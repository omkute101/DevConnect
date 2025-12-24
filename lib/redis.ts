import { Redis } from "@upstash/redis"

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  throw new Error("REDIS_URL is not defined")
}

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export const redisPublisher = new Redis(getRedisUrl())
redisPublisher.on("error", (err) => console.error("Redis Publisher Error:", err))

export const redisSubscriber = new Redis(getRedisUrl())
redisSubscriber.on("error", (err) => console.error("Redis Subscriber Error:", err))
