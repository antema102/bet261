import { useEffect, useState } from 'react';
import { api, type MatchDocument, type LeagueOption } from '../api';
import { Spinner, ErrorMsg, formatDate, formatTime } from '../components/ui';

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchDocument[]>([]);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'finished' | 'upcoming'>('all');
  const [leagueId, setLeagueId] = useState<number | ''>('');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📜 Historique des matchs</h2>
        <div className="flex gap-2 items-center">
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
        </div>
      </div>

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
