"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { WifiOff, SignalLow, SignalMedium, SignalHigh } from "lucide-react"

interface ConnectionQualityProps {
  connectionState: "connecting" | "connected" | "disconnected" | "failed"
}

export function ConnectionQuality({ connectionState }: ConnectionQualityProps) {
  const [quality, setQuality] = useState<"excellent" | "good" | "poor" | "offline">("good")

  // Simulate connection quality monitoring
  useEffect(() => {
    if (connectionState !== "connected") {
      setQuality("offline")
      return
    }

    // Simulate random quality changes for demo
    const interval = setInterval(() => {
      const rand = Math.random()
      if (rand > 0.8) setQuality("excellent")
      else if (rand > 0.3) setQuality("good")
      else setQuality("poor")
    }, 5000)

    setQuality("good")

    return () => clearInterval(interval)
  }, [connectionState])

  const getIcon = () => {
    switch (quality) {
      case "excellent":
        return <SignalHigh className="h-4 w-4 text-green-500" />
      case "good":
        return <SignalMedium className="h-4 w-4 text-green-500" />
      case "poor":
        return <SignalLow className="h-4 w-4 text-yellow-500" />
      case "offline":
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getLabel = () => {
    switch (quality) {
      case "excellent":
        return "Excellent"
      case "good":
        return "Good"
      case "poor":
        return "Weak"
      case "offline":
        return "Offline"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-lg"
    >
      {getIcon()}
      <span className="text-xs font-medium text-muted-foreground">{getLabel()}</span>
    </motion.div>
  )
}
