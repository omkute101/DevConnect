// Mode-based matching queue manager
// Redis-backed FIFO queues with atomic matching

import { redis, redisPublisher } from "@/lib/redis"
import { AppMode, ConnectionType } from "@/app/app/page"
import { getSession } from "@/lib/session"

export interface MatchResult {
  matched: boolean
  roomId?: string
  peerId?: string
  isInitiator?: boolean
}

export interface Room {
  roomId: string
  mode: AppMode
  connectionType: ConnectionType
  participants: [string, string]
  initiatorId: string
  createdAt: number
  lastActivity: number
}

// Redis keys
const keys = {
  queue: (mode: string, type: string) => `queue:${mode}:${type}`,
  room: (roomId: string) => `room:${roomId}`,
  sessionRoom: (sessionId: string) => `session:${sessionId}:room`,
}

export function generateRoomId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `room_${timestamp}_${random}`
}

export async function joinQueue(sessionId: string, mode: AppMode, type: ConnectionType): Promise<MatchResult> {
  // 1. Remove from any existing queues/rooms first to be safe
  await removeFromQueue(sessionId)

  // 2. Try to match with someone waiting
  const queueKey = keys.queue(mode, type)
  
  // Max retries to find a valid partner
  let attempts = 0
  const MAX_ATTEMPTS = 3

  while (attempts < MAX_ATTEMPTS) {
    // Atomic pop from the front of the queue
    const peerId = await redis.lpop(queueKey)

    if (!peerId) {
      // Queue is empty, add ourselves to the back
      await redis.rpush(queueKey, sessionId)
      return { matched: false }
    }

    if (peerId === sessionId) {
      // Should not happen, but ignore self
      continue
    }

    // Check if peer is still alive/valid
    const peerSession = await getSession(peerId)
    if (!peerSession) {
      // Peer expired or disconnected, try next
      attempts++
      continue
    }

    // MATCH FOUND!
    const roomId = generateRoomId()
    const now = Date.now()

    const room: Room = {
      roomId,
      mode,
      connectionType: type,
      participants: [peerId, sessionId],
      initiatorId: sessionId,
      createdAt: now,
      lastActivity: now,
    }

    // Store room data
    const roomKey = keys.room(roomId)
    await redis.set(roomKey, JSON.stringify(room), "EX", 3600) // 1 hour TTL

    // Map sessions to room
    await redis.set(keys.sessionRoom(sessionId), roomId, "EX", 3600)
    await redis.set(keys.sessionRoom(peerId), roomId, "EX", 3600)

    // Notify peer via Pub/Sub (Socket.IO will listen for this)
    const matchEvent = {
        event: "match-found",
        data: {
            roomId,
            peerId: sessionId,
            isInitiator: false
        }
    }
    await redisPublisher.publish(`user:${peerId}`, JSON.stringify(matchEvent))

    return {
      matched: true,
      roomId,
      peerId,
      isInitiator: true,
    }
  }

  // If we exhausted attempts (all popped users were invalid), push self to queue
  await redis.rpush(queueKey, sessionId)
  return { matched: false }
}

export async function removeFromQueue(sessionId: string): Promise<void> {
  // Costly operation in Redis List (O(N)), but necessary for "Leave" functionality
  // Optimization: We check all queues. In prod, we might track which queue user is in.
  const modes: AppMode[] = ["casual", "pitch", "collab", "hiring", "review"]
  const types: ConnectionType[] = ["video", "chat"]
  
  for (const mode of modes) {
    for (const type of types) {
        const deletedCount = await redis.lrem(keys.queue(mode, type), 0, sessionId)
        if (deletedCount > 0) return // User can only be in one queue
    }
  }
}

export async function leaveRoom(sessionId: string): Promise<string | null> {
  const roomId = await redis.get(keys.sessionRoom(sessionId))
  if (!roomId) return null

  const roomData = await redis.get(keys.room(roomId))
  if (!roomData) {
    // Inconsistent state, just clean up self
    await redis.del(keys.sessionRoom(sessionId))
    return null
  }

  const room = JSON.parse(roomData) as Room
  const peerId = room.participants.find((p) => p !== sessionId)

  // Destroy room
  await redis.del(keys.room(roomId))
  
  // Clean up session mappings
  for (const p of room.participants) {
    await redis.del(keys.sessionRoom(p))
  }

  return peerId || null
}

export async function getRoom(roomId: string): Promise<Room | null> {
    const data = await redis.get(keys.room(roomId))
    return data ? JSON.parse(data) : null
}

export async function getQueueStats(): Promise<Record<AppMode, number>> {
  const modes: AppMode[] = ["casual", "pitch", "collab", "hiring", "review"]
  const types: ConnectionType[] = ["video", "chat"]
  
  const stats: Record<AppMode, number> = {
    casual: 0,
    pitch: 0,
    collab: 0,
    hiring: 0,
    review: 0,
  }

  // Ideally use a pipeline
  const pipeline = redis.pipeline()
  const keysList: {mode: AppMode, type: ConnectionType}[] = []

  for (const mode of modes) {
    for (const type of types) {
        pipeline.llen(keys.queue(mode, type))
        keysList.push({mode, type})
    }
  }

  const results = await pipeline.exec()
  
  if (results) {
      results.forEach((result, index) => {
          const [err, count] = result
          if (!err && typeof count === 'number') {
              const { mode } = keysList[index]
              stats[mode] += count
          }
      })
  }

  return stats
}

export async function getActiveRoomCount(): Promise<number> {
    // Return 0 for now as we don't strictly track active room count in a single key
    return 0 
}

export function updateRoomActivity(roomId: string) {
    redis.expire(keys.room(roomId), 3600)
}

