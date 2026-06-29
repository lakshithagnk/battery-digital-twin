import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, DEFAULT_REQUEST_TIMEOUT_MS } from '../config/schema'
import { createSampleDataset } from '../utils/sampleData'

const initialDataset = createSampleDataset()

function mergeSettings(base, update) {
  return {
    ...base,
    ...update,
    mock:    { ...base.mock,    ...(update?.mock    ?? {}) },
    live:    { ...base.live,    ...(update?.live    ?? {}) },
    mqtt:    { ...base.mqtt,    ...(update?.mqtt    ?? {}) }
  }
}

export const useAppStore = create(persist((set, get) => ({
  settings: DEFAULT_SETTINGS,
  datasets: [initialDataset],
  activeDatasetId: initialDataset.id,
  currentSessionNo: 1,
  activeSessionNo: 1,
  latestPrediction: null,
  predictionHistory: [],
  logs: [
    {
      id: 'boot-log',
      time: new Date().toISOString(),
      level: 'info',
      source: 'system',
      message: 'Dashboard initialized with sample dataset.',
      detail: { mode: DEFAULT_SETTINGS.apiMode }
    }
  ],
  playback: {
    state: 'idle',
    currentIndex: 0,
    startedAt: null,
    elapsedSeconds: 0,
    speed: 1
  },
  demo: {
    running: false,
    tick: 0
  },
  live: {
    running: false,
    cursor: 0,
    tick: 0,
    startedAt: null,
    lastEmitAt: null,
    totalEmitted: 0,
    faultsSeen: 0,
    error: null
  },
  connection: {
    mqttStatus: 'offline',
    lastRoundTripMs: null,
    lastConnectionTest: null
  },

  updateSettings: updater => set(state => ({
    settings: typeof updater === 'function'
      ? mergeSettings(state.settings, updater(state.settings))
      : mergeSettings(state.settings, updater)
  })),

  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

  addDataset: dataset => set(state => ({
    datasets: [dataset, ...state.datasets],
    activeDatasetId: dataset.id,
    logs: [makeLog('info', 'dataset', `Dataset uploaded: ${dataset.name}`, { rows: dataset.rows.length }), ...state.logs].slice(0, 1200)
  })),

  setActiveDataset: id => set(state => {
    if (state.activeDatasetId === id) return {}
    
    const currentNo = typeof state.currentSessionNo === 'number' && !isNaN(state.currentSessionNo) ? state.currentSessionNo : 1
    const nextSessionNo = currentNo + 1
    const dataset = state.datasets.find(item => item.id === id)
    const datasetName = dataset?.name ?? 'Unknown Dataset'
    const newLog = makeLog('info', 'system', `Switched operating state to dataset "${datasetName}". Starting Session ${nextSessionNo}.`, { datasetId: id })
    
    return {
      activeDatasetId: id,
      currentSessionNo: nextSessionNo,
      activeSessionNo: nextSessionNo,
      playback: { ...state.playback, currentIndex: 0, state: 'idle', elapsedSeconds: 0 },
      live: {
        running: false,
        cursor: 0,
        tick: 0,
        startedAt: null,
        lastEmitAt: null,
        totalEmitted: 0,
        faultsSeen: 0,
        error: null
      },
      logs: [newLog, ...state.logs].slice(0, 1200)
    }
  }),

  renameDataset: (id, name) => set(state => ({
    datasets: state.datasets.map(dataset => dataset.id === id ? { ...dataset, name, updatedAt: new Date().toISOString() } : dataset)
  })),

  removeDataset: id => set(state => {
    const remaining = state.datasets.filter(dataset => dataset.id !== id)
    return {
      datasets: remaining,
      activeDatasetId: state.activeDatasetId === id ? remaining[0]?.id ?? null : state.activeDatasetId
    }
  }),

  updateDatasetCell: (datasetId, rowIndex, field, value) => set(state => ({
    datasets: state.datasets.map(dataset => {
      if (dataset.id !== datasetId) return dataset
      return {
        ...dataset,
        updatedAt: new Date().toISOString(),
        rows: dataset.rows.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row)
      }
    })
  })),

  getActiveDataset: () => {
    const state = get()
    return state.datasets.find(dataset => dataset.id === state.activeDatasetId) ?? null
  },

  getCurrentRow: () => {
    const state = get()
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    if (!dataset?.rows?.length) return null
    if (state.live.running) {
      return dataset.rows[Math.min(state.live.cursor, dataset.rows.length - 1)]
    }
    return dataset.rows[Math.min(state.playback.currentIndex, dataset.rows.length - 1)]
  },

  setPlayback: patch => set(state => ({ playback: { ...state.playback, ...patch } })),

  advancePlayback: () => set(state => {
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    const last = Math.max((dataset?.rows.length ?? 1) - 1, 0)
    const next = Math.min(state.playback.currentIndex + 1, last)
    const finished = next >= last
    return {
      playback: {
        ...state.playback,
        currentIndex: next,
        elapsedSeconds: next * 20,
        state: finished ? 'finished' : state.playback.state
      }
    }
  }),

  resetPlayback: () => set(state => ({ playback: { ...state.playback, state: 'idle', currentIndex: 0, elapsedSeconds: 0, startedAt: null } })),

  setDemo: patch => set(state => ({ demo: { ...state.demo, ...patch } })),

  setLive: patch => set(state => ({ live: { ...state.live, ...patch } })),

  resetLive: () => set(state => ({
    live: { running: false, cursor: 0, tick: 0, startedAt: null, lastEmitAt: null, totalEmitted: 0, faultsSeen: 0, error: null }
  })),

  advanceLiveCursor: () => set(state => {
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    const length = dataset?.rows?.length ?? 0
    if (!length) return state
    const next = state.live.cursor + 1
    const wrapped = state.settings.live?.loop ? next % length : Math.min(next, length - 1)
    const finished = !state.settings.live?.loop && next >= length
    return {
      live: {
        ...state.live,
        cursor: wrapped,
        tick: state.live.tick + 1,
        running: finished ? false : state.live.running
      }
    }
  }),

  addPrediction: prediction => set(state => {
    const dataset = state.datasets.find(item => item.id === state.activeDatasetId)
    const datasetName = dataset?.name ?? 'Unknown Dataset'
    const sessionNo = typeof state.activeSessionNo === 'number' && !isNaN(state.activeSessionNo) ? state.activeSessionNo : 1
    
    // Find if we already have a start time for this session in history
    const existing = state.predictionHistory.find(p => p.sessionNo === sessionNo)
    const sessionStartTime = existing ? existing.sessionStartTime : prediction.time

    const enriched = {
      ...prediction,
      sessionNo: sessionNo,
      sessionDatasetName: datasetName,
      sessionStartTime: sessionStartTime
    }
    return {
      latestPrediction: enriched,
      predictionHistory: [enriched, ...state.predictionHistory].slice(0, 1000)
    }
  }),

  clearPredictions: () => set(state => ({
    latestPrediction: null,
    predictionHistory: [],
    currentSessionNo: 1,
    activeSessionNo: 1,
    live: {
      running: false,
      cursor: 0,
      tick: 0,
      startedAt: null,
      lastEmitAt: null,
      totalEmitted: 0,
      faultsSeen: 0,
      error: null
    },
    connection: {
      ...state.connection,
      lastRoundTripMs: null,
      lastConnectionTest: null
    }
  })),

  addLog: (level, source, message, detail) => set(state => ({
    logs: [makeLog(level, source, message, detail), ...state.logs].slice(0, 1500)
  })),

  clearLogs: () => set({ logs: [] }),

  setConnection: patch => set(state => ({ connection: { ...state.connection, ...patch } }))
}), {
  name: 'battery-digital-twin-v5-state',
  version: 6,
  partialize: state => ({
    settings: state.settings,
    datasets: state.datasets,
    activeDatasetId: state.activeDatasetId,
    currentSessionNo: state.currentSessionNo,
    activeSessionNo: state.activeSessionNo,
    predictionHistory: state.predictionHistory.slice(0, 200),
    latestPrediction: state.latestPrediction,
    logs: state.logs.slice(0, 300)
  }),
  migrate: (persisted) => {
    if (persisted) {
      if (persisted.currentSessionNo === undefined || isNaN(persisted.currentSessionNo)) {
        persisted.currentSessionNo = 1
      }
      if (persisted.activeSessionNo === undefined || isNaN(persisted.activeSessionNo)) {
        persisted.activeSessionNo = 1
      }
      if (persisted.predictionHistory) {
        persisted.predictionHistory = persisted.predictionHistory.map(p => {
          if (p.sessionNo === undefined || isNaN(p.sessionNo)) {
            p.sessionNo = 1
          }
          if (!p.sessionDatasetName) {
            p.sessionDatasetName = 'Real Discharge — vin_398'
          }
          if (!p.sessionStartTime) {
            p.sessionStartTime = p.time
          }
          return p
        })
      }
    }
    // Drop older persisted shapes and force the real ESP32 HTTP contract.
    if (persisted?.settings?.selectedFeatures) {
      const sf = persisted.settings.selectedFeatures
      const looksOld = sf.includes('TIME') || sf.includes('SOC') || sf.includes('MIN_CELL_VOLT')
      if (looksOld) delete persisted.settings.selectedFeatures
    }
    if (persisted?.settings) {
      persisted.settings.payloadShape = 'features'
      persisted.settings.includeMeta = false
      delete persisted.settings.esp32
      delete persisted.settings.fastapi
      // Preserve user's selected speed; only set sendWindow default
      persisted.settings.live = {
        ...(persisted.settings.live ?? {}),
        sendWindow: false
      }
      // Upgrade old 6 s timeout to default timeout so fast-interval streams don't self-abort
      if (!persisted.settings.requestTimeoutMs || persisted.settings.requestTimeoutMs <= 6000) {
        persisted.settings.requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
      }
      // Seed mqtt defaults for users upgrading from pre-MQTT versions
      if (!persisted.settings.mqtt) {
        persisted.settings.mqtt = {
          brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
          username: 'fypG21', password: '2026FYPg21', clientId: '',
          featuresTopic: 'battery/features',
          predictionTopic: 'battery/prediction',
          statusTopic: 'battery/status'
        }
      }
    }
    return persisted
  }
}))

function makeLog(level, source, message, detail) {
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    time: new Date().toISOString(),
    level,
    source,
    message,
    detail
  }
}
