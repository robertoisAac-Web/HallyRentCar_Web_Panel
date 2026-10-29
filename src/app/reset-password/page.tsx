
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(
        "No se pudo cambiar la contraseña. Solicita un enlace nuevo e inténtalo otra vez."
      );
      console.error("Password update error:", error.message);
      return;
    }

    setMessage("Contraseña actualizada correctamente.");
    router.push("/login?reset=updated");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <img
            src="/logo-dark.png"
            alt="HallyRentCar"
            className="h-10 w-auto"
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Restablecer contraseña
        </h1>

        <p className="mb-6 mt-2 text-sm text-gray-600">
          Introduce tu nueva contraseña para acceder al panel de HallyRentCar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            Nueva contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              className="input mt-2 w-full"
            />
          </label>

          <label className="block text-sm">
            Confirmar contraseña
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              className="input mt-2 w-full"
            />
          </label>

          {message && (
            <p role="status" className="rounded-lg bg-gray-100 p-3 text-sm">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center"
          >
            {loading ? "Actualizando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
