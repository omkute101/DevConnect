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
}

export function useMatching(options: UseMatchingOptions = {}) {
  const [state, setState] = useState<MatchingState>("idle")
  const [currentMode, setCurrentMode] = useState<AppMode | null>(null)
  const [currentType, setCurrentType] = useState<ConnectionType | null>(null)
  const [matchedPeer, setMatchedPeer] = useState<MatchedPeer | null>(null)
  const [onlineCount, setOnlineCount] = useState(247)
  const [isSessionReady, setIsSessionReady] = useState(false)

  const signalingRef = useRef(getSignalingService())
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const optionsRef = useRef(options)

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    const initSession = async () => {
      try {
        await signalingRef.current.initSession()
        setIsSessionReady(true)
      } catch (error) {
        console.error("Failed to initialize session:", error)
        // Retry after delay
        setTimeout(initSession, 2000)
      }
    }
    initSession()
  }, [])

  // Fetch online stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      const stats = await signalingRef.current.getStats()
      if (stats) {
        setOnlineCount(stats.online)
      }
    }

    fetchStats()
    statsIntervalRef.current = setInterval(fetchStats, 10000)

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
    }
  }, [])

  // Set up match and peer-left callbacks
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
        // Peer left - trigger auto-skip to find next match
        if (currentMode && currentType) {
          setState("searching")
          setMatchedPeer(null)
        }
      }
    })
  }, [currentMode, currentType])

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
    // If waiting, the callback will handle when match is found
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
      // If not immediately matched, polling will continue
    }
  }, [currentMode, currentType, matchedPeer?.roomId])

  const leaveMatch = useCallback(async () => {
    await signalingRef.current.leaveQueue()
    setState("idle")
    setCurrentMode(null)
    setCurrentType(null)
    setMatchedPeer(null)
    optionsRef.current.onPeerLeft?.()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
