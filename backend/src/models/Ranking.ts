import mongoose, { Schema } from 'mongoose';
import { IRanking } from '../types';

const rankingSchema = new Schema<IRanking>(
  {
    league_name: { type: String, required: true },
    league_id: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Ranking = mongoose.model<IRanking>('Ranking', rankingSchema);
