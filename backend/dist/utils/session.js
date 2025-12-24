"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.generateSessionId = generateSessionId;
exports.createSessionToken = createSessionToken;
exports.verifySessionToken = verifySessionToken;
exports.createSession = createSession;
exports.getSession = getSession;
exports.incrementReportCount = incrementReportCount;
exports.getActiveSessionCount = getActiveSessionCount;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ioredis_1 = require("ioredis");
// We need a Redis instance for session management. 
// Since we don't have a shared redis module imported here easily without circular deps if we use the one in index.ts,
// we'll accept a redis client or create a lightweight one, OR we can export the redis client from index.ts.
// However, to keep it clean, let's assume we pass the redis client or use a singleton if we had one.
// For now, I will create a new connection here to ensure isolation or we can refactor later.
// Actually, to avoid too many connections, let's export a setup function or expect the caller to handle persistence if possible.
// BUT, the easiest way to match the previous logic is to just use a Redis client here.
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new ioredis_1.Redis(REDIS_URL);
exports.redis = redis;
const JWT_SECRET = process.env.SESSION_SECRET || "omniconnect-anonymous-session-secret-2024";
const SESSION_TTL = 24 * 60 * 60; // 24 hours
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `sess_${timestamp}_${randomPart}`;
}
function createSessionToken(sessionId) {
    return jsonwebtoken_1.default.sign({ sessionId }, JWT_SECRET, { expiresIn: "24h" });
}
function verifySessionToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        return null;
    }
}
async function createSession() {
    const sessionId = generateSessionId();
    const now = Date.now();
    const session = {
        sessionId,
        socketId: null,
        selectedMode: null,
        createdAt: now,
        lastSeen: now,
        reportCount: 0,
    };
    await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL);
    return session;
}
async function getSession(sessionId) {
    const data = await redis.get(`session:${sessionId}`);
    if (!data)
        return null;
    return JSON.parse(data);
}
async function incrementReportCount(sessionId) {
    const session = await getSession(sessionId);
    if (!session)
        return 0;
    session.reportCount = (session.reportCount || 0) + 1;
    await redis.set(`session:${sessionId}`, JSON.stringify(session), "EX", SESSION_TTL);
    return session.reportCount;
}
async function getActiveSessionCount() {
    // Use Redis keys to count sessions 
    const keys = await redis.keys("session:*");
    return keys.length;
}
//# sourceMappingURL=session.js.map