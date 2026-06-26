import { NavLink, Outlet } from 'react-router-dom';
import { ImageIcon, Sparkles, Sun, Moon, Tv } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
      isActive
        ? theme === 'dark'
          ? 'bg-zinc-800 text-zinc-100 shadow-md border border-zinc-700/60'
          : 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
        : theme === 'dark'
          ? 'text-zinc-400 hover:text-zinc-200'
          : 'text-zinc-600 hover:text-zinc-900'
    }`;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 font-sans antialiased selection:bg-indigo-600 selection:text-white ${
        theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      <div
        className={`sticky top-0 z-50 border-b backdrop-blur-md ${
          theme === 'dark' ? 'bg-zinc-950/90 border-zinc-800' : 'bg-zinc-50/90 border-zinc-200'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`p-2 rounded-xl border shadow-md ${
                theme === 'dark'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200'
              }`}
            >
              <Tv className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-tight">eMedia IT Image Tools</p>
              <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Resizer &amp; AI Generate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex p-1 border rounded-xl shadow-inner ${
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-200/60 border-zinc-300/80'
              }`}
            >
              <NavLink to="/" end className={linkClass}>
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                Image Resizer
              </NavLink>
              <NavLink to="/ai-generate" className={linkClass}>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AI Generate
              </NavLink>
            </div>

            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 shadow-sm'
              }`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <Outlet context={{ theme }} />
    </div>
  );
}
