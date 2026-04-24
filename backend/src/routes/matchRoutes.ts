import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/matches/upsert
// Crée ou met à jour un match (cotes) identifié par league_id + round_number
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const { league_name, league_id, round_number, event_category_id, expected_start, odds_data } = req.body;

    // Supprime odds_data.round.matches (redondant avec odds_data.matches) pour alléger MongoDB
    let cleanOddsData = odds_data;
    if (odds_data?.round?.matches) {
      const { matches: _dropped, ...roundMeta } = odds_data.round;
      cleanOddsData = { ...odds_data, round: roundMeta };
    }

    const newExpectedStart = expected_start ? new Date(expected_start) : undefined;

    // Clé d'upsert : {league_id + event_category_id + round_number}
    // event_category_id identifie la saison, round_number le round dans la saison
    // Quand la saison se réinitialise (round 30→30→1), event_category_id change → nouveau document
    const match = await Match.findOneAndUpdate(
      { league_id, event_category_id, round_number },
      {
        $set: {
          league_name,
          league_id,
          round_number,
          event_category_id,
          expected_start: newExpectedStart,
          odds_data: cleanOddsData,
          timestamp: new Date(),
        },
        $setOnInsert: { status: 'upcoming', result_data: null },
      },
      { upsert: true, new: true },
    );

    console.log(`✅ Round ${round_number} upserted pour ${league_name}`);
    sendSuccess(res, match, 201, 'Match upserted');
  } catch (error) {
    console.error('❌ Erreur upsert match:', error);
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/matches/update-result
// Met à jour le résultat d'un round terminé (league_id + round_number)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/update-result', async (req: Request, res: Response) => {
  try {
    const { league_id, round_number, event_category_id, result_data } = req.body;

    // Cible le document exact par les 3 champs clés
    const filter: any = event_category_id
      ? { league_id, event_category_id, round_number, status: 'upcoming' }
      : { league_id, round_number, status: 'upcoming' };

    const match = await Match.findOneAndUpdate(
      filter,
      { $set: { result_data, status: 'finished' } },
      { new: true },
    );

    if (!match) {
      // Déjà terminé ou inexistant — pas une erreur bloquante
      res.status(200).json({ success: true, message: 'Déjà terminé ou introuvable' });
      return;
    }

    console.log(`🏁 Résultat enregistré : round ${round_number} (ligue ${league_id})`);
    sendSuccess(res, match, 200, 'Résultat mis à jour');
  } catch (error) {
    console.error('❌ Erreur update-result:', error);
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/matches/pending
// Retourne les matchs upcoming dont expectedStart est déjà passé
// (utilisé par le ResultUpdater pour déclencher l'appel au playout)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const matches = await Match.find({
      status: 'upcoming',
      expected_start: { $lt: now, $ne: null },
    }).sort({ expected_start: 1 });
    sendSuccess(res, matches);
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/matches/cleanup-round-matches
// Migration : supprime odds_data.round.matches (redondant) de tous les documents
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cleanup-round-matches', async (_req: Request, res: Response) => {
  try {
    // Supprime le champ odds_data.round.matches sur tous les documents qui le possèdent
    const result = await Match.updateMany(
      { 'odds_data.round.matches': { $exists: true } },
      { $unset: { 'odds_data.round.matches': '' } },
    );
    sendSuccess(res, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    }, 200, `Migration terminée — ${result.modifiedCount} document(s) nettoyé(s)`);
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/matches/:league_id?
// Récupère les derniers matchs (tous statuts) pour une ligue ou pour toutes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const paramLeagueId = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const queryLeagueId = Array.isArray(req.query.league_id) ? req.query.league_id[0] : req.query.league_id;
    const queryStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const queryLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const leagueId = paramLeagueId ?? queryLeagueId;
    const limit = Math.max(1, parseInt(String(queryLimit ?? '100'), 10) || 100);

    const query: Record<string, any> = {};
    if (leagueId) {
      query.league_id = parseInt(String(leagueId), 10);
    }
    if (queryStatus === 'upcoming' || queryStatus === 'finished') {
      query.status = queryStatus;
    }

    const matches = await Match.find(query).sort({ expected_start: -1 }).limit(limit);
    sendSuccess(res, matches);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
