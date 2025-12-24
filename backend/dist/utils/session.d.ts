import { Redis } from "ioredis";
declare const redis: Redis;
export interface Session {
    sessionId: string;
    socketId: string | null;
    selectedMode: string | null;
    createdAt: number;
    lastSeen: number;
    reportCount: number;
    [key: string]: any;
}
export declare function generateSessionId(): string;
export declare function createSessionToken(sessionId: string): string;
export declare function verifySessionToken(token: string): {
    sessionId: string;
} | null;
export declare function createSession(): Promise<Session>;
export declare function getSession(sessionId: string): Promise<Session | null>;
export declare function incrementReportCount(sessionId: string): Promise<number>;
export declare function getActiveSessionCount(): Promise<number>;
export { redis };
//# sourceMappingURL=session.d.ts.map
