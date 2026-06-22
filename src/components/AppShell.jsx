import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { Badge, StatusDot, Button, Input } from './ui'
import { useLiveEngine } from '../hooks/useLiveEngine'
import { mqttManager } from '../services/mqttClient'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⬡' },
  { path: '/logs', label: 'Logs', icon: '☰' }
]

function modeTone(mode) {
  if (mode === 'mock')    return 'violet'
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
    '/logs': 'Logs'
  }
  const pageLabel = pageLabels[location.pathname] ?? 'Dashboard'

  // Interactive MQTT Login Overlay State
  const [showLogin, setShowLogin] = useState(false)
  const [localUser, setLocalUser] = useState(settings.mqtt?.username ?? '')
  const [localPass, setLocalPass] = useState(settings.mqtt?.password ?? '')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const addLog = useAppStore(state => state.addLog)
  const setConnection = useAppStore(state => state.setConnection)

  // Show login overlay on initial mount if not connected
  useEffect(() => {
    if (connection.mqttStatus !== 'online') {
      setShowLogin(true)
    }
  }, [])

  // Keep local user/password credentials updated if settings change
  useEffect(() => {
    setLocalUser(settings.mqtt?.username ?? '')
    setLocalPass(settings.mqtt?.password ?? '')
  }, [settings.mqtt?.username, settings.mqtt?.password])


  const handleMqttConnect = () => {
    setIsConnecting(true)
    setConnectError(null)

    const updatedSettings = {
      ...settings,
      apiMode: 'mqtt',
      mqtt: {
        ...settings.mqtt,
        username: localUser,
        password: localPass
      }
    }

    updateSettings(updatedSettings)

    mqttManager.connect(updatedSettings, (status, detail) => {
      // Update connection status in appStore
      setConnection({ mqttStatus: status })

      if (status === 'online') {
        setIsConnecting(false)
        setShowLogin(false)
        addLog('info', 'mqtt', 'Successfully connected to MQTT broker via login popup.')
      } else if (status === 'error') {
        setIsConnecting(false)
        setConnectError(detail ?? 'Failed to connect. Please check credentials.')
        addLog('error', 'mqtt', `MQTT login popup error: ${detail ?? 'unknown'}`)
      } else if (status === 'offline') {
        setIsConnecting(false)
      }
    })
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
                  settings.apiMode === 'mock' ? 'testing' : connection.mqttStatus ?? 'offline'
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

      {/* ── Premium Interactive MQTT Login Modal ───────────────────────────────── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-night-950/90 p-6 shadow-2xl backdrop-blur-2xl animate-modal-card">
            {/* Glow spots */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-brand-cyan/20 blur-3xl opacity-60" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-brand-blue/20 blur-3xl opacity-60" />
            
            {/* Header info */}
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-cyan/35 bg-brand-cyan/15 text-2xl shadow-blue animate-pulse">
                ⇄
              </div>
              <h3 className="mt-4 font-display text-xl font-black tracking-tight text-white sm:text-2xl">
                Login
              </h3>
            </div>

            {/* Inputs */}
            <div className="mt-6 space-y-4">
              <Input
                label="MQTT Username"
                value={localUser}
                onChange={e => setLocalUser(e.target.value)}
                placeholder="e.g. fypG21"
                disabled={isConnecting}
                className="focus-within:border-brand-cyan/50 transition"
              />
              <Input
                label="MQTT Password"
                type="password"
                value={localPass}
                onChange={e => setLocalPass(e.target.value)}
                placeholder="••••••••"
                disabled={isConnecting}
                className="focus-within:border-brand-cyan/50 transition"
              />
            </div>

            {/* Connection error report */}
            {connectError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-400">
                ✗ {connectError}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 space-y-3">
              <Button
                variant="cyan"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold shadow-blue hover:scale-[1.01] active:scale-[0.99] transition duration-150"
                onClick={handleMqttConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Connecting to Broker…
                  </>
                ) : (
                  'Connect to Broker'
                )}
              </Button>

              <button
                type="button"
                className="w-full flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold text-ink-300 hover:bg-white/[0.08] hover:text-white transition duration-150"
                onClick={() => setShowLogin(false)}
                disabled={isConnecting}
              >
                Configure Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
