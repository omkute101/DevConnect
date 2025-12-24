import { Redis } from "@upstash/redis"

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  throw new Error("REDIS_URL is not defined")
}

// For serverless environments, we use a single Redis instance with REST API
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Pub/sub in serverless is handled via polling or external services
// Export the same instance for compatibility
export const redisPublisher = redis
export const redisSubscriber = redis
