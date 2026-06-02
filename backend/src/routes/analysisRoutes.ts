import { Router, Request, Response } from "express";
import { Match } from "../models/Match";
import { sendSuccess, sendError } from "../utils/response";
import {
  OddsTriple,
  OverUnderLine,
  extractRoundMatches,
  oddsDistance,
  oddsDistanceSquared,
  oddsKey,
  extractScore,
} from "../helpers/oddsHelpers";

const router = Router();

// ─── Cache en mémoire pour les matchs historiques (TTL = 5 min) ──────────────
type HistoricalMatch = {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start?: Date;
  matchId?: number;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  overUnder: OverUnderLine[];
  result: { homeScore: number; awayScore: number };
};
interface DailyCacheEntry {
  leagueKey: string;
  historicalMatches: HistoricalMatch[];
  historicalByOddsKey: Map<string, HistoricalMatch[]>;
  ts: number;
}
const HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let _dailyCache: DailyCacheEntry | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analysis/similar
// Cherche dans l'historique (matchs finished) ceux dont les cotes 1X2 sont
// Query params :
//   home, draw, away  — cotes 1X2 du match cible (obligatoires)
//   tolerance         — distance max euclidienne (défaut 0.30)
//   limit             — nombre max de résultats (défaut 20)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/similar", async (req: Request, res: Response) => {
  try {
    const home = parseFloat(req.query.home as string);
    const draw = parseFloat(req.query.draw as string);
    const away = parseFloat(req.query.away as string);
    const tolerance =
      req.query.tolerance !== undefined
        ? parseFloat(req.query.tolerance as string)
        : 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const leagueId = req.query.league_id
      ? parseInt(req.query.league_id as string)
      : null;
    const excludeLeagueId = req.query.exclude_league_id
      ? parseInt(req.query.exclude_league_id as string)
      : null;
    const excludeEventCategoryId = req.query.exclude_event_category_id
      ? parseInt(req.query.exclude_event_category_id as string)
      : null;
    const excludeRoundNumber = req.query.exclude_round_number
      ? parseInt(req.query.exclude_round_number as string)
      : null;

    if (isNaN(home) || isNaN(draw) || isNaN(away)) {
      res
        .status(400)
        .json({ success: false, error: "home, draw & away sont requis" });
      return;
    }

    const target: OddsTriple = { home, draw, away };

    // Pré-filtre MongoDB via l'index sur extracted_matches — évite le brute force
    const tol = tolerance;
    const elemMatch =
      tol === 0
        ? { odds_home: home, odds_draw: draw, odds_away: away }
        : {
            odds_home: { $gte: home - tol, $lte: home + tol },
            odds_draw: { $gte: draw - tol, $lte: draw + tol },
            odds_away: { $gte: away - tol, $lte: away + tol },
          };

    // Récupère uniquement les rounds dont au moins un sous-match est dans la plage
    const finishedRounds = await Match.find({
      status: "finished",
      odds_data: { $ne: null },
      result_data: { $ne: null },
      extracted_matches: { $elemMatch: elemMatch },
      ...(leagueId ? { league_id: leagueId } : {}),
    })
      .select(
        "league_name league_id event_category_id round_number expected_start odds_data result_data",
      )
      .sort({ expected_start: -1 })
      .lean();

    const similar: any[] = [];

    for (const round of finishedRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      for (let i = 0; i < subMatches.length; i++) {
        const sm = subMatches[i];
        const dist = oddsDistance(target, sm.odds);
        const isExcluded =
          excludeLeagueId !== null &&
          round.league_id === excludeLeagueId &&
          excludeEventCategoryId !== null &&
          round.event_category_id === excludeEventCategoryId &&
          excludeRoundNumber !== null &&
          round.round_number === excludeRoundNumber;
        if (dist <= tolerance && !isExcluded) {
          const score = extractScore(
            round.result_data,
            sm.matchId,
            sm.oddsId,
            i,
            sm.homeTeam,
            sm.awayTeam,
          );
          similar.push({
            league_name: round.league_name,
            league_id: round.league_id,
            event_category_id: round.event_category_id,
            round_number: round.round_number,
            expected_start: round.expected_start,
            matchName: sm.name,
            homeTeam: sm.homeTeam,
            awayTeam: sm.awayTeam,
            odds: sm.odds,
            overUnder: sm.overUnder,
            distance: Math.round(dist * 1000) / 1000,
            result: score,
          });
        }
      }
    }

    // Trier par distance croissante et limiter
    similar.sort((a, b) => a.distance - b.distance);
    const top = similar.slice(0, limit);

    // Statistiques rapides — calculées uniquement sur les matchs avec résultat connu
    const withResult = top.filter((m) => m.result !== null);
    const total = withResult.length;
    const homeWins = withResult.filter(
      (m) => m.result.homeScore > m.result.awayScore,
    ).length;
    const draws = withResult.filter(
      (m) => m.result.homeScore === m.result.awayScore,
    ).length;
    const awayWins = withResult.filter(
      (m) => m.result.homeScore < m.result.awayScore,
    ).length;

    sendSuccess(res, {
      target: { home, draw, away },
      tolerance,
      league_id: leagueId,
      total,
      stats: {
        homeWinPct: total ? Math.round((homeWins / total) * 100) : 0,
        drawPct: total ? Math.round((draws / total) * 100) : 0,
        awayWinPct: total ? Math.round((awayWins / total) * 100) : 0,
        homeWins,
        draws,
        awayWins,
      },
      matches: top,
    });
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analysis/daily
//
// Query params :
//   tolerance    — distance max (défaut 0.00)
//   league_id    — optionnel, filtre par ligue
//   future_only  — si "true", ne retourne que les rounds dont expected_start > now
//   page         — numéro de page (défaut 1)
//   limit        — rounds par page (défaut 5, max 20)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/daily", async (req: Request, res: Response) => {
  try {
    const tolerance =
      req.query.tolerance !== undefined
        ? parseFloat(req.query.tolerance as string)
        : 0;
    const futureOnly = req.query.future_only === "true";
    const leagueFilter = req.query.league_id
      ? { league_id: parseInt(req.query.league_id as string) }
      : {};

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      20,
      Math.max(1, parseInt(req.query.limit as string) || 5),
    );
    const skip = (page - 1) * limit;
    const timeFilter = futureOnly
      ? { expected_start: { $gt: new Date() } }
      : {};
    const matchQuery = {
      status: "upcoming",
      odds_data: { $ne: null },
      ...leagueFilter,
      ...timeFilter,
    };

    const totalRounds = await Match.countDocuments(matchQuery);
    const upcomingRounds = await Match.find(matchQuery)
      .select(
        "league_name league_id event_category_id round_number expected_start odds_data result_data",
      )
      .sort({ expected_start: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const leagueKey = (leagueFilter as any).league_id?.toString() ?? "*";
    const now = Date.now();

    let historicalMatches: HistoricalMatch[];
    let historicalByOddsKey: Map<string, HistoricalMatch[]>;

    // Utilise le cache si disponible et non expiré pour la même ligue
    if (
      _dailyCache &&
      _dailyCache.leagueKey === leagueKey &&
      now - _dailyCache.ts < HISTORY_CACHE_TTL
    ) {
      historicalMatches = _dailyCache.historicalMatches;
      historicalByOddsKey = _dailyCache.historicalByOddsKey;
    } else {
      const finishedRounds = await Match.find({
        status: "finished",
        odds_data: { $ne: null },
        result_data: { $ne: null },
        ...leagueFilter,
      })
        .select(
          "league_name league_id event_category_id round_number expected_start odds_data result_data",
        )
        .lean();

      historicalMatches = [];

      for (const round of finishedRounds) {
        const subMatches = extractRoundMatches(round.odds_data);
        for (let i = 0; i < subMatches.length; i++) {
          const score = extractScore(
            round.result_data,
            subMatches[i].matchId,
            subMatches[i].oddsId,
            i,
            subMatches[i].homeTeam,
            subMatches[i].awayTeam,
          );
          if (score) {
            historicalMatches.push({
              league_name: round.league_name,
              league_id: round.league_id,
              round_number: round.round_number,
              event_category_id: (round as any).event_category_id,
              expected_start: (round as any).expected_start,
              matchId: subMatches[i].matchId,
              matchName: subMatches[i].name,
              homeTeam: subMatches[i].homeTeam,
              awayTeam: subMatches[i].awayTeam,
              odds: subMatches[i].odds,
              overUnder: subMatches[i].overUnder,
              result: score,
            });
          }
        }
      }

      historicalByOddsKey = new Map<string, HistoricalMatch[]>();
      for (const h of historicalMatches) {
        const key = oddsKey(h.odds);
        const bucket = historicalByOddsKey.get(key);
        if (bucket) bucket.push(h);
        else historicalByOddsKey.set(key, [h]);
      }

      _dailyCache = { leagueKey, historicalMatches, historicalByOddsKey, ts: now };
    }

    const dailyMatches: any[] = [];

    for (const round of upcomingRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      const roundEntry: any = {
        league_name: round.league_name,
        league_id: round.league_id,
        event_category_id: round.event_category_id,
        round_number: round.round_number,
        expected_start: round.expected_start,
        matches: [],
      };

      for (let smIdx = 0; smIdx < subMatches.length; smIdx++) {
        const sm = subMatches[smIdx];
        type SimilarWithDistance = {
          h: (typeof historicalMatches)[number];
          distance: number;
        };
        let similarsWithDist: SimilarWithDistance[] = [];

        if (tolerance === 0) {
          const exact = historicalByOddsKey.get(oddsKey(sm.odds)) ?? [];
          similarsWithDist = exact.map((h) => ({ h, distance: 0 }));
        } else {
          const tolerance2 = tolerance * tolerance;
          const filtered: SimilarWithDistance[] = [];
          for (const h of historicalMatches) {
            const dist2 = oddsDistanceSquared(sm.odds, h.odds);
            if (dist2 <= tolerance2) {
              filtered.push({ h, distance: Math.sqrt(dist2) });
            }
          }
          filtered.sort((a, b) => a.distance - b.distance);
          similarsWithDist = filtered;
        }

        const total = similarsWithDist.length;
        let homeWins = 0;
        let draws = 0;
        let awayWins = 0;
        for (const s of similarsWithDist) {
          if (s.h.result.homeScore > s.h.result.awayScore) homeWins += 1;
          else if (s.h.result.homeScore === s.h.result.awayScore) draws += 1;
          else awayWins += 1;
        }

        const top5 = similarsWithDist.slice(0, 5).map(({ h, distance }) => ({
          matchId: h.matchId,
          round_number: h.round_number,
          league_name: h.league_name,
          expected_start: h.expected_start,
          matchName: h.matchName,
          homeTeam: h.homeTeam,
          awayTeam: h.awayTeam,
          odds: h.odds,
          overUnder: h.overUnder ?? [],
          distance: Math.round(distance * 1000) / 1000,
          result: h.result,
        }));

        if (total > 0) {
          roundEntry.matches.push({
            matchId: sm.matchId,
            name: sm.name,
            homeTeam: sm.homeTeam,
            awayTeam: sm.awayTeam,
            odds: sm.odds,
            overUnder: sm.overUnder,
            result: null,
            prediction: {
              sampleSize: total,
              homeWinPct: total ? Math.round((homeWins / total) * 100) : null,
              drawPct: total ? Math.round((draws / total) * 100) : null,
              awayWinPct: total ? Math.round((awayWins / total) * 100) : null,
            },
            similarMatches: top5,
          });
        }
      }
      if (roundEntry.matches.length > 0) {
        dailyMatches.push(roundEntry);
      }
    }

    sendSuccess(res, {
      tolerance,
      pagination: {
        page,
        limit,
        totalRounds,
        totalPages: Math.ceil(totalRounds / limit),
        hasNextPage: page * limit < totalRounds,
        hasPrevPage: page > 1,
      },
      totalUpcoming: dailyMatches.length,
      rounds: dailyMatches,
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;