"""Planificateur d'exécution du scraping (cycle unique ou continu).

Deux boucles indépendantes tournent en parallèle :
  - Thread principal  : scraping des cotes toutes les `scraper_interval` secondes (défaut 120s)
  - Thread secondaire : vérification des résultats toutes les `result_interval` secondes (défaut 60s)
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from scrapers.league_scraper import LeagueScraper
from result_updater import ResultUpdater
from config import DEFAULT_INTERVAL, MAX_WORKERS, RESULT_CHECK_INTERVAL

logger = logging.getLogger(__name__)


class Scheduler:
    """Lance le scraping et la vérification des résultats en parallèle."""

    def __init__(
        self,
        scraper: LeagueScraper,
        result_updater: ResultUpdater,
        categories: dict[str, int],
    ) -> None:
        self.scraper         = scraper
        self.result_updater  = result_updater
        self.categories      = categories
        self._stop_event     = threading.Event()

    # ── Scraping principal ─────────────────────────────────────────────────────

    def _scrape_league(self, league_name: str, league_id: int) -> str:
        """Wrapper utilisé par le pool de threads pour scraper une ligue."""
        try:
            self.scraper.process(league_name, league_id)
            return f"{league_name} ✅"
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Erreur scraping %s : %s", league_name, exc)
            return f"{league_name} ❌ ({exc})"

    def _run_scraper_cycle(self) -> None:
        """Scrape toutes les ligues en parallèle (cotes + classement)."""
        logger.info("📡 Scraping des cotes (%d ligues, workers: %d)",
                    len(self.categories), MAX_WORKERS)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self._scrape_league, name, lid): name
                for name, lid in self.categories.items()
            }
            for future in as_completed(futures):
                logger.info("  → %s", future.result())

    # ── Boucle résultats (thread séparé) ──────────────────────────────────────

    def _result_loop(self, interval: int) -> None:
        """Tourne en arrière-plan et vérifie les résultats toutes les `interval` secondes."""
        logger.info("🔁 Thread résultats démarré (intervalle : %ds)", interval)
        while not self._stop_event.is_set():
            start = time.time()
            try:
                self.result_updater.run()
            except Exception as exc:  
                logger.error("Erreur dans le thread résultats : %s", exc)
            elapsed = time.time() - start
            wait_time = max(0.0, interval - elapsed)
            if wait_time > 0:
                self._stop_event.wait(wait_time)

    # ── API publique ──────────────────────────────────────────────────────────

    def run_once(self) -> None:
        """Exécute un seul cycle de scraping puis une vérification des résultats."""
        logger.info("Exécution unique du scraping (parallèle)")
        self._run_scraper_cycle()
        self.result_updater.run()

    def run_continuous(
        self,
        scraper_interval: int = DEFAULT_INTERVAL,
        result_interval: int = RESULT_CHECK_INTERVAL,
    ) -> None:
        """Lance les deux boucles en parallèle.

        - Scraping des cotes  : toutes les `scraper_interval` secondes (défaut 120s)
        - Vérif. des résultats : toutes les `result_interval` secondes (défaut 60s)
        """
        logger.info(
            "🚀 Démarrage — scraping: %ds | résultats: %ds",
            scraper_interval, result_interval,
        )
        self._stop_event.clear()

        # Lancer le thread de vérification des résultats en arrière-plan
        result_thread = threading.Thread(
            target=self._result_loop,
            args=(result_interval,),
            daemon=True,
            name="ResultUpdaterThread",
        )
        result_thread.start()

        # Boucle principale (scraping des cotes)
        while True:
            try:
                start_time = time.time()
                self._run_scraper_cycle()
                elapsed = time.time() - start_time
                logger.info("Cycle scraping terminé en %.2fs", elapsed)

                sleep_time = max(0.0, scraper_interval - elapsed)
                if sleep_time:
                    logger.info("Attente de %.2fs avant le prochain cycle scraping", sleep_time)
                    time.sleep(sleep_time)

            except KeyboardInterrupt:
                logger.info("Arrêt demandé — arrêt du scraper...")
                self._stop_event.set()
                result_thread.join(timeout=5)
                break
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Erreur dans le cycle principal : %s", exc)
                time.sleep(10)

