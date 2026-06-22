import { useMemo, useState } from 'react'
import { API_CONTRACT } from '../config/helpText'
import { useAppStore } from '../store/appStore'
import { buildPayload, callHttpPredict, parsePrediction, trimUrl } from '../services/apiClient'
import { Badge, Button, Input, JsonBlock, PageHeader, Panel, SectionTitle, Select, StatusDot } from '../components/ui'
import { numberFmt } from '../utils/format'

export default function Esp32Connect() {
  const settings = useAppStore(state => state.settings)
  const updateSettings = useAppStore(state => state.updateSettings)
  const row = useAppStore(state => state.getCurrentRow())
  const addPrediction = useAppStore(state => state.addPrediction)
  const addLog = useAppStore(state => state.addLog)
  const connection = useAppStore(state => state.connection)
  const setConnection = useAppStore(state => state.setConnection)
  const [testing, setTesting] = useState(false)
  const [response, setResponse] = useState(null)

  const payload = useMemo(() => buildPayload(row ?? {}, { ...settings, apiMode: 'esp32', payloadShape: 'features' }), [row, settings])
  const dataUrl = `${trimUrl(settings.esp32.httpBaseUrl)}${settings.esp32.httpPredictEndpoint}`

  function patchEsp32(patch) {
    updateSettings({ esp32: { ...settings.esp32, ...patch } })
  }

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

  async function sendHttpRow() {
    setTesting(true)
    setConnection({ esp32Status: 'testing' })
    try {
      const result = await callHttpPredict({ url: dataUrl, method: 'POST', payload, timeoutMs: settings.requestTimeoutMs })
      const prediction = parsePrediction(result.raw, row, 'esp32-http', result.roundTripMs)
      addPrediction(prediction)
      setResponse(result.raw)
      setConnection({ esp32Status: 'online', lastRoundTripMs: result.roundTripMs, lastConnectionTest: new Date().toISOString() })
      addLog('info', 'esp32', `ESP32 POST response: ${prediction.class_name}`, { payload, response: result.raw })
    } catch (error) {
      setConnection({ esp32Status: 'error' })
      setResponse({ status: 'error', error: error.message })
      addLog('error', 'esp32', `ESP32 POST failed: ${error.message}`, { payload })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
      <PageHeader
        title="HTTP Connection"
        description=""
        actions={
          <>
            <Button variant="ghost" onClick={useEsp32Mode}>Use ESP32 Mode</Button>
            <Button variant="cyan" onClick={sendHttpRow} disabled={testing}>Send Test Packet</Button>
          </>
        }
      />

      <div className="w-full">
        <div className="space-y-4 md:space-y-5">
          <Panel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="mini-card"><p className="label">SSID</p><p className="mt-2 break-all font-black text-white">{settings.esp32.ssid}</p></div>
              <div className="mini-card"><p className="label">Password</p><p className="mt-2 font-mono font-black text-white">{settings.esp32.password}</p></div>
              <div className="mini-card"><p className="label">Device IP</p><p className="mt-2 font-mono font-black text-white">192.168.4.1</p></div>
              <div className="mini-card"><p className="label">Port</p><p className="mt-2 font-display text-2xl font-black text-brand-cyan">80</p></div>
            </div>
          </Panel>

          <Panel>
            <div className="space-y-4">
              <Input label="ESP32 Base URL" value={settings.esp32.httpBaseUrl} onChange={event => patchEsp32({ httpBaseUrl: event.target.value })} placeholder="http://192.168.4.1" />
              <Input label="Data Endpoint" value={settings.esp32.httpPredictEndpoint} onChange={event => patchEsp32({ httpPredictEndpoint: event.target.value })} placeholder="/data" />
              <Select
                label="Stream Interval"
                value={settings.live?.intervalMs ?? 10000}
                onChange={event => updateSettings(s => ({ live: { ...s.live, intervalMs: Number(event.target.value) } }))}
              >
                <option value={10000}>10 seconds (Normal)</option>
                <option value={5000}>5 seconds</option>
                <option value={2000}>2 seconds</option>
                <option value={1000}>1 second (Fast)</option>
                <option value={500}>0.5 seconds</option>
                <option value={200}>0.2 seconds</option>
                <option value={100}>0.1 seconds (Demo)</option>
              </Select>
              <Input label="Request Timeout (ms)" type="number" value={settings.requestTimeoutMs} onChange={event => updateSettings({ requestTimeoutMs: Number(event.target.value) })} />
              <Button variant="cyan" className="w-full" onClick={sendHttpRow} disabled={testing}>POST One 31-Feature Packet</Button>
            </div>
          </Panel>

          <Panel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="mini-card"><p className="label">HTTP</p><p className="mt-2 flex items-center gap-2 font-black text-white"><StatusDot status={connection.esp32Status} />{connection.esp32Status}</p></div>
              <div className="mini-card"><p className="label">Round Trip</p><p className="mt-2 font-display text-2xl font-black text-brand-cyan">{numberFmt(connection.lastRoundTripMs, 0)}</p><p className="text-xs text-ink-400">ms</p></div>
              <div className="mini-card"><p className="label">Mode</p><Badge tone={settings.apiMode === 'esp32' ? 'cyan' : 'slate'}>{settings.apiMode}</Badge></div>
              <div className="mini-card"><p className="label">Payload</p><p className="mt-2 font-display text-2xl font-black text-white">31</p><p className="text-xs text-ink-400">raw values</p></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
