import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import DailyPage from './pages/DailyPage';
import HistoryPage from './pages/HistoryPage';
import SimilarPage from './pages/SimilarPage';
import UpcomingPage from './pages/UpcomingPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ── Navbar ── */}
        <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8">
            <span className="text-purple-400 font-bold text-xl tracking-tight select-none">
              ⚽ Bet261
            </span>
            <nav className="flex gap-2">
              {[
                { to: '/',        label: '📅 Daily' },
                { to: '/history', label: '📜 Historique' },
                { to: '/similar',  label: '🔍 Similaires' },
                { to: '/upcoming', label: '⏰ À venir' },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        {/* ── Pages ── */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/"        element={<DailyPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/similar"  element={<SimilarPage />} />
            <Route path="/upcoming" element={<UpcomingPage />} />
          </Routes>
        </main>

        <footer className="text-center text-gray-600 text-xs py-4 border-t border-gray-800">
          Bet261 — Analyse de cotes virtuelles
        </footer>
      </div>
    </BrowserRouter>
  );
}
