import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// POST /api/matches — enregistrer un match
router.post('/', async (req: Request, res: Response) => {
  try {
    const match = new Match(req.body);
    await match.save();
    console.log(`✅ Match enregistré pour ${req.body.league_name}`);
    sendSuccess(res, match, 201, 'Match enregistré');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du match:', error);
    sendError(res, error);
  }
});

// GET /api/matches/:league_id? — récupérer les derniers matchs
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const query = id ? { league_id: parseInt(id) } : {};
    const matches = await Match.find(query).sort({ timestamp: -1 }).limit(10);
    sendSuccess(res, matches);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
