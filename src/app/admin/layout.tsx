import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  GraduationCap,
  LayoutDashboard,
  PlusCircle,
  Home,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  console.log("Admin check:", { userId: user.id, profile, error });

  if (profile?.role !== "admin") {
    redirect("/login?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white tracking-tight">
                    JEE (Main) Exam Controller
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Administrator
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Examination & Paper Management Portal
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {user.email && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px] truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>
            )}

            <AdminSignOutButton />
          </div>
        </div>
      </header>

      {/* Navigation Sub-Bar */}
      <nav className="border-b border-slate-800/80 bg-slate-900/40 px-4 sm:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
              <span>Exam Dashboard</span>
            </Link>

            <Link
              href="/admin/exams/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create New Exam</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Link
              href="/test"
              target="_blank"
              className="flex items-center gap-1 hover:text-slate-200 transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview CBT</span>
            </Link>
            <span className="text-slate-700">•</span>
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-slate-200 transition"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Portal Home</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        JEE (Main) Computer Based Test (CBT) Administration • National Testing Agency
      </footer>
    </div>
  );
}
