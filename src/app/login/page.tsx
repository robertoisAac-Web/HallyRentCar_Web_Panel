
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    console.error("Auth error:", error?.message);
    redirect("/login?error=1");
  }

  redirect("/admin/dashboard");
}

async function sendPasswordReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/login?reset=missing");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Password reset error:", error.message);
    redirect("/login?reset=error");
  }

  redirect("/login?reset=sent");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    reset?: string;
  }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between bg-brand-dark p-8 text-white md:p-12">
        <Link href="/" className="inline-block self-start">
          <img
            src="/logo.png"
            alt="HallyRentCar"
            className="h-9 w-auto"
          />
        </Link>

        <div className="py-12">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Reservas, flota y cobros de tu rent a car en un solo lugar.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Consulta la disponibilidad de cada vehículo y registra los
            alquileres sin errores de fechas.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>
            HallyRentCar &copy; {new Date().getFullYear()} · Panel de Gestión
          </span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f8fafc] p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center md:hidden">
            <img
              src="/logo-dark.png"
              alt="HallyRentCar"
              className="h-8 w-auto"
            />
          </div>

          <h2 className="mb-1 page-title tracking-tight">
            Iniciar sesión
          </h2>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Entra con tu correo y contraseña.
          </p>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              Correo o contraseña incorrectos.
            </p>
          )}

          {reset === "sent" && (
            <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Si el correo está registrado, recibirás instrucciones para
              restablecer tu contraseña.
            </p>
          )}

          {reset === "error" && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              No se pudo enviar el correo. Inténtalo nuevamente.
            </p>
          )}

          {reset === "missing" && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Introduce tu correo electrónico.
            </p>
          )}

          <form action={signIn} className="space-y-4">
            <label className="block">
              Correo
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
              />
            </label>

            <label className="block">
              Contraseña
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </label>

            <button className="btn btn-primary w-full justify-center">
              Entrar al panel
            </button>
          </form>

          <form action={sendPasswordReset} className="mt-4">
            <label className="mb-2 block text-sm">
              Para recuperar tu contraseña, escribe tu correo aquí:
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                className="input mt-2"
              />
            </label>

            <button
              type="submit"
              className="w-full text-sm font-medium text-blue-700 hover:underline"
            >
              Enviarme un enlace para restablecerla
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
