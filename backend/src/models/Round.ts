import mongoose, { Schema } from 'mongoose';
import { IRound } from '../types';

const roundSchema = new Schema<IRound>(
  {
    league_name: { type: String, required: true },
    league_id: { type: Number, required: true },
    round_number: { type: Number, required: true },
    event_category_id: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Round = mongoose.model<IRound>('Round', roundSchema);
