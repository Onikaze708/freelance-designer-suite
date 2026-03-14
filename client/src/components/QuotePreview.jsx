import { formatCurrency } from "../utils/calculations";

export function QuotePreview({ quote, settings }) {
  if (!quote) return <div className="panel p-6 text-sm text-slate-500">La vista previa aparecera cuando agregues servicios y selecciones un cliente.</div>;
  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-6 border-b border-slate-100 pb-6 md:flex-row md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-coral">Cotizacion profesional</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">{settings.businessName || settings.designerName}</h3>
          <p className="mt-2 text-sm text-slate-500">{settings.email}</p>
          <p className="text-sm text-slate-500">{settings.phone}</p>
        </div>
        <div className="rounded-3xl bg-sand px-5 py-4 text-sm">
          <p className="font-semibold text-ink">{quote.quoteNumber || "Vista previa"}</p>
          <p className="mt-2 text-slate-500">Fecha: {quote.date}</p>
          <p className="text-slate-500">Cliente: {quote.clientSnapshot?.businessName || quote.clientSnapshot?.name}</p>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500"><tr><th className="pb-3">Servicio</th><th className="pb-3">Cantidad</th><th className="pb-3">Base</th><th className="pb-3">Extras</th><th className="pb-3">Total</th></tr></thead>
          <tbody>
            {quote.items.map((item) => <tr key={item.tempId || item.serviceId} className="border-t border-slate-100"><td className="py-3 font-medium text-ink">{item.serviceName}</td><td className="py-3">{item.quantity}</td><td className="py-3">{formatCurrency(item.lineSubtotal, settings.currency)}</td><td className="py-3">{formatCurrency(item.complexityFee + item.urgencyFee + item.revisionFee + item.researchFee + item.strategyFee, settings.currency)}</td><td className="py-3 font-semibold text-ink">{formatCurrency(item.total, settings.currency)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-2 text-sm text-slate-600">
          <p><span className="font-semibold text-ink">Condiciones:</span> {quote.paymentTerms}</p>
          <p><span className="font-semibold text-ink">Entrega estimada:</span> {quote.deliveryEstimate}</p>
          <p><span className="font-semibold text-ink">Notas:</span> {quote.notes || "-"}</p>
        </div>
        <div className="rounded-3xl bg-ink p-5 text-sm text-white">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(quote.totals.subtotal, settings.currency)}</span></div>
          <div className="mt-2 flex justify-between"><span>Extras</span><span>{formatCurrency(quote.totals.extras, settings.currency)}</span></div>
          <div className="mt-2 flex justify-between"><span>Descuento</span><span>-{formatCurrency(quote.totals.discount, settings.currency)}</span></div>
          <div className="mt-2 flex justify-between"><span>Impuestos</span><span>{formatCurrency(quote.totals.taxes, settings.currency)}</span></div>
          <div className="mt-4 border-t border-white/20 pt-4 text-lg font-semibold"><div className="flex justify-between"><span>Total</span><span>{formatCurrency(quote.totals.total, settings.currency)}</span></div></div>
        </div>
      </div>
    </div>
  );
}