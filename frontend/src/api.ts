import axios from 'axios';
import type {
  DailyResponse,
  HistoryRound,
  SimilarResponse,
  LeagueOption,
} from './types';

const api = axios.create({
  baseURL: '/api',
});

// ── /api/analysis/daily ───────────────────────────────────────────────────────
export async function fetchDaily(
  tolerance: number,
  leagueId?: number | null,
): Promise<DailyResponse> {
  const params: Record<string, unknown> = { tolerance };
  if (leagueId) params.league_id = leagueId;
  const res = await api.get<{ data: DailyResponse }>('/analysis/daily', { params });
  return res.data.data;
}

// ── /api/predictions ──────────────────────────────────────────────────────────
export async function fetchHistory(
  tolerance: number,
  leagueId?: number | null,
  limit = 50,
): Promise<HistoryRound[]> {
  const params: Record<string, unknown> = { tolerance, limit, status: 'finished' };
  if (leagueId) params.league_id = leagueId;
  const res = await api.get<{ data: HistoryRound[] }>('/predictions', { params });
  return res.data.data ?? [];
}

// ── /api/analysis/similar ─────────────────────────────────────────────────────
export async function fetchSimilar(
  home: number,
  draw: number,
  away: number,
  tolerance: number,
  leagueId?: number | null,
  limit = 30,
): Promise<SimilarResponse> {
  const params: Record<string, unknown> = { home, draw, away, tolerance, limit };
  if (leagueId) params.league_id = leagueId;
  const res = await api.get<{ data: SimilarResponse }>('/analysis/similar', { params });
  return res.data.data;
}

// ── /api/analysis/daily (future_only=true) ───────────────────────────────────
export async function fetchUpcoming(
  tolerance: number,
  leagueId?: number | null,
): Promise<DailyResponse> {
  const params: Record<string, unknown> = { tolerance, future_only: 'true' };
  if (leagueId) params.league_id = leagueId;
  const res = await api.get<{ data: DailyResponse }>('/analysis/daily', { params });
  return res.data.data;
}

// ── /api/leagues/options ──────────────────────────────────────────────────────
export async function fetchLeagues(): Promise<LeagueOption[]> {
  const res = await api.get<{ data: LeagueOption[] }>('/leagues/options');
  return res.data.data ?? [];
}
