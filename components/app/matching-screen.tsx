"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { AppMode } from "@/app/app/page"

const modeLabels: Record<AppMode, string> = {
  casual: "Casual Dev Talk",
  pitch: "Startup Pitch",
  collab: "Finding Collaborators",
  hiring: "Hiring / Freelance",
  review: "Code Review",
}

interface MatchingScreenProps {
  mode: AppMode
  onlineCount: number
  onCancel: () => void
}

export function MatchingScreen({ mode, onlineCount, onCancel }: MatchingScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {/* Animated rings */}
        <div className="relative mx-auto mb-12 h-40 w-40">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-foreground/20"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: [0.5, 1.5],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.6,
                ease: "easeOut",
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-foreground/10 backdrop-blur-sm">
              <div className="flex h-full w-full items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="h-8 w-8 rounded-full border-2 border-foreground border-t-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Looking for a match...</h2>
        <p className="mt-3 text-muted-foreground">
          Mode: <span className="text-foreground">{modeLabels[mode]}</span>
        </p>



        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-10"
        >
          <Button 
            onClick={onCancel} 
            className="gap-2 bg-red-500 text-black hover:bg-red-600 hover:text-black cursor-pointer border-none"
          >
            <X className="h-4 w-4 text-black" />
            Cancel
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
