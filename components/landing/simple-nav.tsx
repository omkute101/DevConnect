"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export function SimpleNav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20 z-50 fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md"
    >
      <Link href="/" className="text-foreground font-bold tracking-tight text-lg hover:opacity-80 transition-opacity">
        Omnars
      </Link>
      <Link href="/app">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-full transition-all duration-300 hover:opacity-90 cursor-pointer"
        >
          Start Connecting
        </motion.button>
      </Link>
    </motion.nav>
  )
}
