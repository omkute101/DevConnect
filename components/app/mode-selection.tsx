"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, Rocket, Users, Code, Video, MessageSquare, UserSearch, Laptop } from "lucide-react"
import type { AppMode, ConnectionType, MediaPermissions } from "@/app/app/page"

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
    id: "hire" as AppMode,
    icon: UserSearch,
    title: "Hire Someone",
    description: "Find talented developers for your project",
  },
  {
    id: "freelance" as AppMode,
    icon: Laptop,
    title: "Freelance",
    description: "Get matched with clients looking to hire",
  },
  {
    id: "review" as AppMode,
    icon: Code,
    title: "Code Review",
    description: "Get real-time code reviews and help",
  },
]

interface ModeSelectionProps {
  onSelect: (mode: AppMode, type: ConnectionType, permissions?: MediaPermissions) => void
}

export function ModeSelection({ onSelect }: ModeSelectionProps) {
  const [step, setStep] = useState<"type" | "mode">("type")
  const [selectedType, setSelectedType] = useState<ConnectionType | null>(null)
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleTypeSelect = async (type: ConnectionType) => {
    if (type === "video") {
      setIsRequestingPermissions(true)
      try {
        // Request permissions before proceeding
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        // Stop tracks immediately - we just wanted to get permission
        stream.getTracks().forEach((track) => track.stop())
        setSelectedType(type)
        setStep("mode")
      } catch (error) {
        // Permission denied or error - still proceed but mark as denied
        console.log("Media permission denied or error:", error)
        setSelectedType(type)
        setStep("mode")
      } finally {
        setIsRequestingPermissions(false)
      }
    } else {
      setSelectedType(type)
      setStep("mode")
    }
  }

  const handleModeSelect = async (mode: AppMode) => {
    if (selectedType && !isConnecting) {
      setIsConnecting(true)
      let permissions: MediaPermissions | undefined

      if (selectedType === "video") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          stream.getTracks().forEach((track) => track.stop())
          permissions = { video: true, audio: true, denied: false }
        } catch {
          permissions = { video: false, audio: false, denied: true }
        }
      }

      onSelect(mode, selectedType, permissions)
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
                disabled={isRequestingPermissions}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-foreground/20">
                  <MessageSquare className="h-8 w-8 text-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Chat Only</h3>
                <p className="text-sm text-muted-foreground">Text-based communication for quick exchanges</p>
              </button>

              <button
                onClick={() => handleTypeSelect("video")}
                disabled={isRequestingPermissions}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {isRequestingPermissions ? (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                  </div>
                ) : (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-foreground/20">
                    <Video className="h-8 w-8 text-foreground" />
                  </div>
                )}
                <h3 className="mb-2 text-lg font-semibold">Video + Chat</h3>
                <p className="text-sm text-muted-foreground">
                  {isRequestingPermissions
                    ? "Requesting camera access..."
                    : "Face-to-face conversations for deeper connection"}
                </p>
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
                ← Back to connection type
              </button>
              <h1 className="text-2xl font-bold tracking-tight md:text-4xl px-2">What brings you here today?</h1>
              <p className="mt-2 text-muted-foreground px-4 text-center break-words max-w-xs mx-auto md:max-w-none">
                Select your intent to get matched with like-minded developers
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((mode, i) => (
                <motion.button
                  key={mode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  onClick={() => handleModeSelect(mode.id)}
                  disabled={isConnecting}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 text-left transition-all hover:border-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none"
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
