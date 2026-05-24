"""
Analyse des matchs à venir (status=upcoming) :
  - Pour chaque sous-match, recherche dans l'historique les cotes 1X2 similaires
  - Affiche les résultats passés + probabilités estimées
  - Affiche le nom de la ligue

Usage :
    python analyse_daily.py [--tolerance 0.20] [--league_id 8035] [--limit 5]

Exemples :
    python analyse_daily.py
    python analyse_daily.py --tolerance 0.15 --league_id 8035
    python analyse_daily.py --tolerance 0.30 --limit 10
"""

import argparse
import sys
from backend_client import BackendClient
from config import BACKEND_URL

# ── Couleurs ANSI pour le terminal ─────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

def color_result(home: int, away: int) -> str:
    """Colorise le score selon le résultat."""
    score = f"{home}-{away}"
    if home > away:
        return f"{GREEN}{score}{RESET}"
    elif home < away:
        return f"{RED}{score}{RESET}"
    return f"{YELLOW}{score}{RESET}"

def color_pct(pct: int | None, label: str) -> str:
    if pct is None:
        return f"{DIM}{label}: ?%{RESET}"
    if pct >= 60:
        return f"{GREEN}{label}: {pct}%{RESET}"
    elif pct >= 40:
        return f"{YELLOW}{label}: {pct}%{RESET}"
    return f"{RED}{label}: {pct}%{RESET}"

def outcome_label(home: int, away: int) -> str:
    if home > away: return "1"
    if home < away: return "2"
    return "X"


def fetch_daily(backend: BackendClient, tolerance: float, league_id: int | None) -> dict | None:
    """Appelle GET /api/analysis/daily et retourne les données."""
    endpoint = f"analysis/daily?tolerance={tolerance}"
    if league_id:
        endpoint += f"&league_id={league_id}"
    url = f"{backend.base_url}/{endpoint}"
    try:
        import requests
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        body = resp.json()
        return body.get("data")
    except Exception as exc:
        print(f"{RED}❌ Erreur API : {exc}{RESET}")
        return None


def display(data: dict, max_similar: int) -> None:
    rounds: list = data.get("rounds", [])
    tolerance = data.get("tolerance", "?")

    if not rounds:
        print(f"{YELLOW}⚠️  Aucun match upcoming trouvé (base vide ou backend hors ligne){RESET}")
        return

    print(f"\n{BOLD}{'═'*72}{RESET}")
    print(f"{BOLD}  🔍  ANALYSE QUOTIDIENNE  —  tolérance={tolerance}{RESET}")
    print(f"{BOLD}{'═'*72}{RESET}")

    for rnd in rounds:
        league   = rnd.get("league_name", "?")
        r_num    = rnd.get("round_number", "?")
        exp      = rnd.get("expected_start", "")
        exp_str  = exp[:16].replace("T", " ") if exp else "—"
        matches  = rnd.get("matches", [])

        print(f"\n{CYAN}{BOLD}🏆  {league}  —  Round {r_num}  ({exp_str}){RESET}")
        print(f"  {'─'*68}")

        for m in matches:
            name     = m.get("name", f"{m.get('homeTeam','?')} vs {m.get('awayTeam','?')}")
            odds     = m.get("odds", {})
            pred     = m.get("prediction", {})
            similars = m.get("similarMatches", [])
            sample   = pred.get("sampleSize", 0)

            h_pct = pred.get("homeWinPct")
            d_pct = pred.get("drawPct")
            a_pct = pred.get("awayWinPct")

            print(f"\n  {BOLD}⚽  {name}{RESET}")
            print(f"     Cotes 1X2 :  1={BOLD}{odds.get('home','?')}{RESET}  "
                  f"X={BOLD}{odds.get('draw','?')}{RESET}  "
                  f"2={BOLD}{odds.get('away','?')}{RESET}")

            if sample == 0:
                print(f"     {DIM}Aucun historique similaire (tolérance trop stricte ?){RESET}")
            else:
                # Barre de probabilité visuelle
                h_bar = "█" * (h_pct // 5 if h_pct else 0)
                d_bar = "█" * (d_pct // 5 if d_pct else 0)
                a_bar = "█" * (a_pct // 5 if a_pct else 0)

                print(f"     Historique : {sample} match(s) similaire(s)")
                print(f"     {color_pct(h_pct, '1')} {h_bar}   "
                      f"{color_pct(d_pct, 'X')} {d_bar}   "
                      f"{color_pct(a_pct, '2')} {a_bar}")

                # Top N similaires
                top = similars[:max_similar]
                if top:
                    print(f"     {DIM}── Top {len(top)} similaires ──────────────────────────────{RESET}")
                    for s in top:
                        s_name  = s.get("matchName", "?")
                        s_league = s.get("league_name", "?")
                        s_round = s.get("round_number", "?")
                        s_odds  = s.get("odds", {})
                        s_res   = s.get("result")
                        s_dist  = s.get("distance", "?")
                        outcome = outcome_label(
                            s_res.get("homeScore", 0), s_res.get("awayScore", 0)
                        ) if s_res else "?"
                        score_str = color_result(
                            s_res.get("homeScore", 0), s_res.get("awayScore", 0)
                        ) if s_res else f"{DIM}?-?{RESET}"

                        print(f"       {DIM}[{s_league} R{s_round}]{RESET} "
                              f"{s_name:<28} "
                              f"1={s_odds.get('home','?'):4}  X={s_odds.get('draw','?'):4}  2={s_odds.get('away','?'):4}  "
                              f"dist={s_dist}  {score_str}  →{BOLD}{outcome}{RESET}")

        print(f"  {'─'*68}")

    print(f"\n{BOLD}{'═'*72}{RESET}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse des cotes similaires pour les matchs upcoming")
    parser.add_argument("--tolerance", type=float, default=0.20,
                        help="Distance euclidienne max entre cotes (défaut: 0.20)")
    parser.add_argument("--league_id", type=int, default=None,
                        help="Filtre par league_id (optionnel)")
    parser.add_argument("--limit", type=int, default=5,
                        help="Nb de matchs similaires à afficher par sous-match (défaut: 5)")
    args = parser.parse_args()

    backend = BackendClient(base_url=BACKEND_URL)
    data = fetch_daily(backend, tolerance=args.tolerance, league_id=args.league_id)

    if data is None:
        sys.exit(1)

    display(data, max_similar=args.limit)


if __name__ == "__main__":
    main()
