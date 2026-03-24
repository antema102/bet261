"""Planificateur d'exécution du scraping (cycle unique ou continu)."""

import logging
import time

from scrapers.league_scraper import LeagueScraper
from config import DEFAULT_INTERVAL, LEAGUE_DELAY

logger = logging.getLogger(__name__)


class Scheduler:
    """Lance le scraping une fois ou en boucle continue."""

    def __init__(self, scraper: LeagueScraper, categories: dict[str, int]) -> None:
        self.scraper = scraper
        self.categories = categories

    def _run_cycle(self) -> None:
        """Exécute un cycle complet sur toutes les ligues."""
        for league_name, league_id in self.categories.items():
            self.scraper.process(league_name, league_id)
            time.sleep(LEAGUE_DELAY)

    def run_once(self) -> None:
        """Exécute le scraping une seule fois."""
        logger.info("Exécution unique du scraping")
        self._run_cycle()

    def run_continuous(self, interval: int = DEFAULT_INTERVAL) -> None:
        """Exécute le scraping en continu toutes les `interval` secondes."""
        logger.info("Démarrage du scraping continu (intervalle : %ds)", interval)

        while True:
            try:
                start_time = time.time()
                self._run_cycle()
                elapsed = time.time() - start_time
                logger.info("Cycle terminé en %.2fs", elapsed)

                sleep_time = max(0.0, interval - elapsed)
                if sleep_time:
                    logger.info("Attente de %.2fs avant le prochain cycle", sleep_time)
                    time.sleep(sleep_time)

            except KeyboardInterrupt:
                logger.info("Arrêt du scraper demandé par l'utilisateur")
                break
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Erreur dans le cycle principal : %s", exc)
                time.sleep(10)
