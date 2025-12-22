import { LandingNav } from "@/components/landing/nav"
import { LandingFooter } from "@/components/landing/footer"
import { FileText } from "lucide-react"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/10">
              <FileText className="h-8 w-8 text-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Terms of Service</h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Last updated: January 2025</p>
          </div>

          <div className="mt-16 space-y-8 text-muted-foreground">
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By accessing or using OmniConnect, you agree to be bound by these Terms of Service. If you do not agree
                to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Eligibility</h2>
              <p className="leading-relaxed">
                You must be at least 18 years old to use OmniConnect. By using this service, you represent and warrant
                that you meet this age requirement.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">User Conduct</h2>
              <p className="leading-relaxed">When using OmniConnect, you agree to:</p>
              <ul className="mt-2 list-inside list-disc space-y-2">
                <li>Follow our Community Guidelines</li>
                <li>Treat other users with respect</li>
                <li>Not engage in harassment, hate speech, or discrimination</li>
                <li>Not share inappropriate or illegal content</li>
                <li>Not attempt to harm or exploit other users</li>
                <li>Not use automated systems or bots</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Content Responsibility</h2>
              <p className="leading-relaxed">
                You are solely responsible for all content you share through OmniConnect. We do not monitor or control
                peer-to-peer communications, but we may take action based on user reports.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Account Termination</h2>
              <p className="leading-relaxed">
                We reserve the right to suspend or terminate access to OmniConnect for users who violate these terms or
                our Community Guidelines, without prior notice.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Disclaimer of Warranties</h2>
              <p className="leading-relaxed">
                OmniConnect is provided "as is" without warranties of any kind. We do not guarantee uninterrupted
                service, and we are not responsible for the conduct of other users.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Limitation of Liability</h2>
              <p className="leading-relaxed">
                OmniConnect and its operators shall not be liable for any indirect, incidental, special, or
                consequential damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Changes to Terms</h2>
              <p className="leading-relaxed">
                We may modify these terms at any time. Continued use of OmniConnect after changes constitutes acceptance
                of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">Contact</h2>
              <p className="leading-relaxed">
                For questions about these terms, contact us at{" "}
                <a href="mailto:legal@omniconnect.dev" className="text-foreground underline">
                  legal@omniconnect.dev
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
