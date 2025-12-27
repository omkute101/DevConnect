import { SimpleNav } from "@/components/landing/simple-nav"
import { LandingFooter } from "@/components/landing/footer"
import { Shield, AlertTriangle, Heart, Code2, Ban, MessageSquare, Gavel, UserCheck } from "lucide-react"

const rules = [
  {
    icon: Code2,
    title: "Professional Developer Conduct",
    description:
      "OmniConnect is a professional network. Approach every conversation as if you are at a tech conference or a co-working space. Keep discussions focused on technology, coding, careers, and mutual growth.",
  },
  {
    icon: Heart,
    title: "Mutual Respect",
    description:
      "treat your peers with dignity. Harassment, hate speech, discrimination (on any basis), or bullying will trigger an immediate permanent ban.",
  },
  {
    icon: Shield,
    title: "Safety & Consent",
    description:
      "Do not obtain or distribute personal information (doxxing) without consent. Do not record calls without permission. Respect boundaries.",
  },
  {
    icon: Ban,
    title: "Zero Tolerance for Abuse",
    description:
      "Absolute prohibition on nudity, sexual content, violence, illegal acts, or promoting self-harm. We report illegal content to relevant authorities.",
  },
  {
    icon: MessageSquare,
    title: "No Spam or Scams",
    description:
      "No unauthorized advertising, multi-level marketing, phishing, or scamming. Do not use the platform to solicit money or financial credentials.",
  },
  {
    icon: UserCheck,
    title: "Accountability",
    description:
      "You are responsible for your actions. OmniConnect does not monitor chats in real-time; we rely on community reports to maintain safety.",
  },
]

const enforcementSteps = [
  {
    title: "Report-Based Moderation",
    description: "We do not actively spy on calls. We act on reports filed by users. Your report is our primary signal for abuse."
  },
  {
    title: "Immediate Action",
    description: "Severe violations (nudity, hate speech, threats) result in an instant, permanent ban across all identifiers."
  },
  {
    title: "Final Decisions",
    description: "Moderation decisions are final. To protect our community, we do not debate bans or offer appeals for severe infractions."
  }
]

export default function RulesPage() {
  return (
    <main className="h-full overflow-y-auto bg-background">
      <SimpleNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Community Guidelines</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              OmniConnect is a dedicated space for developers. Adhering to these standards ensures a valuable experience for everyone.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {rules.map((rule, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <rule.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{rule.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
              <Gavel className="h-5 w-5 text-primary" />
              Enforcement & Consequences
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {enforcementSteps.map((step, i) => (
                <div key={i} className="space-y-2">
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-destructive/30 bg-destructive/5 p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
              <div>
                <h2 className="mb-2 text-lg font-semibold text-destructive">User Responsibility</h2>
                <p className="text-sm text-muted-foreground">
                  By using OmniConnect, you acknowledge that you connect with other users at your own risk. 
                  OmniConnect is a facilitator, not a supervisor. We are not responsible for the conduct of any user 
                  but will remove bad actors when they are reported.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              Help us keep the code compiling and the conversations flowing.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Report violations directly in the chat interface.
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
