import { useMemo, useState } from "react";
import {
  calculateProductionProject,
  createProductionQuotePayload,
  PRODUCTION_CATEGORIES,
  PRODUCTION_MARGIN_PRESETS
} from "../utils/productionCalculator";
import { formatCurrency } from "../utils/calculations";

const initialForm = {
  productName: "",
  category: PRODUCTION_CATEGORIES[0],
  quantity: 1,
  providerCost: "",
  marginPercent: 30,
  notes: ""
};

function SummaryRow({ label, value, emphasized = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${emphasized ? "text-base font-semibold text-ink" : "text-sm text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ProductionCalculator({ settings, onSaveQuote }) {
  const [form, setForm] = useState(initialForm);
  const [showValidation, setShowValidation] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  const preview = useMemo(() => calculateProductionProject(form), [form]);
  const activeResult = submittedResult || preview;
  const errors = showValidation ? activeResult.errors : {};
  const canSave = submittedResult?.isValid;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(key) {
    updateField("marginPercent", Math.round(PRODUCTION_MARGIN_PRESETS[key] * 100));
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

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <div className="panel grid gap-4 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-coral">Producción</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Margen de impresión</h3>
            <p className="mt-2 text-sm text-slate-500">
              Calcula rápidamente el precio final de productos impresos o promocionales producidos por terceros.
            </p>
          </div>

          <div>
            <label className="label">Nombre del producto</label>
            <input className="input" value={form.productName} onChange={(event) => updateField("productName", event.target.value)} />
            {errors.productName ? <p className="mt-2 text-sm text-coral">{errors.productName}</p> : null}
          </div>

          <div>
            <label className="label">Categoría del producto</label>
            <select className="input" value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              {PRODUCTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Cantidad</label>
            <input type="number" min="1" className="input" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} />
            {errors.quantity ? <p className="mt-2 text-sm text-coral">{errors.quantity}</p> : null}
          </div>

          <div>
            <label className="label">Costo base del proveedor</label>
            <input type="number" min="0" step="0.01" className="input" value={form.providerCost} onChange={(event) => updateField("providerCost", event.target.value)} />
            {errors.providerCost ? <p className="mt-2 text-sm text-coral">{errors.providerCost}</p> : null}
          </div>

          <div>
            <label className="label">Porcentaje de margen</label>
            <input type="number" min="0" step="0.01" className="input" value={form.marginPercent} onChange={(event) => updateField("marginPercent", event.target.value)} />
            {errors.marginPercent ? <p className="mt-2 text-sm text-coral">{errors.marginPercent}</p> : null}
          </div>

          <div>
            <label className="label">Márgenes sugeridos</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button-soft" onClick={() => applyPreset('bajo')}>Bajo 25%</button>
              <button type="button" className="button-soft" onClick={() => applyPreset('estandar')}>Estándar 30%</button>
              <button type="button" className="button-soft" onClick={() => applyPreset('alto')}>Alto 35%</button>
              <button type="button" className="button-soft" onClick={() => applyPreset('premium')}>Premium 40%</button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <textarea className="input min-h-24" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={handleCalculate}>Calcular</button>
            <button type="button" className="button-secondary" onClick={handleReset}>Limpiar</button>
            <button
              type="button"
              className="button-secondary"
              disabled={!canSave}
              onClick={() => onSaveQuote(createProductionQuotePayload(form, submittedResult, settings))}
            >
              Guardar como cotización
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-coral">Resumen</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">Precio final del producto</h3>
          <div className="mt-5 divide-y divide-slate-100">
            <SummaryRow label="Costo proveedor" value={formatCurrency(activeResult.breakdown.costoProveedor, settings.currency)} />
            <SummaryRow label="Margen aplicado" value={`${activeResult.breakdown.margenPorcentaje}%`} />
            <SummaryRow label="Ganancia" value={formatCurrency(activeResult.breakdown.ganancia, settings.currency)} />
            <SummaryRow label="Precio final cliente" value={formatCurrency(activeResult.breakdown.precioFinalCliente, settings.currency)} emphasized />
          </div>
        </div>
      </div>
    </div>
  );
}
