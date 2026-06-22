import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { predictForMode, parsePrediction } from '../services/apiClient'

/**
 * Drives continuous real-time predictions.
 *
 * Every `live.intervalMs` (default 10s) it:
 *   1. takes the row at the current cursor index
 *   2. sends it to the active backend (mock / esp32 / fastapi)
 *   3. parses the prediction and streams it into history + the live panel
 *   4. advances the cursor (looping if enabled)
 *
 * The timer reads fresh store state on every tick via getState(), so changing
 * mode / dataset mid-stream takes effect immediately without a restart,
 * and a single in-flight guard stops slow round-trips from stacking.
 */
export function useLiveEngine() {
  const timerRef = useRef(null)
  const inFlightRef = useRef(false)

  // Subscribe only to what the UI needs to re-render on.
  const live = useAppStore(state => state.live)
  const intervalMs = useAppStore(state => state.settings.live?.intervalMs ?? 10000)

  const setLive = useAppStore(state => state.setLive)
  const resetLive = useAppStore(state => state.resetLive)
  const advanceLiveCursor = useAppStore(state => state.advanceLiveCursor)
  const addPrediction = useAppStore(state => state.addPrediction)
  const addLog = useAppStore(state => state.addLog)
  const setConnection = useAppStore(state => state.setConnection)

  const runTick = useCallback(async () => {
    if (inFlightRef.current) return
    const state = useAppStore.getState()
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    if (!dataset?.rows?.length) {
      addLog('warning', 'live', 'No active dataset rows to stream.')
      setLive({ running: false, error: 'No dataset rows available.' })
      return
    }

    const cursor = state.live.cursor
    const latest = dataset.rows[cursor]

    inFlightRef.current = true
    try {
      const { raw, roundTripMs, payload } = await predictForMode(latest, state.settings)
      const prediction = parsePrediction(raw, latest, `live:${state.settings.apiMode}`, roundTripMs)
      prediction.window_size = 32
      prediction.cursor = cursor
      prediction.payload = payload

      addPrediction(prediction)
      setConnection({ lastRoundTripMs: roundTripMs })

      const current = useAppStore.getState().live
      setLive({
        lastEmitAt: new Date().toISOString(),
        totalEmitted: current.totalEmitted + 1,
        faultsSeen: current.faultsSeen + (prediction.fault ? 1 : 0),
        error: null
      })

      if (state.settings.apiMode === 'fastapi') setConnection({ fastapiStatus: 'online' })
      if (state.settings.apiMode === 'esp32')   setConnection({ esp32Status: 'online' })
      if (state.settings.apiMode === 'mqtt')    setConnection({ mqttStatus: 'online' })
    } catch (error) {
      const isAbort = error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('abort')
      const errMsg = isAbort ? 'Request timed out — ESP32 did not respond in time.' : error.message
      addLog('warning', 'live', `Packet skipped: ${errMsg}`, { mode: state.settings.apiMode })
      setLive({ error: errMsg })
      if (state.settings.apiMode === 'fastapi') setConnection({ fastapiStatus: 'error' })
      if (state.settings.apiMode === 'esp32')   setConnection({ esp32Status: 'error' })
      if (state.settings.apiMode === 'mqtt')    setConnection({ mqttStatus: 'error' })

      // Add a 'No Response' entry carrying raw sensor values so charts still update.
      // parsePrediction reads values from `latest` (the raw dataset row) even though
      // there is no model output — confidence and latency stay null → show as '—'.
      const noResponsePrediction = parsePrediction(
        { status: 'timeout', prediction: 'No Response', confidence: null, latency_ms: null, fault: false, fault_count: 0, window_ready: null, message: errMsg },
        latest,
        `live:${state.settings.apiMode}`,
        null
      )
      noResponsePrediction.cursor = cursor
      noResponsePrediction.window_size = 32
      addPrediction(noResponsePrediction)
    } finally {
      inFlightRef.current = false
      advanceLiveCursor()
    }
  }, [addLog, addPrediction, advanceLiveCursor, setConnection, setLive])

  // Schedule / tear down the timeout based on running state + interval length.
  useEffect(() => {
    if (!live.running) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    let active = true

    async function cycle() {
      if (!active) return
      await runTick()
      if (!active) return

      const ms = Math.max(50, intervalMs)
      timerRef.current = setTimeout(cycle, ms)
    }

    cycle()

    return () => {
      active = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [live.running, intervalMs, runTick])

  const start = useCallback(() => {
    const state = useAppStore.getState()
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    if (!dataset?.rows?.length) {
      addLog('warning', 'live', 'Cannot start live engine: no dataset loaded.')
      setLive({ error: 'Load a dataset first (Datasets page).' })
      return
    }
    const packetText = 'one 31-feature packet'
    addLog('info', 'live', `Live engine started — ${packetText} every ${state.settings.live.intervalMs / 1000}s via ${state.settings.apiMode.toUpperCase()}.`)
    setLive({
      running: true,
      cursor: 0,
      tick: 0,
      startedAt: new Date().toISOString(),
      lastEmitAt: null,
      totalEmitted: 0,
      faultsSeen: 0,
      error: null
    })
  }, [addLog, setLive])

  const pause = useCallback(() => {
    addLog('info', 'live', 'Live engine paused.')
    setLive({ running: false })
  }, [addLog, setLive])

  const reset = useCallback(() => {
    addLog('info', 'live', 'Live engine reset.')
    resetLive()
  }, [addLog, resetLive])

  return { live, start, pause, reset, runOnce: runTick }
}
