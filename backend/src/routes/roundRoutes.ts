import { Router, Request, Response } from 'express';
import { Round } from '../models/Round';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// POST /api/rounds — enregistrer un round
router.post('/', async (req: Request, res: Response) => {
  try {
    const round = new Round(req.body);
    await round.save();
    console.log(`✅ Round ${req.body.round_number} enregistré pour ${req.body.league_name}`);
    sendSuccess(res, round, 201, 'Round enregistré');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du round:', error);
    sendError(res, error);
  }
});

// GET /api/rounds/:league_id? — récupérer les rounds
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const query = id ? { league_id: parseInt(id) } : {};
    const rounds = await Round.find(query).sort({ round_number: -1, timestamp: -1 }).limit(20);
    sendSuccess(res, rounds);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
