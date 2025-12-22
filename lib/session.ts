// Anonymous session management with JWT tokens
// Redis-backed for horizontal scalability

import { redis } from "@/lib/redis"

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

const SECRET = process.env.SESSION_SECRET || "omniconnect-anonymous-session-secret-2024"
const SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/")
  while (str.length % 4) str += "="
  return Buffer.from(str, "base64").toString()
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function createSessionToken(sessionId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    sessionId,
    createdAt: now,
    exp: now + 86400, // 24 hour expiry
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const signature = base64UrlEncode(simpleHash(`${header}.${body}.${SECRET}`))

  return `${header}.${body}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [header, body, signature] = parts
    const expectedSig = base64UrlEncode(simpleHash(`${header}.${body}.${SECRET}`))

    if (signature !== expectedSig) return null

    const payload: SessionPayload = JSON.parse(base64UrlDecode(body))

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null

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

export async function getActiveSessionCount(): Promise<number> {
    return 0
}
