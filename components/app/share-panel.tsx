"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { X, Github, Linkedin, Globe, Send, Check, Eye, EyeOff } from "lucide-react"
import { useProfile } from "@/hooks/use-profile"
import { TECH_STACKS, validateGitHubUrl, validateLinkedInUrl, validateWebsiteUrl } from "@/lib/developer-profile"
import { cn } from "@/lib/utils"

interface SharePanelProps {
  isOpen: boolean
  onClose: () => void
  onShareProfile?: (profile: ReturnType<typeof useProfile>["profile"]) => void
}

export function SharePanel({ isOpen, onClose, onShareProfile }: SharePanelProps) {
  const { profile, updateProfile, toggleTechStack, toggleAnonymous } = useProfile()
  const [shared, setShared] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset errors when panel closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({})
      setShared(false)
    }
  }, [isOpen])

  const validateAndShare = () => {
    const newErrors: Record<string, string> = {}

    if (profile?.github && !validateGitHubUrl(profile.github)) {
      newErrors.github = "Invalid GitHub URL"
    }
    if (profile?.linkedin && !validateLinkedInUrl(profile.linkedin)) {
      newErrors.linkedin = "Invalid LinkedIn URL"
    }
    if (profile?.website && !validateWebsiteUrl(profile.website)) {
      newErrors.website = "Invalid URL"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setShared(true)
    onShareProfile?.(profile)
    setTimeout(() => setShared(false), 2000)
  }

  if (!profile) return null

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

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md overflow-hidden border-l border-border bg-card"
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border p-6">
                <div>
                  <h2 className="text-xl font-semibold">Your Developer Profile</h2>
                  <p className="text-sm text-muted-foreground">Share your info with your current partner</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {/* Anonymous toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-4">
                  <div className="flex items-center gap-3">
                    {profile.isAnonymous ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-foreground" />
                    )}
                    <div>
                      <p className="font-medium">Anonymous Mode</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.isAnonymous ? "Your identity is hidden" : "Your profile is visible"}
                      </p>
                    </div>
                  </div>
                  <Switch checked={profile.isAnonymous} onCheckedChange={toggleAnonymous} />
                </div>

                {/* Display name */}
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name (optional)</Label>
                  <Input
                    id="displayName"
                    value={profile.displayName || ""}
                    onChange={(e) => updateProfile({ displayName: e.target.value })}
                    placeholder="How should we call you?"
                    className="bg-secondary"
                    disabled={profile.isAnonymous}
                  />
                </div>

                {/* GitHub */}
                <div className="space-y-2">
                  <Label htmlFor="github" className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub Profile
                  </Label>
                  <Input
                    id="github"
                    value={profile.github || ""}
                    onChange={(e) => {
                      updateProfile({ github: e.target.value })
                      if (errors.github) setErrors((prev) => ({ ...prev, github: "" }))
                    }}
                    placeholder="https://github.com/username"
                    className={cn("bg-secondary", errors.github && "border-destructive")}
                    disabled={profile.isAnonymous}
                  />
                  {errors.github && <p className="text-xs text-destructive">{errors.github}</p>}
                </div>

                {/* LinkedIn */}
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn Profile
                  </Label>
                  <Input
                    id="linkedin"
                    value={profile.linkedin || ""}
                    onChange={(e) => {
                      updateProfile({ linkedin: e.target.value })
                      if (errors.linkedin) setErrors((prev) => ({ ...prev, linkedin: "" }))
                    }}
                    placeholder="https://linkedin.com/in/username"
                    className={cn("bg-secondary", errors.linkedin && "border-destructive")}
                    disabled={profile.isAnonymous}
                  />
                  {errors.linkedin && <p className="text-xs text-destructive">{errors.linkedin}</p>}
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website / Portfolio
                  </Label>
                  <Input
                    id="website"
                    value={profile.website || ""}
                    onChange={(e) => {
                      updateProfile({ website: e.target.value })
                      if (errors.website) setErrors((prev) => ({ ...prev, website: "" }))
                    }}
                    placeholder="https://yoursite.com"
                    className={cn("bg-secondary", errors.website && "border-destructive")}
                    disabled={profile.isAnonymous}
                  />
                  {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                </div>

                {/* Current Project */}
                <div className="space-y-2">
                  <Label htmlFor="currentProject">What are you working on?</Label>
                  <Textarea
                    id="currentProject"
                    value={profile.currentProject || ""}
                    onChange={(e) => updateProfile({ currentProject: e.target.value })}
                    placeholder="Building a developer platform..."
                    className="min-h-[80px] resize-none bg-secondary"
                    disabled={profile.isAnonymous}
                  />
                </div>

                {/* Tech Stack */}
                <div className="space-y-3">
                  <Label>Tech Stack</Label>
                  <div className="flex flex-wrap gap-2">
                    {TECH_STACKS.map((tech) => {
                      const isSelected = profile.techStack.includes(tech.name)
                      return (
                        <button
                          key={tech.name}
                          onClick={() => toggleTechStack(tech.name)}
                          disabled={profile.isAnonymous}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-all",
                            isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-card text-foreground hover:bg-secondary",
                            profile.isAnonymous && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {tech.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Experience Level */}
                <div className="space-y-3">
                  <Label>Experience Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["junior", "mid", "senior", "lead"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => updateProfile({ experience: level })}
                        disabled={profile.isAnonymous}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-all",
                          profile.experience === level
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card hover:bg-secondary",
                          profile.isAnonymous && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privacy notice */}
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Your profile is only shared when you click "Share". Information is only visible to your current
                    conversation partner and is not stored.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border p-6">
                <Button
                  onClick={validateAndShare}
                  className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
                  disabled={shared || profile.isAnonymous}
                >
                  {shared ? (
                    <>
                      <Check className="h-4 w-4" />
                      Shared with Partner!
                    </>
                  ) : profile.isAnonymous ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Anonymous Mode Active
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Share with Partner
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
