"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SkipForward,
  PhoneOff,
  MessageSquare,
  Send,
  X,
  Share2,
  User,
  AlertTriangle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import type { AppMode, ConnectionType } from "@/app/app/page"
import { SharePanel } from "@/components/app/share-panel"
import { PeerProfileCard } from "@/components/app/peer-profile-card"
import { ReportModal } from "@/components/app/report-modal"
import { ConnectionQuality } from "@/components/app/connection-quality"
import { AutoDisconnectWarning } from "@/components/app/auto-disconnect-warning"
import type { DeveloperProfile } from "@/lib/developer-profile"
import { getSignalingService, type WebRTCSignal } from "@/lib/signaling-service"
import { rtcConfig, getLocalStream, createPeerConnection } from "@/lib/webrtc"

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed"

interface VideoRoomProps {
  mode: AppMode
  type: ConnectionType
  peerId: string
  roomId: string
  isInitiator: boolean
  onSkip: () => void
  onLeave: () => void
}

interface ChatMessage {
  id: string
  sender: "me" | "peer" | "system"
  text: string
  timestamp: Date
  type?: "text" | "profile"
  profile?: DeveloperProfile
}

export function VideoRoom({ mode, type, peerId, roomId, isInitiator, onSkip, onLeave }: VideoRoomProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === "video")
  const [isAudioEnabled, setIsAudioEnabled] = useState(type === "video")
  const [isChatOpen, setIsChatOpen] = useState(type === "chat") // Default open for chat-only
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [peerProfile, setPeerProfile] = useState<DeveloperProfile | null>(null)
  const [showPeerProfile, setShowPeerProfile] = useState(false)
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false)
  const [disconnectReason, setDisconnectReason] = useState("")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const isInitializedRef = useRef(false)
  const isCleaningUpRef = useRef(false)

  // Set up signal handler
  useEffect(() => {
    const signaling = getSignalingService()

    const handleSignal = async (signal: WebRTCSignal, fromId: string) => {
      const pc = peerConnectionRef.current
      if (!pc) {
        console.log("[v0] No peer connection, queuing signal:", signal.type)
        return
      }

      try {
        if (signal.type === "offer") {
          console.log("[v0] Received offer, signalingState:", pc.signalingState)
          if (pc.signalingState !== "stable") {
            console.log("[v0] Ignoring offer, not in stable state")
            return
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))

          // Process any pending ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current = []

          // Create and send answer
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          await signaling.sendSignal(roomId, fromId, {
            type: "answer",
            payload: answer,
          })
          console.log("[v0] Sent answer")
        } else if (signal.type === "answer") {
          console.log("[v0] Received answer, signalingState:", pc.signalingState)
          if (pc.signalingState !== "have-local-offer") {
            console.log("[v0] Ignoring answer, not in have-local-offer state")
            return
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))

          // Process any pending ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current = []
          console.log("[v0] Set answer as remote description")
        } else if (signal.type === "ice-candidate") {
          const candidate = signal.payload as RTCIceCandidateInit
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
            console.log("[v0] Added ICE candidate")
          } else {
            console.log("[v0] Queueing ICE candidate")
            pendingCandidatesRef.current.push(candidate)
          }
        }
      } catch (error) {
        console.error("[v0] Error handling signal:", error)
      }
    }

    signaling.onSignal(handleSignal)

    return () => {
      signaling.onSignal(() => {})
    }
  }, [roomId])

  // Initialize connection
  useEffect(() => {
    if (isInitializedRef.current || isCleaningUpRef.current) return
    if (!roomId || !peerId) return

    isInitializedRef.current = true

    const initConnection = async () => {
      console.log("[v0] Initializing connection, isInitiator:", isInitiator, "roomId:", roomId, "peerId:", peerId)
      setConnectionState("connecting")

      try {
        let stream: MediaStream | null = null
        
        // Only get local stream if using video
        if (type === "video") {
            stream = await getLocalStream()
            setLocalStream(stream)

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }
        }

        const signaling = getSignalingService()

        // Create peer connection
        const pc = createPeerConnection(
          rtcConfig,
          async (candidate) => {
            console.log("[v0] Sending ICE candidate")
            await signaling.sendSignal(roomId, peerId, {
              type: "ice-candidate",
              payload: candidate.toJSON(),
            })
          },
          (remoteMediaStream) => {
            console.log("[v0] Received remote stream, tracks:", remoteMediaStream.getTracks().length)
            setRemoteStream(remoteMediaStream)
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteMediaStream
            }
          },
        )

        peerConnectionRef.current = pc

        // Add local tracks if video mode
        if (stream) {
            stream.getTracks().forEach((track) => {
                console.log("[v0] Adding local track:", track.kind)
                pc.addTrack(track, stream!)
            })
        }

        // Set up data channel
        const setupDataChannel = (channel: RTCDataChannel) => {
          channel.onopen = () => {
            console.log("[v0] Data channel opened")
          }
          channel.onmessage = (event) => {
            handleIncomingMessage(event.data)
          }
          channel.onclose = () => {
            console.log("[v0] Data channel closed")
          }
          channel.onerror = (error) => {
            console.error("[v0] Data channel error:", error)
          }
        }

        if (isInitiator) {
          console.log("[v0] Creating data channel (initiator)")
          const dc = pc.createDataChannel("chat", { ordered: true })
          setupDataChannel(dc)
          dataChannelRef.current = dc
        } else {
          pc.ondatachannel = (event) => {
            console.log("[v0] Received data channel")
            setupDataChannel(event.channel)
            dataChannelRef.current = event.channel
          }
        }

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState
          console.log("[v0] Connection state:", state)

          if (state === "connected") {
            setConnectionState("connected")
            setMessages([
              {
                id: "welcome",
                sender: "system",
                text: `Connected! You're now chatting in ${mode} mode (${type === "chat" ? "Chat Only" : "Video"}).`,
                timestamp: new Date(),
                type: "text",
              },
            ])
            setShowDisconnectWarning(false)
          } else if (state === "disconnected") {
            setConnectionState("disconnected")
            setDisconnectReason("Your peer seems to have connection issues.")
            setShowDisconnectWarning(true)
          } else if (state === "failed") {
            setConnectionState("failed")
            setDisconnectReason("The connection has failed.")
            setShowDisconnectWarning(true)
          }
        }

        pc.oniceconnectionstatechange = () => {
          console.log("[v0] ICE connection state:", pc.iceConnectionState)
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setConnectionState("connected")
          }
        }

        // This ensures the non-initiator has time to set up polling
        if (isInitiator) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          console.log("[v0] Creating offer")
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)

          await signaling.sendSignal(roomId, peerId, {
            type: "offer",
            payload: offer,
          })
          console.log("[v0] Sent offer")
        }
      } catch (error) {
        console.error("[v0] Failed to initialize:", error)
        setConnectionState("failed")
      }
    }

    initConnection()

    return () => {
      isCleaningUpRef.current = true
    }
  }, [roomId, peerId, isInitiator, mode, type])

  useEffect(() => {
    return () => {
      if (isCleaningUpRef.current) {
        console.log("[v0] Cleaning up connection")
        dataChannelRef.current?.close()
        peerConnectionRef.current?.close()
        localStream?.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Handle incoming messages
  const handleIncomingMessage = (msg: string) => {
    try {
      const data = JSON.parse(msg)
      if (data.type === "profile" && data.profile) {
        setPeerProfile(data.profile)
        setShowPeerProfile(true)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "system",
            text: `${data.profile.displayName || "Your partner"} shared their profile`,
            timestamp: new Date(),
            type: "text",
          },
        ])
        return
      }
    } catch {
      // Not JSON
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "peer",
        text: msg,
        timestamp: new Date(),
        type: "text",
      },
    ])
  }

  // Update local video element when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream
        localVideoRef.current.play().catch(() => {})
      }
    }
  }, [localStream])

  // Update remote video element when stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream
        remoteVideoRef.current.play().catch((e) => {
          console.log("[v0] Remote video play error:", e)
        })
      }
    }
  }, [remoteStream])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
  }, [localStream, isVideoEnabled])

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioEnabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }, [localStream, isAudioEnabled])

  const sendMessage = useCallback((text: string): boolean => {
    const dc = dataChannelRef.current
    if (dc && dc.readyState === "open") {
      dc.send(text)
      return true
    }
    console.log("[v0] Cannot send, data channel state:", dc?.readyState)
    return false
  }, [])

  const closeConnection = useCallback(() => {
    console.log("[v0] Closing connection")
    dataChannelRef.current?.close()
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    dataChannelRef.current = null
    pendingCandidatesRef.current = []
    setRemoteStream(null)
    setConnectionState("idle")
  }, [])

  const handleShareProfile = useCallback(
    (profile: DeveloperProfile | null) => {
      if (profile && !profile.isAnonymous) {
        const shareData = JSON.stringify({ type: "profile", profile })
        sendMessage(shareData)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "system",
            text: "You shared your profile",
            timestamp: new Date(),
            type: "text",
          },
        ])
      }
    },
    [sendMessage],
  )

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!message.trim()) return

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "me",
          text: message.trim(),
          timestamp: new Date(),
          type: "text",
        },
      ])

      sendMessage(message.trim())
      setMessage("")
    },
    [message, sendMessage],
  )

  const handleSkip = useCallback(() => {
    closeConnection()
    localStream?.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    setMessages([])
    setPeerProfile(null)
    setShowPeerProfile(false)
    setShowDisconnectWarning(false)
    isInitializedRef.current = false
    isCleaningUpRef.current = false
    onSkip()
  }, [onSkip, closeConnection, localStream])

  const handleLeave = useCallback(() => {
    closeConnection()
    localStream?.getTracks().forEach((track) => track.stop())
    onLeave()
  }, [onLeave, closeConnection, localStream])

  const handleReportAutoDisconnect = useCallback(() => {
    setDisconnectReason("This user has been reported multiple times and will be disconnected.")
    setShowDisconnectWarning(true)
    setTimeout(() => {
      handleSkip()
    }, 2000)
  }, [handleSkip])

  const renderMessage = (msg: ChatMessage) => {
    if (msg.sender === "system") {
      return (
        <div key={msg.id} className="flex justify-center">
          <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">{msg.text}</span>
        </div>
      )
    }

    return (
      <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
            msg.sender === "me" ? "bg-foreground text-background" : "bg-secondary text-foreground"
          }`}
        >
          <p className="text-sm">{msg.text}</p>
        </div>
      </div>
    )
  }

  // Adjust UI for Chat Only mode
  if (type === "chat") {
      return (
    <div className="flex h-[calc(100vh-4rem)] flex-col justify-center max-w-4xl mx-auto w-full">
      {/* Main chat area */}
      <div className="relative flex-1 bg-card border rounded-xl overflow-hidden shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-muted/20">
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
                <span className="font-semibold">Anonymous Developer ({mode})</span>
            </div>
            
            <div className="flex items-center gap-2">
                 <Button variant="secondary" size="sm" onClick={handleSkip} className="gap-2">
                    <SkipForward className="h-4 w-4" /> Next
                 </Button>
                 <Button variant="destructive" size="sm" onClick={handleLeave} className="gap-2">
                    <PhoneOff className="h-4 w-4" /> Leave
                 </Button>
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(renderMessage)}
            <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="border-t p-4 bg-muted/10">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={connectionState !== "connected"}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={connectionState !== "connected"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Overlays like Report Modal */}
        <ReportModal
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            peerId={peerId}
            roomId={roomId}
            onAutoDisconnect={handleReportAutoDisconnect}
        />
        <AutoDisconnectWarning
            isVisible={showDisconnectWarning}
            reason={disconnectReason}
            onStay={() => setShowDisconnectWarning(false)}
            onLeave={handleLeave}
        />
      </div>
    </div>
      )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Main video area */}
      <div className="relative flex-1 bg-card">
        {/* Remote video (full screen) */}
        <div className="relative h-full w-full overflow-hidden bg-secondary">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
            poster="/developer-video-call-dark-background.jpg"
          />

          {/* Connection status overlay */}
          {connectionState !== "connected" && (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary/80">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  {connectionState === "connecting" ? "Connecting to peer..." : "Waiting for connection..."}
                </p>
              </div>
            </div>
          )}

          {/* Connection quality indicator */}
          <div className="absolute top-6 right-6">
            {connectionState !== "idle" && <ConnectionQuality connectionState={connectionState} />}
          </div>

          {/* Auto disconnect warning */}
          <AutoDisconnectWarning
            isVisible={showDisconnectWarning}
            reason={disconnectReason}
            onStay={() => setShowDisconnectWarning(false)}
            onLeave={handleLeave}
          />

          {/* Peer info overlay */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-24 left-6 flex items-center gap-3"
          >
            <button
              onClick={() => setShowPeerProfile(!showPeerProfile)}
              className="flex items-center gap-3 rounded-full border border-border bg-background/80 px-4 py-2 backdrop-blur-lg transition-colors hover:bg-background/90"
            >
              <div
                className={`h-3 w-3 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
              />
              <span className="text-sm font-medium">{peerProfile?.displayName || "Anonymous Developer"}</span>
              {peerProfile && <User className="h-4 w-4 text-muted-foreground" />}
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsReportOpen(true)}
              className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-lg hover:bg-destructive/20"
            >
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Chat sidebar - Desktop */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden w-96 flex-col border-l border-border bg-card lg:flex"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold">Chat</h3>
          <Button variant="ghost" size="sm" onClick={() => setIsShareOpen(true)} className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <p>{connectionState === "connected" ? "Say hello!" : "Connecting..."}</p>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={connectionState === "connected" ? "Type a message..." : "Connecting..."}
              className="flex-1 bg-secondary"
              disabled={connectionState !== "connected"}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-foreground text-background hover:bg-foreground/90"
              disabled={connectionState !== "connected"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </motion.div>

      {/* Chat overlay - Mobile */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="absolute inset-0 z-50 flex flex-col bg-card lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold">Chat</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map(renderMessage)}
                <div ref={chatEndRef} />
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={connectionState === "connected" ? "Type a message..." : "Connecting..."}
                  className="flex-1 bg-secondary"
                  disabled={connectionState !== "connected"}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-foreground text-background hover:bg-foreground/90"
                  disabled={connectionState !== "connected"}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share panel */}
      <SharePanel isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShare={handleShareProfile} />

      {/* Report modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        peerId={peerId}
        roomId={roomId}
        onAutoDisconnect={handleReportAutoDisconnect}
      />
      
       {/* Controls bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 border-t border-border bg-background/80 p-4 backdrop-blur-xl"
        >
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="h-12 w-12 rounded-full p-0"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="h-12 w-12 rounded-full p-0"
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button variant="secondary" size="lg" onClick={handleSkip} className="h-12 gap-2 rounded-full px-6">
            <SkipForward className="h-5 w-5" />
            <span className="hidden sm:inline">Next</span>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIsShareOpen(!isShareOpen)}
            className="h-12 w-12 rounded-full p-0"
          >
            <Share2 className="h-5 w-5" />
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="h-12 w-12 rounded-full p-0 lg:hidden"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          <Button variant="destructive" size="lg" onClick={handleLeave} className="h-12 gap-2 rounded-full px-6">
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </motion.div>
    </div>
  )
}
