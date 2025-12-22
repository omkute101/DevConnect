"use client"

import { useState, useCallback, useEffect } from "react"
import type { DeveloperProfile } from "@/lib/developer-profile"
import { createEmptyProfile } from "@/lib/developer-profile"

const STORAGE_KEY = "omniconnect-profile"

export function useProfile() {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load profile from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setProfile(JSON.parse(stored))
      } catch {
        // Invalid stored data, create new profile
        const userId = sessionStorage.getItem("omniconnect-user-id") || `user-${Date.now()}`
        setProfile(createEmptyProfile(userId))
      }
    } else {
      const userId = sessionStorage.getItem("omniconnect-user-id") || `user-${Date.now()}`
      setProfile(createEmptyProfile(userId))
    }
    setIsLoading(false)
  }, [])

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (profile && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    }
  }, [profile])

  const updateProfile = useCallback((updates: Partial<DeveloperProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, ...updates }
    })
  }, [])

  const toggleTechStack = useCallback((tech: string) => {
    setProfile((prev) => {
      if (!prev) return prev
      const techStack = prev.techStack.includes(tech)
        ? prev.techStack.filter((t) => t !== tech)
        : [...prev.techStack, tech]
      return { ...prev, techStack }
    })
  }, [])

  const toggleAnonymous = useCallback(() => {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, isAnonymous: !prev.isAnonymous }
    })
  }, [])

  const clearProfile = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
      const userId = sessionStorage.getItem("omniconnect-user-id") || `user-${Date.now()}`
      setProfile(createEmptyProfile(userId))
    }
  }, [])

  return {
    profile,
    isLoading,
    updateProfile,
    toggleTechStack,
    toggleAnonymous,
    clearProfile,
  }
}
