import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect cron endpoint with secret header
  if (pathname.startsWith("/api/cron")) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Allow bot to POST killmails via shared secret (no Discord session required).
  // Guard: only bypass if BOT_SHARED_SECRET is configured AND matches the header.
  if (pathname.startsWith("/api/killmails") || pathname.startsWith("/api/admin/players")) {
    const configuredSecret = process.env.BOT_SHARED_SECRET;
    const botSecret = req.headers.get("x-bot-secret");
    if (configuredSecret && botSecret && botSecret === configuredSecret) {
      return NextResponse.next();
    }
    // Fall through to normal session check for browser users
  }

  // All other routes require a valid session
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // No token or token was invalidated by guild/role re-check
  if (!token || token.invalidated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    // Append callbackUrl so user lands back here after re-login
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/ppk and /api/admin/players (pay) are accessible to OWNER and ADMIN
  const isAdminAllowed =
    pathname.startsWith("/admin/ppk") ||
    pathname.startsWith("/api/admin/ppk") ||
    pathname.startsWith("/api/admin/players");
  if (isAdminAllowed) {
    if (token.role !== "OWNER" && token.role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // All other /admin/* routes require OWNER role
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (token.role !== "OWNER") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
