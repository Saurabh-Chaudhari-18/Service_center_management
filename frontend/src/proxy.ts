import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/track"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/organizations",
  "/jobs",
  "/my-jobs",
  "/customers",
  "/enquiries",
  "/inventory",
  "/suppliers",
  "/billing",
  "/purchases",
  "/payments",
  "/expenses",
  "/receipts",
  "/ledger",
  "/gst",
  "/reports",
  "/branches",
  "/users",
  "/pickups",
  "/notifications",
  "/settings",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get("scm_session")?.value === "1";

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
