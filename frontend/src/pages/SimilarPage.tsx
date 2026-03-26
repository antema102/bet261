import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, type SimilarResponse } from '../api';
import { OddsBadge, ProbBar, Spinner, ErrorMsg, formatDate } from '../components/ui';

export default function SimilarPage() {
  const [params] = useSearchParams();
  const home = parseFloat(params.get('home') ?? '');
  const draw = parseFloat(params.get('draw') ?? '');
  const away = parseFloat(params.get('away') ?? '');
  const tolerance = parseFloat(params.get('tolerance') ?? '0.3');

  const [data, setData] = useState<SimilarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNaN(home) || isNaN(draw) || isNaN(away)) {
      setError('Paramètres invalides (home, draw, away requis)');
      setLoading(false);
      return;
    }
    api.getSimilar(home, draw, away, tolerance, 50)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [home, draw, away, tolerance]);

  return (
    <div>
      <Link to="/" className="text-emerald-400 text-sm hover:underline mb-4 inline-block">
        ← Retour aux prédictions
      </Link>

      <h2 className="text-2xl font-bold text-white mb-2">
        🔍 Matchs similaires
      </h2>

      {!isNaN(home) && (
        <div className="mb-4">
          <OddsBadge odds={{ home, draw, away }} />
          <span className="text-xs text-gray-500 ml-3">
            Tolérance : {tolerance}
          </span>
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg message={error} />}

      {data && (
        <>
          {/* Statistiques globales */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatBox
              label="Victoire domicile"
              value={`${data.stats.homeWinPct}%`}
              count={data.stats.homeWins}
              color="emerald"
            />
            <StatBox
              label="Match nul"
              value={`${data.stats.drawPct}%`}
              count={data.stats.draws}
              color="yellow"
            />
            <StatBox
              label="Victoire extérieur"
              value={`${data.stats.awayWinPct}%`}
              count={data.stats.awayWins}
              color="red"
            />
          </div>

          <ProbBar
            homeWinPct={data.stats.homeWinPct}
            drawPct={data.stats.drawPct}
            awayWinPct={data.stats.awayWinPct}
          />

          <p className="text-sm text-gray-500 mt-3 mb-4">
            {data.total} match(s) trouvé(s) dans l'historique
          </p>

          {/* Liste des matchs */}
          <div className="space-y-2">
            {data.matches.map((m, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-white font-medium">{m.matchName}</span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {m.league_name} · R{m.round_number} · {formatDate(m.expected_start)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <OddsBadge odds={m.odds} />
                  {m.result ? (
                    <span className={`font-bold text-lg min-w-[60px] text-center ${
                      m.result.homeScore > m.result.awayScore
                        ? 'text-emerald-400'
                        : m.result.homeScore < m.result.awayScore
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}>
                      {m.result.homeScore} - {m.result.awayScore}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-sm">N/A</span>
                  )}
                  <span className="text-xs text-gray-600">
                    d={m.distance}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, count, color }: {
  label: string;
  value: string;
  count: number;
  color: 'emerald' | 'yellow' | 'red';
}) {
  const bg = {
    emerald: 'bg-emerald-900/30 border-emerald-800',
    yellow: 'bg-yellow-900/30 border-yellow-800',
    red: 'bg-red-900/30 border-red-800',
  }[color];
  const txt = {
    emerald: 'text-emerald-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  }[color];

  return (
    <div className={`rounded-lg border p-4 text-center ${bg}`}>
      <div className={`text-2xl font-bold ${txt}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      <div className="text-xs text-gray-600">({count})</div>
    </div>
  );
}
