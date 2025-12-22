"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, Rocket, Users, Briefcase, Code, Video, MessageSquare } from "lucide-react"
import type { AppMode, ConnectionType } from "@/app/app/page"

const modes = [
  {
    id: "casual" as AppMode,
    icon: MessageCircle,
    title: "Casual Dev Talk",
    description: "Chat about tech, life, or the latest frameworks",
  },
  {
    id: "pitch" as AppMode,
    icon: Rocket,
    title: "Startup Pitch",
    description: "Share your ideas and get instant feedback",
  },
  {
    id: "collab" as AppMode,
    icon: Users,
    title: "Find Collaborators",
    description: "Connect with developers ready to build",
  },
  {
    id: "hiring" as AppMode,
    icon: Briefcase,
    title: "Hiring / Freelance",
    description: "Find opportunities or talent",
  },
  {
    id: "review" as AppMode,
    icon: Code,
    title: "Code Review",
    description: "Get real-time code reviews and help",
  },
]

interface ModeSelectionProps {
  onSelect: (mode: AppMode, type: ConnectionType) => void
}

export function ModeSelection({ onSelect }: ModeSelectionProps) {
  const [step, setStep] = useState<"type" | "mode">("type")
  const [selectedType, setSelectedType] = useState<ConnectionType | null>(null)

  const handleTypeSelect = (type: ConnectionType) => {
    setSelectedType(type)
    setStep("mode")
  }

  const handleModeSelect = (mode: AppMode) => {
    if (selectedType) {
      onSelect(mode, selectedType)
    }
  }

  return (
    <div className="flex bg-background h-full flex-col items-center justify-center px-4 py-6 md:px-6">
      <AnimatePresence mode="wait">
        {step === "type" ? (
          <motion.div
            key="type-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl"
          >
             <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">How do you want to connect?</h1>
              <p className="mt-2 text-muted-foreground">Choose your preferred communication style</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => handleTypeSelect("chat")}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-foreground/20">
                  <MessageSquare className="h-8 w-8 text-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Chat Only</h3>
                <p className="text-sm text-muted-foreground">Text-based communication for quick exchanges</p>
              </button>

              <button
                onClick={() => handleTypeSelect("video")}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-foreground/20">
                  <Video className="h-8 w-8 text-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Video + Chat</h3>
                <p className="text-sm text-muted-foreground">Face-to-face conversations for deeper connection</p>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="mode-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl"
          >
            <div className="mb-8 text-center">
              <button 
                onClick={() => setStep("type")}
                className="mb-4 text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Let's select an intent
              </button>
              <h1 className="text-2xl font-bold tracking-tight md:text-4xl">What brings you here today?</h1>
              <p className="mt-2 text-muted-foreground">Select your intent to get matched with like-minded developers</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((mode, i) => (
                <motion.button
                  key={mode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  onClick={() => handleModeSelect(mode.id)}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 text-left transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-foreground/20">
                    <mode.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold">{mode.title}</h3>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                  
                  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
