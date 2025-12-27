import { SimpleNav } from "@/components/landing/simple-nav"
import { LandingFooter } from "@/components/landing/footer"
import { Lock, Shield, EyeOff, ServerOff, UserX } from "lucide-react"

export default function PrivacyPage() {
  return (
    <main className="h-full overflow-y-auto bg-background">
      <SimpleNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Privacy Policy</h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Last Updated: December 2025
            </p>
          </div>

          <div className="mt-16 space-y-12">
            {/* Core Promise */}
            <div className="rounded-2xl border bg-card p-8">
              <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                The Core Promise
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                OmniConnect is designed as a raw, peer-to-peer connection utility. We facilitate the handshake; we do not participate in the conversation.
                <br /><br />
                <strong>We do not record, store, or monitor your audio, video, or chat messages.</strong> Once a session ends, the connection is severed, and no record of the conversation remains on our servers.
              </p>
            </div>

            {/* 1. Architecture */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">1. How OmniConnect Works (The Technical Reality)</h2>
              <p className="text-muted-foreground leading-relaxed">
                To understand our privacy policy, you must understand our architecture:
              </p>
              <ul className="grid gap-4 md:grid-cols-2">
                <li className="rounded-xl border bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <ServerOff className="h-4 w-4" />
                    Peer-to-Peer
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Video and chat data flows directly between you and your partner using WebRTC. It does not pass through a central recording server.
                  </p>
                </li>
                <li className="rounded-xl border bg-card/50 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <UserX className="h-4 w-4" />
                    Anonymous Signaling
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Our servers only see temporary "handshake" signals to help you find a partner. Once connected, we step out of the loop.
                  </p>
                </li>
              </ul>
            </section>

            {/* 2. Data Collection */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">2. Data We Do & Do Not Collect</h2>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold text-green-500">What We Temporarily Use</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                    <li><strong>Ephemeral Session IDs:</strong> Random strings to route connections. Deleted upon disconnection.</li>
                    <li><strong>Connection Intents:</strong> Your choice of "Video" or "Chat" to match you correctly.</li>
                    <li><strong>Voluntary Profile Data:</strong> If you choose to share your GitHub/LinkedIn, it is transmitted only to your current specific partner.</li>
                    <li><strong>Abuse Reports:</strong> If you report a user, we store the report metadata (time, reason) to enforce bans.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="mb-3 font-semibold text-red-500">What We Never Store</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                    <li><strong>Message Content:</strong> No chat logs.</li>
                    <li><strong>Audio/Video:</strong> No recordings.</li>
                    <li><strong>IP Addresses (Long-term):</strong> Used only transiently for connection routing, never logged for tracking.</li>
                    <li><strong>Personal Identity:</strong> We don't know who you are.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 3. No Tracking */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <EyeOff className="h-6 w-6" />
                3. Zero Tracking Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We are a developer tool, not an ad network.
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>We do <strong>not</strong> use tracking pixels or cookies for advertising.</li>
                <li>We do <strong>not</strong> build shadow profiles of users.</li>
                <li>We do <strong>not</strong> sell, trade, or share any data with third parties.</li>
                <li>We do <strong>not</strong> use analytics that record screen sessions.</li>
              </ul>
            </section>

             {/* 4. User Responsibility */}
             <section className="space-y-4">
              <h2 className="text-2xl font-bold">4. Your Responsibility & Risks</h2>
              <p className="text-muted-foreground leading-relaxed">
                Because OmniConnect is peer-to-peer and anonymous, <strong>you are solely responsible for what you share.</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>If you voluntarily reveal your identity, we cannot protect that information.</li>
                <li>We cannot retrieve lost conversations.</li>
                <li>We cannot delete data that you have already shared with another user (e.g., if they took a screenshot).</li>
              </ul>
            </section>

            {/* 5. Rights */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">5. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Anonymity:</strong> Use the platform without revealing your identity.</li>
                <li><strong>Exit:</strong> Disconnect at any time, instantly severing the data link.</li>
                <li><strong>Report:</strong> Flag abusive behavior. While we cannot see the violation content, we act on patterns of reports.</li>
              </ul>
            </section>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
