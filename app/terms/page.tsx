import { SimpleNav } from "@/components/landing/simple-nav"
import { LandingFooter } from "@/components/landing/footer"
import { FileText, Scale, ShieldAlert, Ban, AlertCircle } from "lucide-react"

export default function TermsPage() {
  return (
    <main className="h-full overflow-y-auto bg-background">
      <SimpleNav />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Terms of Service</h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Last Updated: December 2025
            </p>
          </div>

          <div className="mt-16 space-y-12">
            {/* Intro */}
            <div className="space-y-4">
              <p className="text-lg leading-relaxed text-muted-foreground">
                Welcome to OmniConnect. By accessing our platform, you agree to be bound by these Terms. 
                If you do not agree, you must stop using the service immediately.
              </p>
            </div>

            {/* 1. Service Description */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">1. The Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                OmniConnect provides a peer-to-peer connection utility for developers (the "Service"). 
                We act solely as a detailed technical facilitator to establish WebRTC connections between users. 
                We are not a publisher of user content and we do not knowingly participate in your conversations.
              </p>
            </section>

             {/* 2. Eligibility */}
             <section className="space-y-4">
              <h2 className="text-2xl font-bold">2. Eligibility</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must be a human (no automated bots or scrapers).</li>
                <li>You must not have been previously banned from the Service.</li>
              </ul>
            </section>

            {/* 3. User Conduct */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">3. User Conduct & Responsibility</h2>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
                 <h3 className="flex items-center gap-2 font-semibold text-destructive mb-2">
                    <ShieldAlert className="h-5 w-5" />
                    You Are Responsible
                 </h3>
                 <p className="text-sm text-foreground/80">
                    You agree that you are solely responsible for your interactions with other users. 
                    OmniConnect does not conduct criminal background checks or verify the identity of its users. 
                    You act at your own risk.
                 </p>
              </div>
              <p className="text-muted-foreground">
                You agree not to use the Service for:
              </p>
              <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <li className="flex items-center gap-2"><Ban className="h-4 w-4" /> Illegal acts or promoting illegal acts</li>
                <li className="flex items-center gap-2"><Ban className="h-4 w-4" /> Harassment, hate speech, or abuse</li>
                <li className="flex items-center gap-2"><Ban className="h-4 w-4" /> Commercial solicitation or spam</li>
                <li className="flex items-center gap-2"><Ban className="h-4 w-4" /> Distributing malware or viruses</li>
              </ul>
            </section>

            {/* 4. Disclaimer */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="h-6 w-6" />
                4. "AS IS" Disclaimer
              </h2>
              <p className="text-muted-foreground leading-relaxed uppercase text-sm font-medium">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE". OMNICONNECT DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, 
                INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. 
                WE DO NOT GUARANTEE THAT THE SERVICE WILL BE SAFE, SECURE, OR ERROR-FREE.
              </p>
            </section>

            {/* 5. Limitation of Liability */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">5. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OMNICONNECT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, 
                OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, 
                RESULTING FROM (A) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE.
              </p>
            </section>

            {/* 6. Indemnification */}
             <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Scale className="h-6 w-6" />
                6. Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to defend, indemnify, and hold harmless OmniConnect and its officers, directors, employees, and agents from and against any claims, 
                liabilities, damages, losses, and expenses, including reasonable legal and accounting fees, arising out of or in any way connected with your 
                access to or use of the Service or your violation of these Terms.
              </p>
            </section>

             {/* 7. Termination */}
             <section className="space-y-4">
              <h2 className="text-2xl font-bold">7. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, 
                including without limitation if you breach the Terms.
              </p>
            </section>

             {/* 8. Governing Law */}
             <section className="space-y-4">
              <h2 className="text-2xl font-bold">8. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which OmniConnect operates, 
                without regard to its conflict of law provisions.
              </p>
            </section>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
