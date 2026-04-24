import { Router, Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { Match } from '../models/Match';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predictions/upsert
// Sauvegarde (ou met à jour) la prédiction d'un round à une tolérance donnée.
// Appelé automatiquement par le frontend lors du chargement de DailyPage.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const {
      league_name, league_id, round_number, event_category_id,
      expected_start, tolerance, matches,
    } = req.body;

    await Prediction.findOneAndUpdate(
      { league_id, event_category_id, round_number, tolerance },
      {
        $set: {
          league_name,
          league_id,
          round_number,
          event_category_id,
          expected_start: expected_start ? new Date(expected_start) : undefined,
          tolerance,
          matches,
          timestamp: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    sendSuccess(res, { saved: true }, 201);
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions
// Récupère les prédictions sauvegardées (uniquement pour les rounds terminés)
// avec les résultats réels joints depuis la collection Match.
//
// Query params :
//   tolerance  — filtre par tolérance (défaut 0)
//   league_id  — filtre par ligue (optionnel)
//   limit      — nb max de rounds (défaut 50)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tolerance = req.query.tolerance !== undefined
      ? parseFloat(req.query.tolerance as string)
      : 0;
    const leagueId = req.query.league_id ? parseInt(req.query.league_id as string) : null;
    const limit = parseInt(req.query.limit as string) || 50;
    // status: 'finished' (défaut) | 'upcoming' | 'all'
    const statusFilter = (req.query.status as string) || 'finished';

    const filter: Record<string, unknown> = { tolerance };
    if (leagueId) filter.league_id = leagueId;

    const predictions = await Prediction.find(filter)
      .sort({ expected_start: -1 })
      .limit(limit)
      .lean();

    // Joindre avec les rounds MongoDB selon le filtre de statut
    const enriched = (
      await Promise.all(
        predictions.map(async (pred) => {
          const matchQuery: Record<string, unknown> = {
            league_id: pred.league_id,
            event_category_id: pred.event_category_id,
            round_number: pred.round_number,
          };
          if (statusFilter !== 'all') matchQuery.status = statusFilter;

          const match = await Match.findOne(matchQuery).lean();
          if (!match) return null;

          const resultMatches: any[] = (match.result_data as any)?.matches ?? [];
          const resultsById = new Map(resultMatches.map((r: any) => [r.id, r]));

          const enrichedMatches = (pred.matches as any[]).map((m: any, i: number) => {
            const raw =
              m.matchId != null
                ? (resultsById.get(m.matchId) ?? resultMatches[i])
                : resultMatches[i];

            let homeScore: number | null = null;
            let awayScore: number | null = null;

            if (raw) {
              if (typeof raw.homeScore === 'number') {
                homeScore = Math.round(raw.homeScore);
                awayScore = Math.round(raw.awayScore);
              } else if (Array.isArray(raw.goals) && raw.goals.length > 0) {
                const last = raw.goals[raw.goals.length - 1];
                homeScore = Math.round(last.homeScore ?? 0);
                awayScore = Math.round(last.awayScore ?? 0);
              }
            }

            return {
              matchId:   m.matchId,
              matchName: m.matchName,
              homeTeam:  m.homeTeam,
              awayTeam:  m.awayTeam,
              odds:      m.odds,
              prediction: m.prediction,
              result: homeScore !== null && awayScore !== null
                ? { homeScore, awayScore }
                : null,
            };
          });

          return {
            league_name:       pred.league_name,
            league_id:         pred.league_id,
            round_number:      pred.round_number,
            event_category_id: pred.event_category_id,
            expected_start:    pred.expected_start,
            tolerance:         pred.tolerance,
            status:            match.status,
            matches:           enrichedMatches,
          };
        }),
      )
    ).filter(Boolean);

    sendSuccess(res, enriched);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
