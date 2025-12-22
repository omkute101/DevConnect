// API route for handling user reports with rate limiting and session validation

import { NextResponse } from "next/server"
import { verifySessionToken, incrementReportCount } from "@/lib/session"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter"

export const runtime = "nodejs"

// In-memory storage for reports (use database in production)
const reports: Array<{
  id: string
  reporterSessionId: string
  reportedSessionId: string
  roomId: string
  reason: string
  details?: string
  timestamp: number
  status: "pending" | "reviewed" | "resolved"
}> = []

// Track reported sessions for auto-disconnect
const reportedSessions = new Map<string, number>()
const AUTO_DISCONNECT_THRESHOLD = 3

function getSessionFromRequest(request: Request): { sessionId: string } | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7)
  const payload = verifySessionToken(token)
  if (!payload) return null

  return { sessionId: payload.sessionId }
}

export async function POST(request: Request) {
  try {
    const tokenSession = getSessionFromRequest(request)
    const body = await request.json()
    const { reportedSessionId, roomId, reason, details } = body

    const reporterSessionId = tokenSession?.sessionId || body.reporterId

    if (!reporterSessionId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const rateLimit = checkRateLimit(`report:${reporterSessionId}`, RATE_LIMITS.report)
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

    const report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      reporterSessionId,
      reportedSessionId,
      roomId: roomId || "unknown",
      reason,
      details,
      timestamp: Date.now(),
      status: "pending" as const,
    }

    reports.push(report)

    const reportCount = incrementReportCount(reportedSessionId)

    // Track for auto-disconnect
    const currentCount = (reportedSessions.get(reportedSessionId) || 0) + 1
    reportedSessions.set(reportedSessionId, currentCount)

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
  const url = new URL(request.url)
  const status = url.searchParams.get("status")

  let filteredReports = reports
  if (status) {
    filteredReports = reports.filter((r) => r.status === status)
  }

  return NextResponse.json({
    reports: filteredReports.slice(-100), // Return last 100 reports
    total: filteredReports.length,
  })
}
