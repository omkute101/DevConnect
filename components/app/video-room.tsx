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
import { Textarea } from "@/components/ui/textarea"
import type { AppMode, ConnectionType, MediaPermissions } from "@/app/app/page"
import { SharePanel } from "@/components/app/share-panel"
import { ReportModal } from "@/components/app/report-modal"
import { ConnectionQuality } from "@/components/app/connection-quality"
import { AutoDisconnectWarning } from "@/components/app/auto-disconnect-warning"
import type { DeveloperProfile } from "@/lib/developer-profile"
import { getSignalingService, type WebRTCSignal } from "@/lib/signaling-service"
import { rtcConfig } from "@/lib/webrtc"

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed"

interface VideoRoomProps {
  mode: AppMode
  type: ConnectionType
  peerId: string
  roomId: string
  isInitiator: boolean
  onSkip: () => void
  onLeave: () => void
  initialPermissions?: MediaPermissions | null
}

interface ChatMessage {
  id: string
  sender: "me" | "peer" | "system"
  text: string
  timestamp: Date
  type?: "text" | "profile"
  profile?: DeveloperProfile
}

export function VideoRoom({
  mode,
  type,
  peerId,
  roomId,
  isInitiator,
  onSkip,
  onLeave,
  initialPermissions,
}: VideoRoomProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === "video" && !initialPermissions?.denied)
  const [isAudioEnabled, setIsAudioEnabled] = useState(type === "video" && !initialPermissions?.denied)
  const [isChatOpen, setIsChatOpen] = useState(type === "chat")
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [peerProfile, setPeerProfile] = useState<DeveloperProfile | null>(null)
  const [showPeerProfile, setShowPeerProfile] = useState(false)
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false)
  const [disconnectReason, setDisconnectReason] = useState("")
  const [permissionsDenied, setPermissionsDenied] = useState(initialPermissions?.denied ?? false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const isInitializedRef = useRef(false)
  const isCleaningUpRef = useRef(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setPermissionsDenied(false)
      return stream
    } catch (error) {
      console.error("Failed to get local stream:", error)
      setPermissionsDenied(true)
      return null
    }
  }, [])

  const toggleVideo = useCallback(async () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled
        })
        setIsVideoEnabled(!isVideoEnabled)
      }
    } else if (type === "video" && permissionsDenied) {
      const stream = await getLocalStream()
      if (stream) {
        setLocalStream(stream)
        setIsVideoEnabled(true)
        setIsAudioEnabled(true)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        const pc = peerConnectionRef.current
        if (pc) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream)
          })
        }
      }
    }
  }, [localStream, isVideoEnabled, type, permissionsDenied, getLocalStream])

  const toggleAudio = useCallback(async () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !isAudioEnabled
        })
        setIsAudioEnabled(!isAudioEnabled)
      }
    } else if (type === "video" && permissionsDenied) {
      const stream = await getLocalStream()
      if (stream) {
        setLocalStream(stream)
        setIsVideoEnabled(true)
        setIsAudioEnabled(true)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        const pc = peerConnectionRef.current
        if (pc) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream)
          })
        }
      }
    }
  }, [localStream, isAudioEnabled, type, permissionsDenied, getLocalStream])

  // Set up signal handler
  useEffect(() => {
    const signaling = getSignalingService()

    const handleSignal = async (signal: WebRTCSignal, fromId: string) => {
      const pc = peerConnectionRef.current
      if (!pc) {
        return
      }

      try {
        if (signal.type === "offer") {
          if (pc.signalingState !== "stable") {
            return
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))

          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current = []

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          await signaling.sendSignal(roomId, fromId, {
            type: "answer",
            payload: answer,
          })
        } else if (signal.type === "answer") {
          if (pc.signalingState !== "have-local-offer") {
            return
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))

          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current = []
        } else if (signal.type === "ice-candidate") {
          const candidate = signal.payload as RTCIceCandidateInit
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } else {
            pendingCandidatesRef.current.push(candidate)
          }
        }
      } catch (error) {
        console.error("Error handling signal:", error)
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
      setConnectionState("connecting")

      try {
        let stream: MediaStream | null = null

        if (type === "video" && !permissionsDenied) {
          console.log("Requesting local stream...")
          stream = await getLocalStream()
          if (stream) {
            console.log("Local stream acquired, tracks:", stream.getTracks().length)
            setLocalStream(stream)
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream
            }
          } else {
            console.error("Failed to acquire local stream")
          }
        }

        const signaling = getSignalingService()

        const pc = new RTCPeerConnection(rtcConfig)
        peerConnectionRef.current = pc

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await signaling.sendSignal(roomId, peerId, {
              type: "ice-candidate",
              payload: event.candidate.toJSON(),
            })
          }
        }

        pc.ontrack = (event) => {
          console.log("Received remote track:", event.track.kind)
          // Create or get existing remote stream
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream()
          }

          // Add the track to our stream
          const existingTrack = remoteStreamRef.current.getTracks().find((t) => t.id === event.track.id)
          if (!existingTrack) {
            remoteStreamRef.current.addTrack(event.track)
          }

          // Update state with a NEW MediaStream instance to ensure React detects the change
          setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()))

          if (remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current
            }
            remoteVideoRef.current.play().catch((err) => console.error("Error playing remote video:", err))
          }
        }

        // Add local tracks if we have them
        if (stream) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream!)
          })
        }

        // Set up data channel
        const setupDataChannel = (channel: RTCDataChannel) => {
          channel.onopen = () => {
            setConnectionState("connected")
            setMessages([
              {
                id: "welcome",
                sender: "system",
                text: `Connected! You're chatting in ${mode} mode.`,
                timestamp: new Date(),
                type: "text",
              },
            ])
          }
          channel.onmessage = (event) => {
            handleIncomingMessage(event.data)
          }
          channel.onclose = () => {}
          channel.onerror = () => {}
        }

        if (isInitiator) {
          const dc = pc.createDataChannel("chat", { ordered: true })
          setupDataChannel(dc)
          dataChannelRef.current = dc
        } else {
          pc.ondatachannel = (event) => {
            setupDataChannel(event.channel)
            dataChannelRef.current = event.channel
          }
        }

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState

          if (state === "connected") {
            setConnectionState("connected")
            setShowDisconnectWarning(false)
            setDisconnectReason("")
          } else if (state === "disconnected") {
            setConnectionState("disconnected")
            // Give it a moment to reconnect before scaring the user
            setTimeout(() => {
              if (pc.connectionState === "disconnected") {
                setDisconnectReason("Connection unstable...")
                setShowDisconnectWarning(true)
              }
            }, 5000)
          } else if (state === "failed") {
            setConnectionState("failed")
            setDisconnectReason("The connection has failed.")
            setShowDisconnectWarning(true)
          }
        }

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setConnectionState("connected")
          }
        }

        if (isInitiator) {
          await new Promise((resolve) => setTimeout(resolve, 300))
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)

          await signaling.sendSignal(roomId, peerId, {
            type: "offer",
            payload: offer,
          })
        }
      } catch (error) {
        console.error("Failed to initialize:", error)
        setConnectionState("failed")
      }
    }

    initConnection()

    return () => {
      isCleaningUpRef.current = true
    }
  }, [roomId, peerId, isInitiator, mode, type, permissionsDenied, getLocalStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCleaningUpRef.current) {
        dataChannelRef.current?.close()
        peerConnectionRef.current?.close()
        localStream?.getTracks().forEach((track) => track.stop())
        remoteStreamRef.current = null
      }
    }
  }, [localStream])

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

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("Attaching local stream to video element")
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true // Ensure local video is always muted
      localVideoRef.current.play().catch((err) => console.error("Error playing local video:", err))
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("Attaching REMOTE stream to video element")
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch((err) => console.error("Error playing remote video:", err))
    }
  }, [remoteStream])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback((text: string): boolean => {
    const dc = dataChannelRef.current
    if (dc && dc.readyState === "open") {
      dc.send(text)
      return true
    }
    return false
  }, [])

  const closeConnection = useCallback(() => {
    dataChannelRef.current?.close()
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    dataChannelRef.current = null
    pendingCandidatesRef.current = []
    remoteStreamRef.current = null
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
    (e: React.FormEvent | React.KeyboardEvent) => {
      e.preventDefault()
      if (!message.trim()) return

      if ("key" in e && e.key === "Enter" && e.shiftKey) {
        return
      }

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

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 10)
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

  // Connecting Overlay
  if (connectionState === "connecting" || connectionState === "idle") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight">Establishing Secure Connection</h3>
            <p className="text-muted-foreground">Connecting with peer...</p>
          </div>
        </div>
      </div>
    )
  }

  // Chat Only Mode UI
  if (type === "chat") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        {/* Chat Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold leading-none">Anonymous Developer</h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{mode} Mode</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4" />
              <span className="hidden sm:inline">Next</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center opacity-50">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender === "me"
            const isSystem = msg.sender === "system"

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-2">
                  <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
                    {msg.text}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 border-t border-border/50 bg-background/80 backdrop-blur-xl">
          <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder="Type a message..."
                className="min-h-[50px] max-h-[150px] py-3 pr-12 rounded-2xl border-border/50 bg-secondary/50 focus:bg-background transition-all resize-none shadow-sm text-base"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-[50px] w-[50px] rounded-xl shrink-0 shadow-lg transition-all active:scale-95"
              disabled={!message.trim()}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>

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
    )
  }

  // Video + Chat Mode UI
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div className="relative flex-1 bg-card">
        <div className="relative h-full w-full overflow-hidden bg-secondary">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
            poster="/developer-video-call-dark-background.jpg"
          />

          {connectionState !== "connected" && !remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary/80">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                <p className="text-sm text-muted-foreground">Waiting for peer video...</p>
              </div>
            </div>
          )}

          <div className="absolute top-6 right-6">
            <ConnectionQuality connectionState={connectionState} />
          </div>

          <AutoDisconnectWarning
            isVisible={showDisconnectWarning}
            reason={disconnectReason}
            onStay={() => setShowDisconnectWarning(false)}
            onLeave={handleLeave}
          />

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

          {type === "video" && (
            <div className="absolute bottom-24 right-6 h-32 w-48 overflow-hidden rounded-xl border border-border bg-secondary shadow-lg">
              {localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary">
                  <VideoOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
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

        <form onSubmit={handleSendMessage} className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
              placeholder={connectionState === "connected" ? "Type a message..." : "Connecting..."}
              className="flex-1 bg-secondary min-h-[40px] max-h-[120px] resize-none"
              disabled={connectionState !== "connected"}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-foreground text-background hover:bg-foreground/90"
              disabled={connectionState !== "connected"}
              onMouseDown={(e) => e.preventDefault()}
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
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                  placeholder={connectionState === "connected" ? "Type a message..." : "Connecting..."}
                  className="flex-1 bg-secondary min-h-[40px] max-h-[120px] resize-none"
                  disabled={connectionState !== "connected"}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-foreground text-background hover:bg-foreground/90"
                  disabled={connectionState !== "connected"}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <SharePanel isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShare={handleShareProfile} />
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
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 border-t border-border bg-background/80 p-4 backdrop-blur-xl lg:left-0 lg:right-96"
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
