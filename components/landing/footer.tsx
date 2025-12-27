import Link from "next/link"

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">OmniConnect</span>
          </div>

          <div className="flex items-center gap-8">
            <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/rules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Rules
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
