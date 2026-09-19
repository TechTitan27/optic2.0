import React, { useState } from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { Button } from '../common/Button';
import { OpticFooter } from '../common/OpticFooter';
import { SurfaceType } from '../../types';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface TermsPageProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigateSurface }) => {
  const [activeSection, setActiveSection] = useState('acceptance');

  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms' },
    { id: 'services', title: '2. Optic Services & Scope' },
    { id: 'accounts', title: '3. Accounts & API Key Security' },
    { id: 'acceptable-use', title: '4. Acceptable Use Policy' },
    { id: 'intellectual-property', title: '5. Intellectual Property & Ownership' },
    { id: 'quotas', title: '6. Resource Quotas & Fair Use' },
    { id: 'billing', title: '7. Fees, Tiers & Upgrades' },
    { id: 'availability', title: '8. Service Levels & Availability' },
    { id: 'disclaimer', title: '9. Warranties & Disclaimers' },
    { id: 'liability', title: '10. Limitation of Liability' },
    { id: 'termination', title: '11. Termination & Suspension' },
    { id: 'governing-law', title: '12. Governing Law & Dispute Resolution' },
  ];

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigateSurface('main', '/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Home</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <OpticLogo size={20} showWordmark={true} />
            <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
              / Legal / Terms of Service
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigateSurface('privacy', '/privacy')}
            className="text-xs text-zinc-400"
          >
            Privacy Policy
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateSurface('dashboard', '/dashboard')}
            className="text-xs"
          >
            Dashboard
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sticky Table of Contents */}
        <aside className="hidden lg:block col-span-1">
          <div className="sticky top-20 space-y-3 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold px-2">
              Sections
            </div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    activeSection === s.id
                      ? 'bg-zinc-800 text-sky-400 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>
            <div className="pt-3 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-500 px-2">
              Last updated: September 18, 2026
            </div>
          </div>
        </aside>

        {/* Terms Text Content */}
        <main className="col-span-1 lg:col-span-3 space-y-10 max-w-3xl">
          {/* Header */}
          <div className="space-y-3 pb-6 border-b border-zinc-800">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-[11px] font-mono text-emerald-400">
              <Scale size={12} />
              <span>Developer Agreement</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Optic Terms of Service
            </h1>
            <p className="text-xs font-mono text-zinc-400">
              Effective Date: September 18, 2026 • Version 3.1
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding contract
              between you (the developer, enterprise, or individual user, &quot;you&quot;) and Optic
              (&quot;Optic&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account, deploying
              applications via Optic Hosting, uploading assets via Optic Cloud, or generating API
              tokens, you agree to be bound by these Terms.
            </p>
          </div>

          {/* Section 1 */}
          <section id="acceptance" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">1.</span>
              Acceptance of Terms
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                If you are entering into these Terms on behalf of a company, organization, or other
                legal entity, you represent and warrant that you possess full legal authority to
                bind that entity to these Terms. If you do not possess such authority or do not
                agree with any provision, you must immediately cease accessing the platform.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="services" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">2.</span>
              Optic Services &amp; Scope
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>Optic provides a suite of developer infrastructure services:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
                <li>
                  <strong className="text-zinc-200">Optic Cloud:</strong> S3-compatible cloud object
                  storage built for asset delivery, automated MIME detection, and high-throughput
                  media streaming.
                </li>
                <li>
                  <strong className="text-zinc-200">Optic Hosting:</strong> Global edge application
                  and static website deployment platform with automatic SSL provisioning, Git
                  integrations, and preview branches.
                </li>
                <li>
                  <strong className="text-zinc-200">Optic Developer Tools:</strong> Including the
                  REST API, Optic CLI (<code className="text-zinc-300 font-mono">@optic/cli</code>),
                  and official SDK libraries.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="accounts" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">3.</span>
              Accounts &amp; API Key Security
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                You are solely responsible for maintaining the confidentiality of your login
                credentials, email verification links, and generated API keys (
                <code className="text-zinc-200 font-mono">opt_live_...</code>).
              </p>
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Never commit raw API keys to public repositories. You are responsible for all
                  bandwidth, storage, and API requests initiated under your credentials.
                </span>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="acceptable-use" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">4.</span>
              Acceptable Use Policy (AUP)
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>You agree NOT to use the platform to host, transmit, deploy, or store:</p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs">
                <li>Malware, viruses, trojans, ransomware, rootkits, or malicious exploits.</li>
                <li>Phishing campaigns, credential harvesters, or deceptive spoofing sites.</li>
                <li>Cryptocurrency miners or resource-exhaustion scripts without authorization.</li>
                <li>Content that violates copyright, trademark, trade secret, or privacy laws.</li>
                <li>Unsolicited bulk communications (spam) or automated scraping attacks.</li>
                <li>Sites or payloads that facilitate cyberattacks, DDoS, or port scanning.</li>
              </ul>
              <p className="text-xs text-zinc-400 pt-1">
                Violation of our AUP results in immediate deployment termination, token revocation,
                and potential referral to competent regulatory or legal authorities.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="intellectual-property" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">5.</span>
              Intellectual Property &amp; Ownership
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>
                <strong className="text-zinc-100">You retain 100% ownership of your code, data, and assets.</strong>{' '}
                Optic claims zero intellectual property rights over any software, files, or media
                you upload or deploy.
              </p>
              <p className="text-xs text-zinc-400">
                You grant Optic only the limited, non-exclusive, worldwide license to host, cache,
                copy, and transmit your materials solely to the extent necessary to perform the
                requested hosting and storage services.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="quotas" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">6.</span>
              Resource Quotas &amp; Fair Use
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                Each Optic account is assigned tier limits (e.g. Free Developer Tier: 10 GB Storage,
                50 GB Egress/month, 5 active projects).
              </p>
              <p className="text-xs text-zinc-400">
                If your workloads exceed tier quotas, automated email warnings will be dispatched.
                We do not abruptly shut down legitimate production traffic; however, sustained
                unmetered overages may require upgrading or throttling until the next billing
                cycle.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="billing" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">7.</span>
              Fees, Tiers &amp; Upgrades
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                Paid tiers and add-on bandwidth are billed on a recurring monthly or annual basis.
                All fees are non-refundable except where required by statutory consumer law. You may
                cancel paid subscriptions at any time via Dashboard Settings.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section id="availability" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">8.</span>
              Service Levels &amp; Availability
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                We strive for 99.99% edge availability across all deployment endpoints and object
                storage buckets. Maintenance windows and scheduled updates will be communicated in
                advance via our status channels.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="disclaimer" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">9.</span>
              Warranties &amp; Disclaimers
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p className="text-xs text-zinc-400 uppercase tracking-wide font-mono">
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT
                WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
                WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="liability" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">10.</span>
              Limitation of Liability
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                To the maximum extent permitted by applicable law, in no event shall Optic, its
                officers, affiliates, or licensors be liable for any indirect, incidental, special,
                punitive, or consequential damages, including loss of profits, data, or goodwill,
                arising out of your use of or inability to use the services.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section id="termination" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">11.</span>
              Termination &amp; Suspension
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                You may terminate your account at any time. Optic reserves the right to suspend or
                terminate your access with prior notice if you breach these Terms or engage in
                harmful conduct that threatens platform stability.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="governing-law" className="space-y-3 pb-8">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">12.</span>
              Governing Law &amp; Inquiries
            </h2>
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-300 space-y-2">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the
                State of Delaware, without regard to its conflict of law principles.
              </p>
              <div className="font-mono text-zinc-400 space-y-1 pt-1">
                <div>Legal Inquiries: <span className="text-emerald-400">legal@optic.doy.best</span></div>
                <div>Compliance: <span className="text-sky-400">compliance@optic.doy.best</span></div>
                <div>Optic Cloud Platform — Terms Administration</div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <OpticFooter onNavigateSurface={onNavigateSurface} />
    </div>
  );
};
