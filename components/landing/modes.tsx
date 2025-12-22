"use client"

import { motion } from "framer-motion"
import { MessageCircle, Rocket, Users, Briefcase, Code } from "lucide-react"

const modes = [
  {
    icon: MessageCircle,
    title: "Casual Dev Talk",
    description: "Just want to chat about tech, life, or the latest frameworks? Find a like-minded developer.",
    color: "bg-foreground/10",
  },
  {
    icon: Rocket,
    title: "Startup Pitch",
    description: "Have an idea? Pitch it to other developers and get instant feedback on your concept.",
    color: "bg-foreground/10",
  },
  {
    icon: Users,
    title: "Find Collaborators",
    description: "Looking for a co-founder or team members? Connect with developers ready to build.",
    color: "bg-foreground/10",
  },
  {
    icon: Briefcase,
    title: "Hiring / Freelance",
    description: "Whether you're hiring or looking for work, find the right opportunity or talent.",
    color: "bg-foreground/10",
  },
  {
    icon: Code,
    title: "Code Review",
    description: "Need a second pair of eyes? Get real-time code reviews and debugging help.",
    color: "bg-foreground/10",
  },
]

export function LandingModes() {
  return (
    <section id="modes" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Choose your intent</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Select what you are looking for and get matched with developers who share your goals.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {modes.map((mode, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-foreground/30 hover:bg-accent"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${mode.color}`}>
                <mode.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="mb-2 font-semibold">{mode.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{mode.description}</p>

              {/* Hover glow effect */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
