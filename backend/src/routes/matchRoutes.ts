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

    const match = await Match.findOneAndUpdate(
      { league_id, round_number },
      {
        $set: {
          league_name,
          league_id,
          round_number,
          event_category_id,
          expected_start: expected_start ? new Date(expected_start) : undefined,
          odds_data,
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
    const { league_id, round_number, result_data } = req.body;

    const match = await Match.findOneAndUpdate(
      { league_id, round_number, status: 'upcoming' }, // ne met à jour que si pas encore terminé
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
// GET /api/matches/:league_id?
// Récupère les derniers matchs (tous statuts) pour une ligue ou pour toutes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const query = id ? { league_id: parseInt(id) } : {};
    const matches = await Match.find(query).sort({ expected_start: -1 }).limit(50);
    sendSuccess(res, matches);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
