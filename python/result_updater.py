"""Vérification et mise à jour des résultats des rounds terminés via l'API playout.

Ce module tourne toutes les 60 secondes (indépendamment du scraper principal).
Flux :
  1. Interroge GET /api/matches/pending → matchs upcoming dont expectedStart est passé
  2. Pour chaque match, appelle l'API playout :
       /round/{roundNumber}/playout?eventCategoryId={ecId}&parentEventCategoryId={leagueId}
  3. Extrait le score final de chaque match (dernier but dans 'goals', ou 0-0 si pas de but)
  4. Match les résultats avec odds_data par ID (les IDs sont identiques entre /matches et /playout)
  5. Envoie PUT /api/matches/update-result pour passer le round en status 'finished'
"""

import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from api_client import ApiClient
from backend_client import BackendClient
from config import MAX_WORKERS, PLAYOUT_DELAY

logger = logging.getLogger(__name__)


class ResultUpdater:
    """Vérifie les résultats des rounds terminés et les enregistre via l'API playout."""

    def __init__(
        self,
        api_client: ApiClient,
        backend_client: BackendClient,
        categories: dict[str, int],  # conservé pour compatibilité (non utilisé ici)
    ) -> None:
        self.api        = api_client
        self.backend    = backend_client
        self.categories = categories

    # ── Extraction des scores ──────────────────────────────────────────────────

    @staticmethod
    def _final_score(goals: list) -> tuple[int, int]:
        """Retourne (homeScore, awayScore) du dernier but, ou (0, 0) si aucun but."""
        if not goals:
            return 0, 0
        last = goals[-1]
        return int(last.get("homeScore", 0)), int(last.get("awayScore", 0))

    def _build_result_data(self, playout: dict, odds_data: dict | None) -> dict:
        """Construit result_data à partir du playout, en matchant par ID.

        IMPORTANT : Après la fusion dans le scraper, les IDs dans odds_data.matches
        correspondent aux IDs de /playout. On peut donc matcher par ID directement.

        Structure stockée :
          {
            "matches": [
              {
                "id": 63105797,               # ID commun (/matches = /playout)
                "name": "Spurs vs Leeds",
                "homeTeam": "Spurs",
                "awayTeam": "Leeds",
                "goals": [...],
                "homeScore": <score final>,
                "awayScore": <score final>
              },
              ...
            ]
          }
        """
        # Construit un dict {id: match_info} depuis odds_data pour lookup rapide
        odds_by_id = {}
        if odds_data:
            for m in odds_data.get("matches", []):
                if m.get("id"):
                    odds_by_id[m["id"]] = m

        enriched = []
        playout_matches = playout.get("matches", [])

        for match in playout_matches:
            match_id = match.get("id")
            goals = match.get("goals", [])
            home, away = self._final_score(goals)

            # Cherche le match correspondant dans odds_data par ID
            odds_match = odds_by_id.get(match_id, {})

            enriched.append({
                "id":        match_id,
                "name":      odds_match.get("name", f"Match {match_id}"),
                "homeTeam":  odds_match.get("homeTeam", {}).get("name", "Home"),
                "awayTeam":  odds_match.get("awayTeam", {}).get("name", "Away"),
                "goals":     goals,
                "homeScore": home,
                "awayScore": away,
            })

        return {"matches": enriched}

    # ── Traitement d'un seul match ─────────────────────────────────────────────

    def _update_match(self, match: dict) -> str:
        """Appelle l'API playout pour un match pending et met à jour le backend."""
        league_name       = match.get("league_name", "?")
        league_id         = match.get("league_id")
        round_number      = match.get("round_number")
        event_category_id = match.get("event_category_id")
        expected_start    = match.get("expected_start")
        odds_data         = match.get("odds_data")  # Récupère odds_data pour matcher les IDs

        # Vérification du délai minimum après expectedStart
        if expected_start:
            try:
                start_dt = datetime.fromisoformat(
                    expected_start.replace("Z", "+00:00")
                )
                now = datetime.now(timezone.utc)
                elapsed = (now - start_dt).total_seconds()
                if elapsed < PLAYOUT_DELAY:
                    return (
                        f"{league_name} R{round_number} — trop tôt "
                        f"({int(PLAYOUT_DELAY - elapsed)}s restantes)"
                    )
            except (ValueError, AttributeError):
                pass  # On continue si la date n'est pas parsable

        try:
            playout = self.api.get_live_playout(
                round_number, event_category_id, league_id
            )
            if not playout:
                return f"{league_name} R{round_number} — pas de réponse playout"

            matches = playout.get("matches", [])
            if not matches:
                return f"{league_name} R{round_number} — playout vide (match pas encore joué ?)"

            # Passe odds_data pour matcher par ID
            result_data = self._build_result_data(playout, odds_data)

            success = self.backend.update_result(league_id, round_number, result_data)
            if success:
                scores_summary = ", ".join(
                    f"{m['homeScore']}-{m['awayScore']}"
                    for m in result_data["matches"]
                )
                return f"{league_name} R{round_number} ✅  [{scores_summary}]"
            return f"{league_name} R{round_number} — déjà finished (skipped)"

        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Erreur playout %s R%s : %s", league_name, round_number, exc)
            return f"{league_name} R{round_number} ❌ ({exc})"

    # ── Point d'entrée ─────────────────────────────────────────────────────────

    def run(self) -> None:
        """Récupère les matchs pending et les met à jour via l'API playout."""
        pending = self.backend.get_pending_matches()

        if not pending:
            logger.info("🔄 Aucun match pending à mettre à jour")
            return

        logger.info("🔄 Mise à jour de %d match(s) pending via playout...", len(pending))

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self._update_match, match): match.get("round_number")
                for match in pending
            }
            for future in as_completed(futures):
                logger.info("  → %s", future.result())
