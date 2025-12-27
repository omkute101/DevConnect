"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function LandingCTA() {
  return (
    <section className="border-t border-border bg-card/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-12 text-center md:p-20"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:2rem_2rem]" />

          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
              Ready to meet your next
              <br />
              collaborator?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
              Join thousands of developers already connecting on Omnars. No signup required to start chatting.
            </p>
            <div className="mt-10">
              <Link href="/app">
                <Button
                  size="lg"
                  className="h-14 gap-2 bg-foreground px-10 text-lg text-background hover:bg-foreground/90"
                >
                  Start Connecting Now
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
