import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from '../config/schema'
import { createSampleDataset } from '../utils/sampleData'

const initialDataset = createSampleDataset()

function mergeSettings(base, update) {
  return {
    ...base,
    ...update,
    esp32:   { ...base.esp32,   ...(update?.esp32   ?? {}) },
    fastapi: { ...base.fastapi, ...(update?.fastapi ?? {}) },
    mock:    { ...base.mock,    ...(update?.mock    ?? {}) },
    live:    { ...base.live,    ...(update?.live    ?? {}) },
    mqtt:    { ...base.mqtt,    ...(update?.mqtt    ?? {}) }
  }
}

export const useAppStore = create(persist((set, get) => ({
  settings: DEFAULT_SETTINGS,
  datasets: [initialDataset],
  activeDatasetId: initialDataset.id,
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
    esp32Status: 'idle',
    fastapiStatus: 'idle',
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

  setActiveDataset: id => set({ activeDatasetId: id, playback: { ...get().playback, currentIndex: 0, state: 'idle', elapsedSeconds: 0 } }),

  renameDataset: (id, name) => set(state => ({
    datasets: state.datasets.map(dataset => dataset.id === id ? { ...dataset, name, updatedAt: new Date().toISOString() } : dataset)
  })),

  duplicateDataset: id => set(state => {
    const source = state.datasets.find(dataset => dataset.id === id)
    if (!source) return state
    const copy = {
      ...source,
      id: crypto.randomUUID?.() ?? `${Date.now()}-copy`,
      name: `${source.name} Copy`,
      rows: source.rows.map((row, index) => ({ ...row, __id: crypto.randomUUID?.() ?? `${Date.now()}-${index}` })),
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    return { datasets: [copy, ...state.datasets], activeDatasetId: copy.id }
  }),

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

  addPrediction: prediction => set(state => ({
    latestPrediction: prediction,
    predictionHistory: [prediction, ...state.predictionHistory].slice(0, 1000)
  })),

  clearPredictions: () => set(state => ({
    latestPrediction: null,
    predictionHistory: [],
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
      esp32Status: 'idle',
      fastapiStatus: 'idle',
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
    predictionHistory: state.predictionHistory.slice(0, 200),
    latestPrediction: state.latestPrediction,
    logs: state.logs.slice(0, 300)
  }),
  migrate: (persisted) => {
    // Drop older persisted shapes and force the real ESP32 HTTP contract.
    if (persisted?.settings?.selectedFeatures) {
      const sf = persisted.settings.selectedFeatures
      const looksOld = sf.includes('TIME') || sf.includes('SOC') || sf.includes('MIN_CELL_VOLT')
      if (looksOld) delete persisted.settings.selectedFeatures
    }
    if (persisted?.settings) {
      persisted.settings.payloadShape = 'features'
      persisted.settings.includeMeta = false
      persisted.settings.esp32 = {
        ...(persisted.settings.esp32 ?? {}),
        httpBaseUrl: 'http://192.168.4.1',
        httpPredictEndpoint: '/data',
        httpMethod: 'POST',
        ssid: 'BatteryMonitor_AP',
        password: 'battery123',
        maxClients: 4
      }
      delete persisted.settings.esp32.protocol
      delete persisted.settings.esp32.httpStatusEndpoint
      delete persisted.settings.esp32.wsUrl
      // Preserve user's selected speed; only set sendWindow default
      persisted.settings.live = {
        ...(persisted.settings.live ?? {}),
        sendWindow: false
      }
      // Upgrade old 6 s timeout to 15 s so fast-interval streams don't self-abort
      if (!persisted.settings.requestTimeoutMs || persisted.settings.requestTimeoutMs <= 6000) {
        persisted.settings.requestTimeoutMs = 15000
      }
      // Seed mqtt defaults for users upgrading from pre-MQTT versions
      if (!persisted.settings.mqtt) {
        persisted.settings.mqtt = {
          brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
          username: '', password: '', clientId: '',
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
