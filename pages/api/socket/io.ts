
import { Server as NetServer } from "http"
import { NextApiRequest } from "next"
import { Server as ServerIO } from "socket.io"
import { NextApiResponseServerIO } from "@/types"
import { createAdapter } from "@socket.io/redis-adapter"
import { redisPublisher, redisSubscriber } from "@/lib/redis"
import { verifySessionToken } from "@/lib/session"
import { joinQueue, leaveRoom, MatchResult } from "@/lib/queue-manager"

export const config = {
  api: {
    bodyParser: false,
  },
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io"
    const httpServer: NetServer = res.socket.server as any
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
      transports: ["polling", "websocket"],
      pingTimeout: 60000,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    // Monitor Redis connection status before usage
    redisPublisher.on("ready", () => console.log("Redis Publisher Ready"))
    redisSubscriber.on("ready", () => console.log("Redis Subscriber Ready"))

    io.adapter(createAdapter(redisPublisher, redisSubscriber))

    io.use((socket, next) => {
        const { token, sessionId } = socket.handshake.auth
        
        // Basic auth check
        if (!token || !sessionId) return next(new Error("Authentication error"))
        
        // In prod: verifySessionToken(token) and match sessionId
        // For now, assume if they have a token they generated it properly (since we issue it)
        const payload = verifySessionToken(token)
        if (!payload || payload.sessionId !== sessionId) {
            return next(new Error("Invalid session"))
        }

        // Attach sessionId to socket
        (socket as any).sessionId = sessionId
        next()
    })

    io.on("connection", (socket) => {
      const sessionId = (socket as any).sessionId
      console.log(`Socket connected: ${socket.id} (Session: ${sessionId})`)
      
      // Personal room for notifications
      socket.join(`user:${sessionId}`)

      socket.on("join-queue", async (data, callback) => {
          try {
              const result = await joinQueue(sessionId, data.mode, data.type)
              
              if (result.matched && result.roomId && result.peerId) {
                  // Match found!
                  
                  // Join room
                  socket.join(result.roomId)
                  
                  // Notify peer (if they are connected to this instance, or via Redis Adapter)
                  // We emit to `user:peerId` which forces the peer to join the room
                  io.to(`user:${result.peerId}`).emit("match-found", {
                      roomId: result.roomId,
                      peerId: sessionId,
                      isInitiator: false
                  })

                  // Return match to caller
                  callback({ 
                      success: true, 
                      match: { 
                          roomId: result.roomId, 
                          peerId: result.peerId, 
                          isInitiator: true 
                       } 
                  })
              } else {
                  callback({ success: true, match: null }) // Waiting
              }
          } catch (e) {
              console.error("Queue join error", e)
              callback({ success: false, message: "ServerError" })
          }
      })

      socket.on("signal", (data) => {
          // data: { roomId, targetId, signal }
          // Verify user is in room
          socket.to(data.roomId).emit("signal", {
              signal: data.signal,
              fromId: sessionId
          })
      })

      socket.on("leave-queue", async () => {
          await leaveRoom(sessionId)
          // Also need to remove from queue if waiting... joinQueue logic handles this internally via removeFromQueue
      })

      socket.on("disconnect", async (reason) => {
        console.log(`Socket disconnected: ${socket.id} (Reason: ${reason})`)
        await leaveRoom(sessionId)
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler

