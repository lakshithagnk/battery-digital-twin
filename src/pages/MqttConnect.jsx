import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { mqttManager } from '../services/mqttClient'
import { DEFAULT_REQUEST_TIMEOUT_MS } from '../config/schema'
import { buildPayload, parsePrediction } from '../services/apiClient'
import { Badge, Button, Input, JsonBlock, PageHeader, Panel, SectionTitle, StatusDot } from '../components/ui'
import { numberFmt } from '../utils/format'

/* ── helpers ─────────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    online:     { tone: 'green',  label: 'Connected' },
    connecting: { tone: 'amber',  label: 'Connecting…' },
    error:      { tone: 'red',    label: 'Error' },
    offline:    { tone: 'slate',  label: 'Offline' }
  }
  const { tone, label } = map[status] ?? map.offline
  return <Badge tone={tone}>{label}</Badge>
}

/* ── main page ───────────────────────────────────────────────────────────── */

export default function MqttConnect() {
  const settings      = useAppStore(state => state.settings)
  const updateSettings = useAppStore(state => state.updateSettings)
  const connection    = useAppStore(state => state.connection)
  const setConnection = useAppStore(state => state.setConnection)
  const addLog        = useAppStore(state => state.addLog)
  const addPrediction = useAppStore(state => state.addPrediction)
  const row           = useAppStore(state => state.getCurrentRow())

  const [mqttStatus, setMqttStatus] = useState(mqttManager.status)
  const [statusDetail, setStatusDetail] = useState(null)
  const [testResult, setTestResult]   = useState(null)
  const [testing, setTesting]         = useState(false)

  // Keep local status in sync with the singleton
  useEffect(() => {
    setMqttStatus(mqttManager.status)
    const poll = setInterval(() => setMqttStatus(mqttManager.status), 1000)
    return () => clearInterval(poll)
  }, [])

  function patchMqtt(patch) {
    updateSettings({ mqtt: { ...settings.mqtt, ...patch } })
  }

  function handleConnect() {
    mqttManager.connect(settings, (status, detail) => {
      setMqttStatus(status)
      setStatusDetail(detail ?? null)
      setConnection({ mqttStatus: status })
      if (status === 'online')  addLog('info', 'mqtt', 'MQTT broker connected.')
      if (status === 'error')   addLog('error', 'mqtt', `MQTT error: ${detail ?? 'unknown'}`)
      if (status === 'offline') addLog('warning', 'mqtt', 'MQTT connection lost.')
    })
    updateSettings({ apiMode: 'mqtt' })
  }

  function handleDisconnect() {
    mqttManager.disconnect()
    setMqttStatus('offline')
    setConnection({ mqttStatus: 'offline' })
    addLog('info', 'mqtt', 'MQTT disconnected by user.')
  }

  async function sendTestPacket() {
    if (!mqttManager.isConnected) return
    setTesting(true)
    setTestResult(null)
    try {
      const payload = buildPayload(row ?? {}, { ...settings, apiMode: 'mqtt' })
      const started = performance.now()
      const raw = await mqttManager.publishAndWait(payload, Math.max(settings.requestTimeoutMs || 0, DEFAULT_REQUEST_TIMEOUT_MS))
      const rtt = Math.round(performance.now() - started)
      const prediction = parsePrediction(raw, row, 'mqtt', rtt)
      addPrediction(prediction)
      setTestResult({ ok: true, rtt, raw })
      setConnection({ lastRoundTripMs: rtt, lastConnectionTest: new Date().toISOString() })
      addLog('info', 'mqtt', `MQTT test OK: ${prediction.class_name}`, { raw })
    } catch (err) {
      setTestResult({ ok: false, error: err.message })
      addLog('error', 'mqtt', `MQTT test failed: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  const mqtt = settings.mqtt ?? {}
  const isOnline = mqttStatus === 'online'

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6">
      <PageHeader
        title="MQTT Settings"
        description="Connect via an MQTT cloud broker — works from GitHub Pages over the internet."
        actions={
          isOnline
            ? <Button variant="danger" onClick={handleDisconnect}>Disconnect</Button>
            : <Button variant="cyan" onClick={handleConnect}>Connect to Broker</Button>
        }
      />

      {/* ── Architecture diagram ─────────────────────────────────────────── */}
      <Panel>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="mini-card">
            <p className="label">Status</p>
            <div className="mt-2"><StatusBadge status={mqttStatus} /></div>
            {statusDetail && <p className="mt-1 text-xs text-red-400 truncate">{statusDetail}</p>}
          </div>
          <div className="mini-card">
            <p className="label">Mode</p>
            <Badge tone={settings.apiMode === 'mqtt' ? 'cyan' : 'slate'} className="mt-2">{settings.apiMode.toUpperCase()}</Badge>
          </div>
          <div className="mini-card">
            <p className="label">Round Trip</p>
            <p className="mt-2 font-display text-2xl font-black text-brand-cyan">{numberFmt(connection.lastRoundTripMs, 0)}</p>
            <p className="text-xs text-ink-400">ms</p>
          </div>
          <div className="mini-card">
            <p className="label">Protocol</p>
            <p className="mt-2 font-black text-white">MQTT 3.1.1</p>
            <p className="text-xs text-ink-400">over WebSocket</p>
          </div>
        </div>
      </Panel>

      {/* ── Broker settings ──────────────────────────────────────────────── */}
      <Panel>
        <SectionTitle eyebrow="Configuration" title="Broker Settings" />
        <div className="mt-4 space-y-4">
          <Input
            label="Broker URL  (wss:// for secure)"
            value={mqtt.brokerUrl ?? ''}
            onChange={e => patchMqtt({ brokerUrl: e.target.value })}
            placeholder="wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Username (leave blank if public broker)"
              value={mqtt.username ?? ''}
              onChange={e => patchMqtt({ username: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              value={mqtt.password ?? ''}
              onChange={e => patchMqtt({ password: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Client ID (auto-generated if blank)"
              value={mqtt.clientId ?? ''}
              onChange={e => patchMqtt({ clientId: e.target.value })}
              placeholder="bms-web-abc123"
            />
            <Input
              label="Request Timeout (ms)"
              type="number"
              value={settings.requestTimeoutMs ?? ''}
              onChange={e => {
                const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0)
                updateSettings({ requestTimeoutMs: val })
              }}
              placeholder="15000"
            />
          </div>
        </div>
      </Panel>

      {/* ── Test ─────────────────────────────────────────────────────────── */}
      <Panel>
        <SectionTitle eyebrow="Test" title="Send Test Packet" />
        <div className="mt-4 space-y-3">
          <Button
            variant="cyan"
            className="w-full"
            onClick={sendTestPacket}
            disabled={!isOnline || testing}
          >
            {testing ? 'Waiting for ESP32 response…' : 'Publish 31-Feature Packet → Wait for Prediction'}
          </Button>
          {!isOnline && (
            <p className="text-center text-xs text-ink-400">Connect to the broker above first.</p>
          )}
          {testResult && (
            <div className={`rounded-2xl border p-4 text-xs ${testResult.ok ? 'border-brand-green/30 bg-brand-green/10' : 'border-red-500/30 bg-red-500/10'}`}>
              {testResult.ok
                ? <p className="font-bold text-emerald-300">✓ Response received in {testResult.rtt} ms</p>
                : <p className="font-bold text-red-400">✗ {testResult.error}</p>}
            </div>
          )}
          {testResult?.raw && <JsonBlock data={testResult.raw} label="ESP32 response" />}
        </div>
      </Panel>
    </div>
  )
}
