// OmniConnect Backend Service
// Node.js + Express + Socket.IO server for real-time matchmaking and WebRTC signaling
// Deploy to Fly.io, Railway, or any Node.js hosting

import express from "express";
import { createServer } from "http"
import { Server, type Socket } from "socket.io"
import { createAdapter } from "@socket.io/redis-adapter"
import { createClient, type RedisClientType } from "redis"
import jwt from "jsonwebtoken"
import cors from "cors"
import { createSession, createSessionToken, incrementReportCount, getActiveSessionCount, verifySessionToken, getSession } from "./utils/session";
import { checkRateLimit, RATE_LIMITS } from "./utils/rate-limiter";

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
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key"
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"

// App Setup
const app = express();
app.use(cors({ origin: CORS_ORIGIN, methods: ["GET", "POST"] }));
app.use(express.json());

// Redis clients
let pubClient: RedisClientType
let subClient: RedisClientType
let redisClient: RedisClientType

// Socket.IO server
let io: Server

// Stats
// Note: In a scalable setup, these should be in Redis
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

// In-memory storage for reports (migrate to DB in production)
const reports: Array<{
  id: string
  reporterSessionId: string
  reportedSessionId: string
  roomId: string
  reason: string
  details?: string
  timestamp: number
  status: "pending" | "reviewed" | "resolved"
}> = [];

// Track reported sessions for auto-disconnect
const reportedSessions = new Map<string, number>();
const AUTO_DISCONNECT_THRESHOLD = 3;

async function initRedis() {
  pubClient = createClient({ url: REDIS_URL })
  subClient = pubClient.duplicate()
  redisClient = pubClient.duplicate()

  await Promise.all([pubClient.connect(), subClient.connect(), redisClient.connect()])

  console.log("Connected to Redis")
}

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
  const queueLength = await redisClient.lLen(queueKey)

  for (let i = 0; i < queueLength; i++) {
    const peerId = await redisClient.lIndex(queueKey, i)

    if (!peerId || peerId === sessionId) continue

    // Check if peer is still valid
    const peerData = await redisClient.hGetAll(getSessionKey(peerId))
    if (!peerData.socketId || peerData.inQueue !== "true") {
      // Remove stale entry
      await redisClient.lRem(queueKey, 1, peerId)
      continue
    }

    // Found a match! Remove from queue atomically
    const removed = await redisClient.lRem(queueKey, 1, peerId)
    if (removed === 0) continue // Someone else got them

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

  if (sessionData.matchId) {
    // Notify peer
    const participants = await destroyMatch(sessionData.matchId)
    const peerId = participants.find((p) => p !== sessionId)

    if (peerId) {
      const peerData = await redisClient.hGetAll(getSessionKey(peerId))
      if (peerData.socketId) {
        io.to(peerData.socketId).emit("peer-left")

        // Re-add peer to queue automatically
        await addToQueue({
          sessionId: peerId,
          socketId: peerData.socketId,
          mode: peerData.mode || sessionData.mode,
          connectionType: peerData.connectionType || sessionData.connectionType,
          timestamp: Date.now(),
        })
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
  if (sessionData.matchId !== roomId) return

  // Get target socket
  const targetData = await redisClient.hGetAll(getSessionKey(targetId))
  if (!targetData.socketId) return

  // Forward signal
  io.to(targetData.socketId).emit("signal", {
    signal,
    fromId: sessionId,
  })
}

function verifyToken(token: string): SessionData | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionData
  } catch {
    return null
  }
}

// Helper to get session from request
function getSessionFromRequest(request: express.Request): { sessionId: string } | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
  
    const token = authHeader.slice(7);
    const payload = verifySessionToken(token);
    if (!payload) return null;
  
    return { sessionId: payload.sessionId };
}

// API Routes

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Session Init
app.post("/api/session/init", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
      
      const rateLimit = checkRateLimit(`session-init:${ip}`, RATE_LIMITS.sessionInit);
      if (!rateLimit.allowed) {
          return res.status(429).json({
              success: false, 
              error: "Too many requests. Please try again later.",
              headers: {
                  "X-RateLimit-Remaining": rateLimit.remaining.toString(),
                  "X-RateLimit-Reset": rateLimit.resetIn.toString(),
              }
          });
      }
  
      const session = await createSession();
      const token = createSessionToken(session.sessionId);
  
      res.json({
          success: true,
          sessionId: session.sessionId,
          token,
          expiresIn: 86400, // 24 hours
      });
  
    } catch (error) {
      console.error("Session init error:", error);
      res.status(500).json({ success: false, error: "Failed to create session" });
    }
});
  
// Reports
app.post("/api/reports", async (req, res) => {
    try {
        const tokenSession = getSessionFromRequest(req);
        const { reportedSessionId, roomId, reason, details, reporterId } = req.body;
    
        const reporterSessionId = tokenSession?.sessionId || reporterId;
    
        if (!reporterSessionId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }
    
        const rateLimit = checkRateLimit(`report:${reporterSessionId}`, RATE_LIMITS.report);
        if (!rateLimit.allowed) {
            return res.status(429).json({ success: false, error: "Too many reports. Please try again later." });
        }
    
        if (!reportedSessionId || !reason) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }
    
        if (reporterSessionId === reportedSessionId) {
            return res.status(400).json({ success: false, error: "Cannot report yourself" });
        }
    
        const report = {
            id: `report-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            reporterSessionId,
            reportedSessionId,
            roomId: roomId || "unknown",
            reason,
            details,
            timestamp: Date.now(),
            status: "pending" as const,
        };
    
        reports.push(report);
    
        await incrementReportCount(reportedSessionId);
    
        // Track for auto-disconnect
        const currentCount = (reportedSessions.get(reportedSessionId) || 0) + 1;
        reportedSessions.set(reportedSessionId, currentCount);
    
        const shouldAutoDisconnect = currentCount >= AUTO_DISCONNECT_THRESHOLD;
    
        res.json({
            success: true,
            reportId: report.id,
            message: "Report submitted successfully.",
            shouldAutoDisconnect,
        });

        } catch (error) {
        console.error("Report error:", error);
        res.status(500).json({ success: false, error: "Server error" });
        }
});

app.get("/api/reports", async (req, res) => {
    const status = req.query.status as string;
    let filteredReports = reports;
    if (status) {
        filteredReports = reports.filter((r) => r.status === status);
    }
    
    res.json({
        reports: filteredReports.slice(-100),
        total: filteredReports.length,
    });
});

// Stats
app.get("/api/stats", async (req, res) => {
    try {
        const modes = ["casual", "pitch", "collab", "hiring", "review"];
        const types = ["video", "chat"];
        
        const queueStats: Record<string, number> = {
            casual: 0,
            pitch: 0,
            collab: 0,
            hiring: 0,
            review: 0,
        };
        
        // This is efficient enough for small scale but might want to be optimized or cached
        // Using Promise.all for parallelism
        await Promise.all(modes.map(async (mode) => {
            const counts = await Promise.all(types.map(type => 
                redisClient.lLen(`queue:${mode}:${type}`)
            ));
            queueStats[mode] = counts.reduce((a, b) => a + b, 0);
        }));
        
        // Count active sessions (approximate active rooms)
        // Note: This relies on keys pattern matching which can be slow in Redis with many keys
        // Ideally we keep a counter in Redis
        const activeRooms = Math.ceil((await redisClient.keys("match:*")).length);

        const activeSessions = await getActiveSessionCount();
        
        // Add some base numbers for demo purposes (copied from Next.js logic)
        const baseOnline = 247;
        const realOnline = activeSessions > 0 ? activeSessions : baseOnline;
        
        res.json({
            online: realOnline + Math.floor(Math.random() * 20),
            totalConnections: 2847293 + activeRooms,
            todayConnections: 12847 + activeRooms,
            byMode: {
                casual: queueStats.casual + 50,
                pitch: queueStats.pitch + 25,
                collab: queueStats.collab + 35,
                hiring: queueStats.hiring + 15,
                review: queueStats.review + 30,
            },
            realtime: {
                activeRooms,
                waitingByMode: queueStats,
                totalWaiting: Object.values(queueStats).reduce((a, b) => a + b, 0),
            },
        });

    } catch (error) {
        console.error("Stats error:", error);
        // Fallback
        res.json({
            online: 247,
            totalConnections: 2847293,
            todayConnections: 12847,
            byMode: { casual: 50, pitch: 25, collab: 35, hiring: 15, review: 30 },
            realtime: { activeRooms: 0, waitingByMode: {}, totalWaiting: 0 },
        });
    }
});


async function main() {
  await initRedis()

  const httpServer = createServer(app)

  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  })

  // Use Redis adapter for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient))

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
    await redisClient.set(getSocketKey(socket.id), sessionId, { EX: 3600 })

    // Event handlers
    socket.on("join-queue", async (data, callback) => {
      const result = await handleJoinQueue(socket, sessionId, data)
      callback?.(result)
    })

    socket.on("next", async (data, callback) => {
      const result = await handleNext(socket, sessionId, data)
      callback?.(result)
    })

    socket.on("leave", async (data, callback) => {
      await handleLeave(socket, sessionId, data)
      callback?.({ success: true })
    })

    socket.on("signal", async (data) => {
      await handleSignal(socket, sessionId, data)
    })

    socket.on("get-stats", () => {
      socket.emit("stats", {
        online: onlineCount,
        totalConnections,
        todayConnections,
        byMode: modeStats,
      })
    })

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${sessionId}`)
      await handleDisconnect(socket)
    })
  })

  httpServer.listen(PORT, () => {
    console.log(`OmniConnect backend running on port ${PORT}`)
  })
}

main().catch(console.error)
