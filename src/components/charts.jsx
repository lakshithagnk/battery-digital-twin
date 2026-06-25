import { useState, useEffect, useRef } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
  ReferenceArea
} from 'recharts'
import { CELL_VOLTAGE_FIELDS, getNumeric } from '../config/schema'

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-white/10 bg-night-900/95 px-4 py-3 text-xs shadow-soft backdrop-blur-xl">
      <p className="mb-2 font-black text-ink-200">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-black">{Number(entry.value).toFixed(3)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export function TrendChart({ data, series, height = 260 }) {
  const [brushRange, setBrushRange] = useState(null)
  const prevDataLengthRef = useRef(data?.length ?? 0)
  const firstElementKey = data && data.length > 0 ? data[0].label : null

  // Selection state for drag-to-zoom (using label values directly)
  const [refAreaLeft, setRefAreaLeft] = useState('')
  const [refAreaRight, setRefAreaRight] = useState('')

  // Reset range if we switch datasets or clear history
  useEffect(() => {
    setBrushRange(null)
    prevDataLengthRef.current = 0
  }, [firstElementKey])

  // Manage auto-scroll vs manual inspect state when data grows
  useEffect(() => {
    const currentLength = data?.length ?? 0
    const prevLength = prevDataLengthRef.current
    prevDataLengthRef.current = currentLength

    if (currentLength === 0) {
      setBrushRange(null)
      return
    }

    setBrushRange(prevRange => {
      if (!prevRange) {
        return {
          start: Math.max(0, currentLength - 30),
          end: currentLength - 1
        }
      }

      if (currentLength > prevLength) {
        const wasAtEnd = prevRange.end >= prevLength - 1
        if (wasAtEnd) {
          return {
            start: Math.max(0, currentLength - 30),
            end: currentLength - 1
          }
        }
      }

      return {
        start: Math.min(prevRange.start, currentLength - 1),
        end: Math.min(prevRange.end, currentLength - 1)
      }
    })
  }, [data?.length])

  const showBrush = data && data.length > 20
  const marginConfig = showBrush
    ? { top: 8, right: 16, left: -18, bottom: 12 }
    : { top: 8, right: 16, left: -18, bottom: 0 }

  const handleBrushChange = (range) => {
    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
      setBrushRange({
        start: range.startIndex,
        end: range.endIndex
      })
    }
  }

  // Mouse handlers for drag-to-zoom
  const handleMouseDown = (e) => {
    if (e && e.activeLabel !== undefined && e.activeLabel !== null) {
      setRefAreaLeft(e.activeLabel)
      setRefAreaRight(e.activeLabel)
    }
  }

  const handleMouseMove = (e) => {
    if (refAreaLeft && e && e.activeLabel !== undefined && e.activeLabel !== null) {
      setRefAreaRight(e.activeLabel)
    }
  }

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      const startIndex = data.findIndex(d => String(d.label) === String(refAreaLeft))
      const endIndex = data.findIndex(d => String(d.label) === String(refAreaRight))

      if (startIndex !== -1 && endIndex !== -1) {
        let start = Math.min(startIndex, endIndex)
        let end = Math.max(startIndex, endIndex)

        // Only zoom if selection covers at least 2 points
        if (end - start >= 2) {
          start = Math.max(0, start)
          end = Math.min(data.length - 1, end)
          setBrushRange({ start, end })
        }
      }
    }
    setRefAreaLeft('')
    setRefAreaRight('')
  }

  const handleResetZoom = () => {
    if (data && data.length > 0) {
      setBrushRange({
        start: Math.max(0, data.length - 30),
        end: data.length - 1
      })
    }
  }

  const isZoomed = brushRange && data && (brushRange.start > 0 || brushRange.end < data.length - 1)

  return (
    <div className="relative w-full h-full">
      {isZoomed && (
        <button
          onClick={handleResetZoom}
          title="Reset Zoom"
          className="absolute right-4 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-xl border border-brand-cyan/20 bg-night-900/90 text-sm font-black text-brand-cyan hover:bg-brand-cyan hover:text-night-950 transition-all shadow-soft backdrop-blur-md animate-in fade-in zoom-in duration-200"
        >
          ⟲
        </button>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={marginConfig}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setRefAreaLeft(''); setRefAreaRight(''); }}
          style={{ cursor: refAreaLeft ? 'col-resize' : 'crosshair' }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: '#73829a', fontSize: 10 }} tickLine={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: '#73829a', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipBox />} />
          {series.map(item => (
            <Line key={item.key} type={item.type ?? 'linear'} dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={item.strokeWidth ?? 2.2} dot={item.dot ?? { r: 1.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
          ))}
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              fill="#00d4ff"
              fillOpacity={0.15}
              stroke="rgba(0, 212, 255, 0.4)"
            />
          )}
          {showBrush && brushRange && (
            <Brush
              dataKey="label"
              height={10}
              travellerWidth={4}
              stroke="rgba(255, 255, 255, 0.12)"
              fill="rgba(8, 17, 31, 0.9)"
              tickFormatter={() => ''}
              startIndex={brushRange.start}
              endIndex={brushRange.end}
              onChange={handleBrushChange}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AreaTrend({ data, dataKey, color = '#00d4ff', height = 120 }) {
  const gradientId = `gradient-${dataKey}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function CellVoltageBar({ row, height = 240 }) {
  const data = CELL_VOLTAGE_FIELDS.map((field, index) => ({
    cell: `V${index + 1}`,
    value: getNumeric(row, field, 0)
  })).filter(item => Number.isFinite(item.value) && item.value > 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="cell" tick={{ fill: '#73829a', fontSize: 10 }} tickLine={false} interval={1} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#73829a', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipBox />} />
        <ReferenceLine y={3.0} stroke="#ff4d6d" strokeDasharray="5 5" />
        <Bar dataKey="value" name="Cell Voltage" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.value < 3.2 ? '#ff4d6d' : entry.value < 3.45 ? '#ffb020' : '#00d4ff'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ConfidenceGauge({ value = 0 }) {
  const percent = Math.min(100, Math.max(0, Math.abs(value) <= 1 ? value * 100 : value))
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const dash = (percent / 100) * circumference
  const color = percent >= 85 ? '#00e59b' : percent >= 60 ? '#ffb020' : '#ff4d6d'
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="12" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="text-center">
        <p className="font-display text-3xl font-black" style={{ color }}>{percent.toFixed(0)}%</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-ink-400">Confidence</p>
      </div>
    </div>
  )
}
