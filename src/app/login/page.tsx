import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InstallDesktopButton } from "@/components/pwa/DesktopAppManager";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  let data;
  let error;
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    data = res.data;
    error = res.error;
  } catch (err) {
    console.error("Connection error to Supabase:", err);
    redirect("/login?error=db_paused");
  }

  if (error || !data?.session) {
    const msg = (error?.message ?? "").toLowerCase();
    console.error("Auth error:", error?.message);
    if (
      msg.includes("fetch failed") ||
      msg.includes("enotfound") ||
      msg.includes("network") ||
      (error?.status && error.status >= 500)
    ) {
      redirect("/login?error=db_paused");
    }
    redirect("/login?error=1");
  }

  redirect("/admin/dashboard");
}

async function requestReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login?mode=forgot&error=missing_email");
  }

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "hallyrentcar.vercel.app";
  const proto = host.includes("localhost") ? "http" : "https";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Reset password error:", error.message);
    redirect("/login?mode=forgot&error=reset_failed");
  }

  redirect("/login?reset=sent");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; mode?: string }>;
}) {
  const { error, reset, mode } = await searchParams;
  const isForgotMode = mode === "forgot";

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between bg-brand-dark p-8 text-white md:p-12">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="HallyRentCar" className="h-9 w-auto" />
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80">
            Sistema de Gestión
          </span>
        </div>
        <div className="py-12">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Reservas, flota y cobros de tu rent a car en un solo lugar.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Consulta la disponibilidad de cada vehículo y registra los alquileres en tiempo real desde tu aplicación de escritorio.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>HallyRentCar &copy; {new Date().getFullYear()} · Panel Administrativo</span>
        </div>
      </section>

      <section className="flex items-center justify-center p-8 bg-[#f8fafc]">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center md:hidden">
            <img src="/logo-dark.png" alt="HallyRentCar" className="h-8 w-auto" />
          </div>

          {isForgotMode ? (
            <>
              <h2 className="mb-1 page-title tracking-tight">Recuperar contraseña</h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                Ingresa tu correo y te enviaremos un enlace seguro para restablecer tu acceso.
              </p>
              {error && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  No se pudo enviar el correo. Verifica la dirección e inténtalo de nuevo.
                </p>
              )}
              <form action={requestReset} className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Correo electrónico
                  <input name="email" type="email" required autoComplete="email" className="input mt-1" />
                </label>
                <button className="btn btn-primary w-full justify-center">Enviar enlace de recuperación</button>
              </form>
              <div className="mt-4 text-center">
                <Link href="/login" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                  ← Volver a iniciar sesión
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1 page-title tracking-tight">Iniciar sesión</h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">Entra con tu correo y contraseña al panel administrativo.</p>

              {error === "1" && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Correo o contraseña incorrectos.
                </p>
              )}
              {error === "db_paused" && (
                <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Base de datos en pausa o reactivándose</p>
                  <p>
                    El servidor de Supabase se pausó por inactividad o está encendiendo. Espera 1–2 minutos mientras termina de restaurarse e intenta de nuevo.
                  </p>
                </div>
              )}
              {error === "recovery" && (
                <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo.
                </p>
              )}
              {reset === "sent" && (
                <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Te hemos enviado un enlace a tu correo para restablecer la contraseña.
                </p>
              )}
              {reset === "updated" && (
                <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Contraseña actualizada correctamente. Ya puedes iniciar sesión.
                </p>
              )}

              <form action={signIn} className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Correo
                  <input name="email" type="email" required autoComplete="email" className="input mt-1" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center justify-between">
                    <span>Contraseña</span>
                    <Link href="/login?mode=forgot" className="text-xs font-normal text-slate-500 hover:text-slate-800">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </span>
                  <input name="password" type="password" required autoComplete="current-password" className="input mt-1" />
                </label>
                <button className="btn btn-primary w-full justify-center">Entrar al panel</button>
              </form>

              <InstallDesktopButton variant="login" />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
