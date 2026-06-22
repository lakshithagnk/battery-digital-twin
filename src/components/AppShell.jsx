import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { Badge, StatusDot, Button } from './ui'
import { useLiveEngine } from '../hooks/useLiveEngine'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⬡' },
  { path: '/logs', label: 'Logs', icon: '☰' }
]

function modeTone(mode) {
  if (mode === 'mock')    return 'violet'
  if (mode === 'esp32')   return 'cyan'
  if (mode === 'fastapi') return 'green'
  if (mode === 'mqtt')    return 'amber'
  return 'slate'
}

function SettingsDropdown() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <Button
        variant="ghost"
        className="h-8 w-8 !p-0 flex items-center justify-center rounded-xl text-lg text-ink-300 hover:text-white hover:bg-white/[0.08]"
        onClick={() => setOpen(!open)}
      >
        ⋮
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-white/10 bg-night-950/95 p-2 shadow-soft backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <Link
            to="/datasets"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-ink-300 hover:bg-white/[0.08] hover:text-white transition"
            onClick={() => setOpen(false)}
          >
            <span className="text-lg">▦</span> Manage Datasets
          </Link>
          <Link
            to="/esp32"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-ink-300 hover:bg-white/[0.08] hover:text-white transition"
            onClick={() => setOpen(false)}
          >
            <span className="text-lg">⌁</span> HTTP Connection Settings
          </Link>
          <Link
            to="/mqtt"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-ink-300 hover:bg-white/[0.08] hover:text-white transition"
            onClick={() => setOpen(false)}
          >
            <span className="text-lg">⇄</span> MQTT Settings
          </Link>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ children }) {
  const location = useLocation()
  const settings = useAppStore(state => state.settings)
  const updateSettings = useAppStore(state => state.updateSettings)
  const activeDataset = useAppStore(state => state.getActiveDataset())
  const connection = useAppStore(state => state.connection)
  const { live, start, pause } = useLiveEngine()

  const pageLabels = {
    '/': 'Dashboard',
    '/datasets': 'Datasets',
    '/esp32': 'HTTP Connection',
    '/logs': 'Logs'
  }
  const pageLabel = pageLabels[location.pathname] ?? 'Dashboard'

  function useEsp32Mode() {
    updateSettings(s => ({
      apiMode: 'esp32',
      payloadShape: 'features',
      includeMeta: false,
      live: {
        ...(s.live ?? {}),
        sendWindow: false
      }
    }))
  }

  return (
    <div className="app-bg grid-bg min-h-screen overflow-hidden text-ink-100">
      <div className="flex h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-night-950/70 backdrop-blur-2xl lg:flex lg:flex-col">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/15 text-xl shadow-blue">🔋</div>
              <div>
                <p className="font-display text-lg font-black leading-tight text-white">Battery Monitor</p>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Anomaly Detection</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    isActive
                      ? 'border border-brand-cyan/25 bg-brand-blue/15 text-white shadow-blue'
                      : 'text-ink-300 hover:bg-white/[0.06] hover:text-white'
                  }`
                }
              >
                <span className="w-6 text-center text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="label">Active Mode</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge tone={modeTone(settings.apiMode)}>{settings.apiMode.toUpperCase()}</Badge>
                <StatusDot status={
                  settings.apiMode === 'mock'    ? 'testing'
                  : settings.apiMode === 'mqtt'  ? connection.mqttStatus ?? 'offline'
                  : connection.esp32Status === 'online' ? 'online' : 'idle'
                } />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-ink-400">
              <p className="truncate font-bold text-ink-200">{activeDataset?.name ?? 'No dataset selected'}</p>
              <p className="mt-1">{activeDataset?.rows?.length ?? 0} rows</p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative z-20 flex min-h-16 items-center gap-3 border-b border-white/10 bg-night-950/45 px-4 backdrop-blur-2xl lg:px-7">
            <div className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/15">🔋</div>
            <div>
              <h2 className="font-display text-lg font-black text-white">{pageLabel}</h2>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {live.running && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/35 bg-brand-green/15 px-2.5 py-1 text-xs font-black text-emerald-100 mr-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-green" /> LIVE
                </span>
              )}
              <Button
                variant={settings.apiMode === 'esp32' ? 'cyan' : 'ghost'}
                className="hidden md:inline-flex px-3 py-1.5 text-xs font-bold transition"
                onClick={useEsp32Mode}
              >
                Use ESP32 HTTP
              </Button>
              <select
                className="hidden sm:inline-block rounded-2xl border border-white/10 bg-night-900/80 px-3 py-1.5 text-xs font-bold text-ink-200 hover:border-brand-cyan/50 hover:bg-white/[0.09] outline-none transition cursor-pointer"
                value={settings.live?.intervalMs ?? 10000}
                onChange={e => updateSettings(s => ({ live: { ...s.live, intervalMs: Number(e.target.value) } }))}
              >
                <option value={10000} className="bg-night-950">10s Interval</option>
                <option value={5000} className="bg-night-950">5s Interval</option>
                <option value={2000} className="bg-night-950">2s Interval</option>
                <option value={1000} className="bg-night-950">1s Interval</option>
                <option value={500} className="bg-night-950">0.5s Interval</option>
                <option value={200} className="bg-night-950">0.2s Interval</option>
                <option value={100} className="bg-night-950">0.1s Interval</option>
              </select>
              {live.running ? (
                <Button variant="danger" className="px-3 py-1.5 text-xs font-bold" onClick={pause}>
                  Stop Stream
                </Button>
              ) : (
                <Button variant="green" className="px-3 py-1.5 text-xs font-bold" onClick={start}>
                  Start Stream
                </Button>
              )}
              <SettingsDropdown />
            </div>
          </header>

          <div className="border-b border-white/10 bg-night-950/55 p-2 backdrop-blur-xl lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${isActive ? 'bg-brand-blue text-white' : 'bg-white/[0.06] text-ink-300'}`}
                >
                  {item.icon} {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
