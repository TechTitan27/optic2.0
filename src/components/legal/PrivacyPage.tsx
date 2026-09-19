import React, { useState } from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { Button } from '../common/Button';
import { OpticFooter } from '../common/OpticFooter';
import { SurfaceType } from '../../types';
import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  Server,
  Database,
  FileCheck,
  Mail,
  UserCheck,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface PrivacyPageProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigateSurface }) => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: '1. Overview & Commitment' },
    { id: 'collection', title: '2. Information We Collect' },
    { id: 'usage', title: '3. How We Use Information' },
    { id: 'storage', title: '4. Storage, Infrastructure & Security' },
    { id: 'sharing', title: '5. Third-Party Subprocessors' },
    { id: 'retention', title: '6. Data Retention & Deletion' },
    { id: 'rights', title: '7. Your Rights (GDPR & CCPA)' },
    { id: 'cookies', title: '8. Cookies & Session Storage' },
    { id: 'changes', title: '9. Changes to This Policy' },
    { id: 'contact', title: '10. Contact & Privacy Officer' },
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
              / Legal / Privacy Policy
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigateSurface('terms', '/terms')}
            className="text-xs text-zinc-400"
          >
            Terms of Service
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
              Table of Contents
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

        {/* Legal Text Content */}
        <main className="col-span-1 lg:col-span-3 space-y-10 max-w-3xl">
          {/* Header */}
          <div className="space-y-3 pb-6 border-b border-zinc-800">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-950/50 border border-sky-800/50 text-[11px] font-mono text-sky-400">
              <Shield size={12} />
              <span>Optic Privacy Commitment</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Optic Platform Privacy Policy
            </h1>
            <p className="text-xs font-mono text-zinc-400">
              Effective Date: September 18, 2026 • Version 2.4
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Optic (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operating at{' '}
              <code className="text-xs font-mono text-sky-400 bg-zinc-900 px-1 py-0.5 rounded">
                optic.doy.best
              </code>
              , provides developer infrastructure including cloud object storage (Optic Cloud),
              static and full-stack edge web hosting (Optic Hosting), developer APIs, and
              command-line interfaces. We are committed to protecting developer data, honoring
              confidentiality, and being strictly transparent about how systems operate.
            </p>
          </div>

          {/* Section 1 */}
          <section id="overview" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">1.</span>
              Overview &amp; Core Principles
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>
                We believe developers should never be the product. Our business model relies on
                providing transparent, scalable infrastructure compute and bandwidth, not selling or
                brokering personal data.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
                <li>
                  <strong className="text-zinc-200">Zero-Egress Monetization:</strong> We do not
                  monetize, scan, or inspect the contents of your stored files or deployed code
                  for advertising or marketing purposes.
                </li>
                <li>
                  <strong className="text-zinc-200">Encryption at Rest &amp; Transit:</strong> All
                  payloads uploaded via Optic Cloud or deployed via Optic Hosting are encrypted
                  using TLS 1.3 in transit and AES-256 at rest.
                </li>
                <li>
                  <strong className="text-zinc-200">Role-Based Access:</strong> Only authenticated
                  credentials or authorized API tokens generated by your account can access your
                  buckets or deployment configurations.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section id="collection" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">2.</span>
              Information We Collect
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>We collect information strictly necessary to provide and secure developer services:</p>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
                <h3 className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider">
                  A. Account &amp; Identity Information
                </h3>
                <p className="text-xs text-zinc-400">
                  When you register via email/password or OAuth (GitHub, Google, Supabase Auth), we
                  collect your email address, primary name, user identifier, and authentication
                  tokens.
                </p>

                <h3 className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider pt-2 border-t border-zinc-800/60">
                  B. Developer Content &amp; Workloads
                </h3>
                <p className="text-xs text-zinc-400">
                  Files, build artifacts, images, archives, static assets, and configurations
                  uploaded to Optic Cloud or deployed through Optic Hosting. We process these solely
                  to store, build, and serve your web properties.
                </p>

                <h3 className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider pt-2 border-t border-zinc-800/60">
                  C. Machine &amp; Telemetry Data
                </h3>
                <p className="text-xs text-zinc-400">
                  HTTP request headers, edge IP addresses, user agent strings, request latency,
                  bandwidth consumption, build runtime duration, and deployment exit codes required
                  for DDoS prevention, rate limiting, and dashboard telemetry metrics.
                </p>

                <h3 className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider pt-2 border-t border-zinc-800/60">
                  D. API Keys &amp; Cryptographic Hashes
                </h3>
                <p className="text-xs text-zinc-400">
                  When you create API keys (<code className="text-zinc-300">opt_live_...</code>), we
                  display the raw key to you once. We store only a salted SHA-256 cryptographic
                  hash, creation timestamps, and access prefixes.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="usage" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">3.</span>
              How We Use Information
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>We use the data collected strictly for the following functional purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
                <li>Provisioning and maintaining your cloud buckets and website deployments.</li>
                <li>Authenticating CLI sessions, web dashboard access, and REST API calls.</li>
                <li>
                  Generating edge metrics such as bandwidth usage, active domains, and deployment
                  status logs.
                </li>
                <li>Preventing malicious traffic, distributed denial-of-service, and abuse.</li>
                <li>Sending essential transactional notifications regarding account security and quota limits.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="storage" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">4.</span>
              Storage, Infrastructure &amp; Security
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>
                Optic leverages modern cloud providers with SOC 2 Type II, ISO 27001, and HIPAA
                compliance certifications:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-200 font-semibold mb-1">
                    <Database size={14} className="text-sky-400" />
                    <span>Optic Cloud (Object Storage)</span>
                  </div>
                  <p className="text-zinc-400">
                    Backed by Cloudflare R2 object storage with global geographic redundancy, 99.99%
                    availability, and no egress lock-in.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-200 font-semibold mb-1">
                    <Server size={14} className="text-emerald-400" />
                    <span>Optic Hosting (Global Edge)</span>
                  </div>
                  <p className="text-zinc-400">
                    Distributed across hundreds of Anycast edge nodes with automatic TLS termination
                    and HTTP/3 support.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="sharing" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">5.</span>
              Third-Party Subprocessors
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                We do not sell your personal data. We utilize trusted infrastructure partners under
                strict data processing agreements (DPAs):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border border-zinc-800 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-900/80 text-zinc-400">
                    <tr className="border-b border-zinc-800">
                      <th className="p-2.5">Subprocessor</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    <tr>
                      <td className="p-2.5 font-sans font-medium">Cloudflare, Inc.</td>
                      <td className="p-2.5">Object storage (R2) &amp; Edge DNS/CDN</td>
                      <td className="p-2.5">United States / Global Edge</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium">Supabase, Inc.</td>
                      <td className="p-2.5">Authentication &amp; metadata database</td>
                      <td className="p-2.5">AWS US-East &amp; Global</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-medium">GitHub, Inc.</td>
                      <td className="p-2.5">Git integration &amp; webhook deployments (optional)</td>
                      <td className="p-2.5">United States</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="retention" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">6.</span>
              Data Retention &amp; Deletion
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                You maintain complete control over your content. When you delete a file in Optic
                Cloud, or teardown a deployment in Optic Hosting, the object is purged immediately
                from active storage and deleted from edge caches within 60 seconds.
              </p>
              <p className="text-xs text-zinc-400">
                Account deletion requests can be initiated directly via the Dashboard Settings or by
                emailing <code className="text-sky-400">privacy@optic.doy.best</code>. Upon request,
                all associated buckets, deployments, and access keys are permanently destroyed.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="rights" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">7.</span>
              Your Rights (GDPR &amp; CCPA)
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                Developers residing in the European Economic Area (EEA), United Kingdom, or
                California enjoy specific statutory rights:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
                <li><strong className="text-zinc-200">Right of Access:</strong> Obtain a copy of all stored personal information and activity logs.</li>
                <li><strong className="text-zinc-200">Right to Rectification:</strong> Modify incorrect contact, project, or billing details.</li>
                <li><strong className="text-zinc-200">Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> Request full deletion of account and workloads.</li>
                <li><strong className="text-zinc-200">Right to Data Portability:</strong> Export all files and project configurations in open formats (e.g. S3 tarball).</li>
                <li><strong className="text-zinc-200">Non-Discrimination:</strong> We will never degrade service quality for exercising your privacy rights.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="cookies" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">8.</span>
              Cookies &amp; Session Storage
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                We do NOT utilize advertising cookies or cross-site tracking pixels. We utilize only
                strictly necessary client storage:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
                <li>
                  <code className="text-zinc-200 font-mono">optic-auth-session</code>: Client
                  localStorage token used by Supabase Auth to maintain your authenticated login
                  session.
                </li>
                <li>
                  <code className="text-zinc-200 font-mono">optic_theme</code>: Preferences for
                  developer console display modes.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section id="changes" className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">9.</span>
              Changes to This Policy
            </h2>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
              <p>
                We may revise this Privacy Policy to reflect infrastructure improvements or legal
                obligations. For material changes, we will notify developers via dashboard banner or
                email at least 14 days prior to taking effect.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="contact" className="space-y-3 pb-8">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-sky-400 font-mono text-sm">10.</span>
              Contact &amp; Data Protection Officer
            </h2>
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-300 space-y-2">
              <p>For privacy inquiries, GDPR DPA requests, or security vulnerability reports, please reach out directly:</p>
              <div className="font-mono text-zinc-400 space-y-1 pt-1">
                <div>Email: <span className="text-sky-400">privacy@optic.doy.best</span></div>
                <div>Security: <span className="text-emerald-400">security@optic.doy.best</span></div>
                <div>Optic Cloud Platform — Infrastructure Legal Division</div>
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
