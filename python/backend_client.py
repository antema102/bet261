"""Client réutilisable pour envoyer les données scraped vers le backend Node.js."""

import logging
from typing import Optional

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
            logger.error("Erreur POST %s : %s", endpoint, exc)
            return False

    def put(self, endpoint: str, data: dict) -> bool:
        """Met à jour une ressource via PUT. Retourne True si succès."""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.put(
                url,
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            logger.info("Mise à jour réussie : %s", endpoint)
            return True
        except requests.exceptions.RequestException as exc:
            logger.error("Erreur PUT %s : %s", endpoint, exc)
            return False

    def get(self, endpoint: str) -> Optional[dict | list]:
        """Récupère une ressource via GET. Retourne le contenu de 'data' ou None."""
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            body = response.json()
            return body.get("data")
        except requests.exceptions.RequestException as exc:
            logger.error("Erreur GET %s : %s", endpoint, exc)
            return None

    # --- Méthodes métier ---

    def upsert_match(
        self,
        league_name: str,
        league_id: int,
        round_number: int,
        event_category_id: int,
        expected_start: str | None,
        odds_data: dict,
    ) -> bool:
        """Crée ou met à jour un round avec ses cotes (upsert par league_id + event_category_id)."""
        # event_category_id est unique par occurrence de round → préserve l'historique
        return self.post("matches/upsert", {
            "league_name": league_name,
            "league_id": league_id,
            "round_number": round_number,
            "event_category_id": event_category_id,
            "expected_start": expected_start,
            "odds_data": odds_data,
        })

    def update_result(
        self,
        league_id: int,
        round_number: int,
        result_data: dict,
        event_category_id: int | None = None,
    ) -> bool:
        """Met à jour le résultat d'un round terminé (status -> 'finished')."""
        return self.put("matches/update-result", {
            "league_id": league_id,
            "round_number": round_number,
            "event_category_id": event_category_id,
            "result_data": result_data,
        })

    def save_ranking(self, league_name: str, league_id: int, data: dict, timestamp: str) -> bool:
        return self.post("rankings", {
            "league_name": league_name,
            "league_id": league_id,
            "data": data,
            "timestamp": timestamp,
        })

    def get_pending_matches(self) -> list:
        """Récupère les matchs upcoming dont expectedStart est déjà passé.

        Retourne une liste de dicts avec au moins :
          league_id, round_number, event_category_id, league_name
        """
        result = self.get("matches/pending")
        if isinstance(result, list):
            return result
        logger.warning("get_pending_matches : réponse inattendue → %s", type(result))
        return []
        
