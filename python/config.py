"""Configuration centralisée pour le scraper de sports virtuels."""

BASE_URL = "https://hg-event-api-prod.sporty-tech.net/api/instantleagues"

DEFAULT_HEADERS = {
    'referer': 'https://www.bet261.mg/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

BACKEND_URL = "http://localhost:3000/api"

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

# Délai entre chaque requête pour ne pas surcharger l'API
REQUEST_DELAY = 0.5

# Délai entre chaque ligue
LEAGUE_DELAY = 1.0

# Timeout des requêtes HTTP (en secondes)
REQUEST_TIMEOUT = 10
