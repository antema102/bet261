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
        
        merged_matches = []
        for idx, api_match in enumerate(matches_from_api):
            # Récupère le match correspondant dans odds_data par INDEX
            odds_match = odds_matches[idx] if idx < len(odds_matches) else {}
            
            merged_matches.append({
                "id": api_match.get("id"),                    # ID réel (= playout)
                "odds_id": odds_match.get("id"),              # ID des cotes
                "name": api_match.get("name"),
                "homeTeam": api_match.get("homeTeam"),
                "awayTeam": api_match.get("awayTeam"),
                "entryPointId": api_match.get("entryPointId"),
                "round": api_match.get("round"),
                "expectedStart": api_match.get("expectedStart"),
                "eventBetTypes": odds_match.get("eventBetTypes", []),  # cotes
            })
        
        return {
            "round": odds_data.get("round", {}),
            "matches": merged_matches,
        }

    def process(self, league_name: str, league_id: int) -> None:
        """Traite toutes les données d'une ligue (matchs avec cotes + classement)."""
        logger.info("=== Traitement de %s (ID: %d) ===", league_name, league_id)

        # 1. Récupérer la liste des rounds à venir (avec les VRAIS IDs des matchs)
        matches_data = self.api.get_matches(league_id)
        if matches_data:
            for round_info in matches_data.get("rounds", []):
                round_number      = round_info.get("roundNumber")
                event_category_id = round_info.get("eventCategoryId")
                expected_start    = round_info.get("expectedStart")
                matches_list      = round_info.get("matches", [])  # Matchs avec vrais IDs

                if not round_number or not event_category_id:
                    continue

                # 2. Récupérer les détails du round (cotes)
                odds_data = self.api.get_round_details(round_number, event_category_id)
                if odds_data and matches_list:
                    # Fusionner les vrais IDs de /matches avec les cotes de /round
                    merged_data = self._merge_matches_with_odds(matches_list, odds_data)
                    
                    self.backend.upsert_match(
                        league_name,
                        league_id,
                        round_number,
                        event_category_id,
                        expected_start,
                        merged_data,  # Données fusionnées
                    )
                elif odds_data:
                    # Fallback si pas de matchs dans /matches
                    self.backend.upsert_match(
                        league_name,
                        league_id,
                        round_number,
                        event_category_id,
                        expected_start,
                        odds_data,
                    )

                # Petit délai pour ne pas saturer l'API externe
                time.sleep(REQUEST_DELAY)

        # 3. Récupérer le classement (désactivé)
        # ranking_data = self.api.get_ranking(league_id)
        # if ranking_data:
        #     self.backend.save_ranking(league_name, league_id, ranking_data, self._now())
