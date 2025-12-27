// API route for handling user reports with rate limiting and session validation
// Now uses Redis for storage to enable horizontal scaling

import { NextResponse } from "next/server"
import { verifySessionToken, incrementReportCount } from "@/lib/session"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter"
import { redis } from "@/lib/redis"

export const runtime = "nodejs"

// Redis key helpers
const keys = {
  reports: () => "reports:list",
  reportedSession: (sessionId: string) => `reported:${sessionId}`,
  reportById: (id: string) => `report:${id}`,
}

const AUTO_DISCONNECT_THRESHOLD = 3
const REPORT_TTL = 7 * 24 * 60 * 60 // 7 days

interface Report {
  id: string
  reporterSessionId: string
  reportedSessionId: string
  roomId: string
  reason: string
  details?: string
  timestamp: number
  status: "pending" | "reviewed" | "resolved"
}

async function getSessionFromRequest(request: Request): Promise<{ sessionId: string } | null> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7)
  const payload = await verifySessionToken(token)
  if (!payload || !payload.sessionId) return null

  return { sessionId: payload.sessionId }
}

export async function POST(request: Request) {
  try {
    const tokenSession = await getSessionFromRequest(request)
    const body = await request.json()
    const { reportedSessionId, roomId, reason, details } = body

    const reporterSessionId = tokenSession?.sessionId || body.reporterId

    if (!reporterSessionId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`report:${reporterSessionId}`, RATE_LIMITS.report)
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Too many reports. Please try again later." }, { status: 429 })
    }

    if (!reportedSessionId || !reason) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Prevent self-reporting
    if (reporterSessionId === reportedSessionId) {
      return NextResponse.json({ success: false, error: "Cannot report yourself" }, { status: 400 })
    }

    const report: Report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      reporterSessionId,
      reportedSessionId,
      roomId: roomId || "unknown",
      reason,
      details,
      timestamp: Date.now(),
      status: "pending",
    }

    // Store report in Redis
    await redis.rpush(keys.reports(), JSON.stringify(report))
    await redis.set(keys.reportById(report.id), JSON.stringify(report), { ex: REPORT_TTL })

    // Increment report count in session (Redis-backed)
    await incrementReportCount(reportedSessionId)

    // Track for auto-disconnect using Redis atomic increment
    const currentCount = await redis.incr(keys.reportedSession(reportedSessionId))
    
    // Set expiry on first report (24 hours for tracking)
    if (currentCount === 1) {
      await redis.expire(keys.reportedSession(reportedSessionId), 24 * 60 * 60)
    }

    const shouldAutoDisconnect = currentCount >= AUTO_DISCONNECT_THRESHOLD

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: "Report submitted successfully. Thank you for helping keep our community safe.",
      shouldAutoDisconnect,
    })
  } catch (error) {
    console.error("Report error:", error)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get("status")

    // Get last 100 reports from Redis
    const reportStrings = await redis.lrange(keys.reports(), -100, -1)
    let reports: Report[] = reportStrings.map((s) => JSON.parse(s as string))

    if (status) {
      reports = reports.filter((r) => r.status === status)
    }

    return NextResponse.json({
      reports,
      total: reports.length,
    })
  } catch (error) {
    console.error("Get reports error:", error)
    return NextResponse.json({
      reports: [],
      total: 0,
    })
  }
}
