const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual_sports', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connecté à MongoDB'))
.catch(err => console.error('❌ Erreur de connexion MongoDB:', err));

// Schémas MongoDB
const matchSchema = new mongoose.Schema({
    league_name: String,
    league_id: Number,
    data: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const roundSchema = new mongoose.Schema({
    league_name: String,
    league_id: Number,
    round_number: Number,
    event_category_id: Number,
    data: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const resultSchema = new mongoose.Schema({
    league_name: String,
    league_id: Number,
    data: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const rankingSchema = new mongoose.Schema({
    league_name: String,
    league_id: Number,
    data: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Modèles
const Match = mongoose.model('Match', matchSchema);
const Round = mongoose.model('Round', roundSchema);
const Result = mongoose.model('Result', resultSchema);
const Ranking = mongoose.model('Ranking', rankingSchema);

// Routes POST pour recevoir les données du scraper

// Enregistrer les matchs
app.post('/api/matches', async (req, res) => {
    try {
        const match = new Match(req.body);
        await match.save();
        console.log(`✅ Match enregistré pour ${req.body.league_name}`);
        res.status(201).json({ success: true, message: 'Match enregistré' });
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement du match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enregistrer les rounds
app.post('/api/rounds', async (req, res) => {
    try {
        const round = new Round(req.body);
        await round.save();
        console.log(`✅ Round ${req.body.round_number} enregistré pour ${req.body.league_name}`);
        res.status(201).json({ success: true, message: 'Round enregistré' });
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement du round:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enregistrer les résultats
app.post('/api/results', async (req, res) => {
    try {
        const result = new Result(req.body);
        await result.save();
        console.log(`✅ Résultats enregistrés pour ${req.body.league_name}`);
        res.status(201).json({ success: true, message: 'Résultats enregistrés' });
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des résultats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enregistrer le classement
app.post('/api/rankings', async (req, res) => {
    try {
        const ranking = new Ranking(req.body);
        await ranking.save();
        console.log(`✅ Classement enregistré pour ${req.body.league_name}`);
        res.status(201).json({ success: true, message: 'Classement enregistré' });
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement du classement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Routes GET pour récupérer les données

// Récupérer les derniers matchs
app.get('/api/matches/:league_id?', async (req, res) => {
    try {
        const query = req.params.league_id ? { league_id: parseInt(req.params.league_id) } : {};
        const matches = await Match.find(query)
            .sort({ timestamp: -1 })
            .limit(10);
        res.json({ success: true, data: matches });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Récupérer les rounds
app.get('/api/rounds/:league_id?', async (req, res) => {
    try {
        const query = req.params.league_id ? { league_id: parseInt(req.params.league_id) } : {};
        const rounds = await Round.find(query)
            .sort({ round_number: -1, timestamp: -1 })
            .limit(20);
        res.json({ success: true, data: rounds });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Récupérer les résultats
app.get('/api/results/:league_id?', async (req, res) => {
    try {
        const query = req.params.league_id ? { league_id: parseInt(req.params.league_id) } : {};
        const results = await Result.find(query)
            .sort({ timestamp: -1 })
            .limit(10);
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Récupérer le classement le plus récent
app.get('/api/rankings/:league_id?', async (req, res) => {
    try {
        const query = req.params.league_id ? { league_id: parseInt(req.params.league_id) } : {};
        const rankings = await Ranking.find(query)
            .sort({ timestamp: -1 })
            .limit(1);
        res.json({ success: true, data: rankings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Récupérer toutes les ligues disponibles
app.get('/api/leagues', async (req, res) => {
    try {
        const leagues = await Match.distinct('league_name');
        res.json({ success: true, data: leagues });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Statistiques
app.get('/api/stats', async (req, res) => {
    try {
        const stats = {
            total_matches: await Match.countDocuments(),
            total_rounds: await Round.countDocuments(),
            total_results: await Result.countDocuments(),
            total_rankings: await Ranking.countDocuments(),
            last_update: await Match.findOne().sort({ timestamp: -1 }).select('timestamp')
        };
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📊 API disponible sur http://localhost:${PORT}/api`);
});