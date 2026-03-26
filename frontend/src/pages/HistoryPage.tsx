import { useEffect, useState } from 'react';
import { api, type MatchDocument } from '../api';
import { Spinner, ErrorMsg, formatDate, formatTime } from '../components/ui';

export default function HistoryPage() {
  const [matches, setMatches] = useState<MatchDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'finished' | 'upcoming'>('all');

  useEffect(() => {
    api.getMatches()
      .then(setMatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? matches
    : matches.filter((m) => m.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📜 Historique des matchs</h2>
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

      {loading && <Spinner />}
      {error && <ErrorMsg message={error} />}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-500 text-center py-8">Aucun match trouvé.</p>
      )}

      <div className="space-y-2">
        {filtered.map((match) => (
          <MatchRow key={match._id} match={match} />
        ))}
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: MatchDocument }) {
  const [expanded, setExpanded] = useState(false);

  // Extraire les sous-matchs de odds_data
  const roundObj = match.odds_data?.round ?? match.odds_data;
  const subMatches: any[] = roundObj?.matches ?? [];

  // Extraire les résultats
  const results: any[] = match.result_data?.matches ?? [];

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

            // Résultat correspondant
            const result = results[i];
            const goals = result?.goals ?? [];
            const lastGoal = goals.length > 0 ? goals[goals.length - 1] : null;
            const homeScore = lastGoal ? Math.round(lastGoal.homeScore) : null;
            const awayScore = lastGoal ? Math.round(lastGoal.awayScore) : null;

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
