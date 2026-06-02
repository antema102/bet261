import { Document } from 'mongoose';

export interface IExtractedMatch {
  matchId?: number;
  name?: string;
  homeTeam?: string;
  awayTeam?: string;
  odds_home?: number;
  odds_draw?: number;
  odds_away?: number;
  homeScore?: number;
  awayScore?: number;
  overUnder?: Array<{ total: string; over: number; under: number }>;
}

export interface IMatch extends Document {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start?: Date;
  odds_data?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  status: 'upcoming' | 'finished';
  timestamp: Date;
  extracted_matches?: IExtractedMatch[];
}

export interface IRanking extends Document {
  league_name: string;
  league_id: number;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
