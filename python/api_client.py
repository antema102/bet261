"""Client HTTP réutilisable pour consommer l'API de sports virtuels."""

import logging
import time
from typing import Optional

import requests

from config import DEFAULT_HEADERS, REQUEST_TIMEOUT, API_RETRIES, API_RETRY_DELAY

logger = logging.getLogger(__name__)


class ApiClient:
    """Composant réutilisable pour effectuer des requêtes HTTP vers l'API externe."""

    def __init__(
        self,
        base_url: str,
        headers: Optional[dict] = None,
        timeout: int = REQUEST_TIMEOUT,
    ) -> None:
        self.base_url = base_url
        self.headers = headers or DEFAULT_HEADERS.copy()
        self.timeout = timeout

    def get(self, path: str, retries: int = API_RETRIES) -> Optional[dict]:
        """Effectue une requête GET avec retry automatique."""
        url = f"{self.base_url}{path}"
        for attempt in range(1, retries + 1):
            try:
                response = requests.get(url, headers=self.headers, timeout=self.timeout)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as exc:
                logger.warning(
                    "Tentative %d/%d échouée pour %s : %s",
                    attempt, retries, url, exc,
                )
                if attempt < retries:
                    time.sleep(API_RETRY_DELAY)
        logger.error("Échec définitif après %d tentatives pour %s", retries, url)
        return None

    # --- Endpoints métier ---

    def get_matches(self, league_id: int) -> Optional[dict]:
        """Récupère les matchs pour une ligue."""
        logger.info("Récupération des matchs pour la ligue %d", league_id)
        return self.get(f"/{league_id}/matches")

    def get_results(self, league_id: int, skip: int = 0, take: int = 4) -> Optional[dict]:
        """Récupère les résultats des matchs."""
        logger.info("Récupération des résultats pour la ligue %d", league_id)
        return self.get(f"/{league_id}/results?skip={skip}&take={take}")

    def get_round_details(self, round_number: int, event_category_id: int) -> Optional[dict]:
        """Récupère les détails d'un round spécifique avec les cotes."""
        logger.info("Récupération des détails du round %d", round_number)
        return self.get(
            f"/round/{round_number}?eventCategoryId={event_category_id}&getNext=false"
        )

    def get_live_playout(
        self,
        round_number: int,
        event_category_id: int,
        parent_event_id: int,
    ) -> Optional[dict]:
        """Récupère les matchs en cours (playout)."""
        logger.info("Récupération du playout du round %d", round_number)
        return self.get(
            f"/round/{round_number}/playout"
            f"?eventCategoryId={event_category_id}"
            f"&parentEventCategoryId={parent_event_id}"
        )

    def get_ranking(self, league_id: int) -> Optional[dict]:
        """Récupère le classement d'une ligue."""
        logger.info("Récupération du classement pour la ligue %d", league_id)
        return self.get(f"/{league_id}/ranking")
