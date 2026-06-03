import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./utils/db";
import matchRoutes from "./routes/matchRoutes";
import rankingRoutes from "./routes/rankingRoutes";
import leagueRoutes from "./routes/leagueRoutes";
import analysisRoutes, { warmDailyCache } from "./routes/analysisRoutes";
import predictionRoutes from "./routes/predictionRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

connectDB();

// Préchauffage du cache historique après connexion DB (non bloquant)
setTimeout(() => {
  warmDailyCache().catch((err) =>
    console.error("❌ Erreur préchauffage cache:", err),
  );
}, 3000);

// Routes
app.use("/api/matches", matchRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/predictions", predictionRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 API disponible sur http://localhost:${PORT}/api`);
});