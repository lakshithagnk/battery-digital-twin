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



export const DEFAULT_SETTINGS = {
  apiMode: 'mock',
  payloadShape: 'features',
  includeMeta: false,
  selectedFeatures: DEFAULT_SELECTED_FEATURES,
  playbackIntervalMs: 10000,
  demoIntervalMs: 1200,
  requestTimeoutMs: 30000,
  live: {
    intervalMs: 10000,
    windowSize: MODEL_WINDOW_SIZE,
    sendWindow: false,
    loop: true,
    autoScrollLog: true
  },
  mock: {
    faultRate: 0.16,
    latencyMin: 15,
    latencyMax: 60,
    noise: 0.04
  },
  mqtt: {
    brokerUrl: 'wss://85d119b1fc5546828fe0484af72962c3.s1.eu.hivemq.cloud:8884/mqtt',
    username: 'fypG21',
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
