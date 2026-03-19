import { useEffect, useMemo, useState } from "react";
import { api, getClientsDataSource, getCurrentSession, getQuotesDataSource, getStudioSettingsSource, hasSupabaseConfig, signInWithPassword, signOut, subscribeToAuthChanges } from "./api";
import { Layout } from "./components/Layout";
import { StatCard } from "./components/StatCard";
import { SectionHeader } from "./components/SectionHeader";
import { ClientForm } from "./components/ClientForm";
import { ServiceForm } from "./components/ServiceForm";
import { QuoteBuilder } from "./components/QuoteBuilder";
import { PaymentQrCard } from "./components/PaymentQrCard";
import { SettingsForm } from "./components/SettingsForm";
import { EditorialQuoteCalculator } from "./components/EditorialQuoteCalculator";
import { ProductionCalculator } from "./components/ProductionCalculator";
import { LoginScreen } from "./components/LoginScreen";
import { exportQuotePdf } from "./utils/pdf";
import { createInvoiceEmailLink, exportInvoicePdf } from "./utils/invoicePdf";
import {
  formatCurrency,
  getServiceBasePrice,
  getServiceOptions,
  getServiceUnit,
  INVOICE_STATUSES,
  SERVICE_OPTION_LABELS
} from "./utils/calculations";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("es-US") : "-";
}

function sumTotals(items) {
  return items.reduce((sum, item) => sum + Number(item.totals?.total || 0), 0);
}

function isSameMonth(value, referenceDate = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear();
}

function normalizeAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function buildRecentActivity(data) {
  const quoteItems = data.quotes.map((quote) => ({
    id: `quote-${quote.id}`,
    type: "CotizaciÃƒÂ³n",
    title: quote.quoteNumber || "CotizaciÃƒÂ³n",
    subtitle: quote.clientSnapshot?.businessName || quote.clientSnapshot?.name || quote.clientName || "Sin cliente",
    amount: normalizeAmount(quote.totals?.total),
    date: quote.updatedAt || quote.createdAt || quote.date
  }));

  const invoiceItems = data.invoices.map((invoice) => ({
    id: invoice.uiInvoiceId || `invoice-ui-${invoice.dbId || invoice.id}`,
    type: "Factura",
    title: invoice.invoiceNumber || "Factura",
    subtitle: invoice.clientSnapshot?.businessName || invoice.clientSnapshot?.name || "Sin cliente",
    amount: normalizeAmount(invoice.totals?.total),
    date: invoice.updatedAt || invoice.issueDate || invoice.createdAt
  }));

  const paymentItems = data.payments.map((payment) => ({
    id: `payment-${payment.id}`,
    type: "Pago",
    title: payment.method || "Pago registrado",
    subtitle: payment.status || "completed",
    amount: normalizeAmount(payment.amount),
    date: payment.paidAt || payment.createdAt
  }));

  return [...quoteItems, ...invoiceItems, ...paymentItems]
    .filter((item) => item.date)
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 8);
}

function calculateStatistics(data) {
  const now = new Date();
  const quotesThisMonth = data.quotes.filter((quote) => isSameMonth(quote.date || quote.createdAt, now));
  const invoicesThisMonth = data.invoices.filter((invoice) => isSameMonth(invoice.issueDate || invoice.createdAt, now));
  const newClientsThisMonth = data.clients.filter((client) => isSameMonth(client.createdAt || client.updatedAt, now));
  const approvedQuotes = data.quotes.filter((quote) => quote.status === "approved");
  const totalQuotedThisMonth = quotesThisMonth.reduce((sum, quote) => sum + normalizeAmount(quote.totals?.total), 0);
  const totalInvoicedThisMonth = invoicesThisMonth.reduce((sum, invoice) => sum + normalizeAmount(invoice.totals?.total), 0);
  const pendingToCollect = data.invoices
    .filter((invoice) => !["paid", "completed"].includes(invoice.status))
    .reduce((sum, invoice) => sum + normalizeAmount(invoice.totals?.total), 0);
  const approvalRate = data.quotes.length > 0 ? approvedQuotes.length / data.quotes.length : 0;
  const averageQuoteValue = data.quotes.length > 0 ? sumTotals(data.quotes) / data.quotes.length : 0;
  const topQuotedServices = Object.values(
    data.quotes.reduce((accumulator, quote) => {
      quote.items?.forEach((item) => {
        const key = item.serviceName || "Servicio sin nombre";
        if (!accumulator[key]) {
          accumulator[key] = { name: key, count: 0, total: 0 };
        }
        accumulator[key].count += Number(item.quantity || 1);
        accumulator[key].total += normalizeAmount(item.total);
      });
      return accumulator;
    }, {})
  )
    .sort((left, right) => right.count - left.count || right.total - left.total)
    .slice(0, 5);

  return {
    totalQuotedThisMonth,
    totalInvoicedThisMonth,
    pendingToCollect,
    newClientsThisMonth: newClientsThisMonth.length,
    quotesCreatedThisMonth: quotesThisMonth.length,
    approvedQuotes: approvedQuotes.length,
    approvalRate,
    averageQuoteValue,
    topQuotedServices,
    recentActivity: buildRecentActivity(data)
  };
}

function Dashboard({ data }) {
  const stats = useMemo(() => calculateStatistics(data), [data]);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Resumen"
        title="Panel principal"
        description="Consulta el estado general del estudio y entra a estadÃƒÂ­sticas cuando quieras revisar nÃƒÂºmeros con mÃƒÂ¡s detalle."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={String(data.clients.length)} hint="Base activa de clientes del estudio." />
        <StatCard label="Servicios" value={String(data.services.length)} hint="CatÃƒÂ¡logo disponible para cotizar." />
        <StatCard label="Cotizaciones activas" value={String(data.quotes.filter((quote) => quote.status !== "archived").length)} hint="Propuestas visibles en el flujo principal." />
        <StatCard label="Pendiente por cobrar" value={formatCurrency(stats.pendingToCollect, data.settings.currency)} hint="Saldo actual pendiente de cobro." />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Radar del mes</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-sand px-4 py-4 text-sm">
              <p className="text-slate-500">Cotizado este mes</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(stats.totalQuotedThisMonth, data.settings.currency)}</p>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4 text-sm">
              <p className="text-slate-500">Facturado este mes</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(stats.totalInvoicedThisMonth, data.settings.currency)}</p>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4 text-sm">
              <p className="text-slate-500">Clientes nuevos</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{stats.newClientsThisMonth}</p>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4 text-sm">
              <p className="text-slate-500">AprobaciÃƒÂ³n</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{Math.round(stats.approvalRate * 100)}%</p>
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Actividad reciente</h3>
          <div className="mt-4 space-y-3">
            {stats.recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-ink">{activity.title}</span>
                  <span className="text-slate-500">{formatCurrency(activity.amount, data.settings.currency)}</span>
                </div>
                <p className="mt-1 text-slate-500">{activity.type} Ã‚Â· {activity.subtitle} Ã‚Â· {formatDate(activity.date)}</p>
              </div>
            ))}
            {stats.recentActivity.length === 0 ? <p className="text-sm text-slate-500">AÃƒÂºn no hay actividad reciente registrada.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatisticsSection({ data }) {
  const stats = useMemo(() => calculateStatistics(data), [data]);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="AnalÃƒÂ­tica"
        title="EstadÃƒÂ­sticas"
        description="Revisa mÃƒÂ©tricas de cotizaciones, facturaciÃƒÂ³n, cobros y servicios mÃƒÂ¡s solicitados del estudio."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cotizado este mes" value={formatCurrency(stats.totalQuotedThisMonth, data.settings.currency)} hint={`${stats.quotesCreatedThisMonth} cotizaciones creadas este mes.`} />
        <StatCard label="Facturado este mes" value={formatCurrency(stats.totalInvoicedThisMonth, data.settings.currency)} hint="Solo facturas emitidas en el mes actual." />
        <StatCard label="Pendiente por cobrar" value={formatCurrency(stats.pendingToCollect, data.settings.currency)} hint="Facturas aÃƒÂºn no marcadas como pagadas." />
        <StatCard label="Clientes nuevos" value={String(stats.newClientsThisMonth)} hint="Altas creadas durante el mes actual." />
        <StatCard label="Cotizaciones del mes" value={String(stats.quotesCreatedThisMonth)} hint="Nuevas propuestas emitidas este mes." />
        <StatCard label="Cotizaciones aprobadas" value={String(stats.approvedQuotes)} hint="Propuestas con estado aprobado." />
        <StatCard label="Tasa de aprobaciÃƒÂ³n" value={`${Math.round(stats.approvalRate * 100)}%`} hint="Aprobadas / total de cotizaciones." />
        <StatCard label="Valor promedio" value={formatCurrency(stats.averageQuoteValue, data.settings.currency)} hint="Promedio por cotizaciÃƒÂ³n guardada." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Servicios mÃƒÂ¡s cotizados</h3>
          <div className="mt-4 space-y-3">
            {stats.topQuotedServices.map((service) => (
              <div key={service.name} className="rounded-2xl border border-slate-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-ink">{service.name}</span>
                  <span className="text-slate-500">{service.count} usos</span>
                </div>
                <p className="mt-1 text-slate-500">Total cotizado: {formatCurrency(service.total, data.settings.currency)}</p>
              </div>
            ))}
            {stats.topQuotedServices.length === 0 ? <p className="text-sm text-slate-500">AÃƒÂºn no hay suficientes cotizaciones para detectar servicios destacados.</p> : null}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Actividad reciente</h3>
          <div className="mt-4 space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-ink">{activity.title}</span>
                  <span className="text-slate-500">{formatCurrency(activity.amount, data.settings.currency)}</span>
                </div>
                <p className="mt-1 text-slate-500">{activity.type} Ã‚Â· {activity.subtitle} Ã‚Â· {formatDate(activity.date)}</p>
              </div>
            ))}
            {stats.recentActivity.length === 0 ? <p className="text-sm text-slate-500">AÃƒÂºn no hay actividad reciente registrada.</p> : null}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Seguimiento por cliente</h3>
          <div className="mt-4 space-y-3">
            {data.clients.slice(0, 6).map((client) => {
              const clientInvoices = data.invoices.filter((invoice) => invoice.clientId === client.id);
              const total = clientInvoices.reduce((sum, invoice) => sum + Number(invoice.totals.total || 0), 0);
              const latest = clientInvoices[0]?.issueDate || client.updatedAt;

              return (
                <div key={client.id} className="rounded-2xl bg-sand px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-ink">{client.businessName || client.name}</span>
                    <span>{formatCurrency(total, data.settings.currency)}</span>
                  </div>
                  <p className="mt-1 text-slate-500">ÃƒÅ¡ltimo trabajo: {formatDate(latest)}</p>
                </div>
              );
            })}
            {data.clients.length === 0 ? <p className="text-sm text-slate-500">TodavÃƒÂ­a no hay clientes registrados.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
function ClientsSection({ clients, onSaveClient, onDeleteClient, dataSource }) {
  const [editingClient, setEditingClient] = useState(null);
  const [draftResetToken, setDraftResetToken] = useState(0);
  const [clientError, setClientError] = useState("");

  console.log("CLIENTS PAGE RENDER", {
    dataSource,
    totalClients: Array.isArray(clients) ? clients.length : 0
  });

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Clientes"
        description="Guarda los datos esenciales y reutiliza la informaciÃƒÂ³n en futuras cotizaciones e invoices."
      />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-ink">Data Source:</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dataSource === "Supabase" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{dataSource}</span>
      </div>

      {clientError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{clientError}</div> : null}

      <ClientForm
        editingClient={editingClient}
        draftResetToken={draftResetToken}
        onCancel={() => {
          setClientError("");
          setEditingClient(null);
        }}
        onSubmit={async (payload) => {
          try {
            setClientError("");
            await onSaveClient(editingClient, payload);
            if (!editingClient) {
              setDraftResetToken(Date.now());
            }
            setEditingClient(null);
          } catch (error) {
            setClientError(error.message || "No se pudo guardar el cliente.");
          }
        }}
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Negocio</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">TelÃƒÂ©fono</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-ink">{client.name}</td>
                  <td className="px-4 py-3">{client.businessName}</td>
                  <td className="px-4 py-3">{client.email}</td>
                  <td className="px-4 py-3">{client.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2"><button className="button-secondary" type="button" onClick={() => setEditingClient(client)}>Editar</button><button className="button-secondary" type="button" onClick={() => onDeleteClient(client.id)}>Eliminar</button></div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                    AÃƒÂºn no hay clientes guardados. Puedes crear uno desde el formulario superior.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ServicesSection({ services, onSaveService, onDeleteService }) {
  const [editingService, setEditingService] = useState(null);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="CatÃƒÂ¡logo"
        title="Servicios"
        description="CatÃƒÂ¡logo profesional para un estudio pequeÃƒÂ±o, con opciones configurables por servicio."
      />

      <ServiceForm
        editingService={editingService}
        onCancel={() => setEditingService(null)}
        onSubmit={(payload) => {
          onSaveService(editingService, payload);
          setEditingService(null);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <div key={service.id} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-coral">{service.category}</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">{service.name}</h3>
                <p className="mt-2 text-sm text-slate-500">Unidad: {getServiceUnit(service)}</p>
              </div>
              <div className="rounded-2xl bg-sand px-4 py-3 text-right">
                <p className="text-sm text-slate-500">Base</p>
                <p className="text-lg font-semibold text-ink">{formatCurrency(getServiceBasePrice(service))}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              {getServiceOptions(service).length > 0 ? (
                getServiceOptions(service).map((option) => (
                  <span key={option} className="rounded-full bg-mist px-3 py-2">
                    {SERVICE_OPTION_LABELS[option] || option}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-mist px-3 py-2">Sin extras</span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="button-secondary" type="button" onClick={() => setEditingService(service)}>
                Editar
              </button>
              <button className="button-secondary" type="button" onClick={() => onDeleteService(service.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorialSection({ settings, onSaveQuote }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Editorial"
        title="Calculador Editorial"
        description="Cotiza libros para autores independientes con maquetaciÃƒÂ³n, portada, ebook, Amazon KDP e impresiÃƒÂ³n con margen."
      />
      <EditorialQuoteCalculator settings={settings} onSaveQuote={onSaveQuote} />
    </div>
  );
}

function ProductionSection({ settings, onSaveQuote }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="ProducciÃƒÂ³n"
        title="Margen de ImpresiÃƒÂ³n"
        description="Calcula precio final, margen y ganancia de productos impresos o promocionales producidos por terceros."
      />
      <ProductionCalculator settings={settings} onSaveQuote={onSaveQuote} />
    </div>
  );
}

function QuotesSection({
  data,
  editingQuote,
  onEditQuote,
  onCancelEdit,
  onSaveQuote,
  onSelectQuote,
  onConvertQuote,
  onDeleteQuote,
  onDuplicateQuote,
  onArchiveQuote,
  quoteFeedback,
  quotesSource
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleQuotes = data.quotes.filter((quote) => (showArchived ? quote.status === "archived" : quote.status !== "archived"));

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Cotizaciones"
        title="Constructor de cotizaciones"
        description="Selecciona el cliente, agrega servicios, ajusta recargos y genera una propuesta lista para enviar."
      />

      {quoteFeedback?.message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${quoteFeedback.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : quoteFeedback.type === "warning" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
          {quoteFeedback.message}
        </div>
      ) : null}

      <QuoteBuilder
        clients={data.clients}
        services={data.services}
        settings={data.settings}
        activeQuote={editingQuote}
        onSaveQuote={onSaveQuote}
        onCancelEdit={onCancelEdit}
        onExportPdf={(quote) => exportQuotePdf({ ...quote, quoteNumber: quote.quoteNumber || "PREVIEW" }, data.settings)}
      />

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">{showArchived ? "Cotizaciones archivadas" : "Cotizaciones activas"}</p>
            <p className="text-xs text-slate-500">{showArchived ? "Revisa propuestas archivadas y mantenlas fuera de la lista principal." : "Administra propuestas vigentes sin mezclar pruebas o cotizaciones cerradas."}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quotesSource === "Supabase" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              Data Source: {quotesSource}
            </span>
            <button className="button-secondary" type="button" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "Ver activas" : "Ver archivadas"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand text-slate-500">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.map((quote) => (
                <tr key={quote.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-ink">{quote.quoteNumber}</td>
                  <td className="px-4 py-3">{quote.clientSnapshot?.businessName || quote.clientSnapshot?.name}</td>
                  <td className="px-4 py-3">{quote.date}</td>
                  <td className="px-4 py-3">{formatCurrency(quote.totals.total, data.settings.currency)}</td>
                  <td className="px-4 py-3 capitalize">{quote.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="button-secondary" type="button" onClick={() => onEditQuote(quote)}>
                        Editar
                      </button>
                      <button className="button-secondary" type="button" onClick={() => onSelectQuote(quote)}>
                        Ver PDF
                      </button>
                      <button className="button-secondary" type="button" onClick={() => onConvertQuote(quote)}>
                        Convertir
                      </button>
                      <button className="button-secondary" type="button" onClick={() => onDuplicateQuote(quote)}>
                        Duplicar
                      </button>
                      {quote.status !== "archived" ? (
                        <button className="button-secondary" type="button" onClick={() => onArchiveQuote(quote)}>
                          Archivar
                        </button>
                      ) : null}
                      <button className="button-secondary" type="button" onClick={() => onDeleteQuote(quote)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleQuotes.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                    {showArchived ? "No hay cotizaciones archivadas." : "No hay cotizaciones activas guardadas."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getInvoiceUiId(invoice) {
  return invoice?.uiInvoiceId || `invoice-ui-${invoice?.dbId || invoice?.id || "unknown"}`;
}

function getInvoiceDbId(invoice) {
  return invoice?.dbId || invoice?.id || null;
}

function InvoicesSection({ data, onUpdateInvoice, onDeleteInvoice }) {
  const [selectedInvoiceUiId, setSelectedInvoiceUiId] = useState(getInvoiceUiId(data.invoices[0]));
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const selectedInvoice = data.invoices.find((invoice) => getInvoiceUiId(invoice) === selectedInvoiceUiId) || data.invoices[0];

  function openInvoiceEmailDraft(invoice) {
    window.location.href = createInvoiceEmailLink(invoice, data.settings);
  }

  useEffect(() => {
    const selectedStillExists = data.invoices.some((invoice) => getInvoiceUiId(invoice) === selectedInvoiceUiId);
    if (!selectedStillExists) {
      setSelectedInvoiceUiId(data.invoices[0] ? getInvoiceUiId(data.invoices[0]) : "");
    }
  }, [data.invoices, selectedInvoiceUiId]);

  async function handleDelete(invoice) {
    const dbInvoiceId = getInvoiceDbId(invoice);
    const shouldDelete = window.confirm("Â¿Seguro que deseas eliminar esta factura?");
    if (!shouldDelete || !dbInvoiceId) {
      return;
    }

    try {
      setInvoiceError("");
      setInvoiceLoading(true);
      if (getInvoiceUiId(invoice) === selectedInvoiceUiId) {
        setSelectedInvoiceUiId("");
      }
      await onDeleteInvoice(dbInvoiceId);
    } catch (error) {
      setInvoiceError(error?.message || "No se pudo eliminar la factura.");
      setSelectedInvoiceUiId(getInvoiceUiId(invoice));
    } finally {
      setInvoiceLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="FacturaciÃ³n"
        title="Facturas"
        description="Convierte cotizaciones aprobadas, actualiza estados de pago y comparte cobro por PayPal con QR."
      />

      {invoiceError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{invoiceError}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-sand text-slate-500">
                <tr>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr
                    key={getInvoiceUiId(invoice)}
                    className={`border-t border-slate-100 ${getInvoiceUiId(selectedInvoice) === getInvoiceUiId(invoice) ? "bg-mist/70" : ""}`}
                  >
                    <td className="cursor-pointer px-4 py-3 font-semibold text-ink" onClick={() => setSelectedInvoiceUiId(getInvoiceUiId(invoice))}>{invoice.invoiceNumber}</td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => setSelectedInvoiceUiId(getInvoiceUiId(invoice))}>{invoice.clientSnapshot?.businessName || invoice.clientSnapshot?.name}</td>
                    <td className="cursor-pointer px-4 py-3 capitalize" onClick={() => setSelectedInvoiceUiId(getInvoiceUiId(invoice))}>{invoice.status}</td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => setSelectedInvoiceUiId(getInvoiceUiId(invoice))}>{formatCurrency(invoice.totals.total, data.settings.currency)}</td>
                    <td className="px-4 py-3">
                      <button className="button-secondary" type="button" disabled={invoiceLoading} onClick={() => handleDelete(invoice)}>
                        {invoiceLoading && getInvoiceUiId(invoice) === selectedInvoiceUiId ? "Eliminando..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {data.invoices.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                      AÃºn no hay facturas guardadas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {selectedInvoice ? (
          <div className="space-y-4">
            <form
              className="panel grid gap-4 p-6 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                try {
                  setInvoiceError("");
                  setInvoiceLoading(true);
                  await onUpdateInvoice(getInvoiceDbId(selectedInvoice), {
                    status: formData.get("status"),
                    paymentMethod: formData.get("paymentMethod"),
                    paypalLink: formData.get("paypalLink"),
                    notes: formData.get("notes")
                  });
                } catch (error) {
                  setInvoiceError(error?.message || "No se pudo guardar la factura.");
                } finally {
                  setInvoiceLoading(false);
                }
              }}
            >
              <div>
                <label className="label">Factura</label>
                <input className="input" value={selectedInvoice.invoiceNumber} disabled />
              </div>
              <div>
                <label className="label">Cliente</label>
                <input
                  className="input"
                  value={selectedInvoice.clientSnapshot?.businessName || selectedInvoice.clientSnapshot?.name || ""}
                  disabled
                />
              </div>
              <div>
                <label className="label">Estado</label>
                <select name="status" className="input" defaultValue={selectedInvoice.status}>
                  {INVOICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">MÃ©todo de pago</label>
                <input name="paymentMethod" className="input" defaultValue={selectedInvoice.paymentMethod || "PayPal"} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Enlace de PayPal</label>
                <input name="paypalLink" className="input" defaultValue={selectedInvoice.paypalLink || data.settings.paypalLink || ""} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Notas</label>
                <textarea name="notes" className="input min-h-24" defaultValue={selectedInvoice.notes || ""} />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button className="button-primary" type="submit" disabled={invoiceLoading}>
                  {invoiceLoading ? "Guardando..." : "Guardar factura"}
                </button>
                <button className="button-secondary" type="button" onClick={() => exportInvoicePdf(selectedInvoice, data.settings)} disabled={invoiceLoading}>
                  Descargar factura PDF
                </button>
                <button className="button-secondary" type="button" onClick={() => openInvoiceEmailDraft(selectedInvoice)} disabled={invoiceLoading}>
                  Preparar email
                </button>
                <button className="button-secondary" type="button" onClick={() => handleDelete(selectedInvoice)} disabled={invoiceLoading}>
                  {invoiceLoading ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </form>

            <PaymentQrCard link={selectedInvoice.paypalLink || data.settings.paypalLink} title="QR para cobrar por PayPal" />
          </div>
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Convierte una cotizaciÃ³n en factura para verla aquÃ­.</div>
        )}
      </div>
    </div>
  );
}

function PaymentsSection({ data }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Seguimiento"
        title="Historial de pagos"
        description="Visualiza quÃƒÂ© se ha cobrado, cuÃƒÂ¡nto y a quÃƒÂ© cliente corresponde cada pago registrado."
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">MÃƒÂ©todo</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => {
                const invoice = data.invoices.find((entry) => getInvoiceDbId(entry) === payment.invoiceId || entry.id === payment.invoiceId);
                const client = data.clients.find((entry) => entry.id === (payment.clientId || invoice?.clientId));
                return (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                    <td className="px-4 py-3">{invoice?.invoiceNumber || "-"}</td>
                    <td className="px-4 py-3">{client?.businessName || client?.name || "-"}</td>
                    <td className="px-4 py-3">{payment.method}</td>
                    <td className="px-4 py-3">{formatCurrency(payment.amount, data.settings.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.payments.length === 0 ? <p className="p-6 text-sm text-slate-500">AÃƒÂºn no hay pagos registrados.</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [editingQuote, setEditingQuote] = useState(null);
  const [data, setData] = useState({ settings: null, clients: [], services: [], quotes: [], invoices: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsSource, setSettingsSource] = useState("LocalStorage");
  const [clientsSource, setClientsSource] = useState("LocalStorage Fallback");
  const [quotesSource, setQuotesSource] = useState("LocalStorage Fallback");
  const [quoteFeedback, setQuoteFeedback] = useState({ type: "", message: "" });
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig);
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  async function loadApp() {
    try {
      setLoading(true);
      setError("");
      setData(await api.bootstrap());
      setSettingsSource(getStudioSettingsSource());
      setClientsSource(getClientsDataSource());
      setQuotesSource(getQuotesDataSource());
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthLoading(false);
      loadApp();
      return () => {};
    }

    let isActive = true;

    const unsubscribe = subscribeToAuthChanges(async (nextSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      setAuthLoading(false);
      setAuthError("");

      if (nextSession) {
        await loadApp();
      } else {
        setData({ settings: null, clients: [], services: [], quotes: [], invoices: [], payments: [] });
        setLoading(false);
      }
    });

    getCurrentSession()
      .then(async (currentSession) => {
        if (!isActive) {
          return;
        }

        setSession(currentSession);
        setAuthLoading(false);

        if (currentSession) {
          await loadApp();
        } else {
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!isActive) {
          return;
        }

        setAuthError(nextError.message);
        setAuthLoading(false);
        setLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  async function handleSaveClient(editingClient, payload) {
    await (editingClient ? api.updateClient(editingClient.id, payload) : api.createClient(payload));
    await loadApp();
  }

  async function handleDeleteClient(id) {
    await api.deleteClient(id);
    await loadApp();
  }

  async function handleSaveService(editingService, payload) {
    await (editingService ? api.updateService(editingService.id, payload) : api.createService(payload));
    await loadApp();
  }

  async function handleDeleteService(id) {
    await api.deleteService(id);
    await loadApp();
  }

  async function handleSaveQuote(quote) {
    try {
      setQuoteFeedback({ type: "", message: "" });

      const savedQuote = quote.id
        ? await api.updateQuote(quote.id, quote)
        : await api.createQuote({ ...quote, status: "draft" });

      if (!savedQuote?.id) {
        throw new Error("Error al guardar cotizaciÃƒÂ³n");
      }

      setEditingQuote(null);
      await loadApp();
      setQuoteFeedback(
        savedQuote?.syncWarning
          ? { type: "warning", message: savedQuote.syncWarning }
          : { type: "success", message: "CotizaciÃƒÂ³n guardada correctamente" }
      );
      setActiveSection("quotes");
      return savedQuote;
    } catch (nextError) {
      const message = nextError?.message || "Error al guardar cotizaciÃƒÂ³n";
      setQuoteFeedback({ type: "error", message });
      throw nextError;
    }
  }

  async function handleConvertQuote(quote) {
    await api.convertQuoteToInvoice(quote.id, { paypalLink: data.settings.paypalLink });
    setEditingQuote(null);
    await loadApp();
    setActiveSection("invoices");
  }

  async function handleDuplicateQuote(quote) {
    const duplicatedQuote = {
      ...quote,
      id: undefined,
      quoteNumber: undefined,
      status: "draft",
      createdAt: undefined,
      updatedAt: undefined,
      archivedAt: null,
      duplicatedFromId: quote.id
    };

    await api.createQuote(duplicatedQuote);
    setEditingQuote(null);
    await loadApp();
    setActiveSection("quotes");
  }

  async function handleArchiveQuote(quote) {
    await api.updateQuote(quote.id, {
      ...quote,
      status: "archived",
      archivedAt: new Date().toISOString()
    });
    if (editingQuote?.id === quote.id) {
      setEditingQuote(null);
    }
    await loadApp();
    setActiveSection("quotes");
  }

  async function handleDeleteQuote(quote) {
    const shouldDelete = window.confirm("Ã‚Â¿Seguro que deseas eliminar esta cotizaciÃƒÂ³n?");
    if (!shouldDelete) {
      return;
    }

    await api.deleteQuote(quote.id);
    if (editingQuote?.id === quote.id) {
      setEditingQuote(null);
    }
    await loadApp();
    setActiveSection("quotes");
  }

  async function handleUpdateInvoice(invoiceId, payload) {
    await api.updateInvoice(invoiceId, payload);
    await loadApp();
  }

  async function handleDeleteInvoice(invoiceId) {
    await api.deleteInvoice(invoiceId);
    await loadApp();
  }

  async function handleUpdateSettings(payload) {
    await api.updateSettings(payload);
    setSettingsSource(getStudioSettingsSource());
      setClientsSource(getClientsDataSource());
    await loadApp();
  }

  async function handleLogin(credentials) {
    try {
      setAuthSubmitting(true);
      setAuthError("");
      await signInWithPassword(credentials);
    } catch (nextError) {
      setAuthError(nextError.message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (nextError) {
      setAuthError(nextError.message);
    }
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center text-lg text-slate-500">Verificando acceso seguro...</div>;
  }

  if (hasSupabaseConfig && !session) {
    return <LoginScreen onSubmit={handleLogin} loading={authSubmitting} error={authError} />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg text-slate-500">Cargando dashboard...</div>;
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-lg text-coral">{error}</div>;
  }

  return (
    <Layout activeSection={activeSection} setActiveSection={setActiveSection} userEmail={session?.user?.email} onSignOut={hasSupabaseConfig ? handleSignOut : null}>
      {data.settings ? (
        <>
          {activeSection === "dashboard" ? <Dashboard data={data} /> : null}
          {activeSection === "statistics" ? <StatisticsSection data={data} /> : null}
          {activeSection === "clients" ? <ClientsSection clients={data.clients} onSaveClient={handleSaveClient} onDeleteClient={handleDeleteClient} dataSource={clientsSource} /> : null}
          {activeSection === "services" ? (
            <ServicesSection services={data.services} onSaveService={handleSaveService} onDeleteService={handleDeleteService} />
          ) : null}
          {activeSection === "editorial" ? <EditorialSection settings={data.settings} onSaveQuote={handleSaveQuote} /> : null}
          {activeSection === "production" ? <ProductionSection settings={data.settings} onSaveQuote={handleSaveQuote} /> : null}
          {activeSection === "quotes" ? (
            <QuotesSection
              data={data}
              editingQuote={editingQuote}
              onEditQuote={(quote) => setEditingQuote(quote)}
              onCancelEdit={() => setEditingQuote(null)}
              onSaveQuote={handleSaveQuote}
              onSelectQuote={(quote) => exportQuotePdf(quote, data.settings)}
              onConvertQuote={handleConvertQuote}
              onDuplicateQuote={handleDuplicateQuote}
              onArchiveQuote={handleArchiveQuote}
              onDeleteQuote={handleDeleteQuote}
              quoteFeedback={quoteFeedback}
              quotesSource={quotesSource}
            />
          ) : null}
          {activeSection === "invoices" ? <InvoicesSection data={data} onUpdateInvoice={handleUpdateInvoice} onDeleteInvoice={handleDeleteInvoice} /> : null}
          {activeSection === "payments" ? <PaymentsSection data={data} /> : null}
          {activeSection === "settings" ? (
            <div className="space-y-4">
              <SectionHeader
                eyebrow="Negocio"
                title="ConfiguraciÃƒÂ³n"
                description="Ajusta datos del estudio, reglas de cÃƒÂ¡lculo y textos base para cotizaciones y facturas."
              />
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
                <span className="font-medium text-ink">Data Source:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settingsSource === "Supabase" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{settingsSource}</span>
              </div>
              <SettingsForm settings={data.settings} onSubmit={handleUpdateSettings} />
              <div className="panel p-6 text-sm text-slate-600">
                <p className="font-semibold text-ink">Estructura futura preparada</p>
                <p className="mt-2">
                  El proyecto ya estÃƒÂ¡ separado para agregar despuÃƒÂ©s integraciÃƒÂ³n real con PayPal API, membresÃƒÂ­as,
                  firmas, envÃƒÂ­os por email y PDFs mÃƒÂ¡s premium sin reescribir la base.
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Layout>
  );
}














