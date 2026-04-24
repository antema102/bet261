import { useEffect, useState } from 'react';
import { api, type MatchDocument, type LeagueOption, type PredictionRound } from '../api';
import { Spinner, ErrorMsg, formatDate, formatTime } from '../components/ui';

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchDocument[]>([]);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'finished' | 'upcoming'>('all');
  const [leagueId, setLeagueId] = useState<number | ''>('');

  // ── Onglet Prédictions ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'matches' | 'predictions'>('matches');
  const [predTolerance, setPredTolerance] = useState(0);
  const [predStatus, setPredStatus] = useState<'finished' | 'upcoming' | 'all'>('finished');
  const [predictions, setPredictions] = useState<PredictionRound[]>([]);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState('');

  // Charge les matchs + ligues
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getMatches({
        leagueId: leagueId || undefined,
        status: filter === 'all' ? undefined : filter,
        limit: 100,
      }),
      api.getLeagues(),
    ])
      .then(([matchesData, leaguesData]) => {
        setMatches(matchesData);
        setLeagues(leaguesData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter, leagueId]);

  // Charge les prédictions sauvegardées
  useEffect(() => {
    if (activeTab !== 'predictions') return;
    setPredLoading(true);
    setPredError('');
    api
      .getPredictions(predTolerance, leagueId || undefined, 100, predStatus)
      .then(setPredictions)
      .catch((e) => setPredError(e.message))
      .finally(() => setPredLoading(false));
  }, [activeTab, predTolerance, leagueId, predStatus]);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">📜 Historique</h2>
        <div className="flex gap-2 items-center">
          {/* Filtre ligue commun */}
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

          {/* Filtre statut — onglet matchs */}
          {activeTab === 'matches' && (
          <div className="flex gap-1">
            {(['all', 'upcoming', 'finished'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'upcoming' ? '⏳ À venir' : '✅ Terminés'}
              </button>
            ))}
          </div>
          )}

          {/* Sélecteur tolérance — onglet prédictions */}
          {activeTab === 'predictions' && (
            <>
              <div className="flex gap-1">
                {([
                  { key: 'finished', label: '✅ Terminés' },
                  { key: 'upcoming', label: '⏳ À venir' },
                  { key: 'all', label: 'Tous' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPredStatus(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      predStatus === key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="text-sm text-gray-400">Tolérance :</label>
              <select
                value={predTolerance}
                onChange={(e) => setPredTolerance(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              >
                <option value={0}>Exact (0.00)</option>
                <option value={0.15}>Strict (0.15)</option>
                <option value={0.3}>Normal (0.30)</option>
                <option value={0.5}>Large (0.50)</option>
                <option value={0.8}>Très large (0.80)</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 border-b border-gray-800">
        {([
          { key: 'matches', label: '📋 Matchs' },
          { key: 'predictions', label: '📊 Prédictions' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px ${
              activeTab === key
                ? 'text-emerald-400 border-emerald-400 bg-gray-900'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenu Matchs ──────────────────────────────────────────────── */}
      {activeTab === 'matches' && (
        <>
          {loading && <Spinner />}
          {error && <ErrorMsg message={error} />}
          {!loading && matches.length === 0 && (
            <p className="text-gray-500 text-center py-8">Aucun match trouvé.</p>
          )}
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchRow key={match._id} match={match} />
            ))}
          </div>
        </>
      )}

      {/* ── Contenu Prédictions ─────────────────────────────────────────── */}
      {activeTab === 'predictions' && (
        <>
          {predLoading && <Spinner />}
          {predError && <ErrorMsg message={predError} />}
          {!predLoading && predictions.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              Aucune prédiction sauvegardée pour cette tolérance.<br />
              <span className="text-xs text-gray-600">
                Les prédictions sont enregistrées automatiquement depuis la page Prédictions du jour.
              </span>
            </p>
          )}
          <div className="space-y-3">
            {predictions.map((pred, i) => (
              <PredictionRoundCard key={i} pred={pred} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: MatchDocument }) {
  const [expanded, setExpanded] = useState(false);

  const subMatches: any[] = match.odds_data?.matches ?? match.odds_data?.round?.matches ?? [];

  const results: any[] = match.result_data?.matches ?? [];
  const resultsById = new Map(results.map((r: any) => [r.id, r]));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded ${
            match.status === 'finished'
              ? 'bg-emerald-900/50 text-emerald-400'
              : 'bg-yellow-900/50 text-yellow-400'
          }`}>
            {match.status === 'finished' ? '✅' : '⏳'}
          </span>
          <span className="text-emerald-400 font-medium">{match.league_name}</span>
          <span className="text-gray-500 text-sm">R{match.round_number}</span>
          <span className="text-xs text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">
            Saison {match.event_category_id}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {formatDate(match.expected_start)} {formatTime(match.expected_start)}
          </span>
          <span className="text-xs text-gray-500">
            {subMatches.length} match(s)
          </span>
          <span className="text-gray-600">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {expanded && subMatches.length > 0 && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/50">
          {subMatches.map((sm: any, i: number) => {
            const bt = sm.eventBetTypes?.find((b: any) => b.name === '1X2');
            const items = bt?.eventBetTypeItems ?? [];
            const home = items.find((x: any) => x.shortName === '1')?.odds;
            const draw = items.find((x: any) => x.shortName === 'X')?.odds;
            const away = items.find((x: any) => x.shortName === '2')?.odds;

            const result = resultsById.get(sm.id) ?? (sm.odds_id != null ? resultsById.get(sm.odds_id) : undefined) ?? results[i];
            const homeScore = result?.homeScore ?? null;
            const awayScore = result?.awayScore ?? null;

            return (
              <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-white">
                  {sm.homeTeam?.name ?? '?'} <span className="text-gray-500">vs</span>{' '}
                  {sm.awayTeam?.name ?? '?'}
                </span>
                <div className="flex items-center gap-3">
                  {home != null && (
                    <div className="flex gap-1.5 font-mono text-xs">
                      <span className="text-emerald-400">{Number(home).toFixed(2)}</span>
                      <span className="text-yellow-400">{Number(draw).toFixed(2)}</span>
                      <span className="text-red-400">{Number(away).toFixed(2)}</span>
                    </div>
                  )}
                  {homeScore != null && awayScore != null ? (
                    <span className={`font-bold min-w-[50px] text-center ${
                      homeScore > awayScore
                        ? 'text-emerald-400'
                        : homeScore < awayScore
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}>
                      {homeScore} - {awayScore}
                    </span>
                  ) : match.status === 'finished' ? (
                    <span className="text-gray-600 min-w-[50px] text-center">0 - 0</span>
                  ) : (
                    <span className="text-gray-700 min-w-[50px] text-center">—</span>
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
// ─── PredictionRoundCard ──────────────────────────────────────────────────────

function PredictionRoundCard({ pred }: { pred: PredictionRound }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-medium">{pred.league_name}</span>
          <span className="text-gray-500 text-sm">R{pred.round_number}</span>
          <span className="text-xs text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">
            Saison {pred.event_category_id}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {formatDate(pred.expected_start)} · {formatTime(pred.expected_start)}
          </span>
          <span className="text-xs text-gray-500">{pred.matches.length} match(s)</span>
          <span className="text-gray-600">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/50">
          {pred.matches.map((m, i) => {
            const { homeWinPct, drawPct, awayWinPct, sampleSize } = m.prediction;
            const hasResult = m.result !== null;
            const outcome =
              hasResult && m.result!.homeScore > m.result!.awayScore ? 'home'
              : hasResult && m.result!.homeScore < m.result!.awayScore ? 'away'
              : hasResult ? 'draw'
              : null;
            const maxPct = Math.max(homeWinPct ?? 0, drawPct ?? 0, awayWinPct ?? 0);
            const predicted =
              maxPct === 0 ? null
              : maxPct === homeWinPct ? 'home'
              : maxPct === awayWinPct ? 'away'
              : 'draw';
            const correct = outcome !== null && predicted !== null && outcome === predicted;

            return (
              <div key={i} className="px-4 py-3">
                {/* Nom + résultat */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">
                    {m.homeTeam} <span className="text-gray-500">vs</span> {m.awayTeam}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 font-mono text-xs">
                      <span className="text-emerald-400">{m.odds.home.toFixed(2)}</span>
                      <span className="text-yellow-400">{m.odds.draw.toFixed(2)}</span>
                      <span className="text-red-400">{m.odds.away.toFixed(2)}</span>
                    </div>
                    {hasResult ? (
                      <span className={`font-bold text-sm min-w-[50px] text-center ${
                        outcome === 'home' ? 'text-emerald-400'
                        : outcome === 'away' ? 'text-red-400'
                        : 'text-yellow-400'
                      }`}>
                        {m.result!.homeScore} - {m.result!.awayScore}
                      </span>
                    ) : (
                      <span className="text-gray-600 min-w-[50px] text-center">—</span>
                    )}
                    {outcome !== null && predicted !== null && (
                      <span className={`text-xs font-bold w-4 text-center ${correct ? 'text-emerald-400' : 'text-red-400'}`}>
                        {correct ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Probabilités */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    {([
                      { label: '1', pct: homeWinPct, color: 'bg-emerald-500', type: 'home' },
                      { label: 'X', pct: drawPct,    color: 'bg-yellow-500',  type: 'draw' },
                      { label: '2', pct: awayWinPct, color: 'bg-red-500',     type: 'away' },
                    ] as const).map(({ label, pct, color, type }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-gray-400 ${
                          outcome === type ? 'ring-1 ring-white/30 bg-gray-800' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span>{label}</span>
                        <span className="font-mono font-medium text-white">
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 ml-auto">{sampleSize} similaire(s)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}