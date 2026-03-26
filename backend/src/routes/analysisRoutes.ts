import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface OddsTriple { home: number; draw: number; away: number }

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
 * Extrait tous les sous-matchs d'un round avec leurs cotes 1X2
 */
function extractRoundMatches(oddsData: any): Array<{
  matchId: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
}> {
  const roundObj = oddsData?.round ?? oddsData;
  const matches = roundObj?.matches ?? [];
  const result: any[] = [];
  for (const m of matches) {
    const odds = extract1X2(m.eventBetTypes);
    if (odds) {
      result.push({
        matchId: m.id,
        name: m.name ?? `${m.homeTeam?.name ?? '?'} vs ${m.awayTeam?.name ?? '?'}`,
        homeTeam: m.homeTeam?.name ?? '?',
        awayTeam: m.awayTeam?.name ?? '?',
        odds,
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
 * Extrait le score final depuis result_data (playout)
 * pour un match identifié par son matchId.
 * Si le matchId n'est pas trouvé, tente par index.
 */
function extractScore(
  resultData: any,
  matchId: number,
  index: number,
): { homeScore: number; awayScore: number } | null {
  if (!resultData?.matches) return null;
  // Tente par matchId d'abord
  let rm = resultData.matches.find((m: any) => m.id === matchId);
  // Sinon, par index (ordre dans le round)
  if (!rm && index < resultData.matches.length) {
    rm = resultData.matches[index];
  }
  if (!rm) return null;
  // Score final = dernier goal, ou 0-0
  const goals = rm.goals ?? [];
  if (goals.length === 0) return { homeScore: 0, awayScore: 0 };
  const last = goals[goals.length - 1];
  return {
    homeScore: Math.round(last.homeScore ?? 0),
    awayScore: Math.round(last.awayScore ?? 0),
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
    const tolerance = parseFloat(req.query.tolerance as string) || 0.30;
    const limit = parseInt(req.query.limit as string) || 20;

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
    }).lean();

    // Pour chaque round, extraire chaque sous-match et vérifier la distance
    const similar: any[] = [];

    for (const round of finishedRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      for (let i = 0; i < subMatches.length; i++) {
        const sm = subMatches[i];
        const dist = oddsDistance(target, sm.odds);
        if (dist <= tolerance) {
          const score = extractScore(round.result_data, sm.matchId, i);
          similar.push({
            league_name: round.league_name,
            league_id: round.league_id,
            round_number: round.round_number,
            expected_start: round.expected_start,
            matchName: sm.name,
            homeTeam: sm.homeTeam,
            awayTeam: sm.awayTeam,
            odds: sm.odds,
            distance: Math.round(dist * 1000) / 1000,
            result: score,
          });
        }
      }
    }

    // Trier par distance croissante et limiter
    similar.sort((a, b) => a.distance - b.distance);
    const top = similar.slice(0, limit);

    // Statistiques rapides
    const total = top.length;
    const homeWins  = top.filter(m => m.result && m.result.homeScore > m.result.awayScore).length;
    const draws     = top.filter(m => m.result && m.result.homeScore === m.result.awayScore).length;
    const awayWins  = top.filter(m => m.result && m.result.homeScore < m.result.awayScore).length;

    sendSuccess(res, {
      target: { home, draw, away },
      tolerance,
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
//   tolerance   — distance max (défaut 0.30)
//   league_id   — optionnel, filtre par ligue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const tolerance = parseFloat(req.query.tolerance as string) || 0.30;
    const leagueFilter = req.query.league_id
      ? { league_id: parseInt(req.query.league_id as string) }
      : {};

    // 1. Matchs à venir
    const upcomingRounds = await Match.find({
      status: 'upcoming',
      odds_data: { $ne: null },
      ...leagueFilter,
    }).sort({ expected_start: 1 }).lean();

    // 2. Historique finished pour la comparaison
    const finishedRounds = await Match.find({
      status: 'finished',
      odds_data: { $ne: null },
      result_data: { $ne: null },
    }).lean();

    // Pré-extraire tous les sous-matchs finished avec leurs scores
    const historicalMatches: Array<{
      odds: OddsTriple;
      result: { homeScore: number; awayScore: number };
    }> = [];

    for (const round of finishedRounds) {
      const subMatches = extractRoundMatches(round.odds_data);
      for (let i = 0; i < subMatches.length; i++) {
        const score = extractScore(round.result_data, subMatches[i].matchId, i);
        if (score) {
          historicalMatches.push({ odds: subMatches[i].odds, result: score });
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
        round_number: round.round_number,
        expected_start: round.expected_start,
        matches: [],
      };

      for (const sm of subMatches) {
        const similars = historicalMatches.filter(
          h => oddsDistance(sm.odds, h.odds) <= tolerance,
        );

        const total = similars.length;
        const homeWins = similars.filter(s => s.result.homeScore > s.result.awayScore).length;
        const draws    = similars.filter(s => s.result.homeScore === s.result.awayScore).length;
        const awayWins = similars.filter(s => s.result.homeScore < s.result.awayScore).length;

        roundEntry.matches.push({
          name: sm.name,
          homeTeam: sm.homeTeam,
          awayTeam: sm.awayTeam,
          odds: sm.odds,
          prediction: {
            sampleSize: total,
            homeWinPct: total ? Math.round((homeWins / total) * 100) : null,
            drawPct:    total ? Math.round((draws / total) * 100) : null,
            awayWinPct: total ? Math.round((awayWins / total) * 100) : null,
          },
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
