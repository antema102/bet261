import type { OddsTriple } from '../api';

/** Barre de probabilité colorée */
export function ProbBar({ homeWinPct, drawPct, awayWinPct }: {
  homeWinPct: number | null;
  drawPct: number | null;
  awayWinPct: number | null;
}) {
  if (homeWinPct == null || drawPct == null || awayWinPct == null) {
    return <span className="text-xs text-gray-500 italic">Pas de données</span>;
  }
  return (
    <div className="flex rounded overflow-hidden h-5 text-[10px] font-bold leading-5">
      <div
        className="bg-emerald-600 text-white text-center whitespace-nowrap"
        style={{ width: `${homeWinPct}%` }}
      >
        {homeWinPct > 8 && `${homeWinPct}%`}
      </div>
      <div
        className="bg-yellow-500 text-gray-900 text-center whitespace-nowrap"
        style={{ width: `${drawPct}%` }}
      >
        {drawPct > 8 && `${drawPct}%`}
      </div>
      <div
        className="bg-red-500 text-white text-center whitespace-nowrap"
        style={{ width: `${awayWinPct}%` }}
      >
        {awayWinPct > 8 && `${awayWinPct}%`}
      </div>
    </div>
  );
}

/** Badge de cote */
export function OddsBadge({ odds }: { odds: OddsTriple }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-mono">
        1: {odds.home.toFixed(2)}
      </span>
      <span className="px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-300 font-mono">
        X: {odds.draw.toFixed(2)}
      </span>
      <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 font-mono">
        2: {odds.away.toFixed(2)}
      </span>
    </div>
  );
}

/** Formatte une date ISO en heure locale */
export function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Spinner simple */
export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
    </div>
  );
}

/** Message d'erreur */
export function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
      ❌ {message}
    </div>
  );
}
