import mongoose, { Schema, Document } from 'mongoose';

export interface IPrediction extends Document {
  league_name: string;
  league_id: number;
  round_number: number;
  event_category_id: number;
  expected_start?: Date;
  tolerance: number;
  matches: Array<{
    matchId?: number;
    matchName: string;
    homeTeam: string;
    awayTeam: string;
    odds: { home: number; draw: number; away: number };
    prediction: {
      sampleSize: number;
      homeWinPct: number | null;
      drawPct: number | null;
      awayWinPct: number | null;
    };
  }>;
  timestamp: Date;
}

const predictionSchema = new Schema<IPrediction>(
  {
    league_name:       { type: String, required: true },
    league_id:         { type: Number, required: true },
    round_number:      { type: Number, required: true },
    event_category_id: { type: Number, required: true },
    expected_start:    { type: Date },
    tolerance:         { type: Number, required: true },
    matches:           { type: Schema.Types.Mixed, default: [] },
    timestamp:         { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Clé unique : une prédiction par round/saison/tolérance
predictionSchema.index(
  { league_id: 1, event_category_id: 1, round_number: 1, tolerance: 1 },
  { unique: true },
);

export const Prediction = mongoose.model<IPrediction>('Prediction', predictionSchema);
