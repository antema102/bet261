import mongoose, { Schema } from 'mongoose';
import { IResult } from '../types';

const resultSchema = new Schema<IResult>(
  {
    league_name: { type: String, required: true },
    league_id: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Result = mongoose.model<IResult>('Result', resultSchema);
