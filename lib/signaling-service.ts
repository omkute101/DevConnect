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
  private sessionPromise: Promise<SessionData> | null = null
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

    // Create new session with retry logic
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
        const response = await fetch("/api/session/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to create session")
        }

        const sessionData: SessionData = {
          sessionId: data.sessionId,
          token: data.token,
          expiresAt: Date.now() + data.expiresIn * 1000,
        }

        this.storage.setItem("omniconnect-session", JSON.stringify(sessionData))
        return sessionData
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")
        // Wait before retry with exponential backoff
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    }

    throw lastError || new Error("Failed to create session after retries")
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await this.initSession()
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    }
  }

  async joinQueue(mode: AppMode, type: ConnectionType): Promise<MatchResult> {
    try {
      const headers = await this.getAuthHeaders()
      this.currentMode = mode
      this.currentType = type

      const response = await fetch("/api/signaling", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "join-queue",
          mode,
          type,
        }),
      })

      if (!response.ok) {
        // If unauthorized, clear session and retry once
        if (response.status === 401) {
          this.session = null
          this.storage.removeItem("omniconnect-session")
          const newHeaders = await this.getAuthHeaders()
          const retryResponse = await fetch("/api/signaling", {
            method: "POST",
            headers: newHeaders,
            body: JSON.stringify({
              action: "join-queue",
              mode,
              type,
            }),
          })

          if (!retryResponse.ok) {
            return { success: false, type: "error", message: "Authentication failed" }
          }

          const retryData = await retryResponse.json()
          return this.handleJoinQueueResponse(retryData, mode)
        }

        return { success: false, type: "error", message: `HTTP ${response.status}` }
      }

      const data = await response.json()
      return this.handleJoinQueueResponse(data, mode)
    } catch (error) {
      console.error("Failed to join queue:", error)
      return { success: false, type: "error", message: "Failed to connect" }
    }
  }

  private handleJoinQueueResponse(
    data: {
      success: boolean
      matched?: boolean
      roomId?: string
      peerId?: string
      isInitiator?: boolean
      error?: string
    },
    mode: AppMode,
  ): MatchResult {
    if (!data.success) {
      return { success: false, type: "error", message: data.error }
    }

    if (data.matched) {
      this.currentRoomId = data.roomId!
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
  }

  private startMatchPolling() {
    if (this.matchPollInterval) return

    this.isPolling = true
    this.matchPollInterval = setInterval(async () => {
      if (!this.isPolling) return

      try {
        const headers = await this.getAuthHeaders()
        const response = await fetch("/api/signaling", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "check-match" }),
        })

        if (!response.ok) return

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
    }, 1000)
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
        const headers = await this.getAuthHeaders()
        const response = await fetch("/api/signaling", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "get-signals",
            roomId: this.currentRoomId,
          }),
        })

        if (!response.ok) return

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
    }, 300)
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
      const headers = await this.getAuthHeaders()
      await fetch("/api/signaling", {
        method: "POST",
        headers,
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
      const headers = await this.getAuthHeaders()
      const response = await fetch("/api/signaling", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "skip",
          roomId,
          mode,
          type,
        }),
      })

      if (!response.ok) {
        return { success: false, type: "error", message: `HTTP ${response.status}` }
      }

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
      const headers = await this.getAuthHeaders()
      await fetch("/api/signaling", {
        method: "POST",
        headers,
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
      if (!response.ok) return null
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
