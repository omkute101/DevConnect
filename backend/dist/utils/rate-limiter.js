"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMITS = void 0;
exports.checkRateLimit = checkRateLimit;
const rateLimits = new Map();
exports.RATE_LIMITS = {
    sessionInit: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
    signaling: { windowMs: 1000, maxRequests: 30 }, // 30 per second
    report: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
    default: { windowMs: 1000, maxRequests: 100 }, // 100 per second
};
function checkRateLimit(identifier, config = exports.RATE_LIMITS.default) {
    const now = Date.now();
    const key = identifier;
    let entry = rateLimits.get(key);
    if (!entry || now > entry.resetAt) {
        entry = {
            count: 0,
            resetAt: now + config.windowMs,
        };
        rateLimits.set(key, entry);
    }
    entry.count++;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetIn = Math.max(0, entry.resetAt - now);
    const allowed = entry.count <= config.maxRequests;
    return { allowed, remaining, resetIn };
}
// Cleanup old entries periodically
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimits.entries()) {
            if (now > entry.resetAt + 60000) {
                rateLimits.delete(key);
            }
        }
    }, 60 * 1000);
}
//# sourceMappingURL=rate-limiter.js.map
