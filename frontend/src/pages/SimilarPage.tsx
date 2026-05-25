import { useState } from 'react';
import { fetchSimilar, fetchLeagues } from '../api';
import type { SimilarResponse, SimilarResult, LeagueOption, OverUnderLine } from '../types';
import { useEffect } from 'react';

// ── Utilitaires ───────────────────────────────────────────────────────────────

function OutcomeBadge({ home, away }: { home: number; away: number }) {
  if (home > away) return <span className="bg-green-700 text-white text-xs font-bold px-2 py-0.5 rounded">1</span>;
  if (home < away) return <span className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded">2</span>;
  return <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded">X</span>;
}

function PctDonut({ homeWin, draw, awayWin }: { homeWin: number; draw: number; awayWin: number }) {
  const items = [
    { label: '1', pct: homeWin, color: 'bg-green-500' },
    { label: 'X', pct: draw,    color: 'bg-yellow-500' },
    { label: '2', pct: awayWin, color: 'bg-red-500' },
  ];
  const best = items.reduce((a, b) => (a.pct >= b.pct ? a : b));

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Tendance principale */}
      <div className="text-center">
        <span className={`text-4xl font-black ${
          best.label === '1' ? 'text-green-400' :
          best.label === '2' ? 'text-red-400' : 'text-yellow-400'
        }`}>{best.label}</span>
        <p className="text-xs text-gray-400">{best.pct}%</p>
      </div>
      {/* Barres */}
      <div className="w-full space-y-1.5">
        {items.map(it => (
          <div key={it.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4">{it.label}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div className={`h-2 rounded-full ${it.color}`} style={{ width: `${it.pct}%` }} />
            </div>
            <span className="text-xs font-bold w-9 text-right">{it.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverUnderBadges({ lines }: { lines?: OverUnderLine[] }) {
  if (!lines || lines.length === 0) return null;
  const displayed = lines.filter(l => l.total === '2.5');
  if (displayed.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {displayed.map(l => (
        <span key={l.total} className="bg-blue-950/60 border border-blue-800/50 rounded px-1.5 py-0.5 text-xs flex gap-1">
          <span className="text-blue-400 font-semibold">{l.total}</span>
          <span className="text-green-400">+{l.over}</span>
          <span className="text-gray-500">/</span>
          <span className="text-red-400">-{l.under}</span>
        </span>
      ))}
    </div>
  );
}

// ── Carte résultat similaire ──────────────────────────────────────────────────

function SimilarCard({ m }: { m: SimilarResult }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{m.league_name} — R{m.round_number}</p>
          <p className="text-sm font-semibold text-white">{m.matchName}</p>
          <p className="text-xs text-gray-400">{m.homeTeam} vs {m.awayTeam}</p>
        </div>
        <div className="text-right">
          {m.result ? (
            <>
              <p className="text-lg font-black text-white">{m.result.homeScore} – {m.result.awayScore}</p>
              <OutcomeBadge home={m.result.homeScore} away={m.result.awayScore} />
            </>
          ) : (
            <span className="text-gray-500 text-sm">—</span>
          )}
        </div>
      </div>
      {/* Cotes */}
      <div className="flex gap-2 text-xs flex-wrap">
        {[['1', m.odds.home], ['X', m.odds.draw], ['2', m.odds.away]].map(([l, v]) => (
          <span key={l as string} className="bg-gray-800 rounded px-2 py-0.5">
            <span className="text-gray-400">{l} </span>
            <span className="text-white font-semibold">{v}</span>
          </span>
        ))}
        <span className="text-gray-500 ml-auto">dist: {m.distance}</span>
      </div>
      {/* Cotes +/- */}
      <OverUnderBadges lines={m.overUnder} />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function SimilarPage() {
  const [home, setHome] = useState('');
  const [draw, setDraw] = useState('');
  const [away, setAway] = useState('');
  const [over15, setOver15]   = useState('');
  const [under15, setUnder15] = useState('');
  const [over25, setOver25]   = useState('');
  const [under25, setUnder25] = useState('');
  const [tolerance, setTolerance] = useState(0.20);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [limit, setLimit] = useState(30);

  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [result, setResult] = useState<SimilarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(home);
    const d = parseFloat(draw);
    const a = parseFloat(away);
    if (isNaN(h) || isNaN(d) || isNaN(a)) {
      setError('Veuillez saisir des cotes valides (ex: 1.50)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSimilar(h, d, a, tolerance, leagueId, limit);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* ── Formulaire ── */}
      <form
        onSubmit={search}
        className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6"
      >
        <h2 className="text-white font-semibold mb-4">🔍 Recherche par cotes 1X2 &amp; Over/Under</h2>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Cotes */}
          {[
            { label: 'Cote 1 (domicile)', val: home, set: setHome },
            { label: 'Cote X (nul)',       val: draw, set: setDraw },
            { label: 'Cote 2 (extérieur)', val: away, set: setAway },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex-1 min-w-28">
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder="ex: 1.50"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          ))}

          {/* Séparateur Over/Under optionnel */}
          <div className="w-full flex items-center gap-2 mt-1">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-blue-400 font-semibold whitespace-nowrap">+/- Over/Under (optionnel)</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
          {[
            { label: 'Over 1.5', val: over15, set: setOver15 },
            { label: 'Under 1.5', val: under15, set: setUnder15 },
            { label: 'Over 2.5', val: over25, set: setOver25 },
            { label: 'Under 2.5', val: under25, set: setUnder25 },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex-1 min-w-24">
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder="ex: 1.75"
                className="w-full bg-gray-800 border border-blue-900/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}

          {/* Tolérance */}
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

          {/* Ligue */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ligue</label>
            <select
              value={leagueId ?? ''}
              onChange={e => setLeagueId(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="">Toutes</option>
              {leagues.map(l => (
                <option key={l.league_id} value={l.league_id}>{l.league_name}</option>
              ))}
            </select>
          </div>

          {/* Limit */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Limite</label>
            <select
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              {[10, 20, 30, 50, 100].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium px-6 py-1.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Recherche…' : '🔍 Rechercher'}
          </button>
        </div>
      </form>

      {/* ── Erreur ── */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}

      {/* ── Résultats ── */}
      {result && (
        <>
          {/* Statistiques globales */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">Cotes cibles</p>
              <div className="flex gap-2 text-sm">
                {[['1', result.target.home], ['X', result.target.draw], ['2', result.target.away]].map(([l, v]) => (
                  <span key={l as string} className="bg-gray-800 rounded px-2 py-0.5">
                    <span className="text-gray-400">{l} </span>
                    <span className="text-white font-bold">{v}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{result.total} résultat(s) — tolérance: {result.tolerance}</p>
            </div>

            {result.total > 0 && (
              <div className="flex-1 min-w-64">
                <PctDonut
                  homeWin={result.stats.homeWinPct}
                  draw={result.stats.drawPct}
                  awayWin={result.stats.awayWinPct}
                />
              </div>
            )}

            {result.total === 0 && (
              <p className="text-gray-500 text-sm">Aucun match similaire trouvé. Essayez une tolérance plus large.</p>
            )}
          </div>

          {/* Liste */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {result.matches.map((m, i) => (
              <SimilarCard key={i} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
