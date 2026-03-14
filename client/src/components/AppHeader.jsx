import logoIcon from "../assets/logo-icon.png";

export function AppHeader() {
  return (
    <header className="panel border border-white/70 bg-white/95 px-5 py-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.28)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/70">
            <img src={logoIcon} alt="Miami Creative Lab" className="h-9 w-9 object-contain" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-700/90">Miami Creative Lab</p>
            <h1 className="truncate text-lg font-semibold text-ink md:text-xl">Sistema interno del estudio</h1>
          </div>
        </div>

        <div className="hidden text-right md:block">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Creative Dashboard</p>
          <p className="mt-1 text-sm text-slate-500">Cotizaciones, producción y facturación en un solo lugar</p>
        </div>
      </div>
    </header>
  );
}
