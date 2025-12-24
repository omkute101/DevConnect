"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { AppMode, ConnectionType } from "@/app/app/page"
import { getSignalingService } from "@/lib/signaling-service"

export type MatchingState = "idle" | "initializing" | "searching" | "matched" | "error"

interface MatchedPeer {
  id: string
  roomId: string
  mode: AppMode
  isInitiator: boolean
}

interface UseMatchingOptions {
  onMatched?: (peer: MatchedPeer) => void
  onPeerLeft?: () => void
  onPeerSkipped?: () => void
}

export function useMatching(options: UseMatchingOptions = {}) {
  const [state, setState] = useState<MatchingState>("idle")
  const [currentMode, setCurrentMode] = useState<AppMode | null>(null)
  const [currentType, setCurrentType] = useState<ConnectionType | null>(null)
  const [matchedPeer, setMatchedPeer] = useState<MatchedPeer | null>(null)
  const [onlineCount, setOnlineCount] = useState(247)
  const [isSessionReady, setIsSessionReady] = useState(false)

  const signalingRef = useRef(getSignalingService())
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        await signalingRef.current.initSession()
        setIsSessionReady(true)
      } catch (error) {
        console.error("Failed to initialize session:", error)
        setTimeout(initSession, 2000)
      }
    }
    initSession()
  }, [])

  // Set up stats listener
  useEffect(() => {
    const signaling = signalingRef.current

    signaling.onStats((stats) => {
      setOnlineCount(stats.online)
    })

    // Fetch initial stats
    const fetchStats = async () => {
      const stats = await signaling.getStats()
      if (stats) {
        setOnlineCount(stats.online)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Less frequent since we have socket updates

    return () => clearInterval(interval)
  }, [])

  // Set up match event listeners
  useEffect(() => {
    const signaling = signalingRef.current

    signaling.onMatch((result) => {
      if (result.type === "matched" && result.peerId && result.roomId && currentMode) {
        const peer: MatchedPeer = {
          id: result.peerId,
          roomId: result.roomId,
          mode: currentMode,
          isInitiator: result.isInitiator ?? false,
        }
        setMatchedPeer(peer)
        setState("matched")
        optionsRef.current.onMatched?.(peer)
      } else if (result.type === "left") {
        // Peer clicked leave - we should continue searching
        setMatchedPeer(null)
        setState("searching")
        optionsRef.current.onPeerLeft?.()
      } else if (result.type === "skipped") {
        // Peer clicked next - we should also go to searching
        setMatchedPeer(null)
        setState("searching")
        optionsRef.current.onPeerSkipped?.()
      }
    })
  }, [currentMode])

  const startSearching = useCallback(async (mode: AppMode, type: ConnectionType) => {
    setState("searching")
    setCurrentMode(mode)
    setCurrentType(type)

    const result = await signalingRef.current.joinQueue(mode, type)

    if (result.type === "matched" && result.peerId && result.roomId) {
      const peer: MatchedPeer = {
        id: result.peerId,
        roomId: result.roomId,
        mode,
        isInitiator: result.isInitiator ?? false,
      }
      setMatchedPeer(peer)
      setState("matched")
      optionsRef.current.onMatched?.(peer)
    } else if (result.type === "error") {
      setState("error")
    }
    // If waiting, socket will notify us when matched
  }, [])

  const cancelSearch = useCallback(async () => {
    await signalingRef.current.leaveQueue()
    setState("idle")
    setCurrentMode(null)
    setCurrentType(null)
    setMatchedPeer(null)
  }, [])

  const skipPeer = useCallback(async () => {
    if (currentMode && currentType && matchedPeer?.roomId) {
      setState("searching")
      setMatchedPeer(null)

      const result = await signalingRef.current.skip(matchedPeer.roomId, currentMode, currentType)

      if (result.type === "matched" && result.peerId && result.roomId) {
        const peer: MatchedPeer = {
          id: result.peerId,
          roomId: result.roomId,
          mode: currentMode,
          isInitiator: result.isInitiator ?? false,
        }
        setMatchedPeer(peer)
        setState("matched")
        optionsRef.current.onMatched?.(peer)
      }
      // If waiting, socket will notify us when matched
    }
  }, [currentMode, currentType, matchedPeer?.roomId])

  const leaveMatch = useCallback(async () => {
    await signalingRef.current.leaveQueue()
    setState("idle")
    setCurrentMode(null)
    setCurrentType(null)
    setMatchedPeer(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      signalingRef.current.leaveQueue().catch(() => {})
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      signalingRef.current.leaveQueue().catch(() => {})
    }
  }, [])

  return {
    state,
    currentMode,
    currentType,
    matchedPeer,
    onlineCount,
    isSessionReady,
    startSearching,
    cancelSearch,
    skipPeer,
    leaveMatch,
  }
}
