import { useState } from "react";
import logoIcon from "../assets/logo-icon.png";

export function LoginScreen({ onSubmit, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="panel overflow-hidden border border-white/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-8 py-10 text-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.85)] md:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10">
              <img src={logoIcon} alt="Miami Creative Lab" className="h-11 w-11 object-contain" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.34em] text-emerald-200/90">Miami Creative Lab</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white">Acceso privado al sistema interno del estudio</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
              Inicia sesión con tu cuenta del estudio para acceder a clientes, cotizaciones, facturas y configuración protegida.
            </p>
          </section>

          <section className="panel border border-white/90 bg-white/95 px-6 py-8 md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700/90">Sign in</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Bienvenido de vuelta</h2>
            <p className="mt-2 text-sm text-slate-500">Usa tu email y contraseña para abrir el dashboard.</p>

            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit({ email, password });
              }}
            >
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@miamicreativelab.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <button className="button-primary w-full" type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
