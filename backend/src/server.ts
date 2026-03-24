import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB } from './utils/db';
import matchRoutes from './routes/matchRoutes';
import roundRoutes from './routes/roundRoutes';
import resultRoutes from './routes/resultRoutes';
import rankingRoutes from './routes/rankingRoutes';
import leagueRoutes from './routes/leagueRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connexion à MongoDB
connectDB();

// Routes
app.use('/api/matches', matchRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/leagues', leagueRoutes);

// Route de santé
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 API disponible sur http://localhost:${PORT}/api`);
});
