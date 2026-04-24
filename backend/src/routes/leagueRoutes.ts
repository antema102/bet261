import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { Round } from '../models/Round';
import { Result } from '../models/Result';
import { Ranking } from '../models/Ranking';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// GET /api/leagues/options — récupérer les ligues avec id + nom
router.get('/options', async (_req: Request, res: Response) => {
  try {
    const leagues = await Match.aggregate([
      {
        $group: {
          _id: '$league_id',
          league_id: { $first: '$league_id' },
          league_name: { $first: '$league_name' },
        },
      },
      { $sort: { league_name: 1 } },
      { $project: { _id: 0, league_id: 1, league_name: 1 } },
    ]);
    sendSuccess(res, leagues);
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/leagues — récupérer toutes les ligues disponibles
router.get('/', async (_req: Request, res: Response) => {
  try {
    const leagues = await Match.distinct('league_name');
    sendSuccess(res, leagues);
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/stats — statistiques globales
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [total_matches, total_rounds, total_results, total_rankings, last_update] =
      await Promise.all([
        Match.countDocuments(),
        Round.countDocuments(),
        Result.countDocuments(),
        Ranking.countDocuments(),
        Match.findOne().sort({ timestamp: -1 }).select('timestamp'),
      ]);

    sendSuccess(res, { total_matches, total_rounds, total_results, total_rankings, last_update });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
