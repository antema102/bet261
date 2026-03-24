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

    def process(self, league_name: str, league_id: int) -> None:
        """Traite toutes les données d'une ligue (matchs, rounds, résultats, classement)."""
        logger.info("=== Traitement de %s (ID: %d) ===", league_name, league_id)

        # 1. Récupérer les matchs actuels
        matches_data = self.api.get_matches(league_id)
        if matches_data:
            self.backend.save_match(league_name, league_id, matches_data, self._now())

            # 2. Récupérer les détails des rounds avec les cotes
            for round_info in matches_data.get("rounds", []):
                round_number = round_info.get("roundNumber")
                event_category_id = round_info.get("eventCategoryId")

                if round_number and event_category_id:
                    round_details = self.api.get_round_details(round_number, event_category_id)
                    if round_details:
                        self.backend.save_round(
                            league_name,
                            league_id,
                            round_number,
                            event_category_id,
                            round_details,
                            self._now(),
                        )
                    time.sleep(REQUEST_DELAY)

        # 3. Récupérer les résultats
        results_data = self.api.get_results(league_id, skip=0, take=10)
        if results_data:
            self.backend.save_result(league_name, league_id, results_data, self._now())

        # 4. Récupérer le classement
        ranking_data = self.api.get_ranking(league_id)
        if ranking_data:
            self.backend.save_ranking(league_name, league_id, ranking_data, self._now())
