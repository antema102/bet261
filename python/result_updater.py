"""Vérification et mise à jour des résultats des rounds terminés.

Ce module tourne toutes les 60 secondes (indépendamment du scraper principal).
Flux :
  1. Interroge GET /api/matches/pending → matchs upcoming dont expectedStart est passé
  2. Essaie d'abord /{league_id}/results (même système d'IDs que /{league_id}/matches)
     → filtre le round par roundNumber
  3. Si absent (round pas encore dans /results), repli sur /round/{n}/playout + matching par index
     (les IDs playout ≠ IDs matches, d'où le fallback positionnel)
  4. Envoie PUT /api/matches/update-result pour passer le round en status 'finished'
"""

import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from api_client import ApiClient
from backend_client import BackendClient
from config import MAX_WORKERS, PLAYOUT_DELAY

logger = logging.getLogger(__name__)


def _team_name(team: dict | str | None) -> str:
    if isinstance(team, dict):
        return str(team.get("name", "")).strip().lower()
    return str(team or "").strip().lower()


def _match_team_key(match: dict) -> str:
    return f"{_team_name(match.get('homeTeam'))}|{_team_name(match.get('awayTeam'))}"


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

    # ── Helpers internes ──────────────────────────────────────────────────────

    @staticmethod
    def _odds_list(odds_data: dict | None) -> list:
        """Retourne la liste ordonnée des matchs stockés dans odds_data."""
        if not odds_data:
            return []
        return (
            odds_data.get("matches")
            or odds_data.get("round", {}).get("matches")
            or []
        )

    @staticmethod
    def _enrich(result_matches: list, odds_data: dict | None, source: str) -> dict:
        """Fusionne les scores (result_matches) avec les métadonnées d'odds_data.

        Matching :
          1. Par ID direct  → fonctionne avec /{league_id}/results (mêmes IDs)
          2. Par index       → fallback playout (IDs simulation ≠ IDs odds)
        """
        odds_list = ResultUpdater._odds_list(odds_data)
        odds_by_id: dict[int, dict] = {m["id"]: m for m in odds_list if m.get("id")}

        enriched = []
        for idx, rm in enumerate(result_matches):
            match_id = rm.get("id")
            goals    = rm.get("goals", [])

            # Score final : champ direct ou dernier but
            home_score = rm.get("homeScore")
            away_score = rm.get("awayScore")
            if home_score is None or away_score is None:
                home_score, away_score = ResultUpdater._final_score(goals)

            # Matching avec odds_data : ID d'abord, index ensuite
            odds_match: dict = odds_by_id.get(match_id, {})
            if not odds_match and idx < len(odds_list):
                odds_match = odds_list[idx]

            home_team = odds_match.get("homeTeam")
            away_team = odds_match.get("awayTeam")
            home_name = (home_team.get("name") if isinstance(home_team, dict) else str(home_team or "")) or "Home"
            away_name = (away_team.get("name") if isinstance(away_team, dict) else str(away_team or "")) or "Away"

            enriched.append({
                "id":        match_id,
                "name":      odds_match.get("name") or f"{home_name} vs {away_name}",
                "homeTeam":  home_name,
                "awayTeam":  away_name,
                "goals":     goals,
                "homeScore": int(home_score),
                "awayScore": int(away_score),
                "_source":   source,
            })

        return {"matches": enriched}

    def _results_from_league_api(self, league_id: int, round_number: int) -> list | None:
        """Récupère les résultats via /{league_id}/results.

        Cet endpoint utilise le même système d'IDs que /{league_id}/matches,
        contrairement à /playout qui utilise des IDs de simulation différents.
        Retourne la liste de matchs du round si trouvé, None sinon.
        """
        data = self.api.get_results(league_id, skip=0, take=10)
        if not data:
            return None

        # Structure 1 : {"rounds": [{"roundNumber": 18, "matches": [...]}]}
        for rnd in data.get("rounds", []):
            rn = rnd.get("roundNumber") or rnd.get("round_number")
            if rn is not None and int(rn) == round_number:
                matches = rnd.get("matches", [])
                if matches:
                    logger.debug("source /results : round %d trouvé (%d matchs)", round_number, len(matches))
                    return matches

        # Structure 2 : liste directe [{..., "round": "18", ...}]
        if isinstance(data, list):
            matches = [m for m in data if str(m.get("round", "")) == str(round_number)]
            if matches:
                return matches

        # Structure 3 : {"data": {"rounds": [...]}}
        for rnd in (data.get("data") or {}).get("rounds", []):
            rn = rnd.get("roundNumber") or rnd.get("round_number")
            if rn is not None and int(rn) == round_number:
                matches = rnd.get("matches", [])
                if matches:
                    return matches

        return None

    def _build_result_data(
        self,
        league_id: int,
        round_number: int,
        event_category_id: int,
        odds_data: dict | None,
    ) -> dict | None:
        """Construit result_data avec la meilleure source disponible.

        Stratégie :
          1. /{league_id}/results  → IDs = IDs /{league_id}/matches → matching parfait par ID
          2. /round/{n}/playout    → IDs simulation ≠ IDs matches   → matching par index
        """
        # ── Stratégie 1 : /results (IDs corrects) ───────────────────────────
        league_matches = self._results_from_league_api(league_id, round_number)
        if league_matches:
            logger.info(
                "Ligue %d R%d — source: /{league_id}/results (%d matchs, IDs corrects)",
                league_id, round_number, len(league_matches),
            )
            return self._enrich(league_matches, odds_data, "league_results")

        # ── Stratégie 2 : fallback /playout (matching positionnel) ──────────
        logger.info(
            "Ligue %d R%d — round absent de /results, repli sur /playout (index)",
            league_id, round_number,
        )
        playout = self.api.get_live_playout(round_number, event_category_id, league_id)
        if not playout:
            return None
        playout_matches = playout.get("matches", [])
        if not playout_matches:
            return None
        return self._enrich(playout_matches, odds_data, "playout_index")

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
            # Passe les paramètres nécessaires aux deux stratégies
            result_data = self._build_result_data(
                league_id, round_number, event_category_id, odds_data
            )

            if not result_data:
                return f"{league_name} R{round_number} — aucun résultat disponible (trop tôt ?)"

            # Refus du fallback positionnel : IDs playout ≠ IDs matches → scores potentiellement mal attribués
            source = result_data.get("matches", [{}])[0].get("_source", "")
            if source == "playout_index":
                logger.info(
                    "Ligue %d R%d — source playout_index ignorée (matching positionnel non fiable)",
                    league_id, round_number,
                )
                return f"{league_name} R{round_number} — ignoré (playout_index, scores non fiables)"

            success = self.backend.update_result(
                league_id, round_number, result_data, event_category_id
            )
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
