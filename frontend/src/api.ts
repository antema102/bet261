const API_BASE = '/api';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? 'Erreur inconnue');
  return body.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OddsTriple {
  home: number;
  draw: number;
  away: number;
}

export interface MatchPrediction {
  name: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  prediction: {
    sampleSize: number;
    homeWinPct: number | null;
    drawPct: number | null;
    awayWinPct: number | null;
  };
}

export interface DailyRound {
  league_name: string;
  league_id: number;
  event_category_id: number;
  round_number: number;
  expected_start: string;
  matches: MatchPrediction[];
}

export interface DailyResponse {
  tolerance: number;
  totalUpcoming: number;
  rounds: DailyRound[];
}

export interface LeagueOption {
  league_id: number;
  league_name: string;
}

export interface SimilarMatch {
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

export interface SimilarResponse {
  target: OddsTriple;
  tolerance: number;
  league_id?: number | null;
  total: number;
  stats: {
    homeWinPct: number;
    drawPct: number;
    awayWinPct: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  };
  matches: SimilarMatch[];
}

export interface MatchDocument {
  _id: string;
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start: string;
  odds_data: any;
  result_data: any;
  status: 'upcoming' | 'finished';
  timestamp: string;
}

export interface StatsData {
  total_matches: number;
  total_rounds: number;
  total_results: number;
  total_rankings: number;
  last_update: { timestamp: string } | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const api = {
  /** Matchs à venir avec prédictions basées sur l'historique */
  getDaily: (tolerance?: number, leagueId?: number) => {
    const params = new URLSearchParams();
    if (tolerance !== undefined) params.set('tolerance', String(tolerance));
    if (leagueId) params.set('league_id', String(leagueId));
    const qs = params.toString();
    return request<DailyResponse>(`/analysis/daily${qs ? `?${qs}` : ''}`);
  },

  /** Matchs historiques avec cotes similaires */
  getSimilar: (
    home: number, draw: number, away: number,
    tolerance?: number, limit?: number, leagueId?: number,
    excludeLeagueId?: number, excludeEventCategoryId?: number, excludeRoundNumber?: number
  ) => {
    const params = new URLSearchParams({
      home: String(home),
      draw: String(draw),
      away: String(away),
    });
    if (tolerance !== undefined) params.set('tolerance', String(tolerance));
    if (limit) params.set('limit', String(limit));
    if (leagueId) params.set('league_id', String(leagueId));
    if (excludeLeagueId !== undefined) params.set('exclude_league_id', String(excludeLeagueId));
    if (excludeEventCategoryId !== undefined) params.set('exclude_event_category_id', String(excludeEventCategoryId));
    if (excludeRoundNumber !== undefined) params.set('exclude_round_number', String(excludeRoundNumber));
    return request<SimilarResponse>(`/analysis/similar?${params}`);
  },

  /** Tous les matchs (ou filtrés par ligue) */
  getMatches: (options?: { leagueId?: number; status?: 'upcoming' | 'finished'; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.leagueId) params.set('league_id', String(options.leagueId));
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return request<MatchDocument[]>(`/matches${qs ? `?${qs}` : ''}`);
  },

  /** Ligues disponibles */
  getLeagues: () => request<LeagueOption[]>('/leagues/options'),

  /** Statistiques globales */
  getStats: () => request<StatsData>('/leagues/stats'),
};
