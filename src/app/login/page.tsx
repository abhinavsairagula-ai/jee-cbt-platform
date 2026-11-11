"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  GraduationCap,
  ShieldCheck,
  LogOut,
  AlertCircle,
  ArrowRight,
  User as UserIcon,
  Clock,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  LogIn,
  UserPlus,
} from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const errorParam = searchParams.get("error");

  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tab: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam === "unauthorized"
      ? "Access denied. Your account does not have administrator privileges (role !== 'admin') or your profile record is missing."
      : errorParam
      ? "Authentication failed or session expired. Please sign in again."
      : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          setUserRole(profile?.role ?? "candidate");
        }
      } catch (err) {
        console.error("Error checking auth state:", err);
      } finally {
        setLoading(false);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single();
        setUserRole(profile?.role ?? "candidate");
      } else {
        setUserRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Handle Candidate Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both Application / Email ID and Password.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (data?.user) {
        // Fetch role from profiles table
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        const role = profile?.role ?? "candidate";
        setUserRole(role);

        // Redirect based on role
        if (role === "admin") {
          router.push("/admin");
        } else {
          router.push(redirectTo && redirectTo !== "/" ? redirectTo : "/test");
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.");
      setSubmitting(false);
    }
  };

  // Handle New Registration
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both Application / Email ID and Password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (data?.session && data.user) {
        // Automatically signed in
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        const role = profile?.role ?? "candidate";
        if (role === "admin") {
          router.push("/admin");
        } else {
          router.push("/test");
        }
      } else {
        // Confirmation email sent or awaiting verification
        setSuccessMessage("Registration initiated! Please check your email to verify your account or proceed to sign in.");
        setActiveTab("signin");
        setSubmitting(false);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Official Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                JEE (Main) Examination Portal
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  CBT 2026
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                National Testing Agency • Candidate Authentication Portal
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SSL 256-Bit Encrypted</span>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Server Time: Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md">
          {/* Card Frame */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 backdrop-blur-xl">
            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-1">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {user ? "Candidate Session" : "Candidate Authentication"}
              </h2>
              <p className="text-sm text-slate-400">
                {user
                  ? "You are currently logged into the examination system."
                  : "Enter your registered credentials to access the examination."}
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Success Notification */}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Verifying credentials...</span>
              </div>
            ) : user ? (
              /* Authenticated User Session View */
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                      {user.email ? user.email.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">Active Candidate</span>
                        {userRole === "admin" && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-200 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Candidate ID</span>
                    <span className="font-mono text-[11px] text-slate-300">
                      {user.id.substring(0, 12)}...
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (userRole === "admin") {
                        router.push("/admin");
                      } else {
                        router.push(redirectTo && redirectTo !== "/" ? redirectTo : "/test");
                      }
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.99]"
                  >
                    <span>
                      {userRole === "admin" ? "Open Admin Dashboard" : "Proceed to Test Portal"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 border border-slate-700/60"
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span>Sign Out Candidate</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Unauthenticated: NTA JEE CBT Form with Tabs */
              <div className="space-y-5">
                {/* Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("signin");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      activeTab === "signin"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Candidate Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("signup");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                      activeTab === "signup"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New Registration</span>
                  </button>
                </div>

                {/* Authentication Form */}
                <form
                  onSubmit={activeTab === "signin" ? handleSignIn : handleSignUp}
                  className="space-y-4"
                >
                  {/* Email / Application ID */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Application No. / Email ID</span>
                      <span className="text-[10px] text-slate-500">Registered</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="candidate@nta.ac.in"
                        disabled={submitting}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Password</span>
                      {activeTab === "signup" && (
                        <span className="text-[10px] text-slate-500">Min 6 characters</span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={submitting}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {activeTab === "signin" ? (
                          <>
                            <LogIn className="w-4 h-4" />
                            <span>Sign In to Examination</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>Create Candidate Account</span>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                </form>

                {/* Candidate Instructions */}
                <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Candidate Guidelines:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed text-[11px]">
                    <li>Ensure your Application ID and Password match official records.</li>
                    <li>Successful sign in directly navigates to your allotted test or admin portal.</li>
                    <li>Keep your session confidential and do not share credentials.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Assistance */}
          <div className="text-center mt-6 text-xs text-slate-500">
            National Testing Agency Helpline: <span className="text-slate-400">011-40759000</span>
          </div>
        </div>
      </main>

      {/* Portal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        © 2026 National Testing Agency / JEE (Main). All Rights Reserved.
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
