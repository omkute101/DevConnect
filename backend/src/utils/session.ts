import jwt from "jsonwebtoken";
import { Redis } from "ioredis";

// We need a Redis instance for session management. 
// Since we don't have a shared redis module imported here easily without circular deps if we use the one in index.ts,
// we'll accept a redis client or create a lightweight one, OR we can export the redis client from index.ts.
// However, to keep it clean, let's assume we pass the redis client or use a singleton if we had one.
// For now, I will create a new connection here to ensure isolation or we can refactor later.
// Actually, to avoid too many connections, let's export a setup function or expect the caller to handle persistence if possible.
// BUT, the easiest way to match the previous logic is to just use a Redis client here.

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);


const JWT_SECRET = process.env.SESSION_SECRET || "omniconnect-anonymous-session-secret-2024";
const SESSION_TTL = 24 * 60 * 60; // 24 hours

export interface Session {
  sessionId: string;
  socketId: string | null;
  selectedMode: string | null;
  createdAt: number;
  lastSeen: number;
  reportCount: number;
  [key: string]: any;
}

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `sess_${timestamp}_${randomPart}`;
}

export function createSessionToken(sessionId: string): string {
  return jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: "24h" });
}

export function verifySessionToken(token: string): { sessionId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sessionId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function createSession(): Promise<Session> {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session: Session = {
    sessionId,
    socketId: null,
    selectedMode: null,
    createdAt: now,
    lastSeen: now,
    reportCount: 0,
  };

  // Use hSet to store as hash (consistent with index.ts)
  await redis.hset(`session:${sessionId}`, {
    sessionId,
    socketId: "",
    selectedMode: "",
    createdAt: now.toString(),
    lastSeen: now.toString(),
    reportCount: "0",
    inQueue: "false",
  });
  await redis.expire(`session:${sessionId}`, SESSION_TTL);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const data = await redis.hgetall(`session:${sessionId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    sessionId: data.sessionId,
    socketId: data.socketId || null,
    selectedMode: data.selectedMode || null,
    createdAt: parseInt(data.createdAt) || 0,
    lastSeen: parseInt(data.lastSeen) || 0,
    reportCount: parseInt(data.reportCount) || 0,
  } as Session;
}

export async function incrementReportCount(sessionId: string): Promise<number> {
  const newCount = await redis.hincrby(`session:${sessionId}`, "reportCount", 1);
  return newCount;
}

export async function getActiveSessionCount(): Promise<number> {
  // Use Redis keys to count sessions 
  const keys = await redis.keys("session:*");
  return keys.length;
}

export { redis };
