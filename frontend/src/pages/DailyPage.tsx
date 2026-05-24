import { useEffect, useState, useCallback } from 'react';
import { fetchDaily, fetchLeagues } from '../api';
import type { DailyRound, DailySubMatch, LeagueOption } from '../types';

// ── Composants utilitaires ────────────────────────────────────────────────────

function PctBar({ pct, color }: { pct: number | null; color: string }) {
  if (pct === null) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold w-9 text-right">{pct}%</span>
    </div>
  );
}

function OddsBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-800 rounded px-2 py-0.5 text-sm">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </span>
  );
}

function OutcomeBadge({ home, away }: { home: number; away: number }) {
  if (home > away) return <span className="bg-green-700 text-white text-xs font-bold px-2 py-0.5 rounded">1</span>;
  if (home < away) return <span className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded">2</span>;
  return <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded">X</span>;
}

// ── Sous-match card ───────────────────────────────────────────────────────────

function SubMatchCard({ match, expanded, onToggle }: {
  match: DailySubMatch;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { name, homeTeam, awayTeam, odds, prediction, similarMatches } = match;
  const { sampleSize, homeWinPct, drawPct, awayWinPct } = prediction;

  const best =
    homeWinPct != null && drawPct != null && awayWinPct != null
      ? homeWinPct >= drawPct && homeWinPct >= awayWinPct
        ? { label: '1', pct: homeWinPct }
        : drawPct >= awayWinPct
        ? { label: 'X', pct: drawPct }
        : { label: '2', pct: awayWinPct }
      : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* En-tête match */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="font-semibold text-white">{name || `${homeTeam} vs ${awayTeam}`}</p>
          <div className="flex gap-2 mt-1.5">
            <OddsBadge label="1" value={odds.home} />
            <OddsBadge label="X" value={odds.draw} />
            <OddsBadge label="2" value={odds.away} />
          </div>
        </div>
        {best && (
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Tendance</p>
            <span
              className={`text-2xl font-black ${
                best.label === '1' ? 'text-green-400' :
                best.label === '2' ? 'text-red-400' : 'text-yellow-400'
              }`}
            >
              {best.label}
            </span>
            <p className="text-xs text-gray-400">{best.pct}%</p>
          </div>
        )}
      </div>

      {/* Probabilités */}
      {sampleSize === 0 ? (
        <p className="text-gray-500 text-xs italic">Aucun historique similaire</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-4">1</span>
            <PctBar pct={homeWinPct} color="bg-green-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-4">X</span>
            <PctBar pct={drawPct} color="bg-yellow-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-4">2</span>
            <PctBar pct={awayWinPct} color="bg-red-500" />
          </div>
          <p className="text-xs text-gray-500 mt-1">{sampleSize} match(s) similaire(s)</p>
        </div>
      )}

      {/* Similaires */}
      {similarMatches.length > 0 && (
        <button
          onClick={onToggle}
          className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {expanded ? '▲ Masquer les similaires' : `▼ Voir ${similarMatches.length} similaire(s)`}
        </button>
      )}
      {expanded && (
        <div className="mt-3 space-y-2">
          {similarMatches.map((s, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{s.league_name} — R{s.round_number}</p>
                <p className="text-sm text-white truncate">{s.matchName}</p>
                <div className="flex gap-1.5 mt-1">
                  <OddsBadge label="1" value={s.odds.home} />
                  <OddsBadge label="X" value={s.odds.draw} />
                  <OddsBadge label="2" value={s.odds.away} />
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="text-xs text-gray-500">dist: {s.distance}</span>
                {s.result ? (
                  <>
                    <span className="font-bold text-white">{s.result.homeScore} – {s.result.awayScore}</span>
                    <OutcomeBadge home={s.result.homeScore} away={s.result.awayScore} />
                  </>
                ) : (
                  <span className="text-gray-500 text-xs">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function DailyPage() {
  const [tolerance, setTolerance] = useState(0.20);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [data, setData] = useState<DailyRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDaily(tolerance, leagueId);
      setData(res.rounds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [tolerance, leagueId]);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
    load();
  }, [load]);

  const toggleKey = (rnd: DailyRound, matchIdx: number) =>
    `${rnd.league_id}-${rnd.event_category_id}-${rnd.round_number}-${matchIdx}`;

  return (
    <div>
      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-4 items-end mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tolérance</label>
          <select
            value={tolerance}
            onChange={e => setTolerance(parseFloat(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
              {[0.00, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50].map(v => (
              <option key={v} value={v}>{v.toFixed(2)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Ligue</label>
          <select
            value={leagueId ?? ''}
            onChange={e => setLeagueId(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">Toutes les ligues</option>
            {leagues.map(l => (
              <option key={l.league_id} value={l.league_id}>{l.league_name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium px-5 py-1.5 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Chargement…' : '🔄 Rafraîchir'}
        </button>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}

      {/* ── Résultats ── */}
      {!loading && data.length === 0 && !error && (
        <div className="text-center text-gray-500 py-16">
          Aucun match upcoming trouvé.
        </div>
      )}

      <div className="space-y-6">
        {data.map(rnd => (
          <div key={`${rnd.league_id}-${rnd.event_category_id}-${rnd.round_number}`}>
            {/* Header round */}
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-purple-700 text-white text-xs font-bold px-2 py-0.5 rounded">
                R{rnd.round_number}
              </span>
              <span className="font-semibold text-white">{rnd.league_name}</span>
              <span className="text-gray-500 text-sm">
                {rnd.expected_start
                  ? new Date(rnd.expected_start).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            {/* Grille de sous-matchs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rnd.matches.map((m, i) => {
                const key = toggleKey(rnd, i);
                return (
                  <SubMatchCard
                    key={key}
                    match={m}
                    expanded={!!expanded[key]}
                    onToggle={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
