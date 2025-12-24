// Anonymous session management with JWT tokens
// Redis-backed for horizontal scalability

import { redis } from "@/lib/redis"
import { SignJWT, jwtVerify } from "jose"

export interface Session {
  sessionId: string
  socketId: string | null
  selectedMode: string | null
  createdAt: number
  lastSeen: number
  reportCount: number
}

export interface SessionPayload {
  sessionId: string
  createdAt: number
  exp: number
}

const SECRET_KEY = process.env.SESSION_SECRET || "omniconnect-anonymous-session-secret-2024"
const SECRET = new TextEncoder().encode(SECRET_KEY)
const SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds

export async function createSessionToken(sessionId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  
  return new SignJWT({ sessionId, createdAt: now })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `sess_${timestamp}_${randomPart}`
}

export async function createSession(): Promise<Session> {
  const sessionId = generateSessionId()
  const now = Date.now()

  const session: Session = {
    sessionId,
    socketId: null,
    selectedMode: null,
    createdAt: now,
    lastSeen: now,
    reportCount: 0,
  }

  // Store in Redis with TTL
  await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL)

  return session
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await redis.get(`session:${sessionId}`)
  if (!data) return null

  const session = JSON.parse(data) as Session

  // Update lastSeen and refresh TTL
  session.lastSeen = Date.now()
  await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL)

  return session
}

export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
  const session = await getSession(sessionId)
  if (!session) return null

  Object.assign(session, updates, { lastSeen: Date.now() })

  await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL)
  return session
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await redis.del(`session:${sessionId}`)
  return result === 1
}

export async function incrementReportCount(sessionId: string): Promise<number> {
  const session = await getSession(sessionId)
  if (!session) return 0

  session.reportCount += 1
  await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL)

  return session.reportCount
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const payload = await verifySessionToken(token)
  if (!payload) return null

  // Verify session exists in Redis
  const session = await getSession(payload.sessionId)
  if (!session) return null

  return payload
}

export async function getActiveSessionCount(): Promise<number> {
  // Count active heartbeats (sessions active in last 30 seconds)
  const keys = await redis.keys("heartbeat:*")
  let activeCount = 0

  for (const key of keys) {
    const heartbeat = await redis.get(key)
    if (heartbeat && Date.now() - Number.parseInt(heartbeat) < 30000) {
      activeCount++
    }
  }

  return activeCount
}
