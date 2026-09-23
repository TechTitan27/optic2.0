import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  HardDrive,
  Globe,
  Terminal,
  Zap,
  CheckCircle2,
  ArrowRight,
  Share2,
  Sparkles,
  Copy,
  Check,
  Radio,
  ShieldCheck,
  Layers,
  Cpu
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { OpticLogo } from '../brand/OpticLogo';

interface OpticTrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateSurface?: (surface: any, path?: string) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

interface Scene {
  id: number;
  title: string;
  startSec: number;
  durationSec: number;
  tagline: string;
  subtitle: string;
}

const SCENES: Scene[] = [
  {
    id: 0,
    title: 'The Problem',
    startSec: 0,
    durationSec: 8,
    tagline: 'Traditional cloud is broken.',
    subtitle: '14 disjointed dashboards. Cryptic IAM policies. Surprise egress bills.',
  },
  {
    id: 1,
    title: 'Introducing Optic',
    startSec: 8,
    durationSec: 8,
    tagline: 'Meet Optic.',
    subtitle: 'Unified cloud storage and edge hosting. Built exclusively for builders.',
  },
  {
    id: 2,
    title: 'Optic Cloud Storage',
    startSec: 16,
    durationSec: 9,
    tagline: 'S3-Compatible. Zero Friction.',
    subtitle: 'Sub-millisecond presigned URLs, triple-replicated NVMe edge clusters.',
  },
  {
    id: 3,
    title: 'Optic Hosting',
    startSec: 25,
    durationSec: 9,
    tagline: 'Edge Hosting at the Speed of Light.',
    subtitle: '280+ Anycast PoPs, automated ZeroSSL certificates, instant atomic rollbacks.',
  },
  {
    id: 4,
    title: 'Developer Experience',
    startSec: 34,
    durationSec: 8,
    tagline: 'Code. Deploy. Done.',
    subtitle: 'One developer identity. One API token. Direct terminal deployment.',
  },
  {
    id: 5,
    title: 'Launch',
    startSec: 42,
    durationSec: 6,
    tagline: 'The future of infrastructure is here.',
    subtitle: 'Start building free in less than 30 seconds. Welcome to Optic.',
  },
];

const TOTAL_DURATION = 48; // seconds

export const OpticTrailerModal: React.FC<OpticTrailerModalProps> = ({
  isOpen,
  onClose,
  onNavigateSurface,
  onOpenAuth,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  // Initialize Web Audio ambient synthesizer
  const playSceneTone = (sceneIndex: number) => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Cinematic chord notes based on scene
      const chords = [
        [130.81, 196.0, 246.94], // C3 minor tense
        [146.83, 220.0, 277.18], // D3 major lift
        [164.81, 246.94, 329.63], // E3 tech bright
        [174.61, 261.63, 349.23], // F3 epic
        [196.0, 293.66, 392.0], // G3 power
        [220.0, 329.63, 440.0], // A3 crescendo
      ];

      const currentNotes = chords[sceneIndex] || chords[0];
      const now = ctx.currentTime;

      currentNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.7);
      });
    } catch {
      // Audio fallback silent
    }
  };

  // Clock runner
  useEffect(() => {
    if (!isOpen) {
      setCurrentTime(0);
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
  }, [isOpen]);

  useEffect(() => {
    if (isPlaying && isOpen) {
      const intervalMs = 100 / playbackSpeed;
      timerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= TOTAL_DURATION) {
            setIsPlaying(false);
            return TOTAL_DURATION;
          }
          return Math.min(TOTAL_DURATION, +(prev + 0.1).toFixed(2));
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isOpen, playbackSpeed]);

  // Determine current active scene
  const currentSceneIndex = SCENES.findIndex((s, idx) => {
    const nextStart = SCENES[idx + 1]?.startSec ?? TOTAL_DURATION;
    return currentTime >= s.startSec && currentTime < nextStart;
  });
  const activeScene = SCENES[currentSceneIndex === -1 ? SCENES.length - 1 : currentSceneIndex];

  // Play tone when scene changes
  const prevSceneRef = useRef(currentSceneIndex);
  useEffect(() => {
    if (prevSceneRef.current !== currentSceneIndex && isPlaying) {
      prevSceneRef.current = currentSceneIndex;
      playSceneTone(currentSceneIndex);
    }
  }, [currentSceneIndex, isPlaying]);

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    playSceneTone(SCENES.findIndex((s, idx) => {
      const nextStart = SCENES[idx + 1]?.startSec ?? TOTAL_DURATION;
      return seconds >= s.startSec && seconds < nextStart;
    }));
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(true);
    playSceneTone(0);
  };

  const handleCopyBragPost = () => {
    const bragText = `🚀 We just launched Optic — the unified cloud storage & edge hosting platform for modern developers.\n\n✨ S3-compatible NVMe storage + instant presigned URLs\n⚡ Sub-second edge deployments across 280+ Anycast PoPs\n🔒 Zero-trust API keys & instant atomic rollbacks\n\nExperience it: https://optic.doy.best`;
    navigator.clipboard.writeText(bragText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Modal Container */}
      <div
        ref={containerRef}
        className={`relative w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen ? 'fixed inset-0 max-w-none rounded-none z-50' : 'max-h-[95vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono font-semibold tracking-wider uppercase text-zinc-300">
              Optic 2026 // Launch Trailer
            </span>
            <span className="hidden sm:inline text-zinc-600">•</span>
            <span className="hidden sm:inline text-[11px] font-mono text-zinc-400">
              Scene {activeScene.id + 1} of {SCENES.length}: {activeScene.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBragPost}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Copy social launch announcement copy"
            >
              {copiedShare ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedShare ? 'Copied Launch Copy!' : 'Copy Share Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close trailer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 16:9 Cinema Viewport */}
        <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden select-none">
          {/* Subtle Grid Backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute inset-0 bg-radial from-transparent via-zinc-950/60 to-zinc-950 pointer-events-none" />

          {/* SCENE 0: THE PROBLEM */}
          {activeScene.id === 0 && (
            <div className="relative z-10 max-w-2xl px-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <Badge variant="warning" size="sm" dot>
                STATUS QUO: FRAGMENTED
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                Cloud infrastructure shouldn&apos;t feel like a tax.
              </h2>
              <p className="text-sm sm:text-base text-zinc-400 font-mono">
                14 separate dashboards. Cryptic 200-line IAM policies.
              </p>

              {/* Floating Alert Mock */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono shadow-lg">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span>Error: AccessDenied - Missing s3:PutObject on arn:aws:s3:::undefined</span>
              </div>
            </div>
          )}

          {/* SCENE 1: MEET OPTIC */}
          {activeScene.id === 1 && (
            <div className="relative z-10 max-w-2xl px-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex items-center justify-center relative group">
                <div className="absolute inset-0 rounded-2xl bg-sky-500/20 blur-xl animate-pulse" />
                <OpticLogo size={42} />
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                One Platform. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-emerald-400 to-indigo-400">
                  Your Infrastructure.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 max-w-md mx-auto">
                Optic unites high-performance file storage and edge website hosting into a single, cohesive developer workspace.
              </p>
            </div>
          )}

          {/* SCENE 2: OPTIC CLOUD STORAGE */}
          {activeScene.id === 2 && (
            <div className="relative z-10 w-full max-w-3xl px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-sky-500/30 bg-zinc-900/90 shadow-2xl p-4 sm:p-6 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                      <HardDrive size={15} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Optic Cloud Storage</h3>
                      <p className="text-[11px] font-mono text-sky-400">S3 API • NVMe Triple Replication</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    14ms TTFB
                  </Badge>
                </div>

                {/* Animated File Upload Progress */}
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      production-backup-v2.tar.gz
                    </span>
                    <span className="text-zinc-500">1.2 GB • 100% complete</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 w-full animate-pulse" />
                  </div>
                </div>

                {/* Feature Chips */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800 text-center font-mono text-[11px]">
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Encryption</span>
                    <span className="text-zinc-200 font-semibold">AES-256-GCM</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Presigned URLs</span>
                    <span className="text-emerald-400 font-semibold">Sub-Millisecond</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Egress Fees</span>
                    <span className="text-sky-400 font-semibold">$0.00 Always</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 3: OPTIC EDGE HOSTING */}
          {activeScene.id === 3 && (
            <div className="relative z-10 w-full max-w-3xl px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-emerald-500/30 bg-zinc-900/90 shadow-2xl p-4 sm:p-6 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Globe size={15} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Optic Edge Hosting</h3>
                      <p className="text-[11px] font-mono text-emerald-400">280+ Anycast PoPs • ZeroSSL ACME</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Active Worldwide
                  </Badge>
                </div>

                {/* Simulated Build & Deploy Pipeline */}
                <div className="mt-4 p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>$ git push optic main</span>
                    <span className="text-emerald-400">✔ Deployed in 8.4s</span>
                  </div>
                  <div className="text-zinc-500 text-[11px]">
                    https://my-app-production.optic.site
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800 text-center font-mono text-[11px]">
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Rollbacks</span>
                    <span className="text-emerald-400 font-semibold">Instant (0s)</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Custom Domains</span>
                    <span className="text-zinc-200 font-semibold">Apex & CNAME</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">Edge Caching</span>
                    <span className="text-sky-400 font-semibold">Global Anycast</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 4: DEVELOPER EXPERIENCE */}
          {activeScene.id === 4 && (
            <div className="relative z-10 w-full max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-2xl p-4 sm:p-6">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <Terminal size={16} className="text-sky-400" />
                  <span className="text-xs font-mono text-zinc-200 font-semibold">
                    The Modern Developer Stack
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-2">
                  <div className="text-zinc-500"># 1. Deploy straight from terminal</div>
                  <div className="text-emerald-400">$ npx optic deploy</div>
                  <div className="text-zinc-500 pt-1"># 2. Upload via TypeScript SDK</div>
                  <div className="text-sky-300">
                    const file = await optic.files.upload(&apos;./bundle.zip&apos;);
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    ✔ Output: https://cdn.optic.doy.best/f/bundle.zip
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 5: LAUNCH CALL TO ACTION */}
          {activeScene.id === 5 && (
            <div className="relative z-10 max-w-xl px-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <Sparkles size={12} />
                <span>Optic is Live</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Build Faster. <br />
                Pay Nothing to Start.
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Join thousands of engineers unifying their storage and hosting on Optic.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => {
                    onClose();
                    onOpenAuth?.('signup');
                  }}
                  className="text-sm px-6 py-2.5 shadow-lg shadow-sky-500/20"
                >
                  <span>Start Building Free</span>
                  <ArrowRight size={14} className="ml-1.5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleRestart}
                  className="text-sm px-4 py-2.5 border-zinc-800 hover:bg-zinc-900"
                >
                  <RotateCcw size={14} className="mr-1.5" />
                  <span>Replay</span>
                </Button>
              </div>
            </div>
          )}

          {/* Persistent Lower Subtitle / Caption Bar */}
          <div className="absolute bottom-4 left-6 right-6 z-20 pointer-events-none">
            <div className="max-w-xl mx-auto text-center px-4 py-1.5 rounded-lg bg-black/75 border border-zinc-800/80 backdrop-blur-md">
              <p className="text-xs sm:text-sm font-medium text-zinc-200 tracking-wide font-sans">
                {activeScene.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Video Player Controls Bar */}
        <div className="p-3 sm:p-4 bg-zinc-900/95 border-t border-zinc-800 shrink-0 space-y-3">
          {/* Progress Timeline Scrubber */}
          <div className="relative group">
            <div
              className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                handleSeek(clickPos * TOTAL_DURATION);
              }}
            >
              {/* Scene Chapter Dividers */}
              {SCENES.slice(1).map((s) => (
                <div
                  key={s.id}
                  className="absolute top-0 bottom-0 w-0.5 bg-zinc-950 z-10"
                  style={{ left: `${(s.startSec / TOTAL_DURATION) * 100}%` }}
                  title={s.title}
                />
              ))}

              {/* Active Elapsed Fill */}
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-indigo-400 transition-all duration-100"
                style={{ width: `${(currentTime / TOTAL_DURATION) * 100}%` }}
              />
            </div>
          </div>

          {/* Chapter Jump Buttons */}
          <div className="hidden sm:flex items-center justify-between gap-1 overflow-x-auto pb-1 text-[11px] font-mono">
            {SCENES.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => handleSeek(scene.startSec)}
                className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  currentSceneIndex === idx
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                0{idx + 1} {scene.title}
              </button>
            ))}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 flex items-center justify-center transition-transform active:scale-95"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
              </button>

              {/* Restart */}
              <button
                onClick={handleRestart}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Restart from beginning"
              >
                <RotateCcw size={15} />
              </button>

              {/* Audio Synthesizer Tone Toggle */}
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (!nextMuted) playSceneTone(currentSceneIndex);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  isMuted
                    ? 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/40'
                    : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                }`}
                title="Toggle ambient audio synthesizer track"
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span className="hidden sm:inline">{isMuted ? 'Sound Off' : 'Sound On'}</span>
              </button>

              {/* Time display */}
              <span className="text-xs font-mono text-zinc-400 ml-1">
                {formatTime(currentTime)} / {formatTime(TOTAL_DURATION)}
              </span>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <button
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : 1)}
                className="px-2 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                title="Toggle playback rate"
              >
                {playbackSpeed}x
              </button>

              {/* Fullscreen */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
