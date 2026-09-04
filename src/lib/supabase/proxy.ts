import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the token against the Auth server on every call,
  // unlike getClaims()/getSession() which only check the JWT signature and
  // expiry locally. A locally-valid JWT for a since-deleted (or otherwise
  // revoked) user would pass the cheaper check, sending a stale session
  // into a redirect loop between /dashboard and /auth/sign-in - each side
  // disagreeing about whether the user is really authenticated.
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(data?.user);
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/organizer") ||
    request.nextUrl.pathname.startsWith("/auth/choose-mode");
  const isAuthRoute =
    request.nextUrl.pathname === "/auth/sign-in" ||
    request.nextUrl.pathname === "/auth/sign-up";

  if (!isAuthenticated && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("error", "authentication_required");
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
