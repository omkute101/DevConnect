// Socket.IO-based signaling service for external backend architecture
// Connects to external Node.js + Socket.IO server for real-time matchmaking

import { io, type Socket } from "socket.io-client"
import type { AppMode, ConnectionType } from "@/app/app/page"

export interface MatchResult {
  success: boolean
  type: "matched" | "waiting" | "left" | "skipped" | "not-found" | "error"
  roomId?: string
  peerId?: string
  isInitiator?: boolean
  message?: string
}

export interface PlatformStats {
  online: number
  totalConnections: number
  todayConnections: number
  byMode: Record<AppMode, number>
}

interface SessionData {
  sessionId: string
  token: string
  expiresAt: number
}

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
}

function safeStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage.getItem(key)
        }
      } catch {
        // Storage access blocked in iframe
      }
      return null
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem(key, value)
        }
      } catch {
        // Storage access blocked
      }
    },
    removeItem: (key: string): void => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.removeItem(key)
        }
      } catch {
        // Ignore
      }
    },
  }
}

class SignalingService {
  private session: SessionData | null = null
  private sessionPromise: Promise<SessionData> | null = null
  private socket: Socket | null = null
  private storage = safeStorage()

  // Callbacks
  private onMatchCallback: ((result: MatchResult) => void) | null = null
  private onSignalCallback: ((signal: WebRTCSignal, fromId: string) => void) | null = null
  private onStatsCallback: ((stats: PlatformStats) => void) | null = null

  // Current state
  private currentRoomId: string | null = null
  private currentMode: AppMode | null = null
  private currentType: ConnectionType | null = null
  private isConnected = false

  // Backend URL - configurable via environment variable
  private backendUrl: string

  constructor() {
    // In production, this should be your deployed Socket.IO backend URL
    this.backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
  }

  async initSession(): Promise<SessionData> {
    // Return existing session if valid
    if (this.session && this.session.expiresAt > Date.now() + 60000) {
      return this.session
    }

    // Return existing promise if initialization is in progress
    if (this.sessionPromise) {
      return this.sessionPromise
    }

    // Try to load from storage first
    const stored = this.storage.getItem("omniconnect-session")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionData
        if (parsed.expiresAt > Date.now() + 60000) {
          this.session = parsed
          return this.session
        }
      } catch {
        // Invalid stored data, will create new session
      }
    }

    // Create new session
    this.sessionPromise = this.createNewSession()

    try {
      this.session = await this.sessionPromise
      return this.session
    } finally {
      this.sessionPromise = null
    }
  }

  private async createNewSession(retries = 3): Promise<SessionData> {
    let lastError: Error | null = null

    for (let i = 0; i < retries; i++) {
      try {
        // This ensures the same SECRET is used for signing and verification
        let response: Response

        try {
          response = await fetch(`${this.backendUrl}/api/session/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        } catch {
          // Backend not reachable, fall back to Next.js API
          response = await fetch("/api/session/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        const sessionId = data.sessionId
        const token = data.token
        const expiresIn = data.expiresIn || 86400

        if (!sessionId || !token) {
          throw new Error(data.error || "Failed to create session")
        }

        const sessionData: SessionData = {
          sessionId,
          token,
          expiresAt: Date.now() + expiresIn * 1000,
        }

        this.storage.setItem("omniconnect-session", JSON.stringify(sessionData))
        return sessionData
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    }

    throw lastError || new Error("Failed to create session after retries")
  }

  private async connectSocket(): Promise<void> {
    if (this.socket?.connected) {
      return
    }

    const session = await this.initSession()

    return new Promise((resolve, reject) => {
      this.socket = io(this.backendUrl, {
        auth: {
          token: session.token,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true, // Force new connection to avoid stale connections
      })

      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          this.socket?.disconnect()
          reject(new Error("Connection timeout"))
        }
      }, 15000)

      this.socket.on("connect", () => {
        clearTimeout(connectionTimeout)
        this.isConnected = true
        resolve()
      })

      this.socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message)

        if (error.message.includes("Invalid token") || error.message.includes("Authentication")) {
          this.session = null
          this.storage.removeItem("omniconnect-session")
          clearTimeout(connectionTimeout)
          reject(new Error("Authentication failed - please refresh"))
        }
      })

      this.socket.on("disconnect", (reason) => {
        this.isConnected = false
        if (reason === "io server disconnect") {
          // Server disconnected us, try to reconnect with new session
          this.session = null
          this.storage.removeItem("omniconnect-session")
        }
      })

      // Handle match events
      this.socket.on("matched", (data: { roomId: string; peerId: string; isInitiator: boolean }) => {
        this.currentRoomId = data.roomId
        this.onMatchCallback?.({
          success: true,
          type: "matched",
          roomId: data.roomId,
          peerId: data.peerId,
          isInitiator: data.isInitiator,
        })
      })

      this.socket.on("peer-left", () => {
        this.onMatchCallback?.({ success: true, type: "left" })
      })

      this.socket.on("peer-skipped", () => {
        this.onMatchCallback?.({ success: true, type: "skipped" })
      })

      // Handle WebRTC signaling events
      this.socket.on("signal", (data: { signal: WebRTCSignal; fromId: string }) => {
        this.onSignalCallback?.(data.signal, data.fromId)
      })

      // Handle stats updates
      this.socket.on("stats", (stats: PlatformStats) => {
        this.onStatsCallback?.(stats)
      })

      // Handle errors
      this.socket.on("error", (error: { message: string }) => {
        console.error("Socket error:", error.message)
        this.onMatchCallback?.({ success: false, type: "error", message: error.message })
      })

      // Handle auth errors from server
      this.socket.on("auth-error", () => {
        this.session = null
        this.storage.removeItem("omniconnect-session")
        this.socket?.disconnect()
      })
    })
  }

  async joinQueue(mode: AppMode, type: ConnectionType): Promise<MatchResult> {
    try {
      await this.connectSocket()

      this.currentMode = mode
      this.currentType = type

      return new Promise((resolve) => {
        if (!this.socket) {
          resolve({ success: false, type: "error", message: "Socket not connected" })
          return
        }

        this.socket.emit("join-queue", { mode, connectionType: type }, (response: MatchResult) => {
          if (response.type === "matched" && response.roomId) {
            this.currentRoomId = response.roomId
          }
          resolve(response)
        })

        // Timeout after 5 seconds to return waiting state
        setTimeout(() => {
          resolve({ success: true, type: "waiting" })
        }, 5000)
      })
    } catch (error) {
      console.error("Failed to join queue:", error)
      return { success: false, type: "error", message: "Failed to connect" }
    }
  }

  onMatch(callback: (result: MatchResult) => void) {
    this.onMatchCallback = callback
  }

  onSignal(callback: (signal: WebRTCSignal, fromId: string) => void) {
    this.onSignalCallback = callback
  }

  onStats(callback: (stats: PlatformStats) => void) {
    this.onStatsCallback = callback
  }

  async leaveQueue(): Promise<void> {
    if (!this.socket?.connected) return

    return new Promise((resolve) => {
      this.socket!.emit("leave", { roomId: this.currentRoomId }, () => {
        this.currentRoomId = null
        this.currentMode = null
        this.currentType = null
        resolve()
      })

      setTimeout(resolve, 1000)
    })
  }

  async skip(roomId: string, mode: AppMode, type: ConnectionType): Promise<MatchResult> {
    if (!this.socket?.connected) {
      return { success: false, type: "error", message: "Socket not connected" }
    }

    return new Promise((resolve) => {
      this.socket!.emit("next", { roomId, mode, connectionType: type }, (response: MatchResult) => {
        if (response.type === "matched" && response.roomId) {
          this.currentRoomId = response.roomId
        }
        resolve(response)
      })

      setTimeout(() => {
        resolve({ success: true, type: "waiting" })
      }, 5000)
    })
  }

  async sendSignal(roomId: string, targetId: string, signal: WebRTCSignal): Promise<void> {
    if (!this.socket?.connected) {
      return
    }

    this.socket.emit("signal", {
      roomId,
      targetId,
      signal,
    })
  }

  async getStats(): Promise<PlatformStats | null> {
    if (this.socket?.connected) {
      this.socket.emit("get-stats")
    }

    try {
      const response = await fetch("/api/stats")
      if (response.ok) {
        return await response.json()
      }
    } catch {
      // Ignore
    }

    return null
  }

  getCurrentSessionId(): string | null {
    return this.session?.sessionId || null
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId
  }

  isSocketConnected(): boolean {
    return this.isConnected
  }

  destroy() {
    this.socket?.disconnect()
    this.socket = null
    this.onMatchCallback = null
    this.onSignalCallback = null
    this.onStatsCallback = null
    this.currentRoomId = null
    this.currentMode = null
    this.currentType = null
    this.isConnected = false
  }
}

let instance: SignalingService | null = null

export function getSignalingService(): SignalingService {
  if (!instance) {
    instance = new SignalingService()
  }
  return instance
}
