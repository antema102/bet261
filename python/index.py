import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VirtualSportsScraper:
    def __init__(self):
        self.base_url = "https://hg-event-api-prod.sporty-tech.net/api/instantleagues"
        self.headers = {
            'referer': 'https://www.bet261.mg/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        self.categories = {
            'English_League': 8035,
            'Coupe_Afrique': 8060,
            'Champions_League': 8056,
            'Italian_League': 8036,
            'Spanish_League': 8037,
            'French_League': 8042,
            'German_League': 8043,
            'Portuguese_League': 8044
        }
        
        self.backend_url = "http://127.0.0.1:4000/api"  
        
    def fetch_data(self, url: str) -> Optional[Dict]:
        """Récupère les données depuis l'API"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur lors de la récupération des données depuis {url}: {e}")
            return None

    def get_matches(self, league_id: int) -> Optional[Dict]:
        """Récupère les matchs pour une ligue"""
        url = f"{self.base_url}/{league_id}/matches"
        logger.info(f"Récupération des matchs pour la ligue {league_id}")
        return self.fetch_data(url)

    def get_results(self, league_id: int, skip: int = 0, take: int = 4) -> Optional[Dict]:
        """Récupère les résultats des matchs"""
        url = f"{self.base_url}/{league_id}/results?skip={skip}&take={take}"
        logger.info(f"Récupération des résultats pour la ligue {league_id}")
        return self.fetch_data(url)

    def get_round_details(self, round_number: int, event_category_id: int) -> Optional[Dict]:
        """Récupère les détails d'un round spécifique avec les cotes"""
        url = f"{self.base_url}/round/{round_number}?eventCategoryId={event_category_id}&getNext=false"
        logger.info(f"Récupération des détails du round {round_number}")
        return self.fetch_data(url)

    def get_live_playout(self, round_number: int, event_category_id: int, parent_event_id: int) -> Optional[Dict]:
        """Récupère les matchs en cours"""
        url = f"{self.base_url}/round/{round_number}/playout?eventCategoryId={event_category_id}&parentEventCategoryId={parent_event_id}"
        logger.info(f"Récupération du playout du round {round_number}")
        return self.fetch_data(url)

    def get_ranking(self, league_id: int) -> Optional[Dict]:
        """Récupère le classement d'une ligue"""
        url = f"{self.base_url}/{league_id}/ranking"
        logger.info(f"Récupération du classement pour la ligue {league_id}")
        return self.fetch_data(url)

    def send_to_backend(self, endpoint: str, data: Dict) -> bool:
        """Envoie les données au backend Node.js"""
        try:
            response = requests.post(
                f"{self.backend_url}/{endpoint}",
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Données envoyées avec succès à {endpoint}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur lors de l'envoi des données à {endpoint}: {e}")
            return False

    def process_league(self, league_name: str, league_id: int):
        """Traite toutes les données d'une ligue"""
        logger.info(f"=== Traitement de {league_name} (ID: {league_id}) ===")
        
        # 1. Récupérer les matchs actuels
        matches_data = self.get_matches(league_id)
        if matches_data:
            self.send_to_backend('matches', {
                'league_name': league_name,
                'league_id': league_id,
                'data': matches_data,
                'timestamp': datetime.now().isoformat()
            })
            
            # 2. Récupérer les détails des rounds futurs
            if 'rounds' in matches_data:
                for round_info in matches_data['rounds']:
                    round_number = round_info.get('roundNumber')
                    event_category_id = round_info.get('eventCategoryId')
                    
                    if round_number and event_category_id:
                        # Récupérer les cotes pour ce round
                        round_details = self.get_round_details(round_number, event_category_id)
                        if round_details:
                            self.send_to_backend('rounds', {
                                'league_name': league_name,
                                'league_id': league_id,
                                'round_number': round_number,
                                'event_category_id': event_category_id,
                                'data': round_details,
                                'timestamp': datetime.now().isoformat()
                            })
                        
                        # Petit délai pour ne pas surcharger l'API
                        time.sleep(0.5)
        
        # 3. Récupérer les résultats
        results_data = self.get_results(league_id, skip=0, take=10)
        if results_data:
            self.send_to_backend('results', {
                'league_name': league_name,
                'league_id': league_id,
                'data': results_data,
                'timestamp': datetime.now().isoformat()
            })
        
        # # 4. Récupérer le classement
        # ranking_data = self.get_ranking(league_id)

        # if ranking_data:
        #     self.send_to_backend('rankings', {
        #         'league_name': league_name,
        #         'league_id': league_id,
        #         'data': ranking_data,
        #         'timestamp': datetime.now().isoformat()
        #     })

        # 5 .Récupérer les matchs en cours (playout)
        if matches_data and 'rounds' in matches_data:
            for round_info in matches_data['rounds']:
                round_number = round_info.get('roundNumber')
                event_category_id = round_info.get('eventCategoryId')
                parent_event_id = round_info.get('parentEventCategoryId')
                
                if round_number and event_category_id and parent_event_id:
                    playout_data = self.get_live_playout(round_number, event_category_id, parent_event_id)
                    if playout_data:
                        self.send_to_backend('playouts', {
                            'league_name': league_name,
                            'league_id': league_id,
                            'round_number': round_number,
                            'event_category_id': event_category_id,
                            'parent_event_id': parent_event_id,
                            'data': playout_data,
                            'timestamp': datetime.now().isoformat()
                        })
                    
                    # Petit délai pour ne pas surcharger l'API
                    time.sleep(0.5)

    def run_continuous(self, interval: int = 120):
        """Exécute le scraping en continu toutes les X secondes"""
        logger.info(f"Démarrage du scraping continu (intervalle: {interval}s)")
        
        while True:
            try:
                start_time = time.time()
                
                for league_name, league_id in self.categories.items():
                    self.process_league(league_name, league_id)
                    time.sleep(1)  # Délai entre chaque ligue
                
                elapsed_time = time.time() - start_time
                logger.info(f"Cycle terminé en {elapsed_time:.2f}s")
                
                # Attendre jusqu'au prochain cycle
                if elapsed_time < interval:
                    sleep_time = interval - elapsed_time
                    logger.info(f"Attente de {sleep_time:.2f}s avant le prochain cycle")
                    time.sleep(sleep_time)
                    
            except KeyboardInterrupt:
                logger.info("Arrêt du scraper demandé par l'utilisateur")
                break
            except Exception as e:
                logger.error(f"Erreur dans le cycle principal: {e}")
                time.sleep(10)  # Attendre 10s en cas d'erreur

    def run_once(self):
        """Exécute le scraping une seule fois"""
        logger.info("Exécution unique du scraping")
        for league_name, league_id in self.categories.items():
            self.process_league(league_name, league_id)
            time.sleep(1)

if __name__ == "__main__":
    scraper = VirtualSportsScraper()
    
    # Pour une exécution continue (toutes les 2 minutes)
    scraper.run_continuous(interval=120)
    
    # Pour une exécution unique, utiliser:
    # scraper.run_once()