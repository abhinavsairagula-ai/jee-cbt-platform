import Link from "next/link";
import {
  Atom,
  Calculator,
  Database,
  Sparkles,
  CheckCircle2,
  LogIn,
  Lock,
  Shield,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import MathView from "@/components/MathView";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12">
      <main className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20">
            <Sparkles className="w-4 h-4" />
            Next.js App Router + TypeScript + Tailwind CSS
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            JEE Mains Preparation Platform
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Official Computer Based Test (CBT) portal with Supabase authentication, admin exam authoring, and KaTeX mathematical formula rendering.
          </p>

          {/* Primary Quick Action Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.99]"
            >
              <LogIn className="w-4 h-4" />
              <span>Candidate Login</span>
            </Link>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold text-sm transition border border-purple-500/30 active:scale-[0.99]"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Admin Portal</span>
            </Link>

            <Link
              href="/test"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition border border-slate-700/80 active:scale-[0.99]"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Protected Test Area</span>
            </Link>
          </div>
        </header>

        {/* Action Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Candidate Test Area */}
          <Link
            href="/test"
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/90 transition group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                CBT Mock Test
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Experience simulated JEE Main test papers with real-time timers, question palettes, and marking schemes.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span>Enter Test Environment</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 2: Admin Exam Authoring */}
          <Link
            href="/admin"
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 hover:bg-slate-900/90 transition group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-purple-400 transition">
                Admin Management
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Design mock exams, author Physics, Chemistry, and Math questions with live KaTeX preview, and manage scoring.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
              <span>Open Admin Console</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 3: Candidate Login */}
          <Link
            href="/login"
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900/90 transition group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <LogIn className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Candidate Login
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                NTA-style authentication for candidates and administrators with secure session refresh and role routing.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
              <span>Sign In / Register</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Math Formula */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3 text-indigo-400">
              <Calculator className="w-5 h-5" />
              <h3 className="font-semibold text-base text-slate-100">KaTeX Math Typesetting</h3>
            </div>
            <p className="text-xs text-slate-400">
              Full support for mathematical notation and LaTeX equations:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center overflow-x-auto text-xs">
              <MathView math="E = mc^2 = \frac{m_0 c^2}{\sqrt{1 - \frac{v^2}{c^2}}}" block />
            </div>
          </div>

          {/* Card 2: Physics / Science */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3 text-cyan-400">
              <Atom className="w-5 h-5" />
              <h3 className="font-semibold text-base text-slate-100">Calculus & Physics</h3>
            </div>
            <p className="text-xs text-slate-400">
              Standard formulas rendered with high fidelity:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center overflow-x-auto text-xs">
              <MathView math="\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}" block />
            </div>
          </div>

          {/* Card 3: Supabase Backend */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3 text-emerald-400">
              <Database className="w-5 h-5" />
              <h3 className="font-semibold text-base text-slate-100">Supabase SSR Database</h3>
            </div>
            <p className="text-xs text-slate-400">
              Connected tables for exams, questions, and role-based profiles:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 space-y-1">
              <div>tables: exams, questions, profiles</div>
              <div>ssr: client.ts, server.ts</div>
            </div>
          </div>
        </div>

        {/* Status Checklist */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            System Architecture Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Next.js App Router</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Admin Management</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Question Manager</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Live KaTeX Preview</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
