# ESP32-S3 HTTP API Contract

## Network

| Item | Requirement |
|---|---|
| Network type | ESP32 hosts its own WiFi Access Point |
| SSID | `BatteryMonitor_AP` |
| Password | `battery123` |
| Device IP | `192.168.4.1` |
| Port | `80` |
| Protocol | Plain HTTP |

The client device must connect to the ESP32 access point before calling the API.

## Endpoint

```http
POST http://192.168.4.1/data
Content-Type: application/json
```

There is no WebSocket route and no separate status endpoint.

## Request body

```json
{
  "features": [0.0, 25.0, 24.8, 3.33]
}
```

The real `features` array must contain exactly 31 raw numeric values in this order:

1. `SUM_CURRENT`
2. `MAX_TEMP`
3. `MIN_TEMP`
4. `VOLT_1` to `VOLT_28`

The web client must not normalize the values. The firmware performs z-score normalization internally.

## Response while window is filling

```json
{
  "status": "ok",
  "window_ready": false,
  "fault_count": 0,
  "prediction": null,
  "confidence": null,
  "latency_ms": null,
  "fault": false
}
```

## Response after inference

```json
{
  "status": "ok",
  "window_ready": true,
  "fault_count": 2,
  "prediction": "Self Disch",
  "confidence": 94.7,
  "latency_ms": 12.34,
  "fault": true
}
```

## Error response

```json
{
  "status": "error",
  "error": "features must be an array of 31 numbers",
  "window_ready": false,
  "fault_count": 0,
  "prediction": null,
  "confidence": null,
  "latency_ms": null,
  "fault": false
}
```
