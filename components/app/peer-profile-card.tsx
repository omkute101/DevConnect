"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Github, Linkedin, Globe, X, ExternalLink } from "lucide-react"
import type { DeveloperProfile } from "@/lib/developer-profile"

interface PeerProfileCardProps {
  profile: DeveloperProfile
  onClose: () => void
}

export function PeerProfileCard({ profile, onClose }: PeerProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="absolute bottom-28 left-6 z-40 w-80 rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{profile.displayName || "Anonymous Developer"}</h3>
          {profile.experience && (
            <span className="text-sm capitalize text-muted-foreground">{profile.experience} Developer</span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {profile.currentProject && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Working on</p>
          <p className="mt-1 text-sm">{profile.currentProject}</p>
        </div>
      )}

      {profile.techStack.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Tech Stack</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.techStack.slice(0, 8).map((tech) => (
              <span key={tech} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                {tech}
              </span>
            ))}
            {profile.techStack.length > 8 && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                +{profile.techStack.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {(profile.github || profile.linkedin || profile.website) && (
        <div className="mt-4 flex gap-2">
          {profile.github && (
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-sm transition-colors hover:bg-foreground/20"
            >
              <Github className="h-4 w-4" />
              GitHub
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
          {profile.linkedin && (
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-sm transition-colors hover:bg-foreground/20"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-sm transition-colors hover:bg-foreground/20"
            >
              <Globe className="h-4 w-4" />
              Site
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
        </div>
      )}
    </motion.div>
  )
}
