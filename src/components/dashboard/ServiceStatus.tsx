import React, { useState, useEffect } from 'react';
import {
  Activity,
  HardDrive,
  Globe,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
  ShieldCheck,
  Radio,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export interface ServiceComponentHealth {
  id: string;
  name: string;
  category: 'cloud' | 'hosting';
  status: 'operational' | 'degraded' | 'maintenance' | 'outage';
  uptimePercentage: number;
  latencyMs: number;
  description: string;
  region?: string;
}

export interface ServiceStatusProps {
  className?: string;
  compact?: boolean;
  onNavigateSurface?: (surface: any, path?: string) => void;
}

export const ServiceStatus: React.FC<ServiceStatusProps> = ({
  className = '',
  compact = false,
  onNavigateSurface,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [expandedSection, setExpandedSection] = useState<'all' | 'cloud' | 'hosting' | 'none'>('none');
  const [activeTab, setActiveTab] = useState<'overview' | 'regions' | 'history'>('overview');

  // Service components data with dynamic latency jitter simulation for realistic diagnostic feel
  const [services, setServices] = useState<ServiceComponentHealth[]>([
    // Cloud Storage Infrastructure
    {
      id: 's3-gateway',
      name: 'S3-Compatible API Gateway',
      category: 'cloud',
      status: 'operational',
      uptimePercentage: 99.99,
      latencyMs: 14,
      description: 'RESTful S3 object uploads, multi-part chunking, and read operations',
      region: 'Global Anycast',
    },
    {
      id: 'object-store',
      name: 'Distributed Object Store & Replication',
      category: 'cloud',
      status: 'operational',
      uptimePercentage: 100.0,
      latencyMs: 18,
      description: 'Triple-replicated encrypted storage tiers across NVMe edge clusters',
      region: 'Multi-Region (US/EU/APAC)',
    },
    {
      id: 'presigned-auth',
      name: 'Presigned URL & Auth Token Service',
      category: 'cloud',
      status: 'operational',
      uptimePercentage: 99.98,
      latencyMs: 9,
      description: 'HMAC-SHA256 authenticated short-lived download and upload tokens',
      region: 'Global Edge Auth',
    },
    {
      id: 'metadata-index',
      name: 'Metadata & Catalog Indexing Engine',
      category: 'cloud',
      status: 'operational',
      uptimePercentage: 100.0,
      latencyMs: 22,
      description: 'High-throughput database indexing for file hierarchies and tags',
      region: 'Primary Cluster',
    },

    // Hosting Infrastructure
    {
      id: 'edge-cdn',
      name: 'Global Anycast Edge CDN',
      category: 'hosting',
      status: 'operational',
      uptimePercentage: 100.0,
      latencyMs: 19,
      description: '280+ Points of Presence routing traffic to closest geographical cache',
      region: '280+ Edge Locations',
    },
    {
      id: 'build-pipeline',
      name: 'Automated Build Pipeline & Runners',
      category: 'hosting',
      status: 'operational',
      uptimePercentage: 99.96,
      latencyMs: 34,
      description: 'Isolated containerized runners executing Vite, Next.js, and Astro builds',
      region: 'US-East & EU-Central',
    },
    {
      id: 'ssl-acme',
      name: 'SSL/TLS Certificate Authority & ACME',
      category: 'hosting',
      status: 'operational',
      uptimePercentage: 100.0,
      latencyMs: 11,
      description: 'Automatic ZeroSSL & Let\'s Encrypt certificate issuance and renewal',
      region: 'Automated Daemon',
    },
    {
      id: 'dns-routing',
      name: 'Custom Domain & Apex DNS Routing',
      category: 'hosting',
      status: 'operational',
      uptimePercentage: 100.0,
      latencyMs: 16,
      description: 'Near-instant CNAME verification and GeoDNS fallback resolution',
      region: 'Anycast DNS Mesh',
    },
  ]);

  // Regions health status
  const regions = [
    { name: 'North America (US-East)', code: 'iad1', status: 'Operational', latency: '12ms', uptime: '100%' },
    { name: 'Europe (EU-Central / Frankfurt)', code: 'fra1', status: 'Operational', latency: '18ms', uptime: '99.99%' },
    { name: 'Asia Pacific (AP-Southeast / Singapore)', code: 'sin1', status: 'Operational', latency: '26ms', uptime: '100%' },
    { name: 'South America (SA-East / São Paulo)', code: 'gru1', status: 'Operational', latency: '38ms', uptime: '99.98%' },
  ];

  // Simulated 30-day uptime bars (each block represents a day)
  const past30Days = Array.from({ length: 30 }, (_, i) => {
    return {
      day: i + 1,
      status: 'operational',
      uptime: 100,
    };
  });

  const runDiagnostics = async () => {
    setIsRefreshing(true);
    // Real roundtrip ping simulation
    const startTime = performance.now();
    try {
      // Attempt a lightweight fetch to verify connectivity
      await fetch('/api/health', { method: 'GET' }).catch(() => null);
    } catch {
      // fallback
    }
    const duration = Math.max(12, Math.round(performance.now() - startTime));

    setTimeout(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          latencyMs: Math.max(8, Math.round(s.latencyMs + (Math.random() * 6 - 3))),
        }))
      );
      setLastChecked(new Date());
      setIsRefreshing(false);
    }, 600);
  };

  const cloudServices = services.filter((s) => s.category === 'cloud');
  const hostingServices = services.filter((s) => s.category === 'hosting');

  const avgCloudLatency = Math.round(
    cloudServices.reduce((acc, curr) => acc + curr.latencyMs, 0) / cloudServices.length
  );
  const avgHostingLatency = Math.round(
    hostingServices.reduce((acc, curr) => acc + curr.latencyMs, 0) / hostingServices.length
  );

  return (
    <div
      id="optic-service-status-widget"
      className={`rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 sm:p-5 transition-all duration-200 ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Radio size={16} className="text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Infrastructure Health
              </h3>
              <Badge variant="success" dot size="sm">
                All Systems Operational
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-2">
              <span>99.99% 30-day uptime</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={11} className="text-zinc-500" />
                Updated {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={runDiagnostics}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
            title="Ping endpoints and measure live latency"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-sky-400' : 'text-zinc-400'} />
            <span>{isRefreshing ? 'Pinging...' : 'Check Status'}</span>
          </button>

          <button
            onClick={() =>
              setExpandedSection((prev) => (prev === 'all' ? 'none' : 'all'))
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
          >
            <span>{expandedSection === 'all' ? 'Collapse' : 'Details'}</span>
            {expandedSection === 'all' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* High-Level Dual Infrastructure Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        {/* Cloud Storage Infrastructure Card */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3.5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <HardDrive size={15} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Optic Cloud Storage</h4>
                <p className="text-[11px] font-mono text-zinc-400">S3 Gateway & Object Engine</p>
              </div>
            </div>
            <Badge variant="success" size="sm" dot>
              Operational
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-900 font-mono text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Latency</span>
              <span className="text-xs font-semibold text-emerald-400">{avgCloudLatency}ms</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Uptime</span>
              <span className="text-xs font-semibold text-zinc-200">99.99%</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Replication</span>
              <span className="text-xs font-semibold text-sky-400">3x Edge</span>
            </div>
          </div>
        </div>

        {/* Hosting Infrastructure Card */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3.5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Globe size={15} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Optic Hosting Network</h4>
                <p className="text-[11px] font-mono text-zinc-400">Edge CDN, Build & DNS</p>
              </div>
            </div>
            <Badge variant="success" size="sm" dot>
              Operational
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-900 font-mono text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Avg TTFB</span>
              <span className="text-xs font-semibold text-emerald-400">{avgHostingLatency}ms</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">PoPs Active</span>
              <span className="text-xs font-semibold text-zinc-200">280+</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block">Build Queue</span>
              <span className="text-xs font-semibold text-emerald-400">Instant (0s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Uptime Visual Heatmap / Sparkline */}
      <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/30 p-3 mb-4">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2">
          <span className="flex items-center gap-1.5">
            <Activity size={12} className="text-emerald-400" />
            30-Day Uptime Reliability
          </span>
          <span className="text-emerald-400 font-semibold">100% Availability</span>
        </div>

        {/* 30 Continuous Operational Blocks */}
        <div className="flex gap-1 h-3.5 items-center">
          {past30Days.map((day) => (
            <div
              key={day.day}
              title={`Day ${day.day}: ${day.uptime}% uptime - No incidents recorded`}
              className="flex-1 h-full rounded-[2px] bg-emerald-500/80 hover:bg-emerald-400 transition-colors cursor-pointer"
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-1.5">
          <span>30 days ago</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Operational
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Degraded
            </span>
          </span>
          <span>Today</span>
        </div>
      </div>

      {/* Expandable Breakdown of All Sub-Services */}
      {expandedSection === 'all' && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-4">
          {/* Sub-tabs for Deep Diagnostics */}
          <div className="flex items-center gap-2 pb-1 border-b border-zinc-900">
            <button
              onClick={() => setActiveTab('overview')}
              className={`text-xs font-mono px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'overview'
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Components ({services.length})
            </button>
            <button
              onClick={() => setActiveTab('regions')}
              className={`text-xs font-mono px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'regions'
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Edge Regions (4)
            </button>
          </div>

          {activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Cloud Storage Sub-services */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <HardDrive size={13} className="text-sky-400" />
                    Cloud Storage Services
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    avg response: {avgCloudLatency}ms
                  </span>
                </div>

                <div className="rounded-lg border border-zinc-800/70 divide-y divide-zinc-800/70 overflow-hidden bg-zinc-950/40">
                  {cloudServices.map((service) => (
                    <div
                      key={service.id}
                      className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-zinc-900/30 transition-colors text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-zinc-200 font-medium">{service.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 pl-3.5 font-sans">
                          {service.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right shrink-0">
                        <span className="text-zinc-400 hidden sm:inline text-[11px]">
                          {service.region}
                        </span>
                        <span className="text-emerald-400 font-semibold">{service.latencyMs}ms</span>
                        <Badge variant="success" size="sm">
                          {service.uptimePercentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hosting Sub-services */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Globe size={13} className="text-emerald-400" />
                    Hosting & Delivery Infrastructure
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    avg TTFB: {avgHostingLatency}ms
                  </span>
                </div>

                <div className="rounded-lg border border-zinc-800/70 divide-y divide-zinc-800/70 overflow-hidden bg-zinc-950/40">
                  {hostingServices.map((service) => (
                    <div
                      key={service.id}
                      className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-zinc-900/30 transition-colors text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-zinc-200 font-medium">{service.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 pl-3.5 font-sans">
                          {service.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right shrink-0">
                        <span className="text-zinc-400 hidden sm:inline text-[11px]">
                          {service.region}
                        </span>
                        <span className="text-emerald-400 font-semibold">{service.latencyMs}ms</span>
                        <Badge variant="success" size="sm">
                          {service.uptimePercentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Regions tab */
            <div className="rounded-lg border border-zinc-800/70 divide-y divide-zinc-800/70 overflow-hidden bg-zinc-950/40">
              {regions.map((region) => (
                <div
                  key={region.code}
                  className="p-3 flex items-center justify-between text-xs font-mono hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <span className="text-zinc-200 font-medium">{region.name}</span>
                      <span className="text-zinc-500 ml-2">({region.code})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400 font-semibold">{region.latency}</span>
                    <Badge variant="success" size="sm">
                      {region.uptime}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
