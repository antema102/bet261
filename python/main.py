"""Point d'entrée du scraper de sports virtuels."""

import logging

from api_client import ApiClient
from backend_client import BackendClient
from scrapers.league_scraper import LeagueScraper
from scheduler import Scheduler
from config import BASE_URL, BACKEND_URL, CATEGORIES, DEFAULT_INTERVAL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

if __name__ == "__main__":
    api_client = ApiClient(base_url=BASE_URL)
    backend_client = BackendClient(base_url=BACKEND_URL)
    league_scraper = LeagueScraper(api_client=api_client, backend_client=backend_client)
    scheduler = Scheduler(scraper=league_scraper, categories=CATEGORIES)

    # Exécution continue toutes les 2 minutes
    scheduler.run_continuous(interval=DEFAULT_INTERVAL)

    # Pour une exécution unique, remplacer par :
    # scheduler.run_once()
