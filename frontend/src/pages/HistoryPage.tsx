import { useEffect, useState, useCallback } from 'react';
import { fetchHistory, fetchLeagues } from '../api';
import type { HistoryRound, HistorySubMatch, LeagueOption } from '../types';

// ── Utilitaires ───────────────────────────────────────────────────────────────

function outcomeLabel(home: number | null, away: number | null): '1' | 'X' | '2' | null {
  if (home === null || away === null) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
}

function bestPrediction(m: HistorySubMatch): '1' | 'X' | '2' | null {
  const { homeWinPct, drawPct, awayWinPct } = m.prediction;
  if (homeWinPct === null || drawPct === null || awayWinPct === null) return null;
  if (homeWinPct >= drawPct && homeWinPct >= awayWinPct) return '1';
  if (drawPct >= awayWinPct) return 'X';
  return '2';
}

// ── Cellule résultat ─────────────────────────────────────────────────────────

function ResultCell({ m }: { m: HistorySubMatch }) {
  const actual = outcomeLabel(m.homeScore, m.awayScore);
  const predicted = bestPrediction(m);
  const correct = actual !== null && predicted !== null && actual === predicted;
  const hasResult = m.homeScore !== null && m.awayScore !== null;

  return (
    <div className="flex flex-col items-center gap-1">
      {hasResult ? (
        <>
          <span className="text-white font-bold text-sm">{m.homeScore} – {m.awayScore}</span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              correct ? 'bg-green-700 text-white' : 'bg-red-800 text-white'
            }`}
          >
            {actual} {correct ? '✓' : '✗'}
          </span>
        </>
      ) : (
        <span className="text-gray-500 text-xs">—</span>
      )}
    </div>
  );
}

// ── Ligne de sous-match ───────────────────────────────────────────────────────

function SubMatchRow({ m }: { m: HistorySubMatch }) {
  const predicted = bestPrediction(m);
  const { homeWinPct, drawPct, awayWinPct, sampleSize } = m.prediction;
  const actual = outcomeLabel(m.homeScore, m.awayScore);
  const correct = actual !== null && predicted !== null && actual === predicted;

  return (
    <div className={`rounded-lg p-3 flex flex-wrap items-center gap-3 justify-between
      ${correct === true ? 'bg-green-950/40 border border-green-800/40' :
        correct === false ? 'bg-red-950/30 border border-red-800/30' :
        'bg-gray-800/50 border border-gray-700/30'}`}>
      {/* Nom */}
      <div className="flex-1 min-w-40">
        <p className="text-sm text-white font-medium">{m.matchName}</p>
        <p className="text-xs text-gray-400">{m.homeTeam} vs {m.awayTeam}</p>
      </div>

      {/* Cotes */}
      <div className="flex gap-1.5 text-xs">
        {[['1', m.odds.home], ['X', m.odds.draw], ['2', m.odds.away]].map(([l, v]) => (
          <span key={l as string} className="bg-gray-700 rounded px-1.5 py-0.5">
            <span className="text-gray-400">{l} </span>
            <span className="text-white font-semibold">{v}</span>
          </span>
        ))}
      </div>

      {/* Proba */}
      <div className="flex gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded font-bold ${predicted === '1' ? 'bg-green-700 text-white' : 'text-gray-400'}`}>
          1: {homeWinPct ?? '?'}%
        </span>
        <span className={`px-2 py-0.5 rounded font-bold ${predicted === 'X' ? 'bg-yellow-600 text-white' : 'text-gray-400'}`}>
          X: {drawPct ?? '?'}%
        </span>
        <span className={`px-2 py-0.5 rounded font-bold ${predicted === '2' ? 'bg-red-700 text-white' : 'text-gray-400'}`}>
          2: {awayWinPct ?? '?'}%
        </span>
        <span className="text-gray-500">({sampleSize})</span>
      </div>

      {/* Résultat réel */}
      <ResultCell m={m} />
    </div>
  );
}

// ── Carte round ───────────────────────────────────────────────────────────────

function RoundCard({ rnd }: { rnd: HistoryRound }) {
  const withResult = rnd.matches.filter(m => m.homeScore !== null);
  const correct = withResult.filter(m => {
    const a = outcomeLabel(m.homeScore, m.awayScore);
    const p = bestPrediction(m);
    return a && p && a === p;
  }).length;

  const accuracy =
    withResult.length > 0 ? Math.round((correct / withResult.length) * 100) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-purple-700 text-white text-xs font-bold px-2 py-0.5 rounded">
            R{rnd.round_number}
          </span>
          <span className="font-semibold text-white">{rnd.league_name}</span>
          <span className="text-gray-500 text-sm">
            {new Date(rnd.expected_start).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">tolérance: {rnd.tolerance}</span>
          {accuracy !== null && (
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                accuracy >= 60 ? 'bg-green-800 text-green-200' :
                accuracy >= 40 ? 'bg-yellow-800 text-yellow-200' :
                'bg-red-900 text-red-200'
              }`}
            >
              {correct}/{withResult.length} — {accuracy}%
            </span>
          )}
        </div>
      </div>
      {/* Matchs */}
      <div className="space-y-2">
        {rnd.matches.map((m, i) => (
          <SubMatchRow key={i} m={m} />
        ))}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [tolerance, setTolerance] = useState(0.20);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [limit, setLimit] = useState(30);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [data, setData] = useState<HistoryRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHistory(tolerance, leagueId, limit);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [tolerance, leagueId, limit]);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
    load();
  }, [load]);

  // Statistiques globales
  const allMatches = data.flatMap(r => r.matches.filter(m => m.homeScore !== null));
  const totalCorrect = allMatches.filter(m => {
    const a = outcomeLabel(m.homeScore, m.awayScore);
    const p = bestPrediction(m);
    return a && p && a === p;
  }).length;
  const globalAccuracy =
    allMatches.length > 0 ? Math.round((totalCorrect / allMatches.length) * 100) : null;

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
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nb de rounds</label>
          <select
            value={limit}
            onChange={e => setLimit(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {[20, 30, 50, 100].map(v => (
              <option key={v} value={v}>{v}</option>
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

        {/* Stat globale */}
        {globalAccuracy !== null && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400">Précision globale</p>
            <p className={`text-2xl font-black ${
              globalAccuracy >= 60 ? 'text-green-400' :
              globalAccuracy >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {globalAccuracy}%
            </p>
            <p className="text-xs text-gray-500">{totalCorrect}/{allMatches.length} matchs</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="text-center text-gray-500 py-16">
          Aucun historique trouvé. Assurez-vous que le scraper tourne.
        </div>
      )}

      <div className="space-y-4">
        {data.map((rnd, i) => (
          <RoundCard key={i} rnd={rnd} />
        ))}
      </div>
    </div>
  );
}
