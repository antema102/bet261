import mongoose, { Schema } from 'mongoose';
import { IMatch } from '../types';

const matchSchema = new Schema<IMatch>(
  {
    league_name: { type: String, required: true },
    league_id: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Match = mongoose.model<IMatch>('Match', matchSchema);
