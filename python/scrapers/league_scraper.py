"""Scraper dédié à une ligue — orchestration de l'ensemble des appels API."""

import logging
import time
from datetime import datetime

from api_client import ApiClient
from backend_client import BackendClient
from config import REQUEST_DELAY

logger = logging.getLogger(__name__)


class LeagueScraper:
    """Récupère et sauvegarde toutes les données d'une ligue virtuelle."""

    def __init__(self, api_client: ApiClient, backend_client: BackendClient) -> None:
        self.api = api_client
        self.backend = backend_client

    def _now(self) -> str:
        return datetime.now().isoformat()

    def _merge_matches_with_odds(self, matches_from_api: list, odds_data: dict) -> dict:
        """Fusionne les matchs de /matches (vrais IDs) avec les cotes de /round.
        
        Les IDs de /matches correspondent à ceux de /playout (résultats).
        Les IDs de /round peuvent être différents, donc on garde les deux.
        
        Structure résultante :
          {
            "round": {...},
            "matches": [
              {
                "id": 63105797,           # ID de /matches (= ID playout)
                "odds_id": 63195377,      # ID de /round (pour les cotes)
                "name": "Spurs vs Leeds",
                "homeTeam": {...},
                "awayTeam": {...},
                "eventBetTypes": [...]    # cotes de /round
              },
              ...
            ]
          }
        """
        odds_matches = odds_data.get("round", {}).get("matches", [])

        # Construit un index des matchs de /round par noms d'équipes normalisés
        def _team_key(m: dict) -> str:
            """Clé de matching basée sur les noms d'équipes (insensible à la casse)."""
            home = (m.get("homeTeam") or {}).get("name", "") if isinstance(m.get("homeTeam"), dict) else ""
            away = (m.get("awayTeam") or {}).get("name", "") if isinstance(m.get("awayTeam"), dict) else ""
            return f"{home.strip().lower()}|{away.strip().lower()}"

        def _api_team_key(m: dict) -> str:
            """Clé de matching pour un match de /matches (structure peut différer)."""
            home_obj = m.get("homeTeam", {})
            away_obj = m.get("awayTeam", {})
            home = home_obj.get("name", "") if isinstance(home_obj, dict) else str(home_obj)
            away = away_obj.get("name", "") if isinstance(away_obj, dict) else str(away_obj)
            return f"{home.strip().lower()}|{away.strip().lower()}"

        odds_by_teams = {_team_key(om): om for om in odds_matches}

        merged_matches = []
        for idx, api_match in enumerate(matches_from_api):
            # Tente d'abord le matching par noms d'équipes
            key = _api_team_key(api_match)
            odds_match = odds_by_teams.get(key)
            # Fallback par index si pas trouvé par nom
            if odds_match is None:
                odds_match = odds_matches[idx] if idx < len(odds_matches) else {}
                logger.debug(
                    "Matching par index pour %s (clé '%s' non trouvée)",
                    api_match.get("name"), key,
                )

            # Détermine l'ID réel et l'ID des cotes
            # Si api_match vient de /matches → id=vrai ID (= playout), odds_id=ID round
            # Si api_match vient de /round (fallback) → on utilise le même ID pour les deux
            real_id = api_match.get("id")
            odds_id = odds_match.get("id") if odds_match else real_id

            merged_matches.append({
                "id": real_id,
                "odds_id": odds_id,
                "name": api_match.get("name"),
                "homeTeam": api_match.get("homeTeam"),
                "awayTeam": api_match.get("awayTeam"),
                "entryPointId": api_match.get("entryPointId"),
                "round": api_match.get("round"),
                "expectedStart": api_match.get("expectedStart"),
                "eventBetTypes": odds_match.get("eventBetTypes", []) if odds_match else [],
            })
        
        # Supprime round.matches (redondant avec matches[]) pour alléger MongoDB
        round_meta = {k: v for k, v in odds_data.get("round", {}).items() if k != "matches"}
        return {
            "round": round_meta,
            "matches": merged_matches,
        }

    def process(self, league_name: str, league_id: int) -> None:
        """Traite toutes les données d'une ligue (matchs avec cotes + classement)."""
        logger.info("=== Traitement de %s (ID: %d) ===", league_name, league_id)

        # 1. Récupérer la liste des rounds à venir (avec les VRAIS IDs des matchs)
        matches_data = self.api.get_matches(league_id)
        if not matches_data:
            logger.warning("%s — aucune donnée de matchs reçue (API injoignable ?)", league_name)
            return

        rounds = matches_data.get("rounds", [])
        stored_count = 0
        skipped_count = 0

        logger.info("%s — %d round(s) trouvé(s) dans l'API", league_name, len(rounds))

        for round_info in rounds:
            round_number      = round_info.get("roundNumber")
            event_category_id = round_info.get("eventCategoryId")
            expected_start    = round_info.get("expectedStart")
            matches_list      = round_info.get("matches", [])

            if not round_number or not event_category_id:
                skipped_count += 1
                continue

            # 2. Récupérer les détails du round (cotes)
            odds_data = self.api.get_round_details(round_number, event_category_id)
            if not odds_data:
                logger.warning(
                    "%s R%s — pas de cotes (get_round_details a échoué)",
                    league_name, round_number,
                )
                skipped_count += 1
                time.sleep(REQUEST_DELAY)
                continue

            # Si /matches n'a pas fourni les matchs de ce round (cas courant pour
            # les rounds 2+), on les extrait directement depuis /round/{n}
            if not matches_list:
                matches_list = odds_data.get("round", {}).get("matches", [])

            if matches_list:
                # Fusionner les IDs de /matches (ou /round si fallback) avec les cotes
                merged_data = self._merge_matches_with_odds(matches_list, odds_data)
                self.backend.upsert_match(
                    league_name, league_id, round_number,
                    event_category_id, expected_start, merged_data,
                )
                stored_count += 1
            else:
                logger.warning(
                    "%s R%s — aucun match trouvé ni dans /matches ni dans /round",
                    league_name, round_number,
                )
                skipped_count += 1

            # Petit délai pour ne pas saturer l'API externe
            time.sleep(REQUEST_DELAY)

        logger.info(
            "%s — résumé : %d stocké(s), %d ignoré(s) sur %d round(s)",
            league_name, stored_count, skipped_count, len(rounds),
        )

        # 3. Récupérer le classement (désactivé)
        # ranking_data = self.api.get_ranking(league_id)
        # if ranking_data:
        #     self.backend.save_ranking(league_name, league_id, ranking_data, self._now())
