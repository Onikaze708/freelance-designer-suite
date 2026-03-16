import { useEffect, useState } from "react";
import { api, getClientsDataSource, getCurrentSession, getStudioSettingsSource, hasSupabaseConfig, signInWithPassword, signOut, subscribeToAuthChanges } from "./api";
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

function Dashboard({ data }) {
  const paidInvoices = data.invoices.filter((invoice) => invoice.status === "paid");
  const pendingInvoices = data.invoices.filter((invoice) => ["draft", "sent", "pending"].includes(invoice.status));

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Resumen"
        title="Tu estudio en orden"
        description="Consulta rápidamente cotizaciones, facturas y el estado de cobro sin perder tiempo en hojas sueltas."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={String(data.clients.length)} hint="Base reutilizable para futuras propuestas." />
        <StatCard label="Servicios" value={String(data.services.length)} hint="Catálogo profesional y editable." />
        <StatCard
          label="Cotizado"
          value={formatCurrency(sumTotals(data.quotes), data.settings.currency)}
          hint="Total acumulado en cotizaciones."
        />
        <StatCard
          label="Facturado"
          value={formatCurrency(sumTotals(data.invoices), data.settings.currency)}
          hint={`${paidInvoices.length} pagadas · ${pendingInvoices.length} pendientes`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Actividad reciente</h3>
          <div className="mt-4 space-y-3">
            {data.quotes.slice(0, 5).map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-slate-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-ink">{quote.quoteNumber}</span>
                  <span className="text-slate-500">{formatCurrency(quote.totals.total, data.settings.currency)}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {quote.clientSnapshot?.businessName || quote.clientSnapshot?.name} · {formatDate(quote.date)}
                </p>
              </div>
            ))}
            {data.quotes.length === 0 ? <p className="text-sm text-slate-500">Aún no hay cotizaciones guardadas.</p> : null}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-ink">Seguimiento por cliente</h3>
          <div className="mt-4 space-y-3">
            {data.clients.map((client) => {
              const clientInvoices = data.invoices.filter((invoice) => invoice.clientId === client.id);
              const total = clientInvoices.reduce((sum, invoice) => sum + Number(invoice.totals.total || 0), 0);
              const latest = clientInvoices[0]?.issueDate || client.updatedAt;

              return (
                <div key={client.id} className="rounded-2xl bg-sand px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-ink">{client.businessName || client.name}</span>
                    <span>{formatCurrency(total, data.settings.currency)}</span>
                  </div>
                  <p className="mt-1 text-slate-500">Último trabajo: {formatDate(latest)}</p>
                </div>
              );
            })}
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

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Clientes"
        description="Guarda los datos esenciales y reutiliza la información en futuras cotizaciones e invoices."
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
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">{showArchived ? "Cotizaciones archivadas" : "Cotizaciones activas"}</p>
            <p className="text-xs text-slate-500">{showArchived ? "Revisa propuestas archivadas y mantenlas fuera de la lista principal." : "Administra propuestas vigentes sin mezclar pruebas o cotizaciones cerradas."}</p>
          </div>
          <button className="button-secondary" type="button" onClick={() => setShowArchived((current) => !current)}>
            {showArchived ? "Ver activas" : "Ver archivadas"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Negocio</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Teléfono</th>
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

function ServicesSection({ services, onSaveService, onDeleteService }) {
  const [editingService, setEditingService] = useState(null);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Catálogo"
        title="Servicios"
        description="Catálogo profesional para un estudio pequeño, con opciones configurables por servicio."
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
        description="Cotiza libros para autores independientes con maquetación, portada, ebook, Amazon KDP e impresión con margen."
      />
      <EditorialQuoteCalculator settings={settings} onSaveQuote={onSaveQuote} />
    </div>
  );
}

function ProductionSection({ settings, onSaveQuote }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Producción"
        title="Margen de Impresión"
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
  onArchiveQuote
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
          <button className="button-secondary" type="button" onClick={() => setShowArchived((current) => !current)}>
            {showArchived ? "Ver activas" : "Ver archivadas"}
          </button>
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

function InvoicesSection({ data, onUpdateInvoice }) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(data.invoices[0]?.id || "");
  const selectedInvoice = data.invoices.find((invoice) => invoice.id === selectedInvoiceId) || data.invoices[0];

  function openInvoiceEmailDraft(invoice) {
    window.location.href = createInvoiceEmailLink(invoice, data.settings);
  }

  useEffect(() => {
    if (!selectedInvoiceId && data.invoices[0]?.id) {
      setSelectedInvoiceId(data.invoices[0].id);
    }
  }, [data.invoices, selectedInvoiceId]);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Facturación"
        title="Facturas"
        description="Convierte cotizaciones aprobadas, actualiza estados de pago y comparte cobro por PayPal con QR."
      />

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
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`cursor-pointer border-t border-slate-100 ${selectedInvoice?.id === invoice.id ? "bg-mist/70" : ""}`}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <td className="px-4 py-3 font-semibold text-ink">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">{invoice.clientSnapshot?.businessName || invoice.clientSnapshot?.name}</td>
                    <td className="px-4 py-3 capitalize">{invoice.status}</td>
                    <td className="px-4 py-3">{formatCurrency(invoice.totals.total, data.settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedInvoice ? (
          <div className="space-y-4">
            <form
              className="panel grid gap-4 p-6 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                onUpdateInvoice(selectedInvoice.id, {
                  status: formData.get("status"),
                  paymentMethod: formData.get("paymentMethod"),
                  paypalLink: formData.get("paypalLink"),
                  notes: formData.get("notes")
                });
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
                <label className="label">Método de pago</label>
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
                <button className="button-primary" type="submit">
                  Guardar factura
                </button>
                <button className="button-secondary" type="button" onClick={() => exportInvoicePdf(selectedInvoice, data.settings)}>
                  Descargar factura PDF
                </button>
                <button className="button-secondary" type="button" onClick={() => openInvoiceEmailDraft(selectedInvoice)}>
                  Preparar email
                </button>
              </div>
            </form>

            <PaymentQrCard link={selectedInvoice.paypalLink || data.settings.paypalLink} title="QR para cobrar por PayPal" />
          </div>
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Convierte una cotización en factura para verla aquí.</div>
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
        description="Visualiza qué se ha cobrado, cuánto y a qué cliente corresponde cada pago registrado."
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => {
                const invoice = data.invoices.find((entry) => entry.id === payment.invoiceId);
                const client = data.clients.find((entry) => entry.id === payment.clientId);
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
          {data.payments.length === 0 ? <p className="p-6 text-sm text-slate-500">Aún no hay pagos registrados.</p> : null}
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
    if (quote.id) {
      await api.updateQuote(quote.id, quote);
    } else {
      await api.createQuote({ ...quote, status: "draft" });
    }

    setEditingQuote(null);
    await loadApp();
    setActiveSection("quotes");
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
    const shouldDelete = window.confirm("¿Seguro que deseas eliminar esta cotización?");
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
            />
          ) : null}
          {activeSection === "invoices" ? <InvoicesSection data={data} onUpdateInvoice={handleUpdateInvoice} /> : null}
          {activeSection === "payments" ? <PaymentsSection data={data} /> : null}
          {activeSection === "settings" ? (
            <div className="space-y-4">
              <SectionHeader
                eyebrow="Negocio"
                title="Configuración"
                description="Ajusta datos del estudio, reglas de cálculo y textos base para cotizaciones y facturas."
              />
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
                <span className="font-medium text-ink">Data Source:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settingsSource === "Supabase" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{settingsSource}</span>
              </div>
              <SettingsForm settings={data.settings} onSubmit={handleUpdateSettings} />
              <div className="panel p-6 text-sm text-slate-600">
                <p className="font-semibold text-ink">Estructura futura preparada</p>
                <p className="mt-2">
                  El proyecto ya está separado para agregar después integración real con PayPal API, membresías,
                  firmas, envíos por email y PDFs más premium sin reescribir la base.
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Layout>
  );
}










