"""Script de nettoyage : remet en 'upcoming' les rounds dont les résultats
viennent de playout_index (scores positionnels non fiables).

Usage :
    python fix_playout_index.py [--dry-run]

  --dry-run  Affiche les rounds concernés sans modifier la base.
"""

import sys
import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "bet261")

dry_run = "--dry-run" in sys.argv

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
col    = db["matches"]

# Cherche les rounds finished dont au moins un match a _source = playout_index
query = {
    "status": "finished",
    "result_data.matches": {
        "$elemMatch": {"_source": "playout_index"}
    }
}

docs = list(col.find(query, {"league_name": 1, "league_id": 1, "round_number": 1, "event_category_id": 1}))

if not docs:
    print("✅ Aucun round playout_index trouvé en base.")
else:
    print(f"⚠️  {len(docs)} round(s) avec source playout_index :")
    for d in docs:
        print(f"  - {d.get('league_name')} R{d.get('round_number')} "
              f"(league_id={d.get('league_id')}, cat={d.get('event_category_id')})")

    if dry_run:
        print("\n[dry-run] Aucune modification effectuée.")
    else:
        ids = [d["_id"] for d in docs]
        result = col.update_many(
            {"_id": {"$in": ids}},
            {"$set": {"status": "upcoming", "result_data": None}}
        )
        print(f"\n🔄 {result.modified_count} round(s) remis en 'upcoming' — le ResultUpdater les retraitera via /results.")

client.close()
