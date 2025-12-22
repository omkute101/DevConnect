// Anonymous session initialization endpoint
// Creates a new anonymous session and returns a JWT token

import { NextResponse } from "next/server"
import { createSession, createSessionToken } from "@/lib/session"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter"

export async function POST(request: Request) {
  try {
    // Get client identifier for rate limiting
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0] ?? "unknown"

    // Check rate limit
    const rateLimit = checkRateLimit(`session-init:${ip}`, RATE_LIMITS.sessionInit)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetIn.toString(),
          },
        },
      )
    }

    const session = await createSession()

    // Generate JWT token
    const token = createSessionToken(session.sessionId)

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      token,
      expiresIn: 86400, // 24 hours
    })
  } catch (error) {
    console.error("Session init error:", error)
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 })
  }
}
