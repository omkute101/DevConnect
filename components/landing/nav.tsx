"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function LandingNav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <span className="text-sm font-bold text-background">OC</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">OmniConnect</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#modes" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Modes
          </Link>
          <Link href="/rules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Community Rules
          </Link>
        </div>

        <Link href="/app">
          <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
            Start Connecting
          </Button>
        </Link>
      </div>
    </motion.nav>
  )
}
