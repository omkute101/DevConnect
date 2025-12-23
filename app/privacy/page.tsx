import { SimpleNav } from "@/components/landing/simple-nav"
import { LandingFooter } from "@/components/landing/footer"
import { Lock } from "lucide-react"

export default function PrivacyPage() {
  return (
    <main className="h-full overflow-y-auto bg-background">
      <SimpleNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/10">
              <Lock className="h-8 w-8 text-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Privacy Policy</h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Last updated: January 2025</p>
          </div>

          <div className="mt-16 space-y-8 text-muted-foreground">
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Our Commitment to Privacy</h2>
              <p className="leading-relaxed">
                OmniConnect is built with privacy at its core. We believe developers should be able to connect and
                collaborate without sacrificing their privacy. This policy explains how we handle your information.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">What We Collect</h2>
              <ul className="list-inside list-disc space-y-2">
                <li>Session identifiers for matching (temporary, not stored long-term)</li>
                <li>Selected connection mode preferences</li>
                <li>Voluntarily shared profile information (only when you choose to share)</li>
                <li>Reports submitted about other users</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">What We Do NOT Collect</h2>
              <ul className="list-inside list-disc space-y-2">
                <li>Video or audio recordings - we never record your conversations</li>
                <li>Chat message content - messages are peer-to-peer encrypted</li>
                <li>Personal identification unless voluntarily provided</li>
                <li>Browsing history or activity outside OmniConnect</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Peer-to-Peer Communication</h2>
              <p className="leading-relaxed">
                All video and chat communications on OmniConnect are peer-to-peer using WebRTC technology. This means
                your conversations go directly between you and your conversation partner, without passing through our
                servers. We cannot see, store, or access the content of your conversations.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Anonymous by Default</h2>
              <p className="leading-relaxed">
                You can use OmniConnect completely anonymously. Profile information like your name, GitHub, LinkedIn, or
                other details are entirely optional and only shared when you explicitly choose to share them with a
                conversation partner.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Data Retention</h2>
              <p className="leading-relaxed">
                Session data is temporary and automatically deleted when you leave the platform. Reports are retained
                for moderation purposes but do not include conversation content. We retain minimal data necessary for
                platform operation and safety.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Your Rights</h2>
              <p className="leading-relaxed">You have the right to:</p>
              <ul className="mt-2 list-inside list-disc space-y-2">
                <li>Use the platform anonymously</li>
                <li>Choose what information to share</li>
                <li>Request deletion of any stored data</li>
                <li>Report privacy concerns to our team</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Contact</h2>
              <p className="leading-relaxed">
                For privacy concerns or questions, contact us at{" "}
                <a href="mailto:privacy@omniconnect.dev" className="text-foreground underline">
                  privacy@omniconnect.dev
                </a>
              </p>
            </section>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
