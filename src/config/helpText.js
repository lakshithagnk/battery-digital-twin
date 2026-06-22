export const API_CONTRACT = {
  esp32Http: {
    network_type: 'ESP32 SoftAP / isolated WiFi LAN',
    ssid: 'BatteryMonitor_AP',
    password: '12345678',
    device_ip: '192.168.4.1',
    port: 80,
    method: 'POST',
    url: 'http://192.168.4.1/data',
    content_type: 'application/json',
    request_body: {
      features: 'exactly 31 raw numeric values: SUM_CURRENT, MAX_TEMP, MIN_TEMP, VOLT_1..VOLT_28'
    },
    pacing: 'one POST every about 10 seconds',
    status_note: 'No separate status endpoint. Read status and prediction from the POST response.'
  }
}

export const REQUIRED_CORS_HEADERS = [
  'Access-Control-Allow-Origin: *',
  'Access-Control-Allow-Methods: POST, OPTIONS',
  'Access-Control-Allow-Headers: Content-Type'
]
