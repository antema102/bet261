import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DailyResponse, type DailyRound } from '../api';
import { OddsBadge, ProbBar, Spinner, ErrorMsg, formatTime } from '../components/ui';

export default function DailyPage() {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tolerance, setTolerance] = useState(0.3);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getDaily(tolerance)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tolerance]);

  const goSimilar = (home: number, draw: number, away: number) => {
    navigate(`/similar?home=${home}&draw=${draw}&away=${away}&tolerance=${tolerance}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          📊 Prédictions du jour
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Tolérance :</label>
          <select
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
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
  onClickSimilar: (h: number, d: number, a: number) => void;
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
          🕐 {formatTime(round.expected_start)}
        </span>
      </div>

      {/* Matchs */}
      <div className="divide-y divide-gray-800">
        {round.matches.map((match, i) => (
          <div key={i} className="px-4 py-3 hover:bg-gray-800/30 transition">
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
              <span className="text-xs text-gray-500 min-w-[80px] text-right">
                {match.prediction.sampleSize} match(s)
              </span>
              <button
                onClick={() => onClickSimilar(match.odds.home, match.odds.draw, match.odds.away)}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-emerald-400 hover:bg-gray-700 transition"
              >
                Voir similaires →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
