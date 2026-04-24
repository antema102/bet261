import mongoose, { Schema } from "mongoose";
import { IMatch } from "../types";

const matchSchema = new Schema<IMatch>(
  {
    league_name:       { type: String, required: true },
    league_id:         { type: Number, required: true },
    round_number:      { type: Number, required: true },
    event_category_id: { type: Number, required: true },
    expected_start:    { type: Date },
    odds_data:         { type: Schema.Types.Mixed, default: null },
    result_data:       { type: Schema.Types.Mixed, default: null },
    status:            { type: String, enum: ['upcoming', 'finished'], default: 'upcoming' },
    timestamp:         { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Clé unique : une entrée par round par saison
// event_category_id change à chaque nouvelle saison, round_number est le numéro dans la saison
matchSchema.index({ league_id: 1, event_category_id: 1, round_number: 1 }, { unique: true });

export const Match = mongoose.model<IMatch>("Match", matchSchema);
