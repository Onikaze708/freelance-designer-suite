export const CATEGORY_OPTIONS = [
  "Identidad visual",
  "Redes sociales",
  "Publicidad y marketing",
  "Diseño editorial",
  "Diseño web",
  "Diseño corporativo",
  "Photography",
  "Monthly Creative Plans"
];
export const SERVICE_OPTION_LABELS = {
  cantidad: "Cantidad",
  complejidad: "Complejidad",
  urgencia: "Urgencia",
  revisiones: "Revisiones",
  investigacion: "Investigación",
  estrategia: "Estrategia"
};

export const COMPLEXITY_OPTIONS = [
  { value: "basic", label: "Básica" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" }
];

export const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgente" },
  { value: "veryUrgent", label: "Muy urgente" }
];

export const INVOICE_STATUSES = ["draft", "sent", "pending", "paid", "overdue"];

export function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("es-US", { style: "currency", currency }).format(Number(value || 0));
}

export function getServiceBasePrice(service) {
  return Number(service.base_price ?? service.basePrice ?? 0);
}

export function getServiceUnit(service) {
  return service.unit ?? service.billingUnit ?? "proyecto";
}

export function serviceHasOption(service, option) {
  return Array.isArray(service.options) ? service.options.includes(option) : false;
}

export function getServiceOptions(service) {
  return Array.isArray(service.options) ? service.options : [];
}

function feeAmount(baseAmount, feeConfig, enabled) {
  if (!enabled) return 0;
  if (feeConfig.mode === "fixed") return Number(feeConfig.value || 0);
  return baseAmount * (Number(feeConfig.value || 0) / 100);
}

export function calculateLineItem(item, service, settings) {
  const quantity = serviceHasOption(service, "cantidad") ? Number(item.quantity || 1) : 1;
  const base = getServiceBasePrice(service) * quantity;
  const complexityRate = serviceHasOption(service, "complejidad") ? Number(settings.complexityRates[item.complexity] || 0) : 0;
  const urgencyRate = serviceHasOption(service, "urgencia") ? Number(settings.urgencyRates[item.urgency] || 0) : 0;
  const complexityFee = base * complexityRate;
  const urgencyFee = base * urgencyRate;
  const included = Number(settings.revisionSettings.includedRevisions || 1);
  const revisions = serviceHasOption(service, "revisiones") ? Number(item.revisions || included) : included;
  const extraRevisions = Math.max(0, revisions - included);
  const revisionFee = extraRevisions * Number(settings.revisionSettings.extraRevisionCost || 0);
  const subtotalBeforeFlags = base + complexityFee + urgencyFee + revisionFee;
  const researchFee = serviceHasOption(service, "investigacion") ? feeAmount(subtotalBeforeFlags, settings.researchFee, item.includesResearch) : 0;
  const strategyFee = serviceHasOption(service, "estrategia") ? feeAmount(subtotalBeforeFlags, settings.strategyFee, item.includesStrategy) : 0;
  const total = subtotalBeforeFlags + researchFee + strategyFee;

  return {
    ...item,
    quantity,
    complexityFee,
    urgencyFee,
    revisionFee,
    researchFee,
    strategyFee,
    unitBasePrice: getServiceBasePrice(service),
    lineSubtotal: base,
    total
  };
}

export function calculateQuoteTotals(items, services, settings, options) {
  const enrichedItems = items.map((item) => {
    const service = services.find((entry) => entry.id === item.serviceId);
    return service ? { ...calculateLineItem(item, service, settings), serviceName: service.name } : item;
  });

  const subtotal = enrichedItems.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0);
  const extras = enrichedItems.reduce((sum, item) => sum + Number(item.complexityFee || 0) + Number(item.urgencyFee || 0) + Number(item.revisionFee || 0) + Number(item.researchFee || 0) + Number(item.strategyFee || 0), 0);
  const discountValue = Number(options.discountValue || 0);
  const discount = options.discountType === "percent" ? (subtotal + extras) * (discountValue / 100) : discountValue;
  const taxableBase = subtotal + extras - discount;
  const taxes = options.applyTax ? taxableBase * (Number(options.taxRate || 0) / 100) : 0;
  const total = taxableBase + taxes;

  return { items: enrichedItems, totals: { subtotal, extras, discount, taxes, total } };
}

export function createEmptyQuoteItem(service) {
  return {
    tempId: crypto.randomUUID(),
    serviceId: service.id,
    quantity: 1,
    complexity: "basic",
    urgency: "normal",
    revisions: 1,
    includesResearch: false,
    includesStrategy: false
  };
}

