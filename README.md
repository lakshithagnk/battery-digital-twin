# Battery Anomaly Monitoring Dashboard

React + Tailwind dashboard for the ESP32-S3 battery anomaly detection demo.

This version is matched to the real firmware contract:

| Item | Value |
|---|---|
| ESP32 network | SoftAP / Access Point |
| SSID | `BatteryMonitor_AP` |
| Password | `battery123` |
| Device IP | `192.168.4.1` |
| Endpoint | `POST http://192.168.4.1/data` |
| Payload | `{ "features": [31 raw numeric values] }` |
| Feature order | `SUM_CURRENT`, `MAX_TEMP`, `MIN_TEMP`, `VOLT_1` ... `VOLT_28` |
| Sampling | one POST every about 10 seconds |
| Window | ESP32 firmware buffers 32 packets internally |
| Classes | `Normal`, `High Resist`, `Low Cap`, `Self Disch` |

## Important

There is no WebSocket connection and no separate status endpoint. The dashboard sends one HTTP POST packet and reads `window_ready`, `prediction`, `confidence`, `fault_count`, and `fault` from that POST response.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## ESP32 test flow

1. Connect your laptop/phone WiFi to `BatteryMonitor_AP`.
2. Open the dashboard.
3. Go to **ESP32 HTTP API**.
4. Confirm the base URL is `http://192.168.4.1` and endpoint is `/data`.
5. Send one test packet or start the 10-second stream from the dashboard.

The first 32 packets should return `window_ready: false`. After that, the ESP32 should return the actual prediction.
