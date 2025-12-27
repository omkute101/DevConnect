import { Redis } from "@upstash/redis"

// Validate environment variables at startup
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.warn("Redis environment variables not set. Redis operations will fail.")
}

// For serverless environments, we use a single Redis instance with REST API
export const redis = new Redis({
  url: process.env.KV_REST_API_URL || "",
  token: process.env.KV_REST_API_TOKEN || "",
})

// Pub/sub in serverless is handled via polling or external services
// Export the same instance for compatibility
export const redisPublisher = redis
export const redisSubscriber = redis

/**
 * Wrapper for Redis operations with error handling
 * Returns null on error instead of throwing
 */
export async function safeRedisGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key)
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error)
    return null
  }
}

/**
 * Wrapper for Redis SET with error handling
 * Returns true on success, false on failure
 */
export async function safeRedisSet(
  key: string,
  value: string | number | object,
  exSeconds?: number
): Promise<boolean> {
  try {
    if (exSeconds) {
      await redis.set(key, value, { ex: exSeconds })
    } else {
      await redis.set(key, value)
    }
    return true
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error)
    return false
  }
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch (error) {
    console.error("Redis health check failed:", error)
    return false
  }
}
