"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export default function HomePage() {
  return (
    <main className="h-full bg-background flex flex-col overflow-hidden">
      {/* Minimal Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="shrink-0 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20 z-50"
      >
        <span className="text-foreground font-medium tracking-tight text-lg">OmniConnect</span>
        <Link href="/app">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            Start Connecting
          </motion.button>
        </Link>
      </motion.nav>

      {/* Full-screen Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 lg:px-20 overflow-hidden relative">
        <div className="max-w-4xl mx-auto text-center z-10">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight text-foreground leading-[1.1] text-balance"
          >
            Meet developers.
            <br />
            <span className="text-muted-foreground">Instantly.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 md:mt-10 text-muted-foreground text-base md:text-lg lg:text-xl max-w-xl mx-auto leading-relaxed text-pretty"
          >
            One click. Real conversations. No profiles, no swiping—just you and another developer, face to face.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 md:mt-14"
          >
            <Link href="/app">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 50px rgba(255,255,255,0.2)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="group relative px-10 py-4 text-base md:text-lg font-medium bg-foreground text-background rounded-full overflow-hidden transition-all duration-500"
              >
                <span className="relative z-10">Start Connecting</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Minimal Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="shrink-0 py-6 text-center z-50"
      >
        <span className="text-muted-foreground/50 text-xs tracking-wide">Om Kute</span>
      </motion.footer>
    </main>
  )
}
