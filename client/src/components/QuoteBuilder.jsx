import { useEffect, useMemo, useState } from "react";
import { COMPLEXITY_OPTIONS, URGENCY_OPTIONS, calculateQuoteTotals, createEmptyQuoteItem, formatCurrency, getServiceBasePrice, serviceHasOption } from "../utils/calculations";
import { QuotePreview } from "./QuotePreview";

const FALLBACK_QUOTE_CLIENT_ID = "__quote_client__";

function createInitialState(activeQuote, settings, clients) {
  const hydratedClientId = activeQuote?.clientId || activeQuote?.clientSnapshot?.id || (activeQuote?.clientSnapshot ? FALLBACK_QUOTE_CLIENT_ID : clients[0]?.id) || "";

  return {
    selectedClientId: hydratedClientId,
    date: activeQuote?.date || new Date().toISOString().slice(0, 10),
    discountType: activeQuote?.discountType || "percent",
    discountValue: Number.isFinite(Number(activeQuote?.discountValue)) ? Number(activeQuote.discountValue) : 0,
    applyTax: activeQuote?.applyTax ?? true,
    taxRate: activeQuote?.taxRate ?? settings.taxPercentage,
    notes: activeQuote?.notes || "",
    paymentTerms: activeQuote?.paymentTerms || settings.paymentTerms,
    deliveryEstimate: activeQuote?.deliveryEstimate || settings.deliveryEstimate,
    items: activeQuote?.items?.map((item) => ({ ...item, tempId: item.tempId || crypto.randomUUID() })) || []
  };
}

function ItemEditor({ item, service, onChange, onRemove }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">{service.name}</p>
          <p className="mt-1 text-sm text-slate-500">{service.category} · {formatCurrency(getServiceBasePrice(service))}</p>
        </div>
        <button type="button" className="button-secondary" onClick={onRemove}>Quitar</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {serviceHasOption(service, "cantidad") ? <div><label className="label">Cantidad</label><input type="number" min="1" className="input" value={item.quantity} onChange={(event) => onChange({ quantity: Number(event.target.value) })} /></div> : null}
        {serviceHasOption(service, "complejidad") ? <div><label className="label">Complejidad</label><select className="input" value={item.complexity} onChange={(event) => onChange({ complexity: event.target.value })}>{COMPLEXITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div> : null}
        {serviceHasOption(service, "urgencia") ? <div><label className="label">Urgencia</label><select className="input" value={item.urgency} onChange={(event) => onChange({ urgency: event.target.value })}>{URGENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div> : null}
        {serviceHasOption(service, "revisiones") ? <div><label className="label">Revisiones</label><input type="number" min="1" className="input" value={item.revisions} onChange={(event) => onChange({ revisions: Number(event.target.value) })} /></div> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {serviceHasOption(service, "investigacion") ? <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm"><input type="checkbox" checked={item.includesResearch} onChange={(event) => onChange({ includesResearch: event.target.checked })} />Incluir investigación</label> : null}
        {serviceHasOption(service, "estrategia") ? <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm"><input type="checkbox" checked={item.includesStrategy} onChange={(event) => onChange({ includesStrategy: event.target.checked })} />Incluir estrategia</label> : null}
      </div>
    </div>
  );
}

function ServicePicker({ services, onAddService }) {
  const [query, setQuery] = useState("");
  const [openCategory, setOpenCategory] = useState(services[0]?.category || "");

  useEffect(() => {
    if (!services.some((service) => service.category === openCategory)) {
      setOpenCategory(services[0]?.category || "");
    }
  }, [services, openCategory]);

  const trimmedQuery = query.trim().toLowerCase();
  const groupedServices = useMemo(() => {
    return services.reduce((groups, service) => {
      if (!groups[service.category]) {
        groups[service.category] = [];
      }
      groups[service.category].push(service);
      return groups;
    }, {});
  }, [services]);

  const filteredServices = useMemo(() => {
    if (!trimmedQuery) return [];
    return services.filter((service) => service.name.toLowerCase().includes(trimmedQuery));
  }, [services, trimmedQuery]);

  const categories = Object.keys(groupedServices);

  return (
    <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <label className="label">Agregar servicio</label>
          <p className="text-sm text-slate-500">Explora el catálogo por categoría o encuentra un servicio por nombre.</p>
        </div>
        <div className="w-full md:w-80">
          <input
            className="input"
            placeholder="Buscar servicio..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {trimmedQuery ? (
        <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
          {filteredServices.length > 0 ? (
            filteredServices.map((service, index) => (
              <button
                key={service.id}
                type="button"
                onClick={() => onAddService(service)}
                className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-sand ${index > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span>
                  <span className="font-semibold text-ink">{service.name}</span>
                  <span className="ml-2 text-slate-500">{service.category}</span>
                </span>
                <span className="font-semibold text-coral">{formatCurrency(getServiceBasePrice(service))}</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-slate-500">No se encontraron servicios con ese nombre.</div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {categories.map((category) => {
            const isOpen = openCategory === category;
            return (
              <div key={category} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenCategory(isOpen ? "" : category)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="font-semibold text-ink">{category}</span>
                  <span className="text-sm text-slate-500">{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen ? (
                  <div className="border-t border-slate-100">
                    {groupedServices[category].map((service, index) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => onAddService(service)}
                        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-sand ${index > 0 ? "border-t border-slate-100" : ""}`}
                      >
                        <span className="font-medium text-ink">{service.name}</span>
                        <span className="font-semibold text-coral">{formatCurrency(getServiceBasePrice(service))}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuoteBuilder({ clients, services, settings, activeQuote, onSaveQuote, onExportPdf, onCancelEdit }) {
  const [formState, setFormState] = useState(() => createInitialState(activeQuote, settings, clients));
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormState(createInitialState(activeQuote, settings, clients));
    setSaveError("");
  }, [activeQuote, settings, clients]);

  const clientOptions = useMemo(() => {
    const fallbackClientId = activeQuote?.clientId || activeQuote?.clientSnapshot?.id || FALLBACK_QUOTE_CLIENT_ID;
    const hasQuoteClientInList = clients.some((client) => client.id === fallbackClientId);

    if (activeQuote?.clientSnapshot && !hasQuoteClientInList) {
      return [
        {
          ...activeQuote.clientSnapshot,
          id: fallbackClientId,
          businessName: activeQuote.clientSnapshot.businessName || activeQuote.clientSnapshot.name || activeQuote.clientName || "",
          name: activeQuote.clientSnapshot.name || activeQuote.clientSnapshot.businessName || activeQuote.clientName || ""
        },
        ...clients
      ];
    }

    return clients;
  }, [activeQuote, clients]);

  const selectedClient = clientOptions.find((client) => client.id === formState.selectedClientId) || null;
  const calculated = useMemo(
    () =>
      calculateQuoteTotals(formState.items, services, settings, {
        discountType: formState.discountType,
        discountValue: formState.discountValue,
        applyTax: formState.applyTax,
        taxRate: formState.taxRate
      }),
    [formState, services, settings]
  );

  const persistedClientId = selectedClient?.id === FALLBACK_QUOTE_CLIENT_ID ? activeQuote?.clientId || activeQuote?.clientSnapshot?.id || null : selectedClient?.id || formState.selectedClientId || null;

  const quotePreview = selectedClient
    ? {
        id: activeQuote?.id,
        quoteNumber: activeQuote?.quoteNumber,
        status: activeQuote?.status || "draft",
        clientId: persistedClientId,
        clientSnapshot: { ...selectedClient, id: persistedClientId },
        date: formState.date,
        discountType: formState.discountType,
        discountValue: formState.discountValue,
        applyTax: formState.applyTax,
        taxRate: formState.taxRate,
        notes: formState.notes,
        paymentTerms: formState.paymentTerms,
        deliveryEstimate: formState.deliveryEstimate,
        items: calculated.items,
        totals: calculated.totals
      }
    : null;

  const updateState = (changes) => {
    setSaveError("");
    setFormState((current) => ({ ...current, ...changes }));
  };

  async function handleSaveClick() {
    if (!selectedClient) {
      setSaveError("Selecciona un cliente antes de guardar la cotización.");
      return;
    }

    if (formState.items.length === 0) {
      setSaveError("Agrega al menos un servicio antes de guardar la cotización.");
      return;
    }

    if (!quotePreview) {
      setSaveError("No se pudo preparar la cotización para guardarla.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      const grossTotal = Number(calculated?.meta?.grossTotal ?? 0);
      const requestedDiscountValue = Number(formState.discountValue ?? 0);
      const discountAmount = Number(calculated?.totals?.discountAmount ?? calculated?.totals?.discount ?? 0);
      const total = Number(calculated?.totals?.total ?? 0);

      if (!Number.isFinite(grossTotal) || !Number.isFinite(discountAmount) || !Number.isFinite(total)) {
        setSaveError("El total de la cotización es inválido. Revisa descuento, impuestos y servicios.");
        return;
      }

      if (formState.discountType === "fixed" && requestedDiscountValue > grossTotal) {
        setSaveError("El descuento fijo no puede exceder el subtotal de la cotización.");
        return;
      }

      if (total < 0) {
        setSaveError("El total de la cotización no puede ser negativo.");
        return;
      }

      await onSaveQuote({
        ...quotePreview,
        discountType: calculated.meta.discountType,
        discountValue: calculated.meta.discountValue,
        totals: {
          ...quotePreview.totals,
          discountAmount: discountAmount,
          total
        }
      });
    } catch (error) {
      setSaveError(error?.message || "Error al guardar cotización");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-coral">Editor</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">{activeQuote ? `Editando ${activeQuote.quoteNumber}` : "Nueva cotización"}</h3>
            </div>
            {activeQuote ? (
              <button type="button" className="button-secondary" onClick={onCancelEdit}>
                Cancelar edición
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={formState.selectedClientId} onChange={(event) => updateState({ selectedClientId: event.target.value })}>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.businessName || client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={formState.date} onChange={(event) => updateState({ date: event.target.value })} />
            </div>
          </div>

          <ServicePicker services={services} onAddService={(service) => updateState({ items: [...formState.items, createEmptyQuoteItem(service)] })} />
        </div>

        <div className="space-y-3">
          {formState.items.length === 0 ? <div className="panel p-6 text-sm text-slate-500">Agrega uno o varios servicios para comenzar a calcular.</div> : null}
          {formState.items.map((item) => {
            const service = services.find((entry) => entry.id === item.serviceId);
            if (!service) return null;
            return (
              <ItemEditor
                key={item.tempId}
                item={item}
                service={service}
                onRemove={() => updateState({ items: formState.items.filter((entry) => entry.tempId !== item.tempId) })}
                onChange={(changes) =>
                  updateState({
                    items: formState.items.map((entry) => (entry.tempId === item.tempId ? { ...entry, ...changes } : entry))
                  })
                }
              />
            );
          })}
        </div>

        <div className="panel grid gap-4 p-6 md:grid-cols-2">
          <div>
            <label className="label">Descuento</label>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <select className="input" value={formState.discountType} onChange={(event) => updateState({ discountType: event.target.value })}>
                <option value="percent">Porcentaje</option>
                <option value="fixed">Monto fijo</option>
              </select>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formState.discountValue}
                onChange={(event) => {
                  const nextValue = parseFloat(event.target.value);
                  updateState({ discountValue: Number.isFinite(nextValue) ? nextValue : 0 });
                }}
              />
            </div>
          </div>

          <div>
            <label className="label">Impuestos</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <input type="checkbox" checked={formState.applyTax} onChange={(event) => updateState({ applyTax: event.target.checked })} />
                Aplicar
              </label>
              <input type="number" step="0.01" className="input" value={formState.taxRate} onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                updateState({ taxRate: Number.isFinite(nextValue) ? nextValue : 0 });
              }} />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="label">Condiciones de pago</label>
            <textarea className="input min-h-24" value={formState.paymentTerms} onChange={(event) => updateState({ paymentTerms: event.target.value })} />
          </div>

          <div className="md:col-span-2">
            <label className="label">Tiempo estimado de entrega</label>
            <textarea className="input min-h-24" value={formState.deliveryEstimate} onChange={(event) => updateState({ deliveryEstimate: event.target.value })} />
          </div>

          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <textarea className="input min-h-24" value={formState.notes} onChange={(event) => updateState({ notes: event.target.value })} />
          </div>

          {saveError ? <div className="md:col-span-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</div> : null}

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={handleSaveClick} disabled={isSaving}>
              {isSaving ? "Guardando..." : activeQuote ? "Actualizar cotización" : "Guardar cotización"}
            </button>
            <button type="button" className="button-secondary" onClick={() => quotePreview && onExportPdf(quotePreview)}>
              Descargar PDF
            </button>
            <button type="button" className="button-secondary" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <QuotePreview quote={quotePreview} settings={settings} />
    </div>
  );
}



