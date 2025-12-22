// WebSocket signaling client for WebRTC

export type SignalType = "offer" | "answer" | "ice-candidate" | "join" | "leave" | "matched" | "skip" | "message"

export interface SignalMessage {
  type: SignalType
  payload: unknown
  roomId?: string
  peerId?: string
}

export type SocketEventHandler = (message: SignalMessage) => void

class SignalingClient {
  private ws: WebSocket | null = null
  private handlers: Map<SignalType, SocketEventHandler[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private url = ""

  connect(url: string): Promise<void> {
    this.url = url

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: SignalMessage = JSON.parse(event.data)
            this.emit(message.type, message)
          } catch (error) {
            console.error("Failed to parse message:", error)
          }
        }

        this.ws.onclose = () => {
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++

      setTimeout(() => {
        this.connect(this.url).catch(console.error)
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  send(message: SignalMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn("WebSocket not connected, message not sent")
    }
  }

  on(type: SignalType, handler: SocketEventHandler) {
    const handlers = this.handlers.get(type) || []
    handlers.push(handler)
    this.handlers.set(type, handlers)
  }

  off(type: SignalType, handler: SocketEventHandler) {
    const handlers = this.handlers.get(type) || []
    const index = handlers.indexOf(handler)
    if (index !== -1) {
      handlers.splice(index, 1)
    }
  }

  private emit(type: SignalType, message: SignalMessage) {
    const handlers = this.handlers.get(type) || []
    handlers.forEach((handler) => handler(message))
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

let clientInstance: SignalingClient | null = null

export function getSignalingClient(): SignalingClient {
  if (!clientInstance) {
    clientInstance = new SignalingClient()
  }
  return clientInstance
}

// For backwards compatibility
export const signalingClient = {
  get instance() {
    return getSignalingClient()
  },
}
