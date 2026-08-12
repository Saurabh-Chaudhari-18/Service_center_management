import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/track"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
  if (isPublic) return NextResponse.next();

  const accessCookie = request.cookies.get("scm_access_token");
  if (!accessCookie) return redirectToLogin(request);

  const apiBase = process.env.BACKEND_API_URL || `${request.nextUrl.origin}/api`;
  try {
    const response = await fetch(`${apiBase}/core/users/me/`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (response.ok) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        "x-scm-auth-user",
        encodeURIComponent(await response.text()),
      );
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  } catch {
    // Treat an unverifiable session as unauthenticated.
  }
  return redirectToLogin(request);
}

function redirectToLogin(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|media).*)"],
};
