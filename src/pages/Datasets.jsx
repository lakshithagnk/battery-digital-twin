import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { parseBatteryFile, exportRowsCsv } from '../utils/fileParser'
import { downloadFile, fileSizeFmt, numberFmt } from '../utils/format'
import { Badge, Button, EmptyState, Input, PageHeader, Panel, ProgressBar, SectionTitle } from '../components/ui'

const DEFAULT_VIEW_COLUMNS = ['TIME', 'SUM_CURRENT', 'SOC', 'MIN_CELL_VOLT', 'MAX_TEMP', 'MIN_TEMP', 'SUM_VOLTAGE', 'MAX_CELL_VOLT', 'fault_label', 'fault_type']

function UploadBox() {
  const inputRef = useRef(null)
  const addDataset = useAppStore(state => state.addDataset)
  const addLog = useAppStore(state => state.addLog)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleFiles(files) {
    const list = Array.from(files ?? [])
    if (!list.length) return
    setLoading(true)
    try {
      for (const file of list) {
        const lower = file.name.toLowerCase()
        if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
          addLog('warning', 'dataset', `Skipped unsupported file: ${file.name}`)
          continue
        }
        const dataset = await parseBatteryFile(file)
        addDataset(dataset)
      }
    } catch (error) {
      addLog('error', 'dataset', error.message, { stack: error.stack })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-brand-cyan bg-brand-cyan/10' : 'border-white/15 bg-white/[0.03] hover:border-brand-blue/50'}`}
      onDragOver={event => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files) }}
    >
      <input ref={inputRef} type="file" className="hidden" multiple accept=".csv,.xlsx,.xls" onChange={event => handleFiles(event.target.files)} />
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-brand-cyan/30 bg-brand-cyan/10 text-3xl">⇪</div>
      <p className="font-display text-xl font-black text-white">Upload battery dataset</p>
      <p className="mt-2 text-sm text-ink-400">CSV, XLSX, or XLS files are uploaded as raw records for twin inference preview.</p>
      <Button className="mt-5" variant="cyan" onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? 'Parsing...' : 'Choose Files'}</Button>
    </div>
  )
}

export default function Datasets() {
  const datasets = useAppStore(state => state.datasets)
  const activeDatasetId = useAppStore(state => state.activeDatasetId)
  const setActiveDataset = useAppStore(state => state.setActiveDataset)
  const renameDataset = useAppStore(state => state.renameDataset)
  const duplicateDataset = useAppStore(state => state.duplicateDataset)
  const removeDataset = useAppStore(state => state.removeDataset)
  const addLog = useAppStore(state => state.addLog)
  const active = useAppStore(state => state.getActiveDataset())
  const [query, setQuery] = useState('')
  const [sortField, setSortField] = useState('TIME')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const rows = useMemo(() => {
    const source = active?.rows ?? []
    const q = query.trim().toLowerCase()
    const filtered = q ? source.filter(row => JSON.stringify(row).toLowerCase().includes(q)) : source
    return [...filtered].sort((a, b) => {
      const av = Number(a[sortField])
      const bv = Number(b[sortField])
      const result = Number.isFinite(av) && Number.isFinite(bv)
        ? av - bv
        : String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''))
      return sortDir === 'asc' ? result : -result
    })
  }, [active, query, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = rows.slice(page * pageSize, page * pageSize + pageSize)
  const progress = active?.rows?.length ? (rows.length / active.rows.length) * 100 : 0

  function downloadActive() {
    if (!active) return
    downloadFile(`${active.name}.csv`, exportRowsCsv(active.rows), 'text/csv')
    addLog('info', 'dataset', `Dataset downloaded: ${active.name}`)
  }

  function handleSort(column) {
    if (sortField === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(column)
      setSortDir('asc')
    }
    setPage(0)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
      <PageHeader
        eyebrow="Dataset Management"
        title="Manage & Preview Battery Files"
      />

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 md:space-y-5">
          <UploadBox />
          <Panel>
            <SectionTitle eyebrow="Datasets" title="Available Files" />
            <div className="space-y-3">
              {datasets.map(dataset => (
                <div
                  key={dataset.id}
                  onClick={() => {
                    setActiveDataset(dataset.id)
                    setPage(0)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDataset(dataset.id); setPage(0); } }}
                  tabIndex={0}
                  className={`group rounded-2xl border p-4 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-cyan/50 hover:border-brand-cyan/30 hover:bg-white/[0.06] ${dataset.id === activeDatasetId ? 'border-brand-cyan/45 bg-brand-cyan/10' : 'border-white/10 bg-white/[0.035]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-left">
                      <p className="truncate font-black text-white">{dataset.name}</p>
                      <p className="mt-1 text-xs text-ink-400">{dataset.rows.length} rows · {dataset.source} · {fileSizeFmt(dataset.size)}</p>
                    </div>
                    {dataset.id === activeDatasetId && <Badge tone="cyan">Active</Badge>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" className="h-7 px-2.5 text-[10px]" onClick={(e) => {
                      e.stopPropagation()
                      const name = prompt('New dataset name', dataset.name)
                      if (name) renameDataset(dataset.id, name)
                    }}>Rename</Button>
                    <Button variant="ghost" className="h-7 px-2.5 text-[10px]" onClick={(e) => {
                      e.stopPropagation()
                      duplicateDataset(dataset.id)
                    }}>Duplicate</Button>
                    <Button variant="danger" className="h-7 px-2.5 text-[10px] !border-brand-red/20 !bg-brand-red/10 !text-brand-red hover:!bg-brand-red/20" onClick={(e) => {
                      e.stopPropagation()
                      removeDataset(dataset.id)
                    }}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 md:space-y-5">
          <Panel>
            <SectionTitle
              eyebrow="Dataset Viewer"
              title={active?.name ?? 'No Dataset Selected'}
              right={<Button variant="ghost" onClick={downloadActive} disabled={!active}>Download CSV</Button>}
            />

            {!active ? (
              <EmptyState title="No dataset" description="Upload a file or use the included sample dataset." />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="w-full max-w-xs">
                    <Input
                      placeholder="Search records..."
                      value={query}
                      onChange={event => {
                        setQuery(event.target.value)
                        setPage(0)
                      }}
                      className="!py-0"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="blue">Showing {rows.length} / {active.rows.length}</Badge>
                    <div className="w-24 sm:w-40"><ProgressBar value={progress} max={100} tone="violet" /></div>
                    <Badge tone="slate">Page {page + 1} / {totalPages}</Badge>
                  </div>
                </div>

                <div className="max-h-[640px] overflow-auto rounded-2xl border border-white/10">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr>
                        <th className="table-th">#</th>
                        {DEFAULT_VIEW_COLUMNS.map(column => {
                          const isSorted = sortField === column
                          return (
                            <th
                              key={column}
                              className="table-th cursor-pointer select-none hover:text-white"
                              onClick={() => handleSort(column)}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{column}</span>
                                {isSorted && (
                                  <span className="text-brand-cyan text-[10px]">
                                    {sortDir === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, idx) => {
                        const realIndex = active.rows.findIndex(item => item.__id === row.__id)
                        return (
                          <tr key={row.__id} className="hover:bg-white/[0.035]">
                            <td className="table-td font-mono text-xs text-ink-400">{realIndex + 1}</td>
                            {DEFAULT_VIEW_COLUMNS.map(column => {
                              const lowerCol = column.toLowerCase()
                              const actualKey = Object.keys(row || {}).find(k => k.toLowerCase() === lowerCol) ?? column
                              return (
                                <td key={column} className="table-td font-mono text-xs text-ink-100">
                                  {row[actualKey] ?? '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-ink-400">Average SOC visible: {numberFmt(rows.reduce((sum, row) => sum + Number(row.SOC || 0), 0) / Math.max(rows.length, 1), 2)}%</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Previous</Button>
                    <Button variant="ghost" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
