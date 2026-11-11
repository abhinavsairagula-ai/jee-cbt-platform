import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("redirectTo") || searchParams.get("next");

  if (code || (token_hash && type)) {
    const supabase = await createClient();

    let authError = null;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authError = error;
    } else if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });
      authError = error;
    }

    if (!authError) {
      // Determine redirection target
      let destination = next;
      if (!destination) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          destination = profile?.role === "admin" ? "/admin" : "/test";
        } else {
          destination = "/test";
        }
      }

      const sanitizedNext = destination.startsWith("/") ? destination : `/${destination}`;
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${sanitizedNext}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${sanitizedNext}`);
      } else {
        return NextResponse.redirect(`${origin}${sanitizedNext}`);
      }
    }
  }

  // If there's an error or no code/token, return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth-callback-error`);
}
