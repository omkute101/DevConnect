"use client"

import { useState, useCallback } from "react"
import { ModeSelection } from "@/components/app/mode-selection"
import { MatchingScreen } from "@/components/app/matching-screen"
import { VideoRoom } from "@/components/app/video-room"
import { AppNav } from "@/components/app/app-nav"
import { useMatching } from "@/hooks/use-matching"

export type AppMode = "casual" | "pitch" | "collab" | "hiring" | "review"
export type ConnectionType = "video" | "chat"
export type AppState = "select" | "matching" | "connected"

export default function AppPage() {
  const [appState, setAppState] = useState<AppState>("select")

  const onMatched = useCallback(() => {
    setAppState("connected")
  }, [])

  const onPeerLeft = useCallback(() => {
    setAppState("select")
  }, [])

  const { currentMode, currentType, matchedPeer, onlineCount, startSearching, cancelSearch, skipPeer, leaveMatch } = useMatching({
    onMatched,
    onPeerLeft,
  })

  const handleModeSelect = useCallback(
    (mode: AppMode, type: ConnectionType) => {
      setAppState("matching")
      startSearching(mode, type)
    },
    [startSearching],
  )

  const handleCancel = useCallback(() => {
    cancelSearch()
    setAppState("select")
  }, [cancelSearch])

  const handleSkip = useCallback(() => {
    setAppState("matching")
    skipPeer()
  }, [skipPeer])

  const handleLeave = useCallback(() => {
    leaveMatch()
    setAppState("select")
  }, [leaveMatch])

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      <AppNav onLeave={handleLeave} isConnected={appState === "connected"} />
      <main className="flex-1 overflow-auto relative">
        {appState === "select" && <ModeSelection onSelect={handleModeSelect} />}
        {appState === "matching" && currentMode && (
          <MatchingScreen mode={currentMode} onlineCount={onlineCount} onCancel={handleCancel} />
        )}
        {appState === "connected" && currentMode && currentType && matchedPeer && (
          <VideoRoom
            mode={currentMode}
            type={currentType}
            peerId={matchedPeer.id}
            roomId={matchedPeer.roomId}
            isInitiator={matchedPeer.isInitiator}
            onSkip={handleSkip}
            onLeave={handleLeave}
          />
        )}
      </main>
    </div>
  )
}
