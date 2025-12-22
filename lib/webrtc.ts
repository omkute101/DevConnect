// WebRTC utility functions and configuration

export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10, // Pre-fetch ICE candidates
}

export async function getLocalStream(video = true, audio = true): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video
        ? {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: "user",
            frameRate: { ideal: 30, max: 30 },
          }
        : false,
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true, // Add auto gain control
          }
        : false,
    })
    return stream
  } catch (error) {
    console.error("Error accessing media devices:", error)
    throw error
  }
}

export function createPeerConnection(
  config: RTCConfiguration,
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(config)

  // Keep track of the remote stream we're building
  let remoteStream: MediaStream | null = null

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate)
    }
  }

  pc.ontrack = (event) => {
    console.log("[v0] ontrack fired, track kind:", event.track.kind, "streams:", event.streams.length)

    // Use existing stream if available, otherwise create new one
    if (event.streams && event.streams[0]) {
      console.log("[v0] Using stream from event.streams[0]")
      remoteStream = event.streams[0]
      onTrack(remoteStream)
    } else {
      // Some browsers don't populate streams array - create our own
      console.log("[v0] No streams in event, creating new MediaStream")
      if (!remoteStream) {
        remoteStream = new MediaStream()
      }
      remoteStream.addTrack(event.track)
      onTrack(remoteStream)
    }
  }

  return pc
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  return offer
}

export async function createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  return answer
}

export async function setRemoteDescription(
  pc: RTCPeerConnection,
  description: RTCSessionDescriptionInit,
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(description))
}

export async function addIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate))
}
