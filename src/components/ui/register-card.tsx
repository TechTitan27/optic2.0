"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  EyeOff,
  Github,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { GoogleIcon } from "../common/GoogleIcon";
import { OpticLogo } from "../brand/OpticLogo";
import { useAuth } from "../../context/AuthContext";

export interface RegisterCardSectionProps {
  onNavigateToLogin?: () => void;
  onNavigateToHome?: () => void;
  onContact?: () => void;
  onSuccess?: () => void;
  brandTitle?: string;
  brandDomain?: string;
}

export default function RegisterCardSection({
  onNavigateToLogin,
  onNavigateToHome,
  onContact,
  onSuccess,
  brandTitle = "Optic Cloud",
  brandDomain = "optic.doy.best",
}: RegisterCardSectionProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const auth = useAuth();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    type P = { x: number; y: number; v: number; o: number };
    let ps: P[] = [];
    let raf = 0;

    const make = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });

    const init = () => {
      ps = [];
      const count = Math.floor((canvas.width * canvas.height) / 9000);
      for (let i = 0; i < count; i++) ps.push(make());
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ps.forEach((p) => {
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + Math.random() * 40;
          p.v = Math.random() * 0.25 + 0.05;
          p.o = Math.random() * 0.35 + 0.15;
        }
        ctx.fillStyle = `rgba(250,250,250,${p.o})`;
        ctx.fillRect(p.x, p.y, 0.7, 2.2);
      });
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      setSize();
      init();
    };

    window.addEventListener("resize", onResize);
    init();
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setAuthError("Please enter your email address");
      return;
    }
    if (!terms) {
      setAuthError("Please accept the Terms of Service to continue");
      return;
    }
    setAuthError(null);
    setLoading(true);

    try {
      if (auth?.signUp) {
        await auth.signUp(email, password || "demo12345");
      }
      onSuccess?.();
    } catch (err: any) {
      setAuthError(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    setAuthError(null);
    setLoading(true);
    try {
      if (provider === "google" && auth?.signInWithGoogle) {
        await auth.signInWithGoogle();
      } else if (auth?.demoLogin) {
        auth.demoLogin(provider === "google" ? "google-dev@optic.doy.best" : "github-dev@optic.doy.best");
      }
      onSuccess?.();
    } catch (err: any) {
      setAuthError(err?.message || `Failed to sign up with ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="fixed inset-0 bg-black text-zinc-50 overflow-y-auto z-40">
      <style>{`
        .accent-lines{position:absolute;inset:0;pointer-events:none;opacity:.6}
        .hline,.vline{position:absolute;background:#18181b;will-change:transform,opacity}
        .hline{left:0;right:0;height:1px;transform:scaleX(0);transform-origin:50% 50%;animation:drawX .8s cubic-bezier(.22,.61,.36,1) forwards}
        .vline{top:0;bottom:0;width:1px;transform:scaleY(0);transform-origin:50% 0%;animation:drawY .9s cubic-bezier(.22,.61,.36,1) forwards}
        .hline:nth-child(1){top:18%;animation-delay:.12s}
        .hline:nth-child(2){top:50%;animation-delay:.22s}
        .hline:nth-child(3){top:82%;animation-delay:.32s}
        .vline:nth-child(4){left:22%;animation-delay:.42s}
        .vline:nth-child(5){left:50%;animation-delay:.54s}
        .vline:nth-child(6){left:78%;animation-delay:.66s}
        .hline::after,.vline::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(250,250,250,.2),transparent);opacity:0;animation:shimmer .9s ease-out forwards}
        .hline:nth-child(1)::after{animation-delay:.12s}
        .hline:nth-child(2)::after{animation-delay:.22s}
        .hline:nth-child(3)::after{animation-delay:.32s}
        .vline:nth-child(4)::after{animation-delay:.42s}
        .vline:nth-child(5)::after{animation-delay:.54s}
        .vline:nth-child(6)::after{animation-delay:.66s}
        @keyframes drawX{0%{transform:scaleX(0);opacity:0}60%{opacity:.95}100%{transform:scaleX(1);opacity:.7}}
        @keyframes drawY{0%{transform:scaleY(0);opacity:0}60%{opacity:.95}100%{transform:scaleY(1);opacity:.7}}
        @keyframes shimmer{0%{opacity:0}35%{opacity:.25}100%{opacity:0}}

        /* === Card minimal fade-up animation === */
        .card-animate {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.8s cubic-bezier(.22,.61,.36,1) 0.4s forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Subtle pitch black vignette */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(80%_60%_at_50%_30%,rgba(255,255,255,0.03),transparent_60%)]" />

      {/* Accent Lines */}
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      {/* Particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen pointer-events-none"
      />

      {/* Header */}
      <header className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 py-4 border-b border-zinc-900 z-20 bg-black/80 backdrop-blur-sm">
        <button
          onClick={onNavigateToHome}
          type="button"
          className="focus:outline-none flex items-center gap-2 group cursor-pointer"
          aria-label="Optic home"
        >
          <OpticLogo size={24} showWordmark={true} />
        </button>
        <Button
          variant="outline"
          onClick={onContact || onNavigateToHome}
          className="h-9 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900 hover:text-white"
        >
          <span className="mr-2">Documentation</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      {/* Register Card */}
      <div className="min-h-full w-full grid place-items-center px-4 py-24 relative z-10">
        <Card className="card-animate w-full max-w-sm border-zinc-800/90 bg-zinc-950/90 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Create your account</CardTitle>
            <CardDescription className="text-xs text-zinc-400 leading-relaxed">
              Unified developer access across Optic Cloud storage and Hosting.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRegister}>
            <CardContent className="grid gap-4">
              {authError && (
                <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-red-950/40 border border-red-900/60 text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-zinc-300">
                  Developer Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="pl-10 bg-black border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-xs py-2 focus-visible:ring-zinc-700"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@optic.dev"
                    required
                    className="pl-10 bg-black border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-xs py-2 focus-visible:ring-zinc-700"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-zinc-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={6}
                    className="pl-10 pr-10 bg-black border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-xs py-2 focus-visible:ring-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start space-x-2 pt-1">
                <Checkbox
                  id="terms"
                  checked={terms}
                  onCheckedChange={(c) => setTerms(!!c)}
                  className="mt-0.5 border-zinc-700 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-black"
                />
                <Label htmlFor="terms" className="text-[11px] text-zinc-400 leading-snug cursor-pointer">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => onNavigateToHome?.()}
                    className="text-zinc-200 underline hover:text-white"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => onNavigateToHome?.()}
                    className="text-zinc-200 underline hover:text-white"
                  >
                    Privacy Policy
                  </button>
                </Label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-9 rounded-lg bg-zinc-100 text-black hover:bg-white font-medium text-xs mt-1 transition-colors"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>

              <div className="relative my-1">
                <Separator className="bg-zinc-800" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-zinc-950 px-2 text-[10px] uppercase font-mono tracking-widest text-zinc-500">
                  or
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("google")}
                  className="h-9 rounded-lg border-zinc-800 bg-black text-zinc-200 hover:bg-zinc-900 hover:text-white text-xs font-normal"
                >
                  <GoogleIcon className="h-4 w-4 mr-2 shrink-0" />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("github")}
                  className="h-9 rounded-lg border-zinc-800 bg-black text-zinc-200 hover:bg-zinc-900 hover:text-white text-xs font-normal"
                >
                  <Github className="h-4 w-4 mr-2 shrink-0 text-zinc-400" />
                  GitHub
                </Button>
              </div>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col items-center gap-2 pt-2 pb-5 text-xs text-zinc-400 border-t border-zinc-900">
            <div>
              Already have an account?
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="ml-1 text-white hover:underline font-medium cursor-pointer"
              >
                Sign in
              </button>
            </div>
            <div className="text-[11px] text-zinc-600 font-mono mt-1">
              Optic Cloud • S3 Storage &amp; Edge Hosting
            </div>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
