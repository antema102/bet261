"""Configuration centralisée pour le scraper de sports virtuels."""

BASE_URL = "https://hg-event-api-prod.sporty-tech.net/api/instantleagues"

DEFAULT_HEADERS = {
    'referer': 'https://www.bet261.mg/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

BACKEND_URL = "http://127.0.0.1:4000/api"

CATEGORIES: dict[str, int] = {
    'English_League': 8035,
    'Coupe_Afrique': 8060,
    'Champions_League': 8056,
    'Italian_League': 8036,
    'Spanish_League': 8037,
    'French_League': 8042,
    'German_League': 8043,
    'Portuguese_League': 8044,
}

# Intervalle par défaut entre chaque cycle de scraping (en secondes)
DEFAULT_INTERVAL = 120

# Intervalle de vérification des résultats (en secondes)
RESULT_CHECK_INTERVAL = 60

# Délai minimum (en secondes) après expectedStart avant d'appeler l'API playout
# Les matchs virtuels durent ~3 minutes en temps réel → on attend 2 min avant de vérifier
PLAYOUT_DELAY = 120

# Délai entre chaque requête de round pour ne pas surcharger l'API (par ligue)
REQUEST_DELAY = 0.5

# Nombre de ligues scrapées en parallèle (1 thread par ligue)
MAX_WORKERS = 8

# Timeout des requêtes HTTP (en secondes)
REQUEST_TIMEOUT = 10
