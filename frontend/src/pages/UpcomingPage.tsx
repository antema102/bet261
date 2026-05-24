import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchUpcoming, fetchLeagues } from '../api';
import type { DailyRound, DailySubMatch, LeagueOption } from '../types';

const AUTO_REFRESH_SEC = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'imminent';
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Barre de probabilité ─────────────────────────────────────────────────────

function ProbaBars({ homeWinPct, drawPct, awayWinPct, sampleSize }: {
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
  sampleSize: number;
}) {
  if (sampleSize === 0) {
    return <p className="text-xs text-gray-500 italic">Aucun historique exact (0.00)</p>;
  }

  const items = [
    { label: '1', pct: homeWinPct, color: 'bg-green-500', textColor: 'text-green-400' },
    { label: 'X', pct: drawPct,    color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    { label: '2', pct: awayWinPct, color: 'bg-red-500',   textColor: 'text-red-400' },
  ];

  const best = items.reduce((a, b) =>
    (a.pct ?? 0) >= (b.pct ?? 0) ? a : b
  );

  return (
    <div className="space-y-1.5">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={`text-xs font-bold w-4 ${it.label === best.label ? it.textColor : 'text-gray-500'}`}>
            {it.label}
          </span>
          <div className="flex-1 bg-gray-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${it.color} ${it.label === best.label ? 'ring-1 ring-white/20' : 'opacity-60'}`}
              style={{ width: `${it.pct ?? 0}%` }}
            />
          </div>
          <span className={`text-xs font-bold w-9 text-right ${it.label === best.label ? it.textColor : 'text-gray-500'}`}>
            {it.pct ?? '?'}%
          </span>
        </div>
      ))}
      <p className="text-xs text-gray-600 pt-0.5">{sampleSize} historique(s) exact(s)</p>
    </div>
  );
}

// ── Carte sous-match ─────────────────────────────────────────────────────────

function MatchCard({ m, expanded, onToggle }: {
  m: DailySubMatch;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { name, homeTeam, awayTeam, odds, prediction, similarMatches } = m;
  const { homeWinPct, drawPct, awayWinPct, sampleSize } = prediction;

  const items = [
    { label: '1', pct: homeWinPct },
    { label: 'X', pct: drawPct },
    { label: '2', pct: awayWinPct },
  ];
  const best = sampleSize > 0
    ? items.reduce((a, b) => (a.pct ?? 0) >= (b.pct ?? 0) ? a : b)
    : null;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-all
      ${sampleSize > 0
        ? 'bg-gray-900 border-gray-700'
        : 'bg-gray-900/50 border-gray-800'}`}>

      {/* Équipes + cotes */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white text-sm">{name || `${homeTeam} vs ${awayTeam}`}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {[['1', odds.home], ['X', odds.draw], ['2', odds.away]].map(([l, v]) => (
              <span key={l as string} className="bg-gray-800 rounded px-2 py-0.5 text-xs">
                <span className="text-gray-400">{l} </span>
                <span className="font-bold text-white">{v}</span>
              </span>
            ))}
          </div>
        </div>
        {best && (
          <div className="text-center shrink-0">
            <span className={`text-3xl font-black ${
              best.label === '1' ? 'text-green-400' :
              best.label === '2' ? 'text-red-400' : 'text-yellow-400'
            }`}>{best.label}</span>
            <p className="text-xs text-gray-500">{best.pct}%</p>
          </div>
        )}
      </div>

      {/* Barres probabilités */}
      <ProbaBars
        homeWinPct={homeWinPct}
        drawPct={drawPct}
        awayWinPct={awayWinPct}
        sampleSize={sampleSize}
      />

      {/* Similaires */}
      {similarMatches.length > 0 && (
        <>
          <button
            onClick={onToggle}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors text-left"
          >
            {expanded ? '▲ Masquer' : `▼ ${similarMatches.length} match(s) identique(s)`}
          </button>
          {expanded && (
            <div className="space-y-2 mt-1">
              {similarMatches.map((s, i) => {
                const outcome = s.result
                  ? s.result.homeScore > s.result.awayScore ? '1'
                  : s.result.homeScore < s.result.awayScore ? '2' : 'X'
                  : null;
                return (
                  <div key={i} className="bg-gray-800 rounded-lg p-2.5 flex flex-col gap-1.5">
                    {/* Ligne 1 : ligue + résultat */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{s.league_name} R{s.round_number}</p>
                        <p className="text-xs text-white truncate">{s.matchName}</p>
                      </div>
                      {s.result && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-white font-bold text-sm">
                            {s.result.homeScore}–{s.result.awayScore}
                          </span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            outcome === '1' ? 'bg-green-700 text-white' :
                            outcome === '2' ? 'bg-red-700 text-white' :
                            'bg-yellow-600 text-white'
                          }`}>{outcome}</span>
                        </div>
                      )}
                    </div>
                    {/* Ligne 2 : cotes du match similaire */}
                    <div className="flex gap-1.5 flex-wrap">
                      {([['1', s.odds.home], ['X', s.odds.draw], ['2', s.odds.away]] as [string, number][]).map(([l, v]) => (
                        <span key={l} className="bg-gray-700 rounded px-1.5 py-0.5 text-xs">
                          <span className="text-gray-400">{l} </span>
                          <span className="font-semibold text-gray-200">{v}</span>
                        </span>
                      ))}
                      {s.distance > 0 && (
                        <span className="ml-auto text-xs text-gray-600 italic">Δ {s.distance.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Bloc round ────────────────────────────────────────────────────────────────

function RoundBlock({ rnd, expanded, onToggle }: {
  rnd: DailyRound;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const [countdown, setCountdown] = useState(() => timeUntil(rnd.expected_start));

  useEffect(() => {
    const id = setInterval(() => setCountdown(timeUntil(rnd.expected_start)), 1000);
    return () => clearInterval(id);
  }, [rnd.expected_start]);

  const withHistory = rnd.matches.filter(m => m.prediction.sampleSize > 0).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-purple-700 text-white text-xs font-bold px-2 py-0.5 rounded">
            R{rnd.round_number}
          </span>
          <span className="font-semibold text-white">{rnd.league_name}</span>
          <span className="text-gray-400 text-sm">{formatDate(rnd.expected_start)}</span>
        </div>
        <div className="flex items-center gap-3">
          {withHistory > 0 && (
            <span className="text-xs text-green-400 font-medium">
              ✓ {withHistory}/{rnd.matches.length} avec historique
            </span>
          )}
          <span className="bg-orange-900/60 border border-orange-700/50 text-orange-300 text-xs font-bold px-3 py-1 rounded-full">
            ⏱ {countdown}
          </span>
        </div>
      </div>

      {/* Grille matchs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rnd.matches.map((m, i) => {
          const key = `${rnd.league_id}-${rnd.event_category_id}-${rnd.round_number}-${i}`;
          return (
            <MatchCard
              key={key}
              m={m}
              expanded={!!expanded[key]}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function UpcomingPage() {
  const [tolerance, setTolerance] = useState(0.00);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [data, setData] = useState<DailyRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetchUpcoming(tolerance, leagueId);
      setData(res.rounds);
      setLastRefresh(new Date());
      setCountdown(AUTO_REFRESH_SEC);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [tolerance, leagueId]);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          load(true);
          return AUTO_REFRESH_SEC;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
    load();
  }, [load]);

  const toggleKey = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {/* ── Filtres + statut ── */}
      <div className="flex flex-wrap gap-4 items-end mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tolérance</label>
          <select
            value={tolerance}
            onChange={e => setTolerance(parseFloat(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {[0.00, 0.05, 0.10, 0.15, 0.20, 0.30].map(v => (
              <option key={v} value={v}>
                {v === 0 ? '0.00 — exact' : v.toFixed(2)}
              </option>
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
          onClick={() => load()}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium px-5 py-1.5 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Chargement…' : '🔄 Rafraîchir'}
        </button>

        {/* Statut auto-refresh */}
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">
            Refresh auto dans{' '}
            <span className="text-orange-400 font-bold">{countdown}s</span>
          </p>
          {lastRefresh && (
            <p className="text-xs text-gray-600">
              Mis à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-2.5 mb-5 text-blue-300 text-xs flex items-center gap-2">
        <span>⚡</span>
        <span>
          Seuls les matchs dont le coup d'envoi est <strong>dans le futur</strong> apparaissent ici.
          Les matchs terminés ou en cours disparaissent automatiquement.
          Tolérance <strong>0.00</strong> = cotes exactement identiques dans l'historique.
        </span>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="text-center text-gray-500 py-16">
          <p className="text-4xl mb-3">🕐</p>
          <p>Aucun match à venir trouvé.</p>
          <p className="text-xs mt-1">Essayez une tolérance plus large ou attendez le prochain cycle du scraper.</p>
        </div>
      )}

      {loading && data.length === 0 && (
        <div className="text-center text-gray-600 py-16 animate-pulse">Chargement…</div>
      )}

      <div className="space-y-5">
        {data.map(rnd => (
          <RoundBlock
            key={`${rnd.league_id}-${rnd.event_category_id}-${rnd.round_number}`}
            rnd={rnd}
            expanded={expanded}
            onToggle={toggleKey}
          />
        ))}
      </div>
    </div>
  );
}
