import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface OddsTriple { home: number; draw: number; away: number }
interface OverUnderLine { total: string; over: number; under: number }

function getStoredMatches(oddsData: any): any[] {
  if (Array.isArray(oddsData?.matches) && oddsData.matches.length > 0) {
    return oddsData.matches;
  }
  if (Array.isArray(oddsData?.round?.matches)) {
    return oddsData.round.matches;
  }
  if (Array.isArray(oddsData?.matches)) {
    return oddsData.matches;
  }
  return [];
}

/**
 * Extrait les cotes 1X2 d'un match individuel (à l'intérieur de odds_data.round.matches[])
 */
function extract1X2(eventBetTypes: any[]): OddsTriple | null {
  if (!eventBetTypes) return null;
  const bt = eventBetTypes.find((b: any) => b.name === '1X2');
  if (!bt?.eventBetTypeItems) return null;
  const items = bt.eventBetTypeItems;
  const home = items.find((i: any) => i.shortName === '1')?.odds;
  const draw = items.find((i: any) => i.shortName === 'X')?.odds;
  const away = items.find((i: any) => i.shortName === '2')?.odds;
  if (home == null || draw == null || away == null) return null;
  return { home, draw, away };
}

/**
 * Extrait les cotes Over/Under (+/-) d'un match
 */
function extractOverUnder(eventBetTypes: any[]): OverUnderLine[] {
  if (!Array.isArray(eventBetTypes)) return [];
  const result: OverUnderLine[] = [];
  for (const bt of eventBetTypes) {
    if (bt.name !== '+/-') continue;
    let total = '';
    try { total = JSON.parse(bt.betTypeContext ?? '{}')?.total ?? ''; } catch { /**/ }
    if (total !== '2.5') continue;  // uniquement Over/Under 2.5
    const items: any[] = bt.eventBetTypeItems ?? [];
    const overItem  = items.find((i: any) => String(i.shortName ?? '').startsWith('>'));
    const underItem = items.find((i: any) => String(i.shortName ?? '').startsWith('<'));
    if (overItem && underItem) {
      result.push({ total, over: overItem.odds, under: underItem.odds });
    }
  }
  return result;
}

/**
 * Extrait tous les sous-matchs d'un round avec leurs cotes 1X2
 */
function extractRoundMatches(oddsData: any): Array<{
  matchId: number;
  oddsId?: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  overUnder: OverUnderLine[];
}> {
  const matches = getStoredMatches(oddsData);
  const result: any[] = [];
  for (const m of matches) {
    const odds = extract1X2(m.eventBetTypes);
    if (odds) {
      result.push({
        matchId: m.id,
        oddsId: m.odds_id,
        name: m.name ?? `${m.homeTeam?.name ?? '?'} vs ${m.awayTeam?.name ?? '?'}`,
        homeTeam: m.homeTeam?.name ?? '?',
        awayTeam: m.awayTeam?.name ?? '?',
        odds,
        overUnder: extractOverUnder(m.eventBetTypes),
      });
    }
  }
  return result;
}

/**
 * Distance euclidienne entre deux triplets de cotes
 */
function oddsDistance(a: OddsTriple, b: OddsTriple): number {
  return Math.sqrt(
    (a.home - b.home) ** 2 +
    (a.draw - b.draw) ** 2 +
    (a.away - b.away) ** 2,
  );
}

/**
 * Clé de matching par noms d'équipes (insensible à la casse)
 */
function teamKey(homeTeam: any, awayTeam: any): string {
  const h = (typeof homeTeam === 'object' ? homeTeam?.name : homeTeam) ?? '';
  const a = (typeof awayTeam === 'object' ? awayTeam?.name : awayTeam) ?? '';
  return `${String(h).trim().toLowerCase()}|${String(a).trim().toLowerCase()}`;
}

/**
 * Extrait le score final depuis result_data.
 * Stratégie de matching (dans l'ordre) :
 *   1. Par matchId direct
 *   2. Par noms d'équipes (homeTeam|awayTeam)
 *   3. Par index positionnel (dernier recours)
 */
function extractScore(
  resultData: any,
  matchId: number,
  oddsId: number | undefined,
  index: number,
  homeTeam?: string,
  awayTeam?: string,
): { homeScore: number; awayScore: number; matchMethod: string } | null {
  if (!resultData?.matches) return null;
  const rms: any[] = resultData.matches;

  // 1. Par matchId
  let rm = rms.find((m: any) => m.id === matchId);
  let method = 'id';

  // 2. Par noms d'équipes
  if (!rm && homeTeam && awayTeam) {
    const key = teamKey(homeTeam, awayTeam);
    rm = rms.find((m: any) => teamKey(m.homeTeam, m.awayTeam) === key);
    if (rm) method = 'name';
  }

  // 3. Par index positionnel
  if (!rm && index < rms.length) {
    rm = rms[index];
    method = 'index';
  }

  if (!rm) return null;

  if (typeof rm.homeScore === 'number' && typeof rm.awayScore === 'number') {
    return { homeScore: rm.homeScore, awayScore: rm.awayScore, matchMethod: method };
  }
  const goals = rm.goals ?? [];
  if (goals.length === 0) return { homeScore: 0, awayScore: 0, matchMethod: method };
  const last = goals[goals.length - 1];
  return {
    homeScore: Math.round(last.homeScore ?? 0),
    awayScore: Math.round(last.awayScore ?? 0),
    matchMethod: method,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analysis/similar
// Cherche dans l'historique (matchs finished) ceux dont les cotes 1X2 sont
// proches des cotes fournies en query.
//
// Query params :
//   home, draw, away  — cotes 1X2 du match cible (obligatoires)
//   tolerance         — distance max euclidienne (défaut 0.30)
//   limit             — nombre max de résultats (défaut 20)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/similar', async (req: Request, res: Response) => {
  try {
    const home  = parseFloat(req.query.home as string);
    const draw  = parseFloat(req.query.draw as string);
    const away  = parseFloat(req.query.away as string);
    const tolerance = req.query.tolerance !== undefined ? parseFloat(req.query.tolerance as string) : 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const leagueId = req.query.league_id ? parseInt(req.query.league_id as string) : null;
    const excludeLeagueId = req.query.exclude_league_id ? parseInt(req.query.exclude_league_id as string) : null;
    const excludeEventCategoryId = req.query.exclude_event_category_id ? parseInt(req.query.exclude_event_category_id as string) : null;
    const excludeRoundNumber = req.query.exclude_round_number ? parseInt(req.query.exclude_round_number as string) : null;

    if (isNaN(home) || isNaN(draw) || isNaN(away)) {
      res.status(400).json({ success: false, error: 'home, draw & away sont requis' });
      return;
    }

    const target: OddsTriple = { home, draw, away };

    // Récupère tous les rounds finished ayant des odds_data
    const finishedRounds = await Match.find({
      status: 'finished',
      odds_data: { $ne: null },
      result_data: { $ne: null },
      ...(leagueId ? { league_id: leagueId } : {}),
    })
      .select('league_name league_id event_category_id round_number expected_start odds_data result_data')
      .sort({ expected_start: -1 })
      .lean();

    // Pour chaque round, extraire chaque sous-match et vérifier la distance
    const similar: any[] = [];

    for (const round of finishedRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      for (let i = 0; i < subMatches.length; i++) {
        const sm = subMatches[i];
        const dist = oddsDistance(target, sm.odds);
        const isExcluded =
          excludeLeagueId !== null && round.league_id === excludeLeagueId &&
          excludeEventCategoryId !== null && round.event_category_id === excludeEventCategoryId &&
          excludeRoundNumber !== null && round.round_number === excludeRoundNumber;
        if (dist <= tolerance && !isExcluded) {
          const score = extractScore(round.result_data, sm.matchId, sm.oddsId, i, sm.homeTeam, sm.awayTeam);
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
    const withResult = top.filter(m => m.result !== null);
    const total      = withResult.length;
    const homeWins   = withResult.filter(m => m.result.homeScore > m.result.awayScore).length;
    const draws      = withResult.filter(m => m.result.homeScore === m.result.awayScore).length;
    const awayWins   = withResult.filter(m => m.result.homeScore < m.result.awayScore).length;

    sendSuccess(res, {
      target: { home, draw, away },
      tolerance,
      league_id: leagueId,
      total,
      stats: {
        homeWinPct: total ? Math.round((homeWins / total) * 100) : 0,
        drawPct:    total ? Math.round((draws / total) * 100) : 0,
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
// Retourne les matchs à venir (upcoming) avec, pour chaque sous-match, les
// probabilités estimées basées sur l'historique des cotes similaires.
//
// Query params :
//   tolerance    — distance max (défaut 0.30)
//   league_id    — optionnel, filtre par ligue
//   future_only  — si "true", ne retourne que les rounds dont expected_start > now
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const tolerance = req.query.tolerance !== undefined ? parseFloat(req.query.tolerance as string) : 0;
    const futureOnly = req.query.future_only === 'true';
    const leagueFilter = req.query.league_id
      ? { league_id: parseInt(req.query.league_id as string) }
      : {};

    // Filtre temporel : uniquement les rounds dont le début est dans le futur
    const timeFilter = futureOnly ? { expected_start: { $gt: new Date() } } : {};

    // 1. Matchs à venir
    const upcomingRounds = await Match.find({
      status: 'upcoming',
      odds_data: { $ne: null },
      ...leagueFilter,
      ...timeFilter,
    })
      .select('league_name league_id event_category_id round_number expected_start odds_data result_data')
      .sort({ expected_start: 1 })
      .lean();

    // 2. Historique finished pour la comparaison (tous les rounds)
    const finishedRounds = await Match.find({
      status: 'finished',
      odds_data: { $ne: null },
      result_data: { $ne: null },
      ...leagueFilter,
    })
      .select('league_name league_id event_category_id round_number odds_data result_data')
      .sort({ expected_start: -1 })
      .lean();

    // Pré-extraire tous les sous-matchs finished avec leurs scores
    const historicalMatches: Array<{
      league_name: string;
      league_id: number;
      round_number: number;
      event_category_id: number;
      matchId?: number;
      matchName: string;
      homeTeam: string;
      awayTeam: string;
      odds: OddsTriple;      overUnder: OverUnderLine[];      result: { homeScore: number; awayScore: number };
    }> = [];

    for (const round of finishedRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      for (let i = 0; i < subMatches.length; i++) {
        const score = extractScore(round.result_data, subMatches[i].matchId, subMatches[i].oddsId, i, subMatches[i].homeTeam, subMatches[i].awayTeam);
        if (score) {
          historicalMatches.push({
            league_name: round.league_name,
            league_id: round.league_id,
            round_number: round.round_number,
            event_category_id: (round as any).event_category_id,
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

    // 3. Pour chaque match à venir, trouver les similaires et calculer les probas
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
        // Score du sous-match si result_data disponible
        const smScore = (round as any).result_data
          ? extractScore((round as any).result_data, sm.matchId, sm.oddsId, smIdx, sm.homeTeam, sm.awayTeam)
          : null;

        // Évite le spread `...h` (très coûteux en mémoire sur grands tableaux)
        // → filtre d'abord par distance, ne crée les objets résultats qu'à la fin
        const tolerance2 = tolerance * tolerance; // comparaison carré plus rapide
        const filtered: Array<typeof historicalMatches[0] & { distance: number }> = [];
        for (const h of historicalMatches) {
          const dist = oddsDistance(sm.odds, h.odds);
          if (dist <= tolerance) {
            filtered.push({ ...h, distance: dist } as any);
          }
        }
        filtered.sort((a, b) => a.distance - b.distance);

        const similarsWithDist = filtered;
        void tolerance2; // utilisé pour la clarté, la comparaison directe est faite via oddsDistance

        const total = similarsWithDist.length;
        const homeWins = similarsWithDist.filter(s => s.result.homeScore > s.result.awayScore).length;
        const draws    = similarsWithDist.filter(s => s.result.homeScore === s.result.awayScore).length;
        const awayWins = similarsWithDist.filter(s => s.result.homeScore < s.result.awayScore).length;

        const top5 = similarsWithDist.slice(0, 5).map(h => ({
          matchId:     (h as any).matchId,
          round_number: h.round_number,
          league_name: h.league_name,
          matchName:   h.matchName,
          homeTeam:    h.homeTeam,
          awayTeam:    h.awayTeam,
          odds:        h.odds,
          overUnder:   (h as any).overUnder ?? [],
          distance:    Math.round(h.distance * 1000) / 1000,
          result:      h.result,
        }));

        roundEntry.matches.push({
          matchId: sm.matchId,
          name: sm.name,
          homeTeam: sm.homeTeam,
          awayTeam: sm.awayTeam,
          odds: sm.odds,
          overUnder: sm.overUnder,
          result: smScore ? { homeScore: smScore.homeScore, awayScore: smScore.awayScore } : null,
          prediction: {
            sampleSize: total,
            homeWinPct: total ? Math.round((homeWins / total) * 100) : null,
            drawPct:    total ? Math.round((draws / total) * 100) : null,
            awayWinPct: total ? Math.round((awayWins / total) * 100) : null,
          },
          similarMatches: top5,
        });
      }

      dailyMatches.push(roundEntry);
    }

    sendSuccess(res, {
      tolerance,
      totalUpcoming: dailyMatches.length,
      rounds: dailyMatches,
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
