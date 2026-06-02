/**
 * Script de backfill — à exécuter UNE SEULE FOIS.
 * Peuple le champ `extracted_matches` sur tous les documents Match existants
 * qui n'ont pas encore ce champ, en traitant par lots de 500.
 *
 * Usage :
 *   npx ts-node src/scripts/backfill-extracted-matches.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Match } from "../models/Match";
import { extractRoundMatches } from "../helpers/oddsHelpers";

const BATCH_SIZE = 500;

async function backfill(): Promise<void> {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/virtual_sports";
  await mongoose.connect(uri);
  console.log("✅ Connecté à MongoDB");

  const total = await Match.countDocuments({
    odds_data: { $ne: null },
    $or: [
      { extracted_matches: { $exists: false } },
      { extracted_matches: { $size: 0 } },
    ],
  });
  console.log(`📊 ${total} documents à traiter`);

  let processed = 0;
  let cursor = Match.find({
    odds_data: { $ne: null },
    $or: [
      { extracted_matches: { $exists: false } },
      { extracted_matches: { $size: 0 } },
    ],
  })
    .select("_id odds_data")
    .lean()
    .cursor();

  const bulk: Array<{ filter: object; update: object }> = [];

  for await (const doc of cursor) {
    const rawMatches = extractRoundMatches(doc.odds_data as any);
    const extractedMatches = rawMatches.map((m) => ({
      matchId:   m.matchId,
      name:      m.name,
      homeTeam:  m.homeTeam,
      awayTeam:  m.awayTeam,
      odds_home: m.odds.home,
      odds_draw: m.odds.draw,
      odds_away: m.odds.away,
    }));

    bulk.push({
      filter: { _id: doc._id },
      update: { $set: { extracted_matches: extractedMatches } },
    });

    if (bulk.length >= BATCH_SIZE) {
      await Match.bulkWrite(
        bulk.map(({ filter, update }) => ({ updateOne: { filter, update } })),
        { ordered: false },
      );
      processed += bulk.length;
      bulk.length = 0;
      process.stdout.write(`\r  → ${processed}/${total} traités`);
    }
  }

  // Flush le dernier lot
  if (bulk.length > 0) {
    await Match.bulkWrite(
      bulk.map(({ filter, update }) => ({ updateOne: { filter, update } })),
      { ordered: false },
    );
    processed += bulk.length;
  }

  console.log(`\n✅ Backfill terminé — ${processed} documents mis à jour`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error("❌ Erreur backfill:", err);
  process.exit(1);
});
