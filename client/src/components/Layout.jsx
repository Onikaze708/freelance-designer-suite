import { AppHeader } from "./AppHeader";

const sections = [
  { key: "dashboard", label: "Panel principal" },
  { key: "statistics", label: "Estadísticas" },
  { key: "clients", label: "Clientes" },
  { key: "services", label: "Servicios" },
  { key: "editorial", label: "Calculador Editorial" },
  { key: "production", label: "Margen de Impresión" },
  { key: "quotes", label: "Cotizaciones" },
  { key: "invoices", label: "Facturas" },
  { key: "payments", label: "Pagos" },
  { key: "settings", label: "Configuración" }
];

export function Layout({ activeSection, setActiveSection, children, userEmail, onSignOut }) {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <AppHeader userEmail={userEmail} onSignOut={onSignOut} />

        <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
          <aside className="panel overflow-hidden lg:sticky lg:top-4">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white">
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Miami Creative Lab</p>
              <h2 className="mt-3 text-2xl font-semibold">Flujo del estudio</h2>
              <p className="mt-3 text-sm text-slate-300">
                Organiza clientes, servicios, cotizaciones y producción desde un dashboard claro y profesional.
              </p>
            </div>

            <nav className="flex flex-col gap-2 p-4">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === section.key
                      ? "bg-emerald-600 text-white shadow-[0_16px_30px_-20px_rgba(5,150,105,0.95)]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="space-y-4 pb-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
