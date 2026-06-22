import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, PageHeader, Panel, SectionTitle, StatCard } from '../components/ui'
import { CellVoltageBar, ConfidenceGauge, TrendChart } from '../components/charts'
import { useAppStore } from '../store/appStore'
import { numberFmt, percentFmt, shortTime } from '../utils/format'
import { STATUS_COLORS, CELL_VOLTAGE_FIELDS, getNumeric } from '../config/schema'


function buildChartData(history) {
  return [...history].reverse().slice(-80).map((item, index) => {
    const point = {
      label: item.row_reference?.TIME ?? index,
      current: item.values?.SUM_CURRENT ?? 0
    }
    CELL_VOLTAGE_FIELDS.forEach(field => {
      point[field] = getNumeric(item.row, field, 0)
    })
    return point
  })
}

function toneFor(prediction) {
  return STATUS_COLORS[prediction] ?? 'slate'
}

export default function Dashboard() {
  const [expandedChart, setExpandedChart] = useState(null)
  const latest = useAppStore(state => state.latestPrediction)
  const history = useAppStore(state => state.predictionHistory)
  const settings = useAppStore(state => state.settings)
  const updateSettings = useAppStore(state => state.updateSettings)
  const dataset = useAppStore(state => state.getActiveDataset())
  const currentRow = useAppStore(state => state.getCurrentRow())
  const connection = useAppStore(state => state.connection)


  const displayRow = latest ? latest.row : (history.length > 0 ? currentRow : null)
  const showValues = !!(latest || (history.length > 0 && displayRow))
  const chartData = buildChartData(history)
  const faultTone = latest?.fault ? toneFor(latest.class_name) : latest ? 'green' : 'slate'

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow=""
        title="Battery Anomaly Monitoring Dashboard"
        description=""
        
      />

      <Panel className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <Badge tone={settings.apiMode === 'esp32' ? 'cyan' : 'violet'}>{settings.apiMode.toUpperCase()}</Badge>
              <Badge tone={faultTone}>{latest?.class_name ?? 'Waiting'}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard tone="blue" label="Voltage" value={showValues ? numberFmt(latest?.values?.SUM_VOLTAGE ?? getNumeric(displayRow, 'SUM_VOLTAGE', 0), 2) : '—'} unit="V" sub="Pack voltage" />
              <StatCard tone="cyan" label="Current" value={showValues ? numberFmt(latest?.values?.SUM_CURRENT ?? getNumeric(displayRow, 'SUM_CURRENT', 0), 3) : '—'} unit="A" sub="Pack current" />
              <StatCard tone="amber" label="Temperature" value={showValues ? numberFmt(latest?.values?.MAX_TEMP ?? getNumeric(displayRow, 'MAX_TEMP', 0), 1) : '—'} unit="°C" sub="Maximum temperature" />
              <StatCard tone="green" label="SOC" value={showValues ? numberFmt(latest?.values?.SOC ?? getNumeric(displayRow, 'SOC', 0), 1) : '—'} unit="%" sub="State of charge" />
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.035] p-6 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ConfidenceGauge value={latest?.confidence ?? 0} />
              <p className="mt-2 font-display text-2xl font-black text-white">{latest?.class_name ?? 'No Prediction'}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge tone={faultTone}>{latest?.fault ? 'Fault' : latest ? 'Normal / Waiting' : 'Idle'}</Badge>
                {latest && <Badge tone="slate">{percentFmt(latest.confidence)}</Badge>}
                {latest && <Badge tone="slate">{numberFmt(latest.latency_ms, 1)} ms</Badge>}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            eyebrow="Graph"
            title="Voltage vs Time"
            right={
              <Button
                variant="ghost"
                className="h-8 w-8 !p-0 flex items-center justify-center rounded-xl text-lg text-ink-300 hover:text-white hover:bg-white/[0.08]"
                onClick={() => setExpandedChart('voltage')}
              >
                ⛶
              </Button>
            }
          />
          {chartData.length > 1 ? (
            <TrendChart
              data={chartData}
              height={285}
              series={CELL_VOLTAGE_FIELDS.map((field, idx) => ({
                key: field,
                name: `V${idx + 1}`,
                color: `hsl(${(idx * 13) % 360}, 85%, 65%)`,
                strokeWidth: 1.2
              }))}
            />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-ink-400">No voltage data yet.</div>
          )}
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Graph"
            title="Current vs Time"
            right={
              <Button
                variant="ghost"
                className="h-8 w-8 !p-0 flex items-center justify-center rounded-xl text-lg text-ink-300 hover:text-white hover:bg-white/[0.08]"
                onClick={() => setExpandedChart('current')}
              >
                ⛶
              </Button>
            }
          />
          {chartData.length > 1 ? (
            <TrendChart
              data={chartData}
              height={285}
              series={[{ key: 'current', name: 'Current A', color: '#00d4ff' }]}
            />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-ink-400">No current data yet.</div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel>
          <SectionTitle
            eyebrow="Latest Row"
            title="Individual Cell Voltages"
            right={
              <Button
                variant="ghost"
                className="h-8 w-8 !p-0 flex items-center justify-center rounded-xl text-lg text-ink-300 hover:text-white hover:bg-white/[0.08]"
                onClick={() => setExpandedChart('cellVoltage')}
              >
                ⛶
              </Button>
            }
          />
          {displayRow ? (
            <CellVoltageBar row={displayRow} height={300} />
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-ink-400">
              No cell voltage data yet.
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle eyebrow="History" title="Prediction History & Logs" right={<Link to="/logs"><Button variant="ghost">Logs</Button></Link>} />
          <div className="overflow-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th className="table-th">Time</th>
                  <th className="table-th">Prediction</th>
                  <th className="table-th">Window</th>
                  <th className="table-th">Fault</th>
                  <th className="table-th">Confidence</th>
                  <th className="table-th">Latency</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.035]">
                    <td className="table-td font-mono text-xs">{shortTime(item.time)}</td>
                    <td className="table-td"><Badge tone={toneFor(item.class_name)}>{item.class_name}</Badge></td>
                    <td className="table-td">{item.window_ready === true ? 'Ready' : item.window_ready === false ? 'Filling' : '—'}</td>
                    <td className="table-td">{item.fault ? 'Yes' : 'No'}</td>
                    <td className="table-td">{item.confidence != null ? percentFmt(item.confidence) : '—'}</td>
                    <td className="table-td">{item.latency_ms != null ? `${numberFmt(item.latency_ms, 1)} ms` : '—'}</td>
                  </tr>
                ))}
                {!history.length && <tr><td className="table-td text-center text-ink-400" colSpan="6">No responses yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {expandedChart && (
        <div className="fixed inset-0 bg-night-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl rounded-3xl border border-white/10 bg-night-950/95 p-6 shadow-soft flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              className="absolute right-6 top-6 h-10 w-10 flex items-center justify-center rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xl font-bold transition"
              onClick={() => setExpandedChart(null)}
            >
              ✕
            </button>
            <div className="mb-2">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-cyan">Expanded View</p>
              <h2 className="font-display text-2xl font-black text-white mt-1">
                {expandedChart === 'voltage' ? 'Voltage vs Time' : expandedChart === 'current' ? 'Current vs Time' : 'Individual Cell Voltages'}
              </h2>
            </div>
            <div className="flex-1 min-h-[400px] lg:min-h-[500px]">
              {expandedChart === 'voltage' && (
                <TrendChart
                  data={chartData}
                  height={500}
                  series={CELL_VOLTAGE_FIELDS.map((field, idx) => ({
                    key: field,
                    name: `V${idx + 1}`,
                    color: `hsl(${(idx * 13) % 360}, 85%, 65%)`,
                    strokeWidth: 1.6
                  }))}
                />
              )}
              {expandedChart === 'current' && (
                <TrendChart
                  data={chartData}
                  height={500}
                  series={[{ key: 'current', name: 'Current A', color: '#00d4ff', strokeWidth: 3 }]}
                />
              )}
              {expandedChart === 'cellVoltage' && (
                displayRow ? (
                  <CellVoltageBar row={displayRow} height={500} />
                ) : (
                  <div className="flex h-[500px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-ink-400">
                    No cell voltage data yet.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
