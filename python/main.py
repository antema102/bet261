"""Point d'entrée du scraper de sports virtuels."""

import logging

from api_client import ApiClient
from backend_client import BackendClient
from scrapers.league_scraper import LeagueScraper
from result_updater import ResultUpdater
from scheduler import Scheduler
from config import BASE_URL, BACKEND_URL, CATEGORIES, DEFAULT_INTERVAL, RESULT_CHECK_INTERVAL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

if __name__ == "__main__":
    api_client      = ApiClient(base_url=BASE_URL)
    backend_client  = BackendClient(base_url=BACKEND_URL)
    league_scraper  = LeagueScraper(api_client=api_client, backend_client=backend_client)
    result_updater  = ResultUpdater(api_client=api_client, backend_client=backend_client, categories=CATEGORIES)
    scheduler       = Scheduler(scraper=league_scraper, result_updater=result_updater, categories=CATEGORIES)

    # Deux boucles en parallèle :
    #   - Scraping des cotes  toutes les 120s
    #   - Vérif. résultats   toutes les  60s
    scheduler.run_continuous(
        scraper_interval=DEFAULT_INTERVAL,
        result_interval=RESULT_CHECK_INTERVAL,
    )

    # Pour une exécution unique, remplacer par :
    # scheduler.run_once()
