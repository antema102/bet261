# 🏟️ Bet261 — Scraper de Sports Virtuels (Python)

Scraper automatisé qui collecte les données de sports virtuels depuis l'API **Sporty-Tech** (matchs, rounds, résultats, classements) et les envoie au backend Node.js de l'application Bet261.

---

## 📁 Structure du projet

```
python/
├── main.py                  # Point d'entrée principal
├── config.py                # Configuration centralisée (URLs, délais, catégories)
├── api_client.py            # Client HTTP vers l'API externe Sporty-Tech
├── backend_client.py        # Client HTTP vers le backend Node.js local
├── scheduler.py             # Planificateur (exécution unique ou continue)
├── requirements.txt         # Dépendances Python
├── index.py                 # (Legacy) Version monolithique initiale
└── scrapers/
    ├── __init__.py
    └── league_scraper.py    # Orchestration du scraping par ligue
```

---

## ⚙️ Prérequis

- **Python 3.10+**
- **Backend Node.js** démarré sur `http://localhost:3000` (voir `../backend/`)
- **MongoDB** en cours d'exécution sur le port `27017`

---

## 🚀 Installation

### 1. Créer un environnement virtuel

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# ou
source .venv/bin/activate     # Linux / macOS
```

### 2. Installer les dépendances

```bash
pip install -r requirements.txt
```

---

## ▶️ Lancement

### Exécution continue (toutes les 2 minutes par défaut)

```bash
python main.py
```

### Exécution unique (un seul cycle de scraping)

Dans `main.py`, remplacer :

```python
scheduler.run_continuous(interval=DEFAULT_INTERVAL)
```

par :

```python
scheduler.run_once()
```

---

## 🔧 Configuration (`config.py`)

| Variable | Valeur par défaut | Description |
|---|---|---|
| `BASE_URL` | `https://hg-event-api-prod.sporty-tech.net/api/instantleagues` | URL de l'API externe |
| `BACKEND_URL` | `http://localhost:3000/api` | URL du backend Node.js |
| `DEFAULT_INTERVAL` | `120` | Intervalle entre chaque cycle (secondes) |
| `REQUEST_DELAY` | `0.5` | Délai entre chaque requête de round (secondes) |
| `MAX_WORKERS` | `8` | Nombre de ligues scrapées en parallèle |
| `REQUEST_TIMEOUT` | `10` | Timeout des requêtes HTTP (secondes) |

### Ligues scrapées

| Nom | ID |
|---|---|
| English League | 8035 |
| Coupe Afrique | 8060 |
| Champions League | 8056 |
| Italian League | 8036 |
| Spanish League | 8037 |
| French League | 8042 |
| German League | 8043 |
| Portuguese League | 8044 |

---

## 🏗️ Architecture

```
main.py
  └── Scheduler
        └── LeagueScraper (par ligue)
              ├── ApiClient  ──▶  API Sporty-Tech (lecture)
              └── BackendClient ──▶  Backend Node.js (écriture)
```

### Flux de données par ligue

```
1. GET /{league_id}/matches          → POST /api/matches
2. GET /round/{n}?eventCategoryId=X  → POST /api/rounds   (par round)
3. GET /{league_id}/results          → POST /api/results
4. GET /{league_id}/ranking          → POST /api/rankings
```

---

## 📦 Dépendances (`requirements.txt`)

| Package | Version | Rôle |
|---|---|---|
| `requests` | 2.31.0 | Requêtes HTTP |
| `python-dotenv` | 1.0.0 | Chargement de variables d'environnement |

---

## 📋 Modules détaillés

### `ApiClient` (`api_client.py`)
Client HTTP bas niveau vers l'API Sporty-Tech. Toutes les méthodes retournent un `dict` ou `None` en cas d'erreur.

| Méthode | Description |
|---|---|
| `get_matches(league_id)` | Matchs à venir pour une ligue |
| `get_results(league_id, skip, take)` | Résultats passés |
| `get_round_details(round_number, event_category_id)` | Détails et cotes d'un round |
| `get_live_playout(round_number, ...)` | Matchs en cours (playout) |
| `get_ranking(league_id)` | Classement de la ligue |

### `BackendClient` (`backend_client.py`)
Client HTTP vers le backend Node.js local. Expose des méthodes métier qui appellent `POST /api/<endpoint>`.

| Méthode | Endpoint appelé |
|---|---|
| `save_match(...)` | `POST /api/matches` |
| `save_round(...)` | `POST /api/rounds` |
| `save_result(...)` | `POST /api/results` |
| `save_ranking(...)` | `POST /api/rankings` |

### `LeagueScraper` (`scrapers/league_scraper.py`)
Orchestre l'ensemble des appels API et des sauvegardes pour une ligue donnée via `process(league_name, league_id)`.

### `Scheduler` (`scheduler.py`)
Lance les cycles de scraping **en parallèle** via `ThreadPoolExecutor`.

| Méthode | Description |
|---|---|
| `run_once()` | Exécute un seul cycle sur toutes les ligues (en parallèle) |
| `run_continuous(interval)` | Boucle infinie avec délai entre chaque cycle |

---

## 🛑 Arrêt du scraper

Appuyer sur **`Ctrl+C`** dans le terminal pour arrêter proprement le scraper continu.

---

## 🐛 Logs

Les logs sont affichés dans la console au format :

```
2026-03-24 22:27:03,945 - INFO  - Démarrage du scraping continu (intervalle : 120s)
2026-03-24 22:27:04,100 - INFO  - === Traitement de English_League (ID: 8035) ===
2026-03-24 22:27:04,500 - INFO  - Données envoyées avec succès à matches
```

Les erreurs de connexion (backend ou API externe) sont loggées sans interrompre le cycle.
