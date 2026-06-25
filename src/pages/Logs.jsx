import { Badge, Button, PageHeader, Panel } from '../components/ui'
import { useAppStore } from '../store/appStore'
import { downloadFile, percentFmt, shortTime } from '../utils/format'
import { STATUS_COLORS } from '../config/schema'

export default function Logs() {
  const logs = useAppStore(state => state.logs)
  const history = useAppStore(state => state.predictionHistory)
  const activeSessionNo = useAppStore(state => state.activeSessionNo)
  const clearLogs = useAppStore(state => state.clearLogs)
  const clearPredictions = useAppStore(state => state.clearPredictions)

  function exportData() {
    downloadFile(
      'battery-system-history.json',
      JSON.stringify({ predictionHistory: history, logs }, null, 2),
      'application/json'
    )
  }

  function handleClearAll() {
    clearLogs()
    clearPredictions()
  }

  return (
    <div className="mx-auto w-full space-y-4 md:space-y-6">
      <PageHeader
        eyebrow=""
        title="Inference History & System Logs"
        description="View past battery anomaly classifications, backend model responses, and system event consoles."
        actions={
          <>
            <Button variant="ghost" onClick={exportData}>Export Logs (JSON)</Button>
            <Button variant="danger" onClick={handleClearAll}>Clear History</Button>
          </>
        }
      />

      <div className="w-full space-y-4 md:space-y-6">
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-cyan">History</p>
              <h2 className="font-display text-xl font-black text-white mt-1">Prediction Records</h2>
            </div>
            <Badge tone="blue">{history.length} records</Badge>
          </div>

          <div className="max-h-[500px] overflow-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th className="table-th">Time</th>
                  <th className="table-th">Prediction</th>
                  <th className="table-th">Confidence</th>
                  <th className="table-th hidden sm:table-cell">Latency</th>
                  <th className="table-th hidden sm:table-cell">Status / Info</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = []
                  let lastSessionNo = null

                  history.forEach((item) => {
                    const itemSession = item.sessionNo || 1
                    if (itemSession !== lastSessionNo) {
                      const isActive = itemSession === activeSessionNo
                      rows.push(
                        <tr key={`session-divider-${itemSession}`} className={isActive ? "bg-brand-cyan/10 border-y border-brand-cyan/20 animate-in fade-in duration-200" : "bg-white/[0.03] border-y border-white/10"}>
                          <td colSpan={5} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-ink-300">
                            <span className={isActive ? "text-brand-cyan" : "text-ink-400"}>
                              Session {itemSession} — {shortTime(item.sessionStartTime || item.time)} {isActive && '(Active)'}
                            </span>
                          </td>
                        </tr>
                      )
                      lastSessionNo = itemSession
                    }

                    rows.push(
                      <tr key={item.id} className="hover:bg-white/[0.035]">
                        <td className="table-td font-mono text-xs">{shortTime(item.time)}</td>
                        <td className="table-td">
                          <Badge tone={STATUS_COLORS[item.class_name] ?? (item.fault ? 'red' : 'slate')}>
                            {item.class_name}
                          </Badge>
                        </td>
                        <td className="table-td font-mono">{item.confidence != null ? percentFmt(item.confidence) : '—'}</td>
                        <td className="table-td font-mono hidden sm:table-cell">{item.round_trip_ms != null ? `${item.round_trip_ms} ms` : '—'}</td>
                        <td className="table-td text-ink-300 hidden sm:table-cell">{item.message || '—'}</td>
                      </tr>
                    )
                  })

                  if (!history.length) {
                    return (
                      <tr>
                        <td className="table-td text-center text-ink-400" colSpan="5">
                          No prediction history yet.
                        </td>
                      </tr>
                    )
                  }

                  return rows
                })()}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-blue">Console</p>
              <h2 className="font-display text-lg font-black text-white mt-1">System Events Log</h2>
            </div>
            <Button variant="ghost" className="px-3 py-1.5 text-xs hover:border-brand-red/50 hover:bg-brand-red/10 hover:text-red-200" onClick={clearLogs}>
              Clear Event Console
            </Button>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs shadow-inner">
            <div className="max-h-[220px] overflow-auto space-y-1.5 scrollbar-thin">
              {logs.map(log => (
                <div key={log.id} className="flex flex-wrap gap-x-2 border-b border-white/[0.02] pb-1 last:border-0 last:pb-0">
                  <span className="text-ink-500">[{shortTime(log.time)}]</span>
                  <span className={`font-bold ${log.level === 'error' ? 'text-brand-red' : log.level === 'warning' ? 'text-brand-amber' : log.level === 'success' ? 'text-brand-green' : 'text-brand-blue'}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-ink-400">[{log.source}]</span>
                  <span className="text-ink-200">{log.message}</span>
                </div>
              ))}
              {!logs.length && <div className="text-ink-500 italic">Console idle. No events logged.</div>}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
