import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF origin validation for API mutations
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("host");
      try {
        const originHost = new URL(origin).host;
        if (host && originHost !== host) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 },
        );
      }
    }
  }

  // Admin route access token gate
  if (pathname.startsWith("/admin")) {
    const accessToken = process.env.ADMIN_ACCESS_TOKEN;
    if (accessToken) {
      const cookieToken = request.cookies.get("admin-access")?.value;
      const queryToken = request.nextUrl.searchParams.get("access");

      if (cookieToken === accessToken) {
        return NextResponse.next();
      }

      if (queryToken === accessToken) {
        // Set cookie so token doesn't need to be in every URL
        const response = NextResponse.redirect(
          new URL(pathname, request.url),
        );
        response.cookies.set("admin-access", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/admin",
          maxAge: 60 * 60 * 4, // 4 hours
        });
        return response;
      }

      // Return 404 to avoid revealing the route exists
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
