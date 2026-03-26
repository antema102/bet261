import { Routes, Route, NavLink } from 'react-router-dom';
import DailyPage from './pages/DailyPage';
import HistoryPage from './pages/HistoryPage';
import SimilarPage from './pages/SimilarPage';

const navItems = [
  { to: '/', label: '📊 Prédictions du jour' },
  { to: '/history', label: '📜 Historique' },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ─────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-400 tracking-tight">
            ⚽ Bet261 — Virtual Sports
          </h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<DailyPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/similar" element={<SimilarPage />} />
        </Routes>
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-600 py-4 border-t border-gray-800">
        Bet261 Virtual Sports Analyzer — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
