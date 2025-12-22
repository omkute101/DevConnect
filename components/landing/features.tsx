"use client"

import { motion } from "framer-motion"
import { Video, MessageSquare, Shield, Zap, Globe, Code } from "lucide-react"

const features = [
  {
    icon: Video,
    title: "Real-time Video",
    description: "Crystal clear WebRTC-powered video calls with low latency connections worldwide.",
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    description: "Text chat alongside video. Share code snippets, links, and ideas in real-time.",
  },
  {
    icon: Zap,
    title: "Instant Matching",
    description: "Get connected with a random developer in seconds. Skip to find your perfect match.",
  },
  {
    icon: Globe,
    title: "Global Network",
    description: "Connect with developers from every timezone. Build your worldwide network.",
  },
  {
    icon: Code,
    title: "Developer First",
    description: "Share GitHub profiles, tech stacks, and projects. Built for the builder community.",
  },
  {
    icon: Shield,
    title: "Privacy Focused",
    description: "No recordings. Anonymous by default. Your conversations stay private.",
  },
]

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-border bg-card/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Built for builders</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Every feature designed with developers in mind. No fluff, just the tools you need to connect.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:bg-card/80"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <feature.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
