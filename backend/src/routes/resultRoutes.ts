import { Router, Request, Response } from 'express';
import { Result } from '../models/Result';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// POST /api/results — enregistrer des résultats
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = new Result(req.body);
    await result.save();
    console.log(`✅ Résultats enregistrés pour ${req.body.league_name}`);
    sendSuccess(res, result, 201, 'Résultats enregistrés');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des résultats:', error);
    sendError(res, error);
  }
});

// GET /api/results/:league_id? — récupérer les résultats
router.get('/:league_id?', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.league_id) ? req.params.league_id[0] : req.params.league_id;
    const query = id ? { league_id: parseInt(id) } : {};
    const results = await Result.find(query).sort({ timestamp: -1 }).limit(10);
    sendSuccess(res, results);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
