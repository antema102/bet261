import { Router, Request, Response } from "express";
import { Match } from "../models/Match";
import { sendSuccess, sendError } from "../utils/response";
import { extractRoundMatches, extractScore } from "../helpers/oddsHelpers";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Champs inutiles à supprimer au niveau eventBetType
// ─────────────────────────────────────────────────────────────────────────────
const FIELDS_TO_DROP_BET_TYPE = new Set([
  "minimumAmountIncrement",
  "maximumAmount",
  "active",
  "bettingAllowed",
  "displayPriority",
  "hasExplanations",
  "canBeSimulated",
  "isManual",
]);
const FIELDS_TO_DROP_BET_ITEM = new Set([
  "active",
  "bettingAllowed",
  "canBeSimulated",
]);

/**
 * Ne garde que les cotes 1X2 et Over/Under (+/-) et supprime
 * les champs inutiles pour alléger MongoDB.
 */
function cleanEventBetTypes(eventBetTypes: any[]): any[] {
  if (!Array.isArray(eventBetTypes)) return [];

  return eventBetTypes
    .filter((bt: any) => bt.name === "1X2" || bt.name === "+/-")
    .map((bt: any) => {
      // Supprime les champs inutiles au niveau du bet type
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(bt)) {
        if (!FIELDS_TO_DROP_BET_TYPE.has(k)) cleaned[k] = v;
      }
      // Supprime les champs inutiles dans chaque item
      if (Array.isArray(cleaned.eventBetTypeItems)) {
        cleaned.eventBetTypeItems = cleaned.eventBetTypeItems.map(
          (item: any) => {
            const cleanedItem: Record<string, any> = {};
            for (const [k, v] of Object.entries(item)) {
              if (!FIELDS_TO_DROP_BET_ITEM.has(k)) cleanedItem[k] = v;
            }
            return cleanedItem;
          },
        );
      }
      return cleaned;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/matches/upsert
// Crée ou met à jour un match (cotes) identifié par league_id + round_number
// ─────────────────────────────────────────────────────────────────────────────
router.post("/upsert", async (req: Request, res: Response) => {
  try {
    const {
      league_name,
      league_id,
      round_number,
      event_category_id,
      expected_start,
      odds_data,
    } = req.body;

    // Supprime odds_data.round.matches (redondant avec odds_data.matches) pour alléger MongoDB
    let cleanOddsData = odds_data;
    if (odds_data?.round?.matches) {
      const { matches: _dropped, ...roundMeta } = odds_data.round;
      cleanOddsData = { ...odds_data, round: roundMeta };
    }

    if (Array.isArray(cleanOddsData?.matches)) {
      cleanOddsData = {
        ...cleanOddsData,
        matches: cleanOddsData.matches.map((m: any) => ({
          ...m,
          eventBetTypes: cleanEventBetTypes(m.eventBetTypes),
        })),
      };
    }

    const newExpectedStart = expected_start
      ? new Date(expected_start)
      : undefined;

    // Dénormalise les cotes pour l'indexation MongoDB (similarité)
    const rawMatches = extractRoundMatches(cleanOddsData);
    const extractedMatches = rawMatches.map((m) => ({
      matchId:   m.matchId,
      name:      m.name,
      homeTeam:  m.homeTeam,
      awayTeam:  m.awayTeam,
      odds_home: m.odds.home,
      odds_draw: m.odds.draw,
      odds_away: m.odds.away,
    }));

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
          extracted_matches: extractedMatches,
          timestamp: new Date(),
        },
        $setOnInsert: { status: "upcoming", result_data: null },
      },
      { upsert: true, new: true },
    );

    console.log(`✅ Round ${round_number} upserted pour ${league_name}`);
    sendSuccess(res, match, 201, "Match upserted");
  } catch (error) {
    console.error("❌ Erreur upsert match:", error);
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/matches/update-result
// Met à jour le résultat d'un round terminé (league_id + round_number)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/update-result", async (req: Request, res: Response) => {
  try {
    const { league_id, round_number, event_category_id, result_data } =
      req.body;

    // Cible le document exact par les 3 champs clés
    const filter: any = event_category_id
      ? { league_id, event_category_id, round_number, status: "upcoming" }
      : { league_id, round_number, status: "upcoming" };

    const match = await Match.findOneAndUpdate(
      filter,
      { $set: { result_data, status: "finished" } },
      { new: true },
    );

    if (!match) {
      // Déjà terminé ou inexistant — pas une erreur bloquante
      res
        .status(200)
        .json({ success: true, message: "Déjà terminé ou introuvable" });
      return;
    }

    // Enrichit extracted_matches avec les scores pour éviter de recharger result_data plus tard
    if (Array.isArray(match.extracted_matches) && match.extracted_matches.length > 0) {
      const enriched = match.extracted_matches.map((em, i) => {
        const score = extractScore(
          result_data,
          em.matchId as number,
          undefined,
          i,
          em.homeTeam,
          em.awayTeam,
        );
        return score
          ? { ...em, homeScore: score.homeScore, awayScore: score.awayScore }
          : { ...em };
      });
      await Match.updateOne({ _id: match._id }, { $set: { extracted_matches: enriched } });
    }

    console.log(
      `🏁 Résultat enregistré : round ${round_number} (ligue ${league_id})`,
    );
    sendSuccess(res, match, 200, "Résultat mis à jour");
  } catch (error) {
    console.error("❌ Erreur update-result:", error);
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/matches/pending
// Retourne les matchs upcoming dont expectedStart est déjà passé
// (utilisé par le ResultUpdater pour déclencher l'appel au playout)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pending", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const matches = await Match.find({
      status: "upcoming",
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
router.post("/cleanup-round-matches", async (_req: Request, res: Response) => {
  try {
    // Supprime le champ odds_data.round.matches sur tous les documents qui le possèdent
    const result = await Match.updateMany(
      { "odds_data.round.matches": { $exists: true } },
      { $unset: { "odds_data.round.matches": "" } },
    );
    sendSuccess(
      res,
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
      200,
      `Migration terminée — ${result.modifiedCount} document(s) nettoyé(s)`,
    );
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/matches/cleanup-bet-types
// Migration : sur tous les documents existants, ne garde que 1X2 et +/- dans
// eventBetTypes et supprime les champs inutiles (minimumAmountIncrement, etc.)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/cleanup-bet-types", async (_req: Request, res: Response) => {
  try {
    const docs = await Match.find({ "odds_data.matches": { $exists: true } });
    let modifiedCount = 0;

    for (const doc of docs) {
      const oddsData: any = doc.odds_data;
      if (!Array.isArray(oddsData?.matches)) continue;

      const cleaned = oddsData.matches.map((m: any) => ({
        ...m,
        eventBetTypes: cleanEventBetTypes(m.eventBetTypes),
      }));

      doc.odds_data = { ...oddsData, matches: cleaned };
      doc.markModified("odds_data");
      await doc.save();
      modifiedCount++;
    }

    sendSuccess(
      res,
      { matched: docs.length, modified: modifiedCount },
      200,
      `Migration bet-types — ${modifiedCount} document(s) nettoyé(s)`,
    );
  } catch (error) {
    sendError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/matches/:league_id?
// Récupère les derniers matchs (tous statuts) pour une ligue ou pour toutes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:league_id?", async (req: Request, res: Response) => {
  try {
    const paramLeagueId = Array.isArray(req.params.league_id)
      ? req.params.league_id[0]
      : req.params.league_id;
    const queryLeagueId = Array.isArray(req.query.league_id)
      ? req.query.league_id[0]
      : req.query.league_id;
    const queryStatus = Array.isArray(req.query.status)
      ? req.query.status[0]
      : req.query.status;
    const queryLimit = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : req.query.limit;

    const leagueId = paramLeagueId ?? queryLeagueId;
    const limit = Math.max(1, parseInt(String(queryLimit ?? "100"), 10) || 100);

    const query: Record<string, any> = {};
    if (leagueId) {
      query.league_id = parseInt(String(leagueId), 10);
    }
    if (queryStatus === "upcoming" || queryStatus === "finished") {
      query.status = queryStatus;
    }

    const matches = await Match.find(query)
      .sort({ expected_start: -1 })
      .limit(limit);
    sendSuccess(res, matches);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;