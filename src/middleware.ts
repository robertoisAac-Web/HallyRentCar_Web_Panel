import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // Capturamos tanto el usuario como el error de autenticación
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // Imprime esto en los logs de tu terminal (o Vercel Logs)
  console.log("--- MIDDLEWARE DEBUG ---");
  console.log("Path:", req.nextUrl.pathname);
  console.log("User:", user?.email || "No user found");
  console.log("Auth Error:", error?.message || "None");
  console.log("Cookies recibidas:", req.cookies.getAll().map(c => c.name));

  if (!user && req.nextUrl.pathname.startsWith("/admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/admin/:path*"] };