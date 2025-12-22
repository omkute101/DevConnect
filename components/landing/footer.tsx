import Link from "next/link"

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <span className="text-sm font-bold text-background">OC</span>
            </div>
            <span className="text-lg font-semibold">OmniConnect</span>
          </div>

          <div className="flex items-center gap-8">
            <Link href="/rules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Community Rules
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Terms
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">Built for builders.</p>
        </div>
      </div>
    </footer>
  )
}
