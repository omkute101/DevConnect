// Signaling service with anonymous session support
// Handles session initialization, matching, and WebRTC signaling via Socket.IO

import { io, Socket } from "socket.io-client"
import type { AppMode } from "@/app/app/page"

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

function safeStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage.getItem(key)
        }
      } catch {
        // Ignore - storage access blocked
      }
      return null
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem(key, value)
        }
      } catch {
        // Ignore - storage access blocked
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

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
}

class SignalingService {
  private session: SessionData | null = null
  private socket: Socket | null = null
  private onMatchCallback: ((result: MatchResult) => void) | null = null
  private onSignalCallback: ((signal: WebRTCSignal, fromId: string) => void) | null = null
  private currentRoomId: string | null = null
  private storage = safeStorage()
  private isConnecting = false

  private async initSession(): Promise<SessionData> {
    if (this.session && this.session.expiresAt > Date.now()) {
      return this.session
    }

    const stored = this.storage.getItem("omniconnect-session")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionData
        if (parsed.expiresAt > Date.now()) {
          this.session = parsed
          return this.session
        }
      } catch {
        // Invalid stored data
      }
    }

    // Create new anonymous session
    const response = await fetch("/api/session/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to create session")
    }

    this.session = {
      sessionId: data.sessionId,
      token: data.token,
      expiresAt: Date.now() + data.expiresIn * 1000,
    }

    this.storage.setItem("omniconnect-session", JSON.stringify(this.session))
    return this.session
  }

  private connectionPromise: Promise<Socket> | null = null

  private async ensureSocket(): Promise<Socket> {
    if (this.socket?.connected) return this.socket

    if (this.connectionPromise) {
        return this.connectionPromise
    }
    
    this.connectionPromise = (async () => {
        try {
            const session = await this.initSession()
            await fetch("/api/socket/io") 

            this.socket = io({
              path: "/api/socket/io",
              addTrailingSlash: false,
              auth: {
                token: session.token,
                sessionId: session.sessionId
              },
              transports: ["websocket", "polling"]
            })

            this.setupSocketListeners()
            
            await new Promise<void>((resolve, reject) => {
                const onConnect = () => {
                    this.socket!.off("connect_error", onError)
                    resolve()
                }
                const onError = (err: any) => {
                    this.socket!.off("connect", onConnect)
                    reject(err)
                }

                this.socket!.once("connect", onConnect)
                this.socket!.once("connect_error", onError)
            })
            
            this.socket!.on("disconnect", (reason) => {
                console.log("[SignalingService] Socket disconnected:", reason)
            })

            return this.socket!
        } catch (error) {
            console.error("Socket connection failed:", error)
            this.socket = null
            throw error
        } finally {
            this.connectionPromise = null
        }
    })()

    return this.connectionPromise
  }

  private setupSocketListeners() {
    if (!this.socket) return

    this.socket.on("match-found", (data: { roomId: string, peerId: string, isInitiator: boolean }) => {
        this.currentRoomId = data.roomId
        this.onMatchCallback?.({
            success: true,
            type: "matched",
            roomId: data.roomId,
            peerId: data.peerId,
            isInitiator: data.isInitiator
        })
    })

    this.socket.on("signal", (data: { signal: WebRTCSignal, fromId: string }) => {
        this.onSignalCallback?.(data.signal, data.fromId)
    })
    
    this.socket.on("peer-left", () => {
         // Handle peer disconnect
         // We might want to notify hook via callback or just let user re-queue
    })
  }

  constructor() {
      console.log("[SignalingService] New Instance Created")
  }

  async joinQueue(mode: AppMode, type: "video" | "chat"): Promise<MatchResult> {
    console.log(`[SignalingService] joining queue: ${mode} ${type}`)
    try {
      const socket = await this.ensureSocket()
      
      return new Promise((resolve) => {
          socket.emit("join-queue", { mode, type }, (response: any) => {
              if (response.success) {
                  if (response.match) {
                      // Immediate match
                      this.currentRoomId = response.match.roomId
                      resolve({
                          success: true,
                          type: "matched",
                          ...response.match
                      })
                  } else {
                      resolve({ success: true, type: "waiting" })
                  }
              } else {
                  resolve({ success: false, type: "error", message: response.message })
              }
          })
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

  async leaveQueue(): Promise<void> {
    this.currentRoomId = null
    this.socket?.emit("leave-queue")
  }

  async skip(roomId: string, mode: AppMode, type: "video" | "chat"): Promise<MatchResult> {
     // Skip is basically leave + join
     await this.leaveQueue()
     return this.joinQueue(mode, type)
  }

  async sendSignal(roomId: string, targetId: string, signal: WebRTCSignal): Promise<void> {
    this.socket?.emit("signal", { roomId, targetId, signal })
  }

  async getStats(): Promise<PlatformStats | null> {
    // We can fetch stats via REST or Socket
    try {
       // Using REST for stats is fine
      const response = await fetch("/api/stats")
      return response.json()
    } catch {
      return null
    }
  }

  getCurrentSessionId(): string | null {
    return this.session?.sessionId || null
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId
  }

  destroy() {
    this.socket?.disconnect()
    this.socket = null
    this.onMatchCallback = null
    this.onSignalCallback = null
    this.currentRoomId = null
  }
}

let instance: SignalingService | null = null

export function getSignalingService(): SignalingService {
  if (!instance) {
    instance = new SignalingService()
  }
  return instance
}
