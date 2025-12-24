"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { rtcConfig, getLocalStream, createPeerConnection } from "@/lib/webrtc"
import { getSignalingService, type WebRTCSignal } from "@/lib/signaling-service"

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed"

interface UseWebRTCOptions {
  roomId?: string
  peerId?: string
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: ConnectionState) => void
  onMessage?: (message: string) => void
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const signalingRef = useRef(getSignalingService())
  const roomIdRef = useRef<string | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const callbacksRef = useRef(options)

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = options
  }, [options])

  useEffect(() => {
    const signaling = signalingRef.current

    const handleSignal = async (signal: WebRTCSignal, fromId: string) => {
      console.log("[v0] Received signal:", signal.type, "from:", fromId)
      const pc = peerConnectionRef.current
      if (!pc) {
        console.log("[v0] No peer connection yet, ignoring signal")
        return
      }

      if (pc.signalingState === "closed" || pc.connectionState === "closed") {
        console.log("[v0] Peer connection is closed, ignoring signal")
        return
      }

      try {
        if (signal.type === "offer") {
          console.log("[v0] Processing offer, current signalingState:", pc.signalingState)
          if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
             // In some race conditions we might get an offer when we're not ready, but usually 'stable' is expected for initial,
             // or 'have-local-offer' if we both offered (glare). 
             // Simplest mitigation for now is proceeding but catching errors.
          }
          
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))

          // Process pending candidates
          console.log("[v0] Processing", pendingCandidatesRef.current.length, "pending ICE candidates")
          for (const candidate of pendingCandidatesRef.current) {
            try {
            try {
              if ((pc.signalingState as string) !== "closed") {
                await pc.addIceCandidate(new RTCIceCandidate(candidate))
              }
            } catch (e) {
               console.warn("[v0] Error adding pending candidate:", e)
            }
            } catch (e) {
               console.warn("[v0] Error adding pending candidate:", e)
            }
          }
          pendingCandidatesRef.current = []

          // Create and send answer
          if ((pc.signalingState as string) !== "closed") {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            console.log("[v0] Created and set answer")

            const roomId = roomIdRef.current
            if (roomId) {
              await signaling.sendSignal(roomId, fromId, {
                type: "answer",
                payload: answer,
              })
              console.log("[v0] Sent answer to", fromId)
            }
          }
        } else if (signal.type === "answer") {
          console.log("[v0] Processing answer, current signalingState:", pc.signalingState)
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
            console.log("[v0] Set remote description (answer)")

            // Process pending candidates
            for (const candidate of pendingCandidatesRef.current) {
              try {
                if ((pc.signalingState as string) !== "closed") {
                   await pc.addIceCandidate(new RTCIceCandidate(candidate))
                }
              } catch (e) {
                console.warn("[v0] Error adding pending candidate:", e)
              }
            }
            pendingCandidatesRef.current = []
          }
        } else if (signal.type === "ice-candidate") {
          const candidate = signal.payload as RTCIceCandidateInit
          if (pc.remoteDescription && pc.remoteDescription.type) {
            console.log("[v0] Adding ICE candidate directly")
            try {
               if ((pc.signalingState as string) !== "closed") {
                 await pc.addIceCandidate(new RTCIceCandidate(candidate))
               }
            } catch (e) {
                console.warn("[v0] Error adding ICE candidate:", e)
            }
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
      signaling.onSignal(() => {}) // Clear callback
    }
  }, [])

  // Initialize local stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await getLocalStream()
      setLocalStream(stream)
      return stream
    } catch (error) {
      console.error("Failed to initialize local stream:", error)
      throw error
    }
  }, [])

  const createConnection = useCallback(
    async (isInitiator: boolean, roomId: string, peerId: string) => {
      console.log("[v0] Creating connection, isInitiator:", isInitiator, "roomId:", roomId, "peerId:", peerId)

      // Store in refs for use in signal handler
      roomIdRef.current = roomId
      peerIdRef.current = peerId

      setConnectionState("connecting")

      const stream = localStream || (await initializeLocalStream())
      const signaling = signalingRef.current

      const pc = createPeerConnection(
        rtcConfig,
        async (candidate) => {
          // Send ICE candidate to peer via signaling
          if (peerConnectionRef.current?.signalingState === "closed") return
          
          console.log("[v0] Sending ICE candidate to", peerId)
          await signaling.sendSignal(roomId, peerId, {
            type: "ice-candidate",
            payload: candidate.toJSON(),
          })
        },
        (remoteMediaStream) => {
          console.log("[v0] Received remote stream with", remoteMediaStream.getTracks().length, "tracks")
          setRemoteStream(remoteMediaStream)
          callbacksRef.current.onRemoteStream?.(remoteMediaStream)
        },
      )

      // Add local tracks to connection
      stream.getTracks().forEach((track) => {
        console.log("[v0] Adding local track:", track.kind)
        pc.addTrack(track, stream)
      })

      // Set up data channel for chat
      if (isInitiator) {
        console.log("[v0] Creating data channel (initiator)")
        const dataChannel = pc.createDataChannel("chat", { ordered: true })
        setupDataChannel(dataChannel)
        dataChannelRef.current = dataChannel
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
        console.log("[v0] Connection state changed:", state)
        if (state === "connected") {
          setConnectionState("connected")
          callbacksRef.current.onConnectionStateChange?.("connected")
        } else if (state === "disconnected" || state === "closed") {
          setConnectionState("disconnected")
          callbacksRef.current.onConnectionStateChange?.("disconnected")
        } else if (state === "failed") {
          setConnectionState("failed")
          callbacksRef.current.onConnectionStateChange?.("failed")
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log("[v0] ICE connection state:", pc.iceConnectionState)
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnectionState("connected")
          callbacksRef.current.onConnectionStateChange?.("connected")
        }
      }

      peerConnectionRef.current = pc

      if (isInitiator) {
        console.log("[v0] Creating offer (initiator)")
        try {
          const offer = await pc.createOffer()
          if ((pc.signalingState as string) !== "closed") {
            await pc.setLocalDescription(offer)
            console.log("[v0] Set local description (offer)")

            await signaling.sendSignal(roomId, peerId, {
              type: "offer",
              payload: offer,
            })
            console.log("[v0] Sent offer to", peerId)
          }
        } catch (e) {
          console.error("Error creating/sending offer:", e)
        }
      }

      return pc
    },
    [localStream, initializeLocalStream],
  )

  // Set up data channel event handlers
  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log("[v0] Data channel opened")
    }

    channel.onmessage = (event) => {
      console.log("[v0] Data channel message received")
      callbacksRef.current.onMessage?.(event.data)
    }

    channel.onclose = () => {
      console.log("[v0] Data channel closed")
    }

    channel.onerror = (error) => {
      console.error("[v0] Data channel error:", error)
    }
  }

  // Send message via data channel
  const sendMessage = useCallback((message: string) => {
    const dc = dataChannelRef.current
    if (dc && dc.readyState === "open") {
      dc.send(message)
      return true
    }
    console.log("[v0] Cannot send message, data channel state:", dc?.readyState)
    return false
  }, [])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
  }, [localStream, isVideoEnabled])

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioEnabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }, [localStream, isAudioEnabled])

  // Close connection
  const closeConnection = useCallback(() => {
    console.log("[v0] Closing connection")
    dataChannelRef.current?.close()
    peerConnectionRef.current?.close()

    peerConnectionRef.current = null
    dataChannelRef.current = null
    pendingCandidatesRef.current = []
    roomIdRef.current = null
    peerIdRef.current = null

    setRemoteStream(null)
    setConnectionState("idle")
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
      closeConnection()
    }
  }, [localStream, closeConnection])

  return {
    connectionState,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    initializeLocalStream,
    createConnection,
    sendMessage,
    toggleVideo,
    toggleAudio,
    closeConnection,
  }
}
