// ── Cotes 1X2 ─────────────────────────────────────────────────────────────────
export interface OddsTriple {
  home: number;
  draw: number;
  away: number;
}

// ── Prédiction d'un sous-match ────────────────────────────────────────────────
export interface Prediction {
  sampleSize: number;
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
}

// ── Match similaire (dans similarMatches[]) ───────────────────────────────────
export interface SimilarMatch {
  matchId?: number;
  round_number: number;
  league_name: string;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  distance: number;
  result: { homeScore: number; awayScore: number } | null;
  matchMethod?: string;
}

// ── Sous-match dans un round upcoming (/daily) ────────────────────────────────
export interface DailySubMatch {
  matchId?: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  prediction: Prediction;
  similarMatches: SimilarMatch[];
}

// ── Round upcoming (/daily) ───────────────────────────────────────────────────
export interface DailyRound {
  league_name: string;
  league_id: number;
  event_category_id: number;
  round_number: number;
  expected_start: string;
  matches: DailySubMatch[];
}

// ── Réponse /api/analysis/daily ───────────────────────────────────────────────
export interface DailyResponse {
  tolerance: number;
  totalUpcoming: number;
  rounds: DailyRound[];
}

// ── Sous-match enrichi dans l'historique ─────────────────────────────────────
export interface HistorySubMatch {
  matchId?: number;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  prediction: Prediction;
  homeScore: number | null;
  awayScore: number | null;
  correct: boolean | null;
  bestOutcome: string | null;
}

// ── Round historique (/api/predictions) ──────────────────────────────────────
export interface HistoryRound {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start: string;
  tolerance: number;
  status: string;
  matches: HistorySubMatch[];
}

// ── Résultat de recherche /api/analysis/similar ───────────────────────────────
export interface SimilarResult {
  league_name: string;
  league_id: number;
  event_category_id: number;
  round_number: number;
  expected_start: string;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  distance: number;
  result: { homeScore: number; awayScore: number } | null;
}

export interface SimilarStats {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

export interface SimilarResponse {
  target: OddsTriple;
  tolerance: number;
  total: number;
  stats: SimilarStats;
  matches: SimilarResult[];
}

// ── Ligue (/api/leagues/options) ──────────────────────────────────────────────
export interface LeagueOption {
  league_id: number;
  league_name: string;
}
