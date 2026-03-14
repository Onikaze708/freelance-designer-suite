import { useMemo, useState } from "react";
import {
  calculateEditorialProject,
  createEditorialQuotePayload,
  COVER_PRICES,
  EBOOK_PRICES,
  EDITORIAL_COMPLEXITY_PRICES,
  KDP_PRICES,
  METADATA_PRICES,
  PRINT_MANAGEMENT_PRICES,
  PRINT_MARGIN_TABLE
} from "../utils/editorialCalculator";
import { formatCurrency } from "../utils/calculations";

const initialForm = {
  projectTitle: "",
  clientName: "",
  pages: "",
  complexity: "baja",
  cover: "none",
  ebook: "none",
  kdp: "none",
  metadata: "none",
  printManagement: "none",
  includesExternalPrint: false,
  providerCost: "",
  printType: "local_books",
  marginLevel: "estandar"
};

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryRow({ label, value, emphasized = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${emphasized ? "text-base font-semibold text-ink" : "text-sm text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function EditorialQuoteCalculator({ settings, onSaveQuote }) {
  const [form, setForm] = useState(initialForm);
  const [showValidation, setShowValidation] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  const preview = useMemo(() => calculateEditorialProject(form), [form]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleCalculate() {
    setShowValidation(true);
    setSubmittedResult(preview);
  }

  function handleReset() {
    setForm(initialForm);
    setShowValidation(false);
    setSubmittedResult(null);
  }

  const activeResult = submittedResult || preview;
  const errors = showValidation ? activeResult.errors : {};
  const canSave = submittedResult?.isValid;
  const marginPercent = Math.round((activeResult.breakdown?.margenAplicado || 0) * 100);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="panel grid gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-coral">Proyecto editorial</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Calculador para autores independientes</h3>
            <p className="mt-2 text-sm text-slate-500">
              Cotiza maquetación, portada, ebook, KDP e impresión con margen de producción desde una sola vista.
            </p>
          </div>

          <div>
            <label className="label">Título del libro o proyecto</label>
            <input className="input" value={form.projectTitle} onChange={(event) => updateField("projectTitle", event.target.value)} />
            {errors.projectTitle ? <p className="mt-2 text-sm text-coral">{errors.projectTitle}</p> : null}
          </div>

          <div>
            <label className="label">Autor / cliente</label>
            <input className="input" value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
            {errors.clientName ? <p className="mt-2 text-sm text-coral">{errors.clientName}</p> : null}
          </div>

          <div>
            <label className="label">Número de páginas</label>
            <input type="number" min="1" className="input" value={form.pages} onChange={(event) => updateField("pages", event.target.value)} />
            {errors.pages ? <p className="mt-2 text-sm text-coral">{errors.pages}</p> : null}
          </div>

          <div>
            <label className="label">Rango de maquetación</label>
            <div className="input flex items-center bg-sand text-slate-700">
              {activeResult.layoutRange.label || "Se calcula según páginas"}
            </div>
          </div>

          <SelectField
            label="Complejidad"
            value={form.complexity}
            onChange={(value) => updateField("complexity", value)}
            options={[
              { value: "baja", label: `Baja (${formatCurrency(EDITORIAL_COMPLEXITY_PRICES.baja, settings.currency)})` },
              { value: "media", label: `Media (${formatCurrency(EDITORIAL_COMPLEXITY_PRICES.media, settings.currency)})` },
              { value: "alta", label: `Alta (${formatCurrency(EDITORIAL_COMPLEXITY_PRICES.alta, settings.currency)})` }
            ]}
          />

          <SelectField
            label="Portada"
            value={form.cover}
            onChange={(value) => updateField("cover", value)}
            options={[
              { value: "none", label: "No incluye" },
              { value: "basic", label: `Portada básica (${formatCurrency(COVER_PRICES.basic, settings.currency)})` },
              { value: "professional", label: `Portada profesional (${formatCurrency(COVER_PRICES.professional, settings.currency)})` },
              { value: "premium", label: `Portada premium (${formatCurrency(COVER_PRICES.premium, settings.currency)})` }
            ]}
          />

          <SelectField
            label="Ebook"
            value={form.ebook}
            onChange={(value) => updateField("ebook", value)}
            options={[
              { value: "none", label: "No incluye" },
              { value: "basic", label: `Conversión básica EPUB/Kindle (${formatCurrency(EBOOK_PRICES.basic, settings.currency)})` },
              { value: "optimized", label: `Conversión revisada y optimizada (${formatCurrency(EBOOK_PRICES.optimized, settings.currency)})` }
            ]}
          />

          <SelectField
            label="Amazon KDP"
            value={form.kdp}
            onChange={(value) => updateField("kdp", value)}
            options={[
              { value: "none", label: "No incluye" },
              { value: "basic", label: `Configuración básica (${formatCurrency(KDP_PRICES.basic, settings.currency)})` },
              { value: "assisted", label: `Publicación asistida completa (${formatCurrency(KDP_PRICES.assisted, settings.currency)})` },
              { value: "premium", label: `Publicación premium con acompañamiento (${formatCurrency(KDP_PRICES.premium, settings.currency)})` }
            ]}
          />

          <SelectField
            label="Metadatos"
            value={form.metadata}
            onChange={(value) => updateField("metadata", value)}
            options={[
              { value: "none", label: "No incluye" },
              { value: "basic", label: `Optimización básica (${formatCurrency(METADATA_PRICES.basic, settings.currency)})` },
              { value: "complete", label: `Optimización completa (${formatCurrency(METADATA_PRICES.complete, settings.currency)})` }
            ]}
          />

          <SelectField
            label="Gestión de impresión"
            value={form.printManagement}
            onChange={(value) => updateField("printManagement", value)}
            options={[
              { value: "none", label: "No incluye" },
              { value: "basic", label: `Gestión básica (${formatCurrency(PRINT_MANAGEMENT_PRICES.basic, settings.currency)})` },
              { value: "complete", label: `Gestión completa (${formatCurrency(PRINT_MANAGEMENT_PRICES.complete, settings.currency)})` }
            ]}
          />
        </div>

        <div className="panel grid gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-coral">Producción</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Impresión externa</h3>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.includesExternalPrint}
                onChange={(event) => updateField("includesExternalPrint", event.target.checked)}
              />
              Incluir impresión externa
            </label>
          </div>

          <div>
            <label className="label">Costo real del proveedor</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              disabled={!form.includesExternalPrint}
              value={form.providerCost}
              onChange={(event) => updateField("providerCost", event.target.value)}
            />
            {errors.providerCost ? <p className="mt-2 text-sm text-coral">{errors.providerCost}</p> : null}
          </div>

          <SelectField
            label="Tipo de impresión"
            value={form.printType}
            onChange={(value) => updateField("printType", value)}
            options={[
              { value: "local_books", label: "Libros imprenta local" },
              { value: "international_books", label: "Libros imprenta internacional" },
              { value: "marketing_items", label: "Artículos de marketing" }
            ]}
          />

          <SelectField
            label="Nivel de margen"
            value={form.marginLevel}
            onChange={(value) => updateField("marginLevel", value)}
            options={[
              { value: "bajo", label: "Bajo" },
              { value: "estandar", label: "Estándar" },
              { value: "alto", label: "Alto" }
            ]}
          />

          <div>
            <label className="label">Margen activo</label>
            <div className="input flex items-center bg-sand text-slate-700">
              {form.includesExternalPrint ? `${Math.round((PRINT_MARGIN_TABLE[form.printType]?.[form.marginLevel] || 0) * 100)}%` : 'Sin impresión externa'}
            </div>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={handleCalculate}>
              Calcular proyecto
            </button>
            <button type="button" className="button-secondary" onClick={handleReset}>
              Limpiar formulario
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={!canSave}
              onClick={() => onSaveQuote(createEditorialQuotePayload(form, submittedResult, settings))}
            >
              Guardar como cotización
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeResult.warning ? (
          <div className="panel border border-coral/20 bg-coral/10 p-5 text-sm text-ink">
            <p className="font-semibold">{activeResult.warning}</p>
          </div>
        ) : null}

        <div className="panel p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-coral">Resumen del proyecto</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">Total editorial y producción</h3>

          <div className="mt-5 divide-y divide-slate-100">
            <SummaryRow label="Maquetación" value={activeResult.layoutRange.specialQuote ? 'Cotización especial' : formatCurrency(activeResult.breakdown.maquetacion, settings.currency)} />
            <SummaryRow label="Complejidad" value={formatCurrency(activeResult.breakdown.complejidad, settings.currency)} />
            <SummaryRow label="Portada" value={formatCurrency(activeResult.breakdown.portada, settings.currency)} />
            <SummaryRow label="Ebook" value={formatCurrency(activeResult.breakdown.ebook, settings.currency)} />
            <SummaryRow label="KDP" value={formatCurrency(activeResult.breakdown.kdp, settings.currency)} />
            <SummaryRow label="Metadatos" value={formatCurrency(activeResult.breakdown.metadatos, settings.currency)} />
            <SummaryRow label="Gestión de impresión" value={formatCurrency(activeResult.breakdown.gestionImpresion, settings.currency)} />
            <SummaryRow label="Subtotal editorial" value={formatCurrency(activeResult.breakdown.subtotalEditorial, settings.currency)} emphasized />
            <SummaryRow label="Costo proveedor" value={formatCurrency(activeResult.breakdown.costoProveedor, settings.currency)} />
            <SummaryRow label="Margen aplicado" value={`${marginPercent}%`} />
            <SummaryRow label="Precio al cliente por impresión" value={formatCurrency(activeResult.breakdown.precioClienteImpresion, settings.currency)} />
            <SummaryRow label="Ganancia por impresión" value={formatCurrency(activeResult.breakdown.gananciaImpresion, settings.currency)} />
            <SummaryRow label="Total final" value={formatCurrency(activeResult.breakdown.totalFinal, settings.currency)} emphasized />
          </div>
        </div>
      </div>
    </div>
  );
}
