import { SimpleNav } from "@/components/landing/simple-nav"
import { LandingFooter } from "@/components/landing/footer"
import { Shield, AlertTriangle, Heart, Users, Ban, MessageSquare } from "lucide-react"

const rules = [
  {
    icon: Heart,
    title: "Be Respectful",
    description:
      "Treat everyone with respect. No harassment, hate speech, discrimination, or bullying of any kind is tolerated.",
  },
  {
    icon: Shield,
    title: "Keep It Safe",
    description:
      "Do not share personal information like addresses, phone numbers, or financial details. Protect yourself and others.",
  },
  {
    icon: Users,
    title: "Be Professional",
    description:
      "This is a platform for developers. Keep conversations professional and relevant to technology, careers, and collaboration.",
  },
  {
    icon: Ban,
    title: "No Inappropriate Content",
    description:
      "Absolutely no nudity, sexual content, violence, or illegal activities. Violations result in immediate permanent bans.",
  },
  {
    icon: MessageSquare,
    title: "Honest Communication",
    description:
      "Be genuine. No impersonation, scams, or misleading information about yourself, your skills, or your intentions.",
  },
  {
    icon: AlertTriangle,
    title: "Report Violations",
    description:
      "If you encounter anyone violating these rules, use the report button. Help us maintain a safe community for everyone.",
  },
]

const violations = [
  "First offense: Warning and temporary suspension",
  "Second offense: Extended suspension (7 days)",
  "Third offense: Permanent ban from the platform",
  "Severe violations: Immediate permanent ban",
]

export default function RulesPage() {
  return (
    <main className="h-full overflow-y-auto bg-background">
      <SimpleNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/10">
              <Shield className="h-8 w-8 text-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Community Guidelines</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              OmniConnect is a safe space for developers to connect, collaborate, and grow. These rules help maintain a
              positive environment for everyone.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {rules.map((rule, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <rule.icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{rule.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8">
            <h2 className="mb-4 text-xl font-semibold">Violation Consequences</h2>
            <p className="mb-6 text-muted-foreground">
              We take violations seriously. Depending on the severity and frequency, consequences may include:
            </p>
            <ul className="space-y-3">
              {violations.map((violation, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{violation}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16 rounded-2xl border border-destructive/30 bg-destructive/5 p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
              <div>
                <h2 className="mb-2 text-lg font-semibold">Zero Tolerance Policy</h2>
                <p className="text-sm text-muted-foreground">
                  We have zero tolerance for harassment, hate speech, or any form of abuse. Such behavior will result in
                  immediate and permanent removal from the platform without warning. We are committed to maintaining a
                  safe space for all developers.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              By using OmniConnect, you agree to abide by these community guidelines.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions or concerns? Contact us at{" "}
              <a href="mailto:support@omniconnect.dev" className="text-foreground underline">
                support@omniconnect.dev
              </a>
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
