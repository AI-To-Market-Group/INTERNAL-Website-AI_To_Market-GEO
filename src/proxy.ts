import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must be called before any route logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /atelier routes — redirect to /login if not authenticated.
  if (!user && pathname.startsWith("/atelier")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Protect /content-forge routes — redirect to /login if not authenticated.
  if (!user && pathname.startsWith("/content-forge")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Legacy: /dashboard → /atelier
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/dashboard/, "/atelier");
    return NextResponse.redirect(url);
  }

  // Legacy: /newsroom → /content-forge
  if (pathname === "/newsroom" || pathname.startsWith("/newsroom/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/newsroom/, "/content-forge");
    return NextResponse.redirect(url);
  }

  // Legacy: /insights → /content-forge
  if (pathname === "/insights" || pathname.startsWith("/insights/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/insights/, "/content-forge");
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from /login.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/atelier";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
