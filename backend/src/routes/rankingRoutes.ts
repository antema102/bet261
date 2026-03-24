import { Router, Request, Response } from 'express';
import { Ranking } from '../models/Ranking';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// POST /api/rankings — enregistrer un classement
router.post('/', async (req: Request, res: Response) => {
  try {
    const ranking = new Ranking(req.body);
    await ranking.save();
    console.log(`✅ Classement enregistré pour ${req.body.league_name}`);
    sendSuccess(res, ranking, 201, 'Classement enregistré');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du classement:', error);
    sendError(res, error);
  }
});

// GET /api/rankings/:league_id? — récupérer le classement le plus récent
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const query = id ? { league_id: parseInt(id) } : {};
    const rankings = await Ranking.find(query).sort({ timestamp: -1 }).limit(1);
    sendSuccess(res, rankings);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
