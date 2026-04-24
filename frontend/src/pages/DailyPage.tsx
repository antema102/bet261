import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DailyResponse, type DailyRound, type LeagueOption } from '../api';
import { OddsBadge, ProbBar, Spinner, ErrorMsg, formatDate, formatTime } from '../components/ui';

export default function DailyPage() {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tolerance, setTolerance] = useState(0);
  const [leagueId, setLeagueId] = useState<number | ''>('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      api.getDaily(tolerance, leagueId || undefined),
      api.getLeagues(),
    ])
      .then(([dailyData, leaguesData]) => {
        setData(dailyData);
        setLeagues(leaguesData);

        // Auto-sauvegarde des prédictions dans MongoDB
        dailyData.rounds.forEach((round) => {
          api.savePrediction({
            league_name:       round.league_name,
            league_id:         round.league_id,
            round_number:      round.round_number,
            event_category_id: round.event_category_id,
            expected_start:    round.expected_start,
            tolerance,
            matches: round.matches.map((m) => ({
              matchId:   m.matchId,
              matchName: m.name,
              homeTeam:  m.homeTeam,
              awayTeam:  m.awayTeam,
              odds:      m.odds,
              prediction: m.prediction,
            })),
          }).catch(() => {}); // silencieux, non-bloquant
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tolerance, leagueId]);

  const goSimilar = (home: number, draw: number, away: number, leagueId_: number, eventCategoryId: number, roundNumber: number) => {
    const params = new URLSearchParams({
      home: String(home),
      draw: String(draw),
      away: String(away),
      tolerance: String(tolerance),
      exclude_league_id: String(leagueId_),
      exclude_event_category_id: String(eventCategoryId),
      exclude_round_number: String(roundNumber),
    });
    if (leagueId) params.set('league_id', String(leagueId));
    navigate(`/similar?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          📊 Prédictions du jour
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value ? Number(e.target.value) : '')}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">Toutes les ligues</option>
            {leagues.map((league) => (
              <option key={league.league_id} value={league.league_id}>
                {league.league_name}
              </option>
            ))}
          </select>
          <label className="text-sm text-gray-400">Tolérance :</label>
          <select
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value={0}>Exact (0.00)</option>
            <option value={0.15}>Strict (0.15)</option>
            <option value={0.3}>Normal (0.30)</option>
            <option value={0.5}>Large (0.50)</option>
            <option value={0.8}>Très large (0.80)</option>
          </select>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMsg message={error} />}

      {data && data.rounds.length === 0 && (
        <p className="text-gray-500 text-center py-8">Aucun match à venir pour le moment.</p>
      )}

      {data?.rounds.map((round) => (
        <RoundCard
          key={`${round.league_id}-${round.round_number}`}
          round={round}
          onClickSimilar={goSimilar}
        />
      ))}
    </div>
  );
}

function RoundCard({
  round,
  onClickSimilar,
}: {
  round: DailyRound;
  onClickSimilar: (h: number, d: number, a: number, leagueId: number, eventCategoryId: number, roundNumber: number) => void;
}) {
  return (
    <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header du round */}
      <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-semibold">{round.league_name}</span>
          <span className="text-gray-500 text-sm">Round {round.round_number}</span>
        </div>
        <span className="text-sm text-gray-400">
          {formatDate(round.expected_start)} · 🕐 {formatTime(round.expected_start)}
        </span>
      </div>

      {/* Matchs */}
      <div className="divide-y divide-gray-800">
        {round.matches.map((match, i) => (
          <MatchCard
            key={i}
            match={match}
            onClickSimilar={() => onClickSimilar(match.odds.home, match.odds.draw, match.odds.away, round.league_id, round.event_category_id, round.round_number)}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  onClickSimilar,
}: {
  match: DailyRound['matches'][0];
  onClickSimilar: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSimilars = (match.similarMatches?.length ?? 0) > 0;

  return (
    <div>
      {/* Ligne principale */}
      <div className="px-4 py-3 hover:bg-gray-800/30 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">
            {match.homeTeam} <span className="text-gray-500">vs</span> {match.awayTeam}
          </span>
          <OddsBadge odds={match.odds} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <ProbBar
              homeWinPct={match.prediction.homeWinPct}
              drawPct={match.prediction.drawPct}
              awayWinPct={match.prediction.awayWinPct}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {match.prediction.sampleSize} similaire(s)
          </span>
          {hasSimilars && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs px-2 py-1 rounded bg-gray-800/80 text-gray-400 hover:text-white transition"
            >
              {expanded ? '▲ Masquer' : '▼ Détails'}
            </button>
          )}
          <button
            onClick={onClickSimilar}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-emerald-400 hover:bg-gray-700 transition"
          >
            Voir tous →
          </button>
        </div>
      </div>

      {/* Similaires en-dessous */}
      {expanded && hasSimilars && (
        <div className="border-t border-gray-800/60 bg-gray-950/50 divide-y divide-gray-800/40">
          <div className="px-4 py-1.5 text-xs text-gray-600 uppercase tracking-wider font-semibold">
            Matchs similaires utilisés pour la prédiction
          </div>
          {match.similarMatches!.map((sm, j) => {
            const outcome =
              sm.result.homeScore > sm.result.awayScore ? 'home'
              : sm.result.homeScore < sm.result.awayScore ? 'away'
              : 'draw';
            return (
              <div key={j} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-emerald-500/70 shrink-0">{sm.league_name.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400 truncate">
                    {sm.homeTeam} <span className="text-gray-600">vs</span> {sm.awayTeam}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="flex gap-1 font-mono">
                    <span className="text-emerald-400">{sm.odds.home.toFixed(2)}</span>
                    <span className="text-yellow-400">{sm.odds.draw.toFixed(2)}</span>
                    <span className="text-red-400">{sm.odds.away.toFixed(2)}</span>
                  </div>
                  <span className={`font-bold min-w-[40px] text-center ${
                    outcome === 'home' ? 'text-emerald-400'
                    : outcome === 'away' ? 'text-red-400'
                    : 'text-yellow-400'
                  }`}>
                    {sm.result.homeScore} - {sm.result.awayScore}
                  </span>
                  {sm.distance > 0 && (
                    <span className="text-gray-600">d={sm.distance.toFixed(2)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
