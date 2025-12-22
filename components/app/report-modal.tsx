"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X, AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSignalingService } from "@/lib/signaling-service"

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  peerId: string
  roomId: string
  onAutoDisconnect?: () => void
}

const REPORT_REASONS = [
  { id: "harassment", label: "Harassment or abuse" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "spam", label: "Spam or scam" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Other" },
]

export function ReportModal({ isOpen, onClose, peerId, roomId, onAutoDisconnect }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [details, setDetails] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!selectedReason) return

    setIsSubmitting(true)
    setError(null)

    try {
      const signalingService = getSignalingService()
      const sessionId = signalingService.getCurrentSessionId()

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reporterId: sessionId,
          reportedSessionId: peerId,
          roomId,
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit report")
      }

      setIsSubmitted(true)

      // Check if the reported user should be auto-disconnected
      if (result.shouldAutoDisconnect && onAutoDisconnect) {
        setTimeout(() => {
          onAutoDisconnect()
        }, 1500)
      }

      // Close after showing success
      setTimeout(() => {
        onClose()
        // Reset state after closing
        setTimeout(() => {
          setSelectedReason(null)
          setDetails("")
          setIsSubmitted(false)
        }, 300)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            {isSubmitted ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Report Submitted</h3>
                <p className="mt-2 text-sm text-muted-foreground">Thank you for helping keep our community safe.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Report User</h3>
                      <p className="text-sm text-muted-foreground">Help us keep OmniConnect safe</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {error && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Why are you reporting this user?</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {REPORT_REASONS.map((reason) => (
                        <button
                          key={reason.id}
                          onClick={() => setSelectedReason(reason.id)}
                          className={cn(
                            "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                            selectedReason === reason.id
                              ? "border-foreground bg-foreground/10"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          {reason.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="details">Additional details (optional)</Label>
                    <Textarea
                      id="details"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Provide any additional context..."
                      className="min-h-[80px] resize-none bg-secondary"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedReason || isSubmitting}
                    className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
