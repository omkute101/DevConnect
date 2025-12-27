// Omnars Backend Service
// Node.js + Express + Socket.IO server for real-time matchmaking and WebRTC signaling

import dotenv from "dotenv"
dotenv.config()

import express from "express"
import { createServer } from "http"
import { Server, type Socket } from "socket.io"
import { createAdapter } from "@socket.io/redis-adapter"
import { createClient, type RedisClientType } from "redis"
import jwt from "jsonwebtoken"
import cors from "cors"

// Types
interface SessionData {
  sessionId: string
  iat: number
  exp: number
}

interface QueueEntry {
  sessionId: string
  socketId: string
  mode: string
  connectionType: string
  timestamp: number
}

interface Match {
  matchId: string
  participants: string[]
  mode: string
  connectionType: string
  initiatorId: string
  createdAt: number
}

// Environment variables
const PORT = process.env.PORT || 8080
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || "redis://localhost:6379"
const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "Omnars-anonymous-session-secret-2024"
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"

// Log JWT secret hash for debugging (not the actual secret)
console.log("JWT Secret configured (length):", JWT_SECRET.length)

// App Setup
const app = express()
app.use(
  cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","), methods: ["GET", "POST"], credentials: true }),
)
app.use(express.json())

// Redis clients
let pubClient: RedisClientType
let subClient: RedisClientType
let redisClient: RedisClientType

// Socket.IO server
let io: Server

// Stats
let onlineCount = 0
let totalConnections = 0
let todayConnections = 0
const modeStats: Record<string, number> = {
  casual: 0,
  pitch: 0,
  collab: 0,
  hire: 0,
  freelance: 0,
  review: 0,
}

// Mode matching pairs (hire matches with freelance)
const modeMatchPairs: Record<string, string> = {
  hire: "freelance",
  freelance: "hire",
}

const SESSION_TTL = 24 * 60 * 60 // 24 hours

function getRedisConnectionUrl(): string {
  let url = REDIS_URL

  // Handle Upstash REST API URLs - convert to standard redis URL if needed
  if (url.includes("upstash.io") && !url.startsWith("redis://") && !url.startsWith("rediss://")) {
    // If it's a REST API URL, we can't use it directly with ioredis
    // Use the REDIS_URL which should be the standard redis:// URL
    console.warn("Detected Upstash REST URL, looking for standard Redis URL...")
  }

  // Ensure TLS for production
  if (url.includes("upstash.io") && url.startsWith("redis://")) {
    url = url.replace("redis://", "rediss://")
  }

  return url
}

async function initRedis() {
  const redisUrl = getRedisConnectionUrl()

  console.log("Connecting to Redis...")

  const clientConfig: { url: string; socket?: { tls: boolean; rejectUnauthorized: boolean } } = {
    url: redisUrl,
  }

  if (redisUrl.startsWith("rediss://")) {
    clientConfig.socket = {
      tls: true,
      rejectUnauthorized: false,
    }
  }

  pubClient = createClient(clientConfig)
  subClient = pubClient.duplicate()
  redisClient = pubClient.duplicate()

  // Error handlers with reconnection
  pubClient.on("error", (err) => console.error("Redis Pub Client Error:", err))
  subClient.on("error", (err) => console.error("Redis Sub Client Error:", err))
  redisClient.on("error", (err) => console.error("Redis Client Error:", err))

  // Reconnection handlers
  pubClient.on("reconnecting", () => console.log("Redis Pub Client reconnecting..."))
  subClient.on("reconnecting", () => console.log("Redis Sub Client reconnecting..."))
  redisClient.on("reconnecting", () => console.log("Redis Client reconnecting..."))

  await Promise.all([pubClient.connect(), subClient.connect(), redisClient.connect()])

  console.log("Connected to Redis successfully")
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Closing Redis connections...`)
  
  try {
    if (io) {
      io.close()
      console.log("Socket.IO server closed")
    }
    
    await Promise.all([
      pubClient?.quit(),
      subClient?.quit(),
      redisClient?.quit(),
    ])
    console.log("Redis connections closed successfully")
  } catch (error) {
    console.error("Error during shutdown:", error)
  }
  
  process.exit(0)
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Export Redis client for reuse by other modules
export { redisClient }


function getQueueKey(mode: string, connectionType: string): string {
  return `queue:${mode}:${connectionType}`
}

function getSessionKey(sessionId: string): string {
  return `session:${sessionId}`
}

function getSocketKey(socketId: string): string {
  return `socket:${socketId}`
}

function getMatchKey(matchId: string): string {
  return `match:${matchId}`
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `sess_${timestamp}_${randomPart}`
}

function createSessionToken(sessionId: string): string {
  return jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: "24h" })
}

function verifyToken(token: string): SessionData | null {
  try {
    console.log("Verifying token, first 20 chars:", token.substring(0, 20) + "...")
    const decoded = jwt.verify(token, JWT_SECRET) as SessionData
    console.log("Token verified successfully for session:", decoded.sessionId)
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log("Token expired")
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log("Invalid token:", error.message)
      console.log("Token structure check - parts:", token.split(".").length)
    } else {
      console.error("Token verification error:", error)
    }
    return null
  }
}

async function createSession(): Promise<{ sessionId: string }> {
  const sessionId = generateSessionId()
  const now = Date.now()

  // Use hSet to store session data as a hash (consistent with other session operations)
  await redisClient.hSet(getSessionKey(sessionId), {
    sessionId,
    socketId: "",
    selectedMode: "",
    createdAt: now.toString(),
    lastSeen: now.toString(),
    reportCount: "0",
    inQueue: "false",
  })
  await redisClient.expire(getSessionKey(sessionId), SESSION_TTL)

  return { sessionId }
}

async function addToQueue(entry: QueueEntry): Promise<void> {
  const queueKey = getQueueKey(entry.mode, entry.connectionType)

  // Store entry data
  await redisClient.hSet(getSessionKey(entry.sessionId), {
    socketId: entry.socketId,
    mode: entry.mode,
    connectionType: entry.connectionType,
    timestamp: entry.timestamp.toString(),
    inQueue: "true",
  })

  // Map socket to session
  await redisClient.set(getSocketKey(entry.socketId), entry.sessionId, { EX: 3600 })

  // Add to queue (FIFO)
  await redisClient.rPush(queueKey, entry.sessionId)
}

async function removeFromQueue(sessionId: string, mode: string, connectionType: string): Promise<void> {
  const queueKey = getQueueKey(mode, connectionType)
  await redisClient.lRem(queueKey, 0, sessionId)
  await redisClient.hSet(getSessionKey(sessionId), { inQueue: "false" })
}

async function findMatch(sessionId: string, mode: string, connectionType: string): Promise<Match | null> {
  // Determine which queue to search
  const targetMode = modeMatchPairs[mode] || mode
  const queueKey = getQueueKey(targetMode, connectionType)

  // Try to get first person in queue (not ourselves)
  // Fix: Use dynamic length check and proper index handling when removing items
  let i = 0
  let queueLength = await redisClient.lLen(queueKey)
  const MAX_CHECKS = 50 // Safety limit

  while (i < queueLength && i < MAX_CHECKS) {
    const peerId = await redisClient.lIndex(queueKey, i)

    if (!peerId) {
        break
    }

    if (peerId === sessionId) {
        i++
        continue
    }

    // Check if peer is still valid
    const peerData = await redisClient.hGetAll(getSessionKey(peerId))
    console.log(`[match] Checking ${peerId}: socket=${!!peerData.socketId}, inQueue=${peerData.inQueue}`)

    if (!peerData.socketId || peerData.inQueue !== "true") {
      // Remove stale entry
      console.log(`[match] Removing stale entry ${peerId}`)
      await redisClient.lRem(queueKey, 1, peerId)
      // Do NOT increment i, as the next item shifted into this slot
      // Update length
      queueLength = await redisClient.lLen(queueKey)
      continue
    }

    // Found a match! Remove from queue atomically
    const removed = await redisClient.lRem(queueKey, 1, peerId)
    if (removed === 0) {
        console.log(`[match] Failed to atomically remove ${peerId}`)
        // If we failed to remove, it might have been removed by someone else
        // We updates length and check index i again (which now has a new item)
        queueLength = await redisClient.lLen(queueKey)
        continue
    }

    console.log(`[match] Successfully matched ${sessionId} with ${peerId}`)

    // Create match
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const match: Match = {
      matchId,
      participants: [peerId, sessionId],
      mode: targetMode,
      connectionType,
      initiatorId: sessionId, // Joiner is initiator
      createdAt: Date.now(),
    }

    // Store match in Redis
    await redisClient.hSet(getMatchKey(matchId), {
      participants: JSON.stringify(match.participants),
      mode: match.mode,
      connectionType: match.connectionType,
      initiatorId: match.initiatorId,
      createdAt: match.createdAt.toString(),
    })
    await redisClient.expire(getMatchKey(matchId), 3600)

    // Update both sessions
    await redisClient.hSet(getSessionKey(sessionId), {
      matchId,
      peerId,
      inQueue: "false",
    })
    await redisClient.hSet(getSessionKey(peerId), {
      matchId,
      peerId: sessionId,
      inQueue: "false",
    })

    return match
  }

  console.log(`[match] No match found for ${sessionId} in ${queueKey} (checked ${i} items)`)
  return null
}

async function destroyMatch(matchId: string): Promise<string[]> {
  const matchData = await redisClient.hGetAll(getMatchKey(matchId))
  if (!matchData.participants) return []

  const participants: string[] = JSON.parse(matchData.participants)

  // Clear match references from sessions
  for (const sessionId of participants) {
    await redisClient.hDel(getSessionKey(sessionId), ["matchId", "peerId"])
  }

  // Delete match
  await redisClient.del(getMatchKey(matchId))

  return participants
}

async function handleJoinQueue(
  socket: Socket,
  sessionId: string,
  data: { mode: string; connectionType: string },
): Promise<{ type: string; roomId?: string; peerId?: string; isInitiator?: boolean }> {
  const { mode, connectionType } = data

  // Check for existing match first
  const match = await findMatch(sessionId, mode, connectionType)

  if (match) {
    const peerId = match.participants.find((p) => p !== sessionId)!
    const peerData = await redisClient.hGetAll(getSessionKey(peerId))

    // Join socket room
    socket.join(match.matchId)

    // Notify peer
    io.to(peerData.socketId).emit("matched", {
      roomId: match.matchId,
      peerId: sessionId,
      isInitiator: false,
    })

    // Make peer join room too
    const peerSocket = io.sockets.sockets.get(peerData.socketId)
    peerSocket?.join(match.matchId)

    totalConnections++
    todayConnections++
    modeStats[mode] = (modeStats[mode] || 0) + 1

    return {
      type: "matched",
      roomId: match.matchId,
      peerId,
      isInitiator: true,
    }
  }

  // No match found, add to queue
  await addToQueue({
    sessionId,
    socketId: socket.id,
    mode,
    connectionType,
    timestamp: Date.now(),
  })

  return { type: "waiting" }
}

async function handleNext(
  socket: Socket,
  sessionId: string,
  data: { roomId: string; mode: string; connectionType: string },
): Promise<{ type: string; roomId?: string; peerId?: string; isInitiator?: boolean }> {
  const { roomId, mode, connectionType } = data

  // Get current match participants before destroying
  const participants = await destroyMatch(roomId)

  // Notify peer that we skipped
  const peerId = participants.find((p) => p !== sessionId)
  if (peerId) {
    const peerData = await redisClient.hGetAll(getSessionKey(peerId))
    if (peerData.socketId) {
      io.to(peerData.socketId).emit("peer-skipped")

      // Try to find new match immediately for the skipped peer
      const peerMode = peerData.mode || mode
      const peerType = peerData.connectionType || connectionType

      const match = await findMatch(peerId, peerMode, peerType)

      if (match) {
        const newPeerId = match.participants.find((p) => p !== peerId)!
        const newPeerData = await redisClient.hGetAll(getSessionKey(newPeerId))

        // Notify skipped peer
        io.to(peerData.socketId).emit("matched", {
          roomId: match.matchId,
          peerId: newPeerId,
          isInitiator: true, 
        })
        const peerSocket = io.sockets.sockets.get(peerData.socketId)
        peerSocket?.join(match.matchId)

        // Notify new peer
        io.to(newPeerData.socketId).emit("matched", {
          roomId: match.matchId,
          peerId: peerId,
          isInitiator: false,
        })
        const newPeerSocket = io.sockets.sockets.get(newPeerData.socketId)
        newPeerSocket?.join(match.matchId)

        totalConnections++
        todayConnections++
      } else {
        // Re-add peer to queue
        await addToQueue({
          sessionId: peerId,
          socketId: peerData.socketId,
          mode: peerData.mode || mode,
          connectionType: peerData.connectionType || connectionType,
          timestamp: Date.now(),
        })
      }
    }
  }

  // Leave the room
  socket.leave(roomId)

  // Try to find new match immediately
  const match = await findMatch(sessionId, mode, connectionType)

  if (match) {
    const newPeerId = match.participants.find((p) => p !== sessionId)!
    const peerData = await redisClient.hGetAll(getSessionKey(newPeerId))

    socket.join(match.matchId)
    io.to(peerData.socketId).emit("matched", {
      roomId: match.matchId,
      peerId: sessionId,
      isInitiator: false,
    })

    const peerSocket = io.sockets.sockets.get(peerData.socketId)
    peerSocket?.join(match.matchId)

    totalConnections++
    todayConnections++

    return {
      type: "matched",
      roomId: match.matchId,
      peerId: newPeerId,
      isInitiator: true,
    }
  }

  // Add to queue
  await addToQueue({
    sessionId,
    socketId: socket.id,
    mode,
    connectionType,
    timestamp: Date.now(),
  })

  return { type: "waiting" }
}

async function handleLeave(socket: Socket, sessionId: string, data: { roomId?: string }): Promise<void> {
  const sessionData = await redisClient.hGetAll(getSessionKey(sessionId))

  // If this socket is not the current one for the session, ignore
  // This prevents stale connections (e.g. from previous tab) from destroying the match
  if (sessionData.socketId && sessionData.socketId !== socket.id) {
    console.log(`Ignoring leave for session ${sessionId} from stale socket ${socket.id}`)
    return
  }

  if (sessionData.matchId) {
    // Notify peer
    const participants = await destroyMatch(sessionData.matchId)
    const peerId = participants.find((p) => p !== sessionId)

    if (peerId) {
      const peerData = await redisClient.hGetAll(getSessionKey(peerId))
      if (peerData.socketId) {
        io.to(peerData.socketId).emit("peer-left")

        // Try to find new match immediately for the abandoned peer
        const peerMode = peerData.mode || sessionData.mode
        const peerType = peerData.connectionType || sessionData.connectionType

        const match = await findMatch(peerId, peerMode, peerType)

        if (match) {
          const newPeerId = match.participants.find((p) => p !== peerId)!
          const newPeerData = await redisClient.hGetAll(getSessionKey(newPeerId))

          // Notify abandoned peer
          io.to(peerData.socketId).emit("matched", {
            roomId: match.matchId,
            peerId: newPeerId,
            isInitiator: true,
          })
          const peerSocket = io.sockets.sockets.get(peerData.socketId)
          peerSocket?.join(match.matchId)

          // Notify new peer
          io.to(newPeerData.socketId).emit("matched", {
            roomId: match.matchId,
            peerId: peerId,
            isInitiator: false,
          })
          const newPeerSocket = io.sockets.sockets.get(newPeerData.socketId)
          newPeerSocket?.join(match.matchId)

          totalConnections++
          todayConnections++
        } else {
          // Re-add peer to queue automatically if no match found
          await addToQueue({
            sessionId: peerId,
            socketId: peerData.socketId,
            mode: peerMode,
            connectionType: peerType,
            timestamp: Date.now(),
          })
        }
      }
    }

    socket.leave(sessionData.matchId)
  }

  // Remove from any queues
  if (sessionData.mode && sessionData.connectionType && sessionData.inQueue === "true") {
    await removeFromQueue(sessionId, sessionData.mode, sessionData.connectionType)
  }
}

async function handleDisconnect(socket: Socket): Promise<void> {
  const sessionId = await redisClient.get(getSocketKey(socket.id))
  if (!sessionId) return

  onlineCount = Math.max(0, onlineCount - 1)

  await handleLeave(socket, sessionId, {})

  // Clean up socket mapping
  await redisClient.del(getSocketKey(socket.id))
}

async function handleSignal(
  socket: Socket,
  sessionId: string,
  data: { roomId: string; targetId: string; signal: unknown },
): Promise<void> {
  const { roomId, targetId, signal } = data

  // Verify user is in this match
  const sessionData = await redisClient.hGetAll(getSessionKey(sessionId))
  if (sessionData.matchId !== roomId) {
    return
  }

  // Get target socket
  const targetData = await redisClient.hGetAll(getSessionKey(targetId))
  if (!targetData.socketId) {
    return
  }

  // Forward signal
  io.to(targetData.socketId).emit("signal", {
    signal,
    fromId: sessionId,
  })
}

// API Routes

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() })
})

// Session init endpoint so backend can issue tokens directly
app.post("/api/session/init", async (req, res) => {
  try {
    const { sessionId } = await createSession()
    const token = createSessionToken(sessionId)

    console.log("Created new session:", sessionId)

    res.json({
      token,
      sessionId,
      expiresIn: 86400, // 24 hours
    })
  } catch (error) {
    console.error("Session init error:", error)
    res.status(500).json({ error: "Failed to create session" })
  }
})

// Endpoint to verify token (for debugging)
app.post("/api/session/verify", (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    return res.status(401).json({ valid: false, error: "No token provided" })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ valid: false, error: "Invalid token" })
  }

  res.json({ valid: true, sessionId: decoded.sessionId })
})

// Stats endpoint
app.get("/api/stats", async (req, res) => {
  try {
    const modes = ["casual", "pitch", "collab", "hire", "freelance", "review"]
    const types = ["video", "chat"]

    const queueStats: Record<string, number> = {}

    await Promise.all(
      modes.map(async (mode) => {
        const counts = await Promise.all(types.map((type) => redisClient.lLen(`queue:${mode}:${type}`)))
        queueStats[mode] = counts.reduce((a, b) => a + b, 0)
      }),
    )

    const activeRooms = (await redisClient.keys("match:*")).length

    res.json({
      online: onlineCount + 247,
      totalConnections: 2847293 + totalConnections,
      todayConnections: 12847 + todayConnections,
      byMode: {
        casual: (queueStats.casual || 0) + 50,
        pitch: (queueStats.pitch || 0) + 25,
        collab: (queueStats.collab || 0) + 35,
        hire: (queueStats.hire || 0) + 15,
        freelance: (queueStats.freelance || 0) + 20,
        review: (queueStats.review || 0) + 30,
      },
      realtime: {
        activeRooms,
        waitingByMode: queueStats,
        totalWaiting: Object.values(queueStats).reduce((a, b) => a + b, 0),
      },
    })
  } catch (error) {
    console.error("Stats error:", error)
    res.json({
      online: 247,
      totalConnections: 2847293,
      todayConnections: 12847,
      byMode: { casual: 50, pitch: 25, collab: 35, hire: 15, freelance: 20, review: 30 },
    })
  }
})

async function main() {
  try {
    await initRedis()
  } catch (error) {
    console.error("Failed to connect to Redis:", error)
    console.log("Starting without Redis adapter (single instance mode)")
  }

  const httpServer = createServer(app)

  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // Use Redis adapter for horizontal scaling (if Redis is connected)
  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient))
    console.log("Socket.IO Redis adapter enabled")
  }

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication required"))
    }

    const session = verifyToken(token)
    if (!session) {
      return next(new Error("Invalid token"))
    }
    // Attach session to socket
    ;(socket as Socket & { sessionId: string }).sessionId = session.sessionId
    next()
  })

  io.on("connection", async (socket: Socket & { sessionId?: string }) => {
    const sessionId = socket.sessionId!
    onlineCount++

    console.log(`Client connected: ${sessionId}`)

    // Store socket mapping
    if (redisClient) {
      await redisClient.set(getSocketKey(socket.id), sessionId, { EX: 3600 })
      // Update session with new socket ID immediately to handle reconnections
      await redisClient.hSet(getSessionKey(sessionId), { socketId: socket.id })
    }

    // Event handlers
    socket.on("join-queue", async (data, callback) => {
      try {
        const result = await handleJoinQueue(socket, sessionId, data)
        callback?.(result)
      } catch (error) {
        console.error("join-queue error:", error)
        callback?.({ type: "error", message: "Failed to join queue" })
      }
    })

    socket.on("next", async (data, callback) => {
      try {
        const result = await handleNext(socket, sessionId, data)
        callback?.(result)
      } catch (error) {
        console.error("next error:", error)
        callback?.({ type: "error", message: "Failed to skip" })
      }
    })

    socket.on("leave", async (data, callback) => {
      try {
        await handleLeave(socket, sessionId, data)
        callback?.({ success: true })
      } catch (error) {
        console.error("leave error:", error)
        callback?.({ success: false })
      }
    })

    socket.on("signal", async (data) => {
      try {
        await handleSignal(socket, sessionId, data)
      } catch (error) {
        console.error("signal error:", error)
      }
    })

    socket.on("get-stats", () => {
      socket.emit("stats", {
        online: onlineCount,
        totalConnections,
        todayConnections,
        byMode: modeStats,
      })
    })

    socket.on("disconnect", async (reason) => {
      console.log(`Client disconnected: ${sessionId}, reason: ${reason}`)
      try {
        await handleDisconnect(socket)
      } catch (error) {
        console.error("disconnect error:", error)
      }
    })
  })

  httpServer.listen(PORT, () => {
    console.log(`Omnars backend running on port ${PORT}`)
    console.log(`CORS origin: ${CORS_ORIGIN}`)
  })
}

main().catch(console.error)
