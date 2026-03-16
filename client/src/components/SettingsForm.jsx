export function SettingsForm({ settings, onSubmit }) {
  return (
    <form key={settings.businessName} className="panel grid gap-4 p-6 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      onSubmit({
        businessName: formData.get("businessName"),
        designerName: formData.get("designerName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        currency: formData.get("currency"),
        logoUrl: formData.get("logoUrl"),
        taxPercentage: Number(formData.get("taxPercentage")),
        paymentTerms: formData.get("paymentTerms"),
        deliveryEstimate: formData.get("deliveryEstimate"),
        termsOfService: formData.get("termsOfService"),
        quoteClosingMessage: formData.get("quoteClosingMessage"),
        invoiceClosingMessage: formData.get("invoiceClosingMessage"),
        paypalLink: formData.get("paypalLink"),
        revisionSettings: { includedRevisions: Number(formData.get("includedRevisions")), extraRevisionCost: Number(formData.get("extraRevisionCost")) },
        complexityRates: { basic: Number(formData.get("complexityBasic")), medium: Number(formData.get("complexityMedium")), high: Number(formData.get("complexityHigh")) },
        urgencyRates: { normal: Number(formData.get("urgencyNormal")), urgent: Number(formData.get("urgencyUrgent")), veryUrgent: Number(formData.get("urgencyVeryUrgent")) },
        researchFee: { mode: formData.get("researchMode"), value: Number(formData.get("researchValue")) },
        strategyFee: { mode: formData.get("strategyMode"), value: Number(formData.get("strategyValue")) }
      });
    }}>
      <div><label className="label">Nombre del negocio</label><input name="businessName" className="input" defaultValue={settings.businessName} /></div>
      <div><label className="label">Nombre del diseñador</label><input name="designerName" className="input" defaultValue={settings.designerName} /></div>
      <div><label className="label">Correo</label><input name="email" className="input" defaultValue={settings.email} /></div>
      <div><label className="label">Teléfono</label><input name="phone" className="input" defaultValue={settings.phone} /></div>
      <div><label className="label">Dirección</label><input name="address" className="input" defaultValue={settings.address} /></div>
      <div><label className="label">Moneda</label><input name="currency" className="input" defaultValue={settings.currency} /></div>
      <div className="md:col-span-2"><label className="label">Logo URL opcional</label><input name="logoUrl" className="input" defaultValue={settings.logoUrl} /></div>
      <div><label className="label">Impuestos %</label><input name="taxPercentage" type="number" step="0.01" className="input" defaultValue={settings.taxPercentage} /></div>
      <div><label className="label">Enlace PayPal / PayPal.Me</label><input name="paypalLink" className="input" defaultValue={settings.paypalLink} placeholder="https://www.paypal.me/martialsciencemag" /></div>
      <div><label className="label">Revisión incluida</label><input name="includedRevisions" type="number" min="0" className="input" defaultValue={settings.revisionSettings.includedRevisions} /></div>
      <div><label className="label">Costo revisión extra</label><input name="extraRevisionCost" type="number" step="0.01" className="input" defaultValue={settings.revisionSettings.extraRevisionCost} /></div>
      <div><label className="label">Complejidad media</label><input name="complexityMedium" type="number" step="0.01" className="input" defaultValue={settings.complexityRates.medium} /></div>
      <div><label className="label">Complejidad alta</label><input name="complexityHigh" type="number" step="0.01" className="input" defaultValue={settings.complexityRates.high} /></div>
      <input type="hidden" name="complexityBasic" defaultValue={settings.complexityRates.basic} />
      <input type="hidden" name="urgencyNormal" defaultValue={settings.urgencyRates.normal} />
      <div><label className="label">Urgencia</label><input name="urgencyUrgent" type="number" step="0.01" className="input" defaultValue={settings.urgencyRates.urgent} /></div>
      <div><label className="label">Muy urgente</label><input name="urgencyVeryUrgent" type="number" step="0.01" className="input" defaultValue={settings.urgencyRates.veryUrgent} /></div>
      <div><label className="label">Investigación</label><div className="grid grid-cols-[120px_1fr] gap-3"><select name="researchMode" className="input" defaultValue={settings.researchFee.mode}><option value="percent">%</option><option value="fixed">Fijo</option></select><input name="researchValue" type="number" step="0.01" className="input" defaultValue={settings.researchFee.value} /></div></div>
      <div><label className="label">Estrategia</label><div className="grid grid-cols-[120px_1fr] gap-3"><select name="strategyMode" className="input" defaultValue={settings.strategyFee.mode}><option value="percent">%</option><option value="fixed">Fijo</option></select><input name="strategyValue" type="number" step="0.01" className="input" defaultValue={settings.strategyFee.value} /></div></div>
      <div className="md:col-span-2"><label className="label">Condiciones de pago</label><textarea name="paymentTerms" className="input min-h-24" defaultValue={settings.paymentTerms} /></div>
      <div className="md:col-span-2"><label className="label">Tiempo estimado de entrega</label><textarea name="deliveryEstimate" className="input min-h-24" defaultValue={settings.deliveryEstimate} /></div>
      <div className="md:col-span-2"><label className="label">Términos de servicio</label><textarea name="termsOfService" className="input min-h-24" defaultValue={settings.termsOfService} /></div>
      <div className="md:col-span-2"><label className="label">Mensaje final de cotización</label><textarea name="quoteClosingMessage" className="input min-h-24" defaultValue={settings.quoteClosingMessage} /></div>
      <div className="md:col-span-2"><label className="label">Mensaje final de factura</label><textarea name="invoiceClosingMessage" className="input min-h-24" defaultValue={settings.invoiceClosingMessage} /></div>
      <div className="md:col-span-2"><button className="button-primary" type="submit">Guardar configuración</button></div>
    </form>
  );
}

