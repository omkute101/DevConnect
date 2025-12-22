// Signaling service with HTTP polling for Vercel serverless deployment
// Handles session initialization, matching, and WebRTC signaling

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

function safeStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage.getItem(key)
        }
      } catch {
        // Storage access blocked
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

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
}

class SignalingService {
  private session: SessionData | null = null
  private onMatchCallback: ((result: MatchResult) => void) | null = null
  private onSignalCallback: ((signal: WebRTCSignal, fromId: string) => void) | null = null
  private currentRoomId: string | null = null
  private currentMode: AppMode | null = null
  private currentType: ConnectionType | null = null
  private storage = safeStorage()

  // Polling intervals
  private matchPollInterval: ReturnType<typeof setInterval> | null = null
  private signalPollInterval: ReturnType<typeof setInterval> | null = null
  private isPolling = false

  async initSession(): Promise<SessionData> {
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

  private getAuthHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.session?.token ? { Authorization: `Bearer ${this.session.token}` } : {}),
    }
  }

  async joinQueue(mode: AppMode, type: ConnectionType): Promise<MatchResult> {
    try {
      await this.initSession()
      this.currentMode = mode
      this.currentType = type

      const response = await fetch("/api/signaling", {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: "join-queue",
          mode,
          type,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        return { success: false, type: "error", message: data.error }
      }

      if (data.matched) {
        // Immediate match found
        this.currentRoomId = data.roomId
        this.startSignalPolling()
        return {
          success: true,
          type: "matched",
          roomId: data.roomId,
          peerId: data.peerId,
          isInitiator: data.isInitiator,
        }
      }

      // Start polling for match
      this.startMatchPolling()
      return { success: true, type: "waiting" }
    } catch (error) {
      console.error("Failed to join queue:", error)
      return { success: false, type: "error", message: "Failed to connect" }
    }
  }

  private startMatchPolling() {
    if (this.matchPollInterval) return

    this.isPolling = true
    this.matchPollInterval = setInterval(async () => {
      if (!this.isPolling) return

      try {
        const response = await fetch("/api/signaling", {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ action: "check-match" }),
        })

        const data = await response.json()

        if (data.matched && data.roomId) {
          this.stopMatchPolling()
          this.currentRoomId = data.roomId
          this.startSignalPolling()

          this.onMatchCallback?.({
            success: true,
            type: "matched",
            roomId: data.roomId,
            peerId: data.peerId,
            isInitiator: data.isInitiator,
          })
        }
      } catch (error) {
        console.error("Match poll error:", error)
      }
    }, 1000) // Poll every second
  }

  private stopMatchPolling() {
    if (this.matchPollInterval) {
      clearInterval(this.matchPollInterval)
      this.matchPollInterval = null
    }
  }

  private startSignalPolling() {
    if (this.signalPollInterval) return

    this.signalPollInterval = setInterval(async () => {
      if (!this.currentRoomId) return

      try {
        const response = await fetch("/api/signaling", {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            action: "get-signals",
            roomId: this.currentRoomId,
          }),
        })

        const data = await response.json()

        if (data.signals && Array.isArray(data.signals)) {
          for (const item of data.signals) {
            if (item.signal && item.fromId) {
              this.onSignalCallback?.(item.signal, item.fromId)
            }
          }
        }

        // Check if peer left
        if (data.peerLeft) {
          this.onMatchCallback?.({ success: true, type: "left" })
        }
      } catch (error) {
        console.error("Signal poll error:", error)
      }
    }, 300) // Poll signals more frequently for low latency
  }

  private stopSignalPolling() {
    if (this.signalPollInterval) {
      clearInterval(this.signalPollInterval)
      this.signalPollInterval = null
    }
  }

  onMatch(callback: (result: MatchResult) => void) {
    this.onMatchCallback = callback
  }

  onSignal(callback: (signal: WebRTCSignal, fromId: string) => void) {
    this.onSignalCallback = callback
  }

  async leaveQueue(): Promise<void> {
    this.isPolling = false
    this.stopMatchPolling()
    this.stopSignalPolling()

    try {
      await fetch("/api/signaling", {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: "leave",
          roomId: this.currentRoomId,
        }),
      })
    } catch {
      // Ignore errors on leave
    }

    this.currentRoomId = null
    this.currentMode = null
    this.currentType = null
  }

  async skip(roomId: string, mode: AppMode, type: ConnectionType): Promise<MatchResult> {
    this.stopSignalPolling()

    try {
      const response = await fetch("/api/signaling", {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: "skip",
          roomId,
          mode,
          type,
        }),
      })

      const data = await response.json()

      if (data.matched) {
        this.currentRoomId = data.roomId
        this.startSignalPolling()
        return {
          success: true,
          type: "matched",
          roomId: data.roomId,
          peerId: data.peerId,
          isInitiator: data.isInitiator,
        }
      }

      // Start polling for new match
      this.startMatchPolling()
      return { success: true, type: "waiting" }
    } catch (error) {
      console.error("Skip error:", error)
      return { success: false, type: "error", message: "Failed to skip" }
    }
  }

  async sendSignal(roomId: string, targetId: string, signal: WebRTCSignal): Promise<void> {
    try {
      await fetch("/api/signaling", {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: "signal",
          roomId,
          targetId,
          signal,
        }),
      })
    } catch (error) {
      console.error("Failed to send signal:", error)
    }
  }

  async getStats(): Promise<PlatformStats | null> {
    try {
      const response = await fetch("/api/stats")
      const data = await response.json()
      return data
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
    this.stopMatchPolling()
    this.stopSignalPolling()
    this.onMatchCallback = null
    this.onSignalCallback = null
    this.currentRoomId = null
    this.currentMode = null
    this.currentType = null
  }
}

let instance: SignalingService | null = null

export function getSignalingService(): SignalingService {
  if (!instance) {
    instance = new SignalingService()
  }
  return instance
}
