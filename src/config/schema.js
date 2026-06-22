// ============================================================================
// ESP32-S3 HTTP CONTRACT
//   Endpoint      : POST http://192.168.4.1/data
//   Payload       : { "features": [31 raw numeric values] }
//   Feature order : SUM_CURRENT, MAX_TEMP, MIN_TEMP, VOLT_1..VOLT_28
//   Window        : ESP32 firmware buffers 32 samples internally
//   Classes       : Normal, High Resist, Low Cap, Self Disch
// ============================================================================

export const MODEL_WINDOW_SIZE = 32
export const MODEL_FEATURE_COUNT = 31

export const CELL_VOLTAGE_FIELDS = Array.from({ length: 28 }, (_, index) => `VOLT_${index + 1}`)

// Exact 31-value sequence expected by the ESP32 firmware.
export const MODEL_FEATURES = ['SUM_CURRENT', 'MAX_TEMP', 'MIN_TEMP', ...CELL_VOLTAGE_FIELDS]

export const BASE_MODEL_FIELDS = ['SUM_CURRENT', 'MAX_TEMP', 'MIN_TEMP']

export const UI_ONLY_FIELDS = [
  'TIME',
  'CHARGE_STATUS',
  'SUM_VOLTAGE',
  'SOC',
  'MAX_CELL_VOLT',
  'MIN_CELL_VOLT',
  'fault_label'
]

export const DATASET_COLUMNS = [
  'TIME',
  'CHARGE_STATUS',
  'SUM_VOLTAGE',
  'SUM_CURRENT',
  'SOC',
  'MAX_CELL_VOLT',
  'MIN_CELL_VOLT',
  'MAX_TEMP',
  'MIN_TEMP',
  ...CELL_VOLTAGE_FIELDS,
  'fault_label'
]

export const DEFAULT_SELECTED_FEATURES = [...MODEL_FEATURES]

export const CLASS_LABELS = ['Normal', 'High Resist', 'Low Cap', 'Self Disch']

export const FEATURE_MEAN = [
  13.9295, 25.3831, 25.1976, 3.3095, 3.3084, 3.3085, 3.3087, 3.3078, 3.3083, 3.3081,
  3.3088, 3.3085, 3.3071, 3.3083, 3.3089, 3.3083, 3.3093, 3.3098, 3.3094, 3.3092,
  3.3089, 3.3086, 3.3088, 3.3083, 3.3092, 3.3075, 3.3091, 3.3081, 3.3092, 3.3091, 3.3097
]

export const FEATURE_STD = [
  36.8721, 0.7408, 0.4649, 0.0451, 0.0481, 0.0465, 0.0461, 0.0485, 0.0468, 0.0477,
  0.0461, 0.0469, 0.0501, 0.0473, 0.0458, 0.0470, 0.0458, 0.0459, 0.0463, 0.0469,
  0.0468, 0.0474, 0.0473, 0.0500, 0.0462, 0.0512, 0.0471, 0.0494, 0.0464, 0.0469, 0.0454
]

export const DEFAULT_SETTINGS = {
  apiMode: 'mock',
  payloadShape: 'features',
  includeMeta: false,
  selectedFeatures: DEFAULT_SELECTED_FEATURES,
  playbackIntervalMs: 10000,
  demoIntervalMs: 1200,
  requestTimeoutMs: 15000,
  live: {
    intervalMs: 10000,
    windowSize: MODEL_WINDOW_SIZE,
    sendWindow: false,
    loop: true,
    autoScrollLog: true
  },
  esp32: {
    httpBaseUrl: 'http://192.168.4.1',
    httpPredictEndpoint: '/data',
    httpMethod: 'POST',
    ssid: 'BatteryMonitor_AP',
    password: '12345678',
    maxClients: 4
  },
  fastapi: {
    baseUrl: 'http://127.0.0.1:8000',
    predictEndpoint: '/predict',
    healthEndpoint: '/health',
    httpMethod: 'POST'
  },
  mock: {
    faultRate: 0.16,
    latencyMin: 15,
    latencyMax: 60,
    noise: 0.04
  },
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    username: '',
    password: '',
    clientId: '',
    featuresTopic: 'battery/features',
    predictionTopic: 'battery/prediction',
    statusTopic: 'battery/status'
  }
}

export const STATUS_COLORS = {
  Normal: 'green',
  'High Resist': 'red',
  'High Resistance': 'red',
  'Low Cap': 'amber',
  'Low Capacity': 'amber',
  'Self Disch': 'violet',
  'Self Discharge': 'violet',
  'Window Filling': 'slate',
  'No Response': 'slate',
  Unknown: 'slate'
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()
}

export function normalizeDatasetRow(row, index = 0) {
  return {
    ...(row || {}),
    __id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
    __index: index
  }
}

export function getNumeric(row, field, fallback = 0) {
  if (!row) return fallback
  if (field in row) {
    const value = Number(row[field])
    return Number.isFinite(value) ? value : fallback
  }
  const lowerField = String(field).toLowerCase()
  const key = Object.keys(row).find(k => String(k).toLowerCase() === lowerField)
  if (key !== undefined) {
    const value = Number(row[key])
    return Number.isFinite(value) ? value : fallback
  }
  return fallback
}
