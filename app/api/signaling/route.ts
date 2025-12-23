import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { verifySession } from "@/lib/session"
import type { AppMode, ConnectionType } from "@/app/app/page"

// Redis key helpers
const keys = {
  queue: (mode: string, type: string) => `queue:${mode}:${type}`,
  room: (roomId: string) => `room:${roomId}`,
  sessionRoom: (sessionId: string) => `session:${sessionId}:room`,
  signals: (roomId: string, sessionId: string) => `signals:${roomId}:${sessionId}`,
  heartbeat: (sessionId: string) => `heartbeat:${sessionId}`,
}

function generateRoomId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `room_${timestamp}_${random}`
}

function getMatchingMode(mode: AppMode): AppMode {
  if (mode === "hire") return "freelance"
  if (mode === "freelance") return "hire"
  return mode
}

export async function POST(request: NextRequest) {
  try {
    // Verify session from Authorization header
    const authHeader = request.headers.get("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 })
    }

    const sessionId = session.sessionId
    const body = await request.json()
    const { action } = body

    // Update heartbeat
    await redis.set(keys.heartbeat(sessionId), Date.now().toString(), "EX", 30)

    switch (action) {
      case "join-queue": {
        const { mode, type } = body as { mode: AppMode; type: ConnectionType }

        // Remove from any existing room/queue first
        await cleanupSession(sessionId)

        const matchingMode = getMatchingMode(mode)
        const queueKey = keys.queue(matchingMode, type)
        const ownQueueKey = keys.queue(mode, type)

        // Try to find a match from the complementary queue
        let attempts = 0
        const MAX_ATTEMPTS = 5

        while (attempts < MAX_ATTEMPTS) {
          // Atomic pop from the matching queue
          const peerId = await redis.lpop(queueKey)

          if (!peerId) {
            // No one waiting in matching queue, add ourselves to our own queue
            await redis.rpush(ownQueueKey, sessionId)
            return NextResponse.json({ success: true, matched: false })
          }

          if (peerId === sessionId) {
            // Skip self
            continue
          }

          // Check if peer is still active (heartbeat within last 30s)
          const peerHeartbeat = await redis.get(keys.heartbeat(peerId))
          if (!peerHeartbeat || Date.now() - Number.parseInt(peerHeartbeat) > 30000) {
            // Peer is stale, try next
            attempts++
            continue
          }

          // Match found! Create room
          const roomId = generateRoomId()
          const now = Date.now()

          const room = {
            roomId,
            mode,
            type,
            participants: [peerId, sessionId],
            initiatorId: sessionId, // The joiner (us) is the initiator
            createdAt: now,
            lastActivity: now,
          }

          // Store room with 1 hour TTL
          await redis.set(keys.room(roomId), JSON.stringify(room), "EX", 3600)

          // Map both sessions to room
          await redis.set(keys.sessionRoom(sessionId), roomId, "EX", 3600)
          await redis.set(keys.sessionRoom(peerId), roomId, "EX", 3600)

          // Notify the waiting peer by storing match info
          await redis.set(
            `match:${peerId}`,
            JSON.stringify({
              roomId,
              peerId: sessionId,
              isInitiator: false,
            }),
            "EX",
            60,
          )

          return NextResponse.json({
            success: true,
            matched: true,
            roomId,
            peerId,
            isInitiator: true,
          })
        }

        // Failed to find valid match after retries, add to our own queue
        await redis.rpush(ownQueueKey, sessionId)
        return NextResponse.json({ success: true, matched: false })
      }

      case "check-match": {
        // Check if we have a pending match notification
        const matchData = await redis.get(`match:${sessionId}`)
        if (matchData) {
          await redis.del(`match:${sessionId}`)
          const match = JSON.parse(matchData)
          return NextResponse.json({
            success: true,
            matched: true,
            ...match,
          })
        }

        // Also check if we're already in a room
        const existingRoomId = await redis.get(keys.sessionRoom(sessionId))
        if (existingRoomId) {
          const roomData = await redis.get(keys.room(existingRoomId))
          if (roomData) {
            const room = JSON.parse(roomData)
            const peerId = room.participants.find((p: string) => p !== sessionId)
            return NextResponse.json({
              success: true,
              matched: true,
              roomId: existingRoomId,
              peerId,
              isInitiator: room.initiatorId === sessionId,
            })
          }
        }

        return NextResponse.json({ success: true, matched: false })
      }

      case "get-signals": {
        const { roomId } = body

        // Verify user is in this room
        const userRoomId = await redis.get(keys.sessionRoom(sessionId))
        if (userRoomId !== roomId) {
          return NextResponse.json({ success: false, error: "Not in room" }, { status: 403 })
        }

        // Get pending signals for this user
        const signalKey = keys.signals(roomId, sessionId)
        const signals = await redis.lrange(signalKey, 0, -1)

        // Clear the signals after reading
        if (signals.length > 0) {
          await redis.del(signalKey)
        }

        // Check if peer is still in the room
        const roomData = await redis.get(keys.room(roomId))
        let peerLeft = false
        if (roomData) {
          const room = JSON.parse(roomData)
          const peerId = room.participants.find((p: string) => p !== sessionId)
          if (peerId) {
            const peerRoomId = await redis.get(keys.sessionRoom(peerId))
            peerLeft = peerRoomId !== roomId
          }
        } else {
          peerLeft = true
        }

        return NextResponse.json({
          success: true,
          signals: signals.map((s) => JSON.parse(s)),
          peerLeft,
        })
      }

      case "signal": {
        const { roomId, targetId, signal } = body

        // Verify user is in this room
        const userRoomId = await redis.get(keys.sessionRoom(sessionId))
        if (userRoomId !== roomId) {
          return NextResponse.json({ success: false, error: "Not in room" }, { status: 403 })
        }

        // Store signal for target user
        const signalKey = keys.signals(roomId, targetId)
        await redis.rpush(
          signalKey,
          JSON.stringify({
            signal,
            fromId: sessionId,
            timestamp: Date.now(),
          }),
        )
        // Set expiry on signal queue
        await redis.expire(signalKey, 60)

        return NextResponse.json({ success: true })
      }

      case "skip": {
        const { roomId, mode, type } = body as { roomId: string; mode: AppMode; type: ConnectionType }

        const roomData = await redis.get(keys.room(roomId))
        if (roomData) {
          const room = JSON.parse(roomData)
          const peerId = room.participants.find((p: string) => p !== sessionId)

          if (peerId) {
            // Clear peer's room association so they know we left
            await redis.del(keys.sessionRoom(peerId))
            // Put peer back in their queue for immediate rematch
            const peerMode = room.mode as AppMode
            await redis.rpush(keys.queue(peerMode, type), peerId)
            // Notify peer they need to find a new match
            await redis.set(
              `match:${peerId}`,
              JSON.stringify({
                type: "left",
              }),
              "EX",
              10,
            )
          }
        }

        // Clean up current room
        await cleanupSession(sessionId)

        const matchingMode = getMatchingMode(mode)
        const queueKey = keys.queue(matchingMode, type)
        const ownQueueKey = keys.queue(mode, type)

        // Try to find a new match
        const peerId = await redis.lpop(queueKey)

        if (!peerId || peerId === sessionId) {
          await redis.rpush(ownQueueKey, sessionId)
          return NextResponse.json({ success: true, matched: false })
        }

        // Check peer validity
        const peerHeartbeat = await redis.get(keys.heartbeat(peerId))
        if (!peerHeartbeat || Date.now() - Number.parseInt(peerHeartbeat) > 30000) {
          await redis.rpush(ownQueueKey, sessionId)
          return NextResponse.json({ success: true, matched: false })
        }

        // Create new room
        const newRoomId = generateRoomId()
        const now = Date.now()

        const room = {
          roomId: newRoomId,
          mode,
          type,
          participants: [peerId, sessionId],
          initiatorId: sessionId,
          createdAt: now,
          lastActivity: now,
        }

        await redis.set(keys.room(newRoomId), JSON.stringify(room), "EX", 3600)
        await redis.set(keys.sessionRoom(sessionId), newRoomId, "EX", 3600)
        await redis.set(keys.sessionRoom(peerId), newRoomId, "EX", 3600)

        await redis.set(
          `match:${peerId}`,
          JSON.stringify({
            roomId: newRoomId,
            peerId: sessionId,
            isInitiator: false,
          }),
          "EX",
          60,
        )

        return NextResponse.json({
          success: true,
          matched: true,
          roomId: newRoomId,
          peerId,
          isInitiator: true,
        })
      }

      case "leave": {
        const { roomId } = body

        if (roomId) {
          const roomData = await redis.get(keys.room(roomId))
          if (roomData) {
            const room = JSON.parse(roomData)
            const peerId = room.participants.find((p: string) => p !== sessionId)

            if (peerId) {
              // Clear peer's room association
              await redis.del(keys.sessionRoom(peerId))
              // Put peer back in queue
              const type = room.type as ConnectionType
              const peerMode = room.mode as AppMode
              await redis.rpush(keys.queue(peerMode, type), peerId)
              // Notify peer to find new match
              await redis.set(
                `match:${peerId}`,
                JSON.stringify({
                  type: "left",
                }),
                "EX",
                10,
              )
            }
          }
        }

        await cleanupSession(sessionId)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Signaling error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}

async function cleanupSession(sessionId: string) {
  // Remove from any queues
  const modes = ["casual", "pitch", "collab", "hire", "freelance", "review"]
  const types = ["video", "chat"]

  for (const mode of modes) {
    for (const type of types) {
      await redis.lrem(keys.queue(mode, type), 0, sessionId)
    }
  }

  // Remove from current room
  const roomId = await redis.get(keys.sessionRoom(sessionId))
  if (roomId) {
    await redis.del(keys.sessionRoom(sessionId))
    await redis.del(keys.signals(roomId, sessionId))

    // Check if room is now empty and delete
    const roomData = await redis.get(keys.room(roomId))
    if (roomData) {
      const room = JSON.parse(roomData)
      const otherParticipant = room.participants.find((p: string) => p !== sessionId)
      if (otherParticipant) {
        const otherRoomId = await redis.get(keys.sessionRoom(otherParticipant))
        if (otherRoomId !== roomId) {
          // Other participant also left, delete room
          await redis.del(keys.room(roomId))
        }
      }
    }
  }

  // Clear any pending match
  await redis.del(`match:${sessionId}`)
}
