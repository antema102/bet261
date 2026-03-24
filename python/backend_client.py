"""Client réutilisable pour envoyer les données scraped vers le backend Node.js."""

import logging

import requests

from config import BACKEND_URL, REQUEST_TIMEOUT

logger = logging.getLogger(__name__)


class BackendClient:
    """Composant réutilisable pour poster des données vers le backend Express."""

    def __init__(self, base_url: str = BACKEND_URL, timeout: int = REQUEST_TIMEOUT) -> None:
        self.base_url = base_url
        self.timeout = timeout

    def post(self, endpoint: str, data: dict) -> bool:
        """Envoie un objet JSON à l'endpoint donné. Retourne True si succès."""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.post(
                url,
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.info("Données envoyées avec succès à %s", endpoint)
            return True
        except requests.exceptions.RequestException as exc:
            logger.error("Erreur lors de l'envoi des données à %s : %s", endpoint, exc)
            return False

    # --- Méthodes métier ---

    def save_match(self, league_name: str, league_id: int, data: dict, timestamp: str) -> bool:
        return self.post("matches", {
            "league_name": league_name,
            "league_id": league_id,
            "data": data,
            "timestamp": timestamp,
        })

    def save_round(
        self,
        league_name: str,
        league_id: int,
        round_number: int,
        event_category_id: int,
        data: dict,
        timestamp: str,
    ) -> bool:
        return self.post("rounds", {
            "league_name": league_name,
            "league_id": league_id,
            "round_number": round_number,
            "event_category_id": event_category_id,
            "data": data,
            "timestamp": timestamp,
        })

    def save_result(self, league_name: str, league_id: int, data: dict, timestamp: str) -> bool:
        return self.post("results", {
            "league_name": league_name,
            "league_id": league_id,
            "data": data,
            "timestamp": timestamp,
        })

    def save_ranking(self, league_name: str, league_id: int, data: dict, timestamp: str) -> bool:
        return self.post("rankings", {
            "league_name": league_name,
            "league_id": league_id,
            "data": data,
            "timestamp": timestamp,
        })
