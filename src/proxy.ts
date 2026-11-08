import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/portal/login"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // strip locale prefix
  const stripped = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
  const isPublic = PUBLIC.some((p) => stripped === p || stripped.startsWith(p + "/"));

  if (!isPublic) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      // Behind Railway TLS ends at the edge, so trust which cookie the browser actually sent.
      secureCookie: req.cookies.getAll().some((c) => c.name.startsWith("__Secure-authjs.session-token")),
    });
    const isPortalRoute = stripped === "/portal" || stripped.startsWith("/portal/");
    const locale = pathname.match(/^\/(ar|en)(?=\/|$)/)?.[1] ?? routing.defaultLocale;
    const wrongRealm = token && (isPortalRoute ? !token.portal : Boolean(token.portal));
    if (!token || wrongRealm) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}${isPortalRoute ? "/portal/login" : "/login"}`;
      if (!token) url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
