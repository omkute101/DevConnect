// Redis-backed rate limiting for the backend
// Enables horizontal scaling across multiple instances

import { createClient, type RedisClientType } from "redis"

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

// Redis client will be injected from main module
let redisClient: RedisClientType | null = null

export function setRedisClient(client: RedisClientType) {
  redisClient = client
}

/**
 * Redis-backed rate limiter using sliding window algorithm with sorted sets
 * Works across all backend instances for horizontal scaling
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.default
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  // Fallback to allow if Redis not available
  if (!redisClient) {
    console.warn("Rate limiter: Redis client not set, allowing request")
    return { allowed: true, remaining: config.maxRequests, resetIn: config.windowMs }
  }

  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Use Redis multi for atomic operations
    const multi = redisClient.multi()
    
    // Remove old entries outside the window
    multi.zRemRangeByScore(key, 0, windowStart)
    
    // Count current entries in window
    multi.zCard(key)
    
    // Add current request with timestamp as score
    multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` })
    
    // Set expiry on the key (window duration + buffer)
    multi.expire(key, Math.ceil(config.windowMs / 1000) + 1)

    const results = await multi.exec()
    
    // Get count from multi results (index 1 is zCard result)
    const count = (results?.[1] as number) || 0
    
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
  if (!redisClient) return
  
  try {
    await redisClient.del(`ratelimit:${identifier}`)
  } catch (error) {
    console.error("Failed to clear rate limit:", error)
  }
}
