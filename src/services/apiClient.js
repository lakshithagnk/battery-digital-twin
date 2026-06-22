import { getNumeric, UI_ONLY_FIELDS, MODEL_FEATURES, CLASS_LABELS } from '../config/schema'
import { useAppStore } from '../store/appStore'
import { mqttManager } from './mqttClient'

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}

// ---- payload builders -------------------------------------------------------

export function buildPayload(row, settings = {}) {
  const selectedFeatures = settings.selectedFeatures ?? MODEL_FEATURES
  const input = selectedFeatures.map(field => getNumeric(row, field, 0))

  // Real ESP32 firmware contract:
  // POST /data with exactly { features: [31 raw numeric values] }
  if ((settings.payloadShape ?? 'features') === 'features' || settings.apiMode === 'esp32') {
    return { features: input }
  }

  const features = {}
  selectedFeatures.forEach((field, index) => { features[field] = input[index] })

  const meta = settings.includeMeta ? {
    source_time: row?.TIME ?? null,
    charge_status: row?.CHARGE_STATUS ?? null,
    ui_reference: {
      SUM_VOLTAGE: row?.SUM_VOLTAGE ?? null,
      SOC: row?.SOC ?? null,
      MAX_CELL_VOLT: row?.MAX_CELL_VOLT ?? null,
      MIN_CELL_VOLT: row?.MIN_CELL_VOLT ?? null,
      fault_label: row?.fault_label ?? null
    }
  } : undefined

  if (settings.payloadShape === 'array') {
    return settings.includeMeta
      ? { input, feature_names: selectedFeatures, meta }
      : { input, feature_names: selectedFeatures }
  }

  if (settings.payloadShape === 'flat') {
    return { ...features }
  }

  return {
    type: 'battery_predict',
    feature_count: selectedFeatures.length,
    feature_names: selectedFeatures,
    input,
    features,
    meta
  }
}


// ---- response parsing -------------------------------------------------------

export function parsePrediction(raw = {}, row = {}, source = 'unknown', roundTripMs = null) {
  let val = raw.class_name ?? raw.class ?? raw.prediction ?? raw.label ?? raw.class_index ?? raw.prediction_index ?? raw.class_label

  let className = null
  if (val !== undefined && val !== null) {
    const num = Number(val)
    if (Number.isInteger(num) && num >= 0 && num < CLASS_LABELS.length) {
      className = CLASS_LABELS[num]
    } else {
      className = String(val)
    }
  }

  if (raw.window_ready === false && className == null) {
    className = 'Window Filling'
  }
  if (className == null) className = 'Unknown'

  const confidenceRaw = raw.confidence ?? raw.score ?? raw.probability
  // Preserve null when server explicitly sends null (e.g. window filling phase)
  const confidence = confidenceRaw == null ? null : Number(confidenceRaw)
  const faultValue = raw.fault ?? raw.anomaly ?? raw.is_fault
  const fault = typeof faultValue === 'boolean'
    ? faultValue
    : Number(faultValue) === 1 || !['normal', 'window filling', 'unknown'].includes(String(className).toLowerCase())

  // Preserve null latency when server sends null (window filling phase)
  const latencyRaw = raw.latency_ms ?? raw.inference_ms ?? raw.model_latency_ms
  const latencyMs = latencyRaw == null ? null : Number(latencyRaw)

  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    time: new Date().toISOString(),
    source,
    status: raw.status ?? null,
    window_ready: raw.window_ready ?? null,
    class_name: String(className),
    confidence: (confidence !== null && Number.isFinite(confidence)) ? confidence : null,
    fault,
    fault_count: Number(raw.fault_count ?? raw.count ?? 0),
    latency_ms: (latencyMs !== null && Number.isFinite(latencyMs)) ? latencyMs : null,
    round_trip_ms: roundTripMs,
    message: raw.error ?? raw.message ?? (
      raw.window_ready === false
        ? 'ESP32 buffer filling. Prediction starts after 32 packets.'
        : fault ? `Fault detected: ${className}` : 'Battery operating normally'
    ),
    row_reference: {
      TIME: row?.TIME ?? raw.TIME ?? null,
      CHARGE_STATUS: row?.CHARGE_STATUS ?? null,
      fault_label: row?.fault_label ?? null
    },
    values: {
      SUM_VOLTAGE: Number(raw.SUM_VOLTAGE ?? getNumeric(row, 'SUM_VOLTAGE', 0)),
      SUM_CURRENT: Number(raw.SUM_CURRENT ?? raw.current ?? getNumeric(row, 'SUM_CURRENT', 0)),
      SOC: Number(raw.SOC ?? getNumeric(row, 'SOC', 0)),
      MAX_TEMP: Number(raw.MAX_TEMP ?? raw.temperature ?? getNumeric(row, 'MAX_TEMP', 0)),
      MIN_TEMP: Number(raw.MIN_TEMP ?? getNumeric(row, 'MIN_TEMP', 0)),
      MIN_CELL_VOLT: Number(raw.MIN_CELL_VOLT ?? getNumeric(row, 'MIN_CELL_VOLT', 0)),
      MAX_CELL_VOLT: Number(raw.MAX_CELL_VOLT ?? getNumeric(row, 'MAX_CELL_VOLT', 0))
    },
    raw,
    row
  }
}

// ---- transports -------------------------------------------------------------

export async function callHttpPredict({ url, method = 'POST', payload, timeoutMs = 6000 }) {
  const { signal, cancel } = withTimeout(timeoutMs)
  const started = performance.now()
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    })
    const text = await response.text()
    let json = {}
    try { json = text ? JSON.parse(text) : {} } catch { json = { message: text } }
    if (!response.ok) throw new Error(json.error ?? json.detail ?? json.message ?? `HTTP ${response.status}`)
    return { raw: json, roundTripMs: Math.round(performance.now() - started) }
  } finally {
    cancel()
  }
}

export async function callHealth(url, timeoutMs = 4000) {
  const { signal, cancel } = withTimeout(timeoutMs)
  const started = performance.now()
  try {
    const response = await fetch(url, { signal })
    const text = await response.text()
    let json = {}
    try { json = text ? JSON.parse(text) : {} } catch { json = { message: text } }
    if (!response.ok) throw new Error(json.detail ?? json.message ?? `HTTP ${response.status}`)
    return { raw: json, roundTripMs: Math.round(performance.now() - started) }
  } finally {
    cancel()
  }
}

// ---- mode routers -----------------------------------------------------------

export async function predictForMode(row, settings) {
  const payload = buildPayload(row, settings)

  if (settings.apiMode === 'mock') {
    return {
      raw: mockPrediction(row, settings),
      roundTripMs: Math.round(settings.mock.latencyMin + Math.random() * (settings.mock.latencyMax - settings.mock.latencyMin)),
      payload
    }
  }

  if (settings.apiMode === 'fastapi') {
    const url = `${trimUrl(settings.fastapi.baseUrl)}${settings.fastapi.predictEndpoint}`
    const result = await callHttpPredict({ url, method: settings.fastapi.httpMethod, payload, timeoutMs: settings.requestTimeoutMs })
    return { ...result, payload }
  }

  if (settings.apiMode === 'mqtt') {
    const started = performance.now()
    const raw = await mqttManager.publishAndWait(payload, settings.requestTimeoutMs ?? 15000)
    const roundTripMs = Math.round(performance.now() - started)
    return { raw, roundTripMs, payload }
  }

  // Default: esp32 HTTP
  const url = `${trimUrl(settings.esp32.httpBaseUrl)}${settings.esp32.httpPredictEndpoint}`
  const result = await callHttpPredict({ url, method: 'POST', payload, timeoutMs: settings.requestTimeoutMs })
  return { ...result, payload }
}


// ---- mock model -------------------------------------------------------------

export function mockPrediction(row, settings) {
  const liveState = useAppStore.getState().live
  const packetsSent = liveState.running ? liveState.totalEmitted : useAppStore.getState().predictionHistory.length
  const windowReady = packetsSent >= 32

  if (!windowReady) {
    return {
      status: "ok",
      window_ready: false,
      fault_count: 0,
      prediction: null,
      confidence: null,
      latency_ms: null,
      fault: false,
      TIME: row?.TIME
    }
  }

  const current = Number(row?.SUM_CURRENT ?? 0)
  const maxTemp = Number(row?.MAX_TEMP ?? 25)
  const minCell = Number(row?.MIN_CELL_VOLT ?? 3.3)
  const maxCell = Number(row?.MAX_CELL_VOLT ?? 3.33)
  const soc = Number(row?.SOC ?? 90)
  const imbalance = Math.abs(maxCell - minCell)
  const randomFault = Math.random() < (settings?.mock?.faultRate ?? 0.16)

  let prediction = 'Normal'
  if (imbalance > 0.06 || (randomFault && imbalance > 0.03)) prediction = 'High Resist'
  else if (soc < 84 && minCell < 3.15) prediction = 'Low Cap'
  else if (Math.abs(current) < 1 && randomFault) prediction = 'Self Disch'
  else if (maxTemp > 45 && randomFault) prediction = 'High Resist'
  else if (randomFault) prediction = 'High Resist'

  const fault = prediction !== 'Normal'
  const confidence = fault ? 62 + Math.random() * 25 : 86 + Math.random() * 12

  return {
    status: 'ok',
    window_ready: true,
    prediction,
    confidence: Number(confidence.toFixed(1)),
    fault,
    fault_count: fault ? 1 : 0,
    latency_ms: Number((12 + Math.random() * 3).toFixed(1)),
    TIME: row?.TIME,
    SUM_VOLTAGE: row?.SUM_VOLTAGE,
    SUM_CURRENT: row?.SUM_CURRENT,
    SOC: row?.SOC,
    MAX_TEMP: row?.MAX_TEMP,
    MIN_TEMP: row?.MIN_TEMP,
    MIN_CELL_VOLT: row?.MIN_CELL_VOLT,
    MAX_CELL_VOLT: row?.MAX_CELL_VOLT,
    ...Object.fromEntries(UI_ONLY_FIELDS.map(field => [field, row?.[field]]))
  }
}

export function trimUrl(url) {
  return String(url ?? '').replace(/\/+$/, '')
}
