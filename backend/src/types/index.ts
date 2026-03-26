import { Document } from 'mongoose';

export interface IMatch extends Document {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start?: Date;
  odds_data?: Record<string, unknown>;   // données brutes du round (cotes, matchs)
  result_data?: Record<string, unknown>; // données résultat une fois le round terminé
  status: 'upcoming' | 'finished';
  timestamp: Date;
}

export interface IRound extends Document {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface IResult extends Document {
  league_name: string;
  league_id: number;
  data: Record<string, unknown>;
  timestamp: Date;
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
