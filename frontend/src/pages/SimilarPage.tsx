import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api, type SimilarResponse, type LeagueOption } from '../api';
import { OddsBadge, ProbBar, Spinner, ErrorMsg, formatDate, formatTime } from '../components/ui';

export default function SimilarPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const home = parseFloat(params.get('home') ?? '');
  const draw = parseFloat(params.get('draw') ?? '');
  const away = parseFloat(params.get('away') ?? '');
  const tolerance = parseFloat(params.get('tolerance') ?? '0.3');
  const queryLeagueId = parseFloat(params.get('league_id') ?? '');
  const excludeLeagueId = params.get('exclude_league_id') ? parseInt(params.get('exclude_league_id')!) : undefined;
  const excludeEventCategoryId = params.get('exclude_event_category_id') ? parseInt(params.get('exclude_event_category_id')!) : undefined;
  const excludeRoundNumber = params.get('exclude_round_number') ? parseInt(params.get('exclude_round_number')!) : undefined;

  const [data, setData] = useState<SimilarResponse | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leagueId, setLeagueId] = useState<number | ''>(isNaN(queryLeagueId) ? '' : queryLeagueId);
  const [currentTolerance, setCurrentTolerance] = useState(isNaN(tolerance) ? 0.3 : tolerance);

  useEffect(() => {
    if (isNaN(home) || isNaN(draw) || isNaN(away)) {
      setError('Paramètres invalides (home, draw, away requis)');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.all([
      api.getSimilar(home, draw, away, currentTolerance, 50, leagueId || undefined, excludeLeagueId, excludeEventCategoryId, excludeRoundNumber),
      api.getLeagues(),
    ])
      .then(([similarData, leaguesData]) => {
        setData(similarData);
        setLeagues(leaguesData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [home, draw, away, currentTolerance, leagueId]);

  const updateLeague = (value: number | '') => {
    setLeagueId(value);
    const next = new URLSearchParams(params);
    if (value) next.set('league_id', String(value));
    else next.delete('league_id');
    navigate(`/similar?${next.toString()}`, { replace: true });
  };

  const updateTolerance = (value: number) => {
    setCurrentTolerance(value);
    const next = new URLSearchParams(params);
    next.set('tolerance', String(value));
    navigate(`/similar?${next.toString()}`, { replace: true });
  };

  return (
    <div>
      <Link to="/" className="text-emerald-400 text-sm hover:underline mb-4 inline-block">
        ← Retour aux prédictions
      </Link>

      <h2 className="text-2xl font-bold text-white mb-2">
        🔍 Matchs similaires
      </h2>

      {!isNaN(home) && (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <OddsBadge odds={{ home, draw, away }} />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-gray-400">Tolérance :</label>
            <select
              value={currentTolerance}
              onChange={(e) => updateTolerance(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value={0}>Exact (0.00)</option>
              <option value={0.15}>Strict (0.15)</option>
              <option value={0.3}>Normal (0.30)</option>
              <option value={0.5}>Large (0.50)</option>
              <option value={0.8}>Très large (0.80)</option>
            </select>
            <select
              value={leagueId}
              onChange={(e) => updateLeague(e.target.value ? Number(e.target.value) : '')}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">Toutes les ligues</option>
              {leagues.map((league) => (
                <option key={league.league_id} value={league.league_id}>
                  {league.league_name}
                </option>
              ))}
            </select>
          </div>
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
                    {m.league_name} · R{m.round_number}
                    · <span className="text-gray-600">saison {m.event_category_id}</span>
                    · {formatDate(m.expected_start)} {formatTime(m.expected_start)}
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
