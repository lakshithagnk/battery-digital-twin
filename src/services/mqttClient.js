/**
 * mqttClient.js — Singleton MQTT over WebSocket connection manager.
 *
 * Architecture:
 *   Browser (GitHub Pages HTTPS) ──WSS──► MQTT Broker ◄──MQTT/TLS── ESP32
 *
 * Usage:
 *   mqttManager.connect(settings, onStatusChange)
 *   const raw = await mqttManager.publishAndWait(payload, timeoutMs)
 *   mqttManager.disconnect()
 */

import mqtt from 'mqtt'

class MqttClientManager {
  constructor() {
    this._client      = null
    this._resolver    = null   // { resolve, reject, timer }
    this._onStatus    = null   // callback(status, detail?)
    this._predTopic   = null
    this._featureTopic = null
  }

  // ── connection ──────────────────────────────────────────────────────────────

  connect(settings, onStatusChange) {
    const { brokerUrl, username, password, clientId, predictionTopic, featuresTopic } = settings.mqtt

    this._predTopic    = predictionTopic
    this._featureTopic = featuresTopic
    this._onStatus     = onStatusChange

    // Clean up any existing connection first
    if (this._client) {
      this._client.end(true)
      this._client = null
    }

    onStatusChange?.('connecting')

    const id = clientId || `bms-web-${Math.random().toString(36).slice(2, 8)}`

    this._client = mqtt.connect(brokerUrl, {
      clientId:         id,
      username:         username || undefined,
      password:         password || undefined,
      clean:            true,
      reconnectPeriod:  4000,   // auto-reconnect every 4 s
      connectTimeout:   12000,
      keepalive:        30,
      protocolVersion:  4
    })

    this._client.on('connect', () => {
      this._client.subscribe(predictionTopic, { qos: 0 }, (err) => {
        if (err) {
          onStatusChange?.('error', `Subscribe failed: ${err.message}`)
        } else {
          onStatusChange?.('online')
        }
      })
    })

    this._client.on('message', (topic, payload) => {
      if (topic !== this._predTopic) return
      if (!this._resolver) return          // no pending request — ignore

      let data
      try { data = JSON.parse(payload.toString()) }
      catch (err) {
        this._settle('reject', new Error(`MQTT parse error: ${err.message}`))
        return
      }
      this._settle('resolve', data)
    })

    this._client.on('error', (err) => {
      onStatusChange?.('error', err.message)
      this._settle('reject', err)
    })

    this._client.on('offline', () => {
      onStatusChange?.('offline')
      this._settle('reject', new Error('MQTT connection lost'))
    })

    this._client.on('reconnect', () => {
      onStatusChange?.('connecting')
    })

    this._client.on('close', () => {
      if (this._status !== 'online') onStatusChange?.('offline')
    })
  }

  disconnect() {
    if (this._client) {
      this._settle('reject', new Error('MQTT disconnected by user'))
      this._client.end(true)
      this._client = null
    }
    this._onStatus?.('offline')
  }

  // ── request / response ──────────────────────────────────────────────────────

  /**
   * Publish features payload to featuresTopic and wait for a response on
   * predictionTopic.  Since the live engine is sequential (inFlightRef), only
   * one request is ever in-flight at a time, so a single pending resolver is safe.
   */
  publishAndWait(payload, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (!this._client?.connected) {
        reject(new Error('MQTT not connected — please connect on the MQTT Settings page first.'))
        return
      }

      if (this._resolver) {
        // Previous request still pending (should not happen with sequential streaming)
        reject(new Error('MQTT request already in-flight'))
        return
      }

      const timer = setTimeout(() => {
        this._resolver = null
        reject(new Error('MQTT response timeout — ESP32 did not publish a prediction in time.'))
      }, timeoutMs)

      this._resolver = { resolve, reject, timer }

      const msg = JSON.stringify(payload)
      this._client.publish(this._featureTopic, msg, { qos: 0 }, (err) => {
        if (err) {
          this._settle('reject', new Error(`MQTT publish failed: ${err.message}`))
        }
      })
    })
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  _settle(type, value) {
    if (!this._resolver) return
    const { resolve, reject, timer } = this._resolver
    this._resolver = null
    clearTimeout(timer)
    if (type === 'resolve') resolve(value)
    else reject(value)
  }

  get isConnected() {
    return this._client?.connected ?? false
  }

  get status() {
    if (!this._client)              return 'offline'
    if (this._client.connected)     return 'online'
    if (this._client.reconnecting)  return 'connecting'
    return 'offline'
  }
}

// Export singleton — shared across the entire app.
export const mqttManager = new MqttClientManager()
