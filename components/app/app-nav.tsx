"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { motion } from "framer-motion"

interface AppNavProps {
  onLeave: () => void
  isConnected: boolean
}

export function AppNav({ onLeave, isConnected }: AppNavProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="shrink-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <span className="text-sm font-bold text-background">OC</span>
          </div>
          <span className="text-lg font-bold tracking-tight">OmniConnect</span>
        </Link>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="mr-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Connected</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Exit
          </Button>
        </div>
      </div>
    </motion.nav>
  )
}
