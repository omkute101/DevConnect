"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Video, MessageSquare, Users } from "lucide-react"

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Gradient orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-foreground/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-4xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
          >
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-muted-foreground">1,247 developers online now</span>
          </motion.div>

          <h1 className="text-balance text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
            Meet developers.
            <br />
            <span className="text-muted-foreground">Instantly.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Real-time video connections with developers worldwide. Pitch ideas, find collaborators, get code reviews, or
            just have a casual dev talk.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/app">
              <Button size="lg" className="h-12 gap-2 bg-foreground px-8 text-background hover:bg-foreground/90">
                Start Connecting
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="h-12 px-8 bg-transparent">
                How It Works
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            { icon: Video, stat: "50K+", label: "Video calls daily" },
            { icon: Users, stat: "120K+", label: "Active developers" },
            { icon: MessageSquare, stat: "2M+", label: "Connections made" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{item.stat}</span>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
