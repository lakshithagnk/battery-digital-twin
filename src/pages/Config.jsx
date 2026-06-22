import { useMemo } from 'react'
import { BASE_MODEL_FIELDS, CELL_VOLTAGE_FIELDS, DATASET_COLUMNS, DEFAULT_SELECTED_FEATURES, UI_ONLY_FIELDS } from '../config/schema'
import { buildPayload } from '../services/apiClient'
import { useAppStore } from '../store/appStore'
import { Badge, Button, Input, JsonBlock, PageHeader, Panel, SectionTitle, Select } from '../components/ui'

export default function Config() {
  const settings = useAppStore(state => state.settings)
  const updateSettings = useAppStore(state => state.updateSettings)
  const resetSettings = useAppStore(state => state.resetSettings)
  const row = useAppStore(state => state.getCurrentRow())
  const payload = useMemo(() => buildPayload(row ?? {}, settings), [row, settings])

  function toggleFeature(field) {
    if (BASE_MODEL_FIELDS.includes(field)) return
    const selected = new Set(settings.selectedFeatures)
    if (selected.has(field)) selected.delete(field)
    else selected.add(field)
    updateSettings({ selectedFeatures: [...BASE_MODEL_FIELDS, ...CELL_VOLTAGE_FIELDS.filter(item => selected.has(item))] })
  }

  function selectAll28() {
    updateSettings({ selectedFeatures: [...BASE_MODEL_FIELDS, ...CELL_VOLTAGE_FIELDS] })
  }

  function resetFeatures() {
    updateSettings({ selectedFeatures: DEFAULT_SELECTED_FEATURES })
  }

  const selectedCellCount = settings.selectedFeatures.filter(field => field.startsWith('VOLT_')).length
  const isThirtyOne = settings.selectedFeatures.length === 31

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Input Format and Dataset Structure"
        description="ESP32 mode sends exactly { features: [31 raw numeric values] }. Keep all 28 cell voltages selected for the real firmware."
        actions={
          <>
            <Button variant="ghost" onClick={resetSettings}>Reset All Settings</Button>
            <Button variant="cyan" onClick={resetFeatures}>Reset Features</Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel>
            <SectionTitle eyebrow="API Payload" title="Request JSON Shape" description="Choose what the frontend sends to ESP32-S3 or FastAPI." />
            <div className="space-y-4">
              <Select label="Payload Shape" value={settings.payloadShape} onChange={event => updateSettings({ payloadShape: event.target.value })}>
                <option value="features">ESP32: features array only</option>
                <option value="hybrid">Hybrid: features + input array + names</option>
                <option value="flat">Flat object: TIME, SOC, VOLT_1...</option>
                <option value="array">Array object: input + feature_names</option>
              </Select>
              <Select label="Include metadata" value={settings.includeMeta ? 'yes' : 'no'} onChange={event => updateSettings({ includeMeta: event.target.value === 'yes' })}>
                <option value="yes">Yes, include UI-only reference fields</option>
                <option value="no">No, send only model input</option>
              </Select>
              <Input label="Request timeout" type="number" value={settings.requestTimeoutMs} onChange={event => updateSettings({ requestTimeoutMs: Number(event.target.value) })} hint="Used for ESP32 and FastAPI requests." />
              <Input label="Real playback interval" type="number" value={settings.playbackIntervalMs} onChange={event => updateSettings({ playbackIntervalMs: Number(event.target.value) })} hint="20000 ms means one row every 20 seconds." />
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Feature Count" title="Selected Model Features" />
            <div className="grid grid-cols-2 gap-3">
              <div className="mini-card"><p className="label">Base Features</p><p className="font-display text-3xl font-black text-brand-cyan">{BASE_MODEL_FIELDS.length}</p></div>
              <div className="mini-card"><p className="label">Cell Voltages</p><p className="font-display text-3xl font-black text-brand-violet">{selectedCellCount}</p></div>
              <div className="mini-card"><p className="label">Total Sent</p><p className="font-display text-3xl font-black text-white">{settings.selectedFeatures.length}</p></div>
              <div className="mini-card"><p className="label">31 Feature Match</p><p className={`font-display text-3xl font-black ${isThirtyOne ? 'text-brand-green' : 'text-brand-amber'}`}>{isThirtyOne ? 'YES' : 'NO'}</p></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-400">The real ESP32 firmware expects exactly 31 values in this order: SUM_CURRENT, MAX_TEMP, MIN_TEMP, then VOLT_1 to VOLT_28. Do not send SOC, TIME, or normalized values to ESP32.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={selectAll28}>Use ESP32 31 Features</Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <SectionTitle eyebrow="Dataset Columns" title="Original Dataset Structure" description="These columns are stored in the web app. Only selected model features are transmitted." />
            <div className="flex flex-wrap gap-2">
              {DATASET_COLUMNS.map(column => (
                <Badge key={column} tone={settings.selectedFeatures.includes(column) ? 'cyan' : UI_ONLY_FIELDS.includes(column) ? 'amber' : 'slate'}>
                  {column}
                </Badge>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Model Input" title="Feature Selection" description="Base features are locked. Cell voltage features are selectable." />
            <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="label">Locked Base Features</p>
              <div className="flex flex-wrap gap-2">
                {BASE_MODEL_FIELDS.map(field => <Badge key={field} tone="blue">{field}</Badge>)}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
              {CELL_VOLTAGE_FIELDS.map(field => (
                <button
                  key={field}
                  onClick={() => toggleFeature(field)}
                  className={`rounded-2xl border px-3 py-3 text-left text-xs font-black transition ${settings.selectedFeatures.includes(field) ? 'border-brand-cyan/45 bg-brand-cyan/15 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-ink-400 hover:bg-white/[0.07]'}`}
                >
                  {field}
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Preview" title="Current Request Payload" description="This is the exact structure sent to the selected API mode." />
            <JsonBlock data={payload} />
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Expected Output" title="Recommended Response Format" />
            <JsonBlock data={{
              status: 'ok',
              window_ready: true,
              prediction: 'Normal',
              confidence: 94.0,
              fault: false,
              fault_count: 0,
              latency_ms: 22.5,
              message: 'Battery operating normally',
              SUM_CURRENT: -1.24,
              SOC: 72.5,
              MAX_TEMP: 31.8,
              MIN_CELL_VOLT: 3.61
            }} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
