// Anonymous session management with JWT tokens
// Redis-backed for horizontal scalability

import { redis } from "@/lib/redis"
import jwt from "jsonwebtoken"

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
  createdAt?: number
  iat?: number
  exp?: number
}

const SECRET_KEY = process.env.SESSION_SECRET || "Omnars-anonymous-session-secret-2024"
const SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds

export async function createSessionToken(sessionId: string): Promise<string> {
  return jwt.sign({ sessionId }, SECRET_KEY, { expiresIn: "24h" })
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as SessionPayload
    return payload
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

  await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL })

  return session
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await redis.get<string>(`session:${sessionId}`)
  if (!data) return null

  const session = typeof data === "string" ? JSON.parse(data) : (data as unknown as Session)

  // Update lastSeen and refresh TTL
  session.lastSeen = Date.now()
  await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL })

  return session
}

export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
  const session = await getSession(sessionId)
  if (!session) return null

  Object.assign(session, updates, { lastSeen: Date.now() })

  await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL })
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
  await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL })

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
  // For Upstash, we'll estimate based on a counter
  const count = await redis.get<number>("active-session-count")
  return count || 0
}
