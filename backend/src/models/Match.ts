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
    extracted_matches: {
      type: [
        {
          matchId:   { type: Number },
          name:      { type: String },
          homeTeam:  { type: String },
          awayTeam:  { type: String },
          odds_home: { type: Number },
          odds_draw: { type: Number },
          odds_away: { type: Number },
          homeScore: { type: Number },
          awayScore: { type: Number },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

matchSchema.index({ league_id: 1, event_category_id: 1, round_number: 1 }, { unique: true });
matchSchema.index({ status: 1, league_id: 1 });
matchSchema.index({ status: 1, expected_start: 1 });
matchSchema.index({ status: 1, league_id: 1, expected_start: 1 });
// Index pour la recherche de similarité par cotes
matchSchema.index({ status: 1, 'extracted_matches.odds_home': 1 });

export const Match = mongoose.model<IMatch>("Match", matchSchema);
