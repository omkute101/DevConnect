"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AlertTriangle, X } from "lucide-react"

interface AutoDisconnectWarningProps {
  isVisible: boolean
  reason: string
  onStay: () => void
  onLeave: () => void
}

export function AutoDisconnectWarning({ isVisible, reason, onStay, onLeave }: AutoDisconnectWarningProps) {
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!isVisible) {
      setCountdown(10)
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onLeave()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isVisible, onLeave])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-20 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-2xl border border-destructive/30 bg-background p-6 shadow-xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Connection Issue Detected</h3>
              <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
              <p className="mt-2 text-sm">
                Auto-disconnecting in <span className="font-bold text-destructive">{countdown}s</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onStay} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={onStay} className="flex-1 bg-transparent">
              Stay Connected
            </Button>
            <Button onClick={onLeave} className="flex-1 bg-destructive text-destructive-foreground">
              Leave Now
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
