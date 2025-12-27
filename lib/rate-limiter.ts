// Redis-backed rate limiting for API routes
// Enables horizontal scaling by using shared Redis state

import { redis } from "@/lib/redis"

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

export const RATE_LIMITS = {
  sessionInit: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  signaling: { windowMs: 1000, maxRequests: 30 }, // 30 per second
  report: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
  default: { windowMs: 1000, maxRequests: 100 }, // 100 per second
} as const

/**
 * Redis-backed rate limiter using sliding window algorithm
 * Works across all serverless instances for horizontal scaling
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.default
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline()
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart)
    
    // Count current entries in window
    pipeline.zcard(key)
    
    // Add current request with timestamp as score
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })
    
    // Set expiry on the key (window duration + buffer)
    pipeline.expire(key, Math.ceil(config.windowMs / 1000) + 1)

    const results = await pipeline.exec()
    
    // Get count from pipeline results (index 1 is zcard result)
    const count = (results[1] as number) || 0
    
    const remaining = Math.max(0, config.maxRequests - count - 1)
    const allowed = count < config.maxRequests
    const resetIn = config.windowMs

    return { allowed, remaining, resetIn }
  } catch (error) {
    console.error("Rate limit check failed:", error)
    // Fail open - allow request if Redis is unavailable
    return { allowed: true, remaining: config.maxRequests, resetIn: config.windowMs }
  }
}

/**
 * Clear rate limit for an identifier (useful for testing)
 */
export async function clearRateLimit(identifier: string): Promise<void> {
  try {
    await redis.del(`ratelimit:${identifier}`)
  } catch (error) {
    console.error("Failed to clear rate limit:", error)
  }
}
