import { hasSupabaseConfig, supabase } from "./supabaseClient";

let invoicesTableAvailable = true;
let paymentsTableAvailable = true;

function isMissingTableError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  const code = String(error?.code || error?.status || "").toLowerCase();
  return code === "404" || message.includes("relation") || message.includes("does not exist") || message.includes("could not find the table") || message.includes("not found");
}

function normalizeNumber(value) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message || "No se pudo obtener el usuario autenticado");
  }

  return data.user?.id || null;
}

function invoiceNumberValue(invoiceNumber, year) {
  if (typeof invoiceNumber !== "string") {
    return 0;
  }

  const match = invoiceNumber.match(new RegExp(`^INV-${year}-(\\d+)$`));
  if (!match) {
    return 0;
  }

  return Number(match[1]) || 0;
}

async function generateNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const { data, error } = await supabase.from("invoices").select("invoice_number");
  if (error) {
    throw new Error(error.message || "No se pudo calcular el prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ximo nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºmero de factura");
  }

  const maxIndex = (data || []).reduce((highest, row) => {
    return Math.max(highest, invoiceNumberValue(row.invoice_number, year));
  }, 0);

  return `INV-${year}-${String(maxIndex + 1).padStart(4, "0")}`;
}

export function normalizeRemoteInvoice(row) {
  if (!row) {
    return null;
  }

  const dbId = String(row.id);

  return {
    id: dbId,
    dbId,
    uiInvoiceId: `invoice-row-${dbId}`,
    userId: row.user_id || null,
    invoiceNumber: row.invoice_number || "",
    quoteId: row.quote_id || null,
    clientId: row.client_id || null,
    clientSnapshot: row.client_snapshot || {
      id: row.client_id || null,
      name: row.client_name || "",
      businessName: row.client_name || ""
    },
    issueDate: row.date || row.issue_date || new Date().toISOString().slice(0, 10),
    dueDate: row.due_date || row.date || null,
    items: Array.isArray(row.items) ? row.items : [],
    totals: {
      subtotal: normalizeNumber(row.subtotal),
      extras: normalizeNumber(row.extras),
      discount: normalizeNumber(row.discount),
      taxes: normalizeNumber(row.tax),
      total: normalizeNumber(row.total)
    },
    notes: row.notes || "",
    paymentTerms: row.payment_terms || "",
    deliveryEstimate: row.delivery_time || "",
    discountType: row.discount_type || "percent",
    discountValue: normalizeNumber(row.discount_value),
    applyTax: row.apply_tax ?? true,
    taxRate: normalizeNumber(row.tax_rate),
    paymentMethod: row.payment_method || "PayPal",
    paypalLink: row.paypal_link || "",
    status: row.status || "draft",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

export function normalizeRemotePayment(row) {
  if (!row) {
    return null;
  }

  const dbId = String(row.id);

  return {
    id: dbId,
    dbId,
    uiInvoiceId: `invoice-row-${dbId}`,
    userId: row.user_id || null,
    invoiceId: row.invoice_id || null,
    amount: normalizeNumber(row.amount),
    method: row.method || "PayPal",
    paidAt: row.date || row.paid_at || row.created_at || null,
    notes: row.notes || "",
    createdAt: row.created_at || null
  };
}

const INVOICE_DB_COLUMNS = [
  "user_id",
  "invoice_number",
  "quote_id",
  "client_name",
  "client_id",
  "client_snapshot",
  "date",
  "due_date",
  "status",
  "subtotal",
  "extras",
  "tax",
  "discount",
  "total",
  "notes",
  "payment_terms",
  "delivery_time",
  "discount_type",
  "discount_value",
  "apply_tax",
  "tax_rate",
  "payment_method",
  "paypal_link",
  "items",
  "updated_at"
];

function toUuidOrNull(value, context) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = String(value).trim();
  if (isUuid(normalized)) {
    return normalized;
  }

  console.warn("INVALID UUID SANITIZED", {
    context,
    receivedValue: value,
    sanitizedTo: null
  });
  return null;
}

function sanitizeInvoicePayload(payload) {
  return INVOICE_DB_COLUMNS.reduce((accumulator, column) => {
    if (payload[column] !== undefined) {
      accumulator[column] = payload[column];
    }
    return accumulator;
  }, {});
}

function buildInvoicePayload(invoice, userId) {
  const payload = {
    ...(userId ? { user_id: toUuidOrNull(userId, "invoices.user_id") } : {}),
    invoice_number: invoice.invoiceNumber || undefined,
    quote_id: toUuidOrNull(invoice.quoteId, "invoices.quote_id"),
    client_name:
      invoice.clientSnapshot?.businessName ||
      invoice.clientSnapshot?.name ||
      invoice.clientName ||
      "",
    client_id: toUuidOrNull(invoice.clientId || invoice.clientSnapshot?.id, "invoices.client_id"),
    client_snapshot: invoice.clientSnapshot || null,
    date: invoice.issueDate || invoice.date || new Date().toISOString().slice(0, 10),
    due_date: invoice.dueDate || invoice.issueDate || invoice.date || null,
    status: invoice.status || "draft",
    subtotal: normalizeNumber(invoice.totals?.subtotal),
    extras: normalizeNumber(invoice.totals?.extras),
    tax: normalizeNumber(invoice.totals?.taxes),
    discount: normalizeNumber(invoice.totals?.discount),
    total: normalizeNumber(invoice.totals?.total),
    notes: invoice.notes || "",
    payment_terms: invoice.paymentTerms || "",
    delivery_time: invoice.deliveryEstimate || "",
    discount_type: invoice.discountType || "percent",
    discount_value: normalizeNumber(invoice.discountValue),
    apply_tax: invoice.applyTax ?? true,
    tax_rate: normalizeNumber(invoice.taxRate),
    payment_method: invoice.paymentMethod || "PayPal",
    paypal_link: invoice.paypalLink || "",
    items: Array.isArray(invoice.items) ? invoice.items : [],
    updated_at: new Date().toISOString()
  };

  return sanitizeInvoicePayload(payload);
}

function buildPaymentPayload(payment, userId) {
  return {
    ...(userId ? { user_id: toUuidOrNull(userId, "payments.user_id") } : {}),
    invoice_id: toUuidOrNull(payment.invoiceId, "payments.invoice_id"),
    amount: normalizeNumber(payment.amount),
    method: payment.method || "PayPal",
    date: payment.paidAt || payment.date || new Date().toISOString(),
    notes: payment.notes || ""
  };
}

function createPaymentFromInvoice(invoice) {
  return {
    invoiceId: invoice.id,
    amount: normalizeNumber(invoice.totals?.total),
    method: invoice.paymentMethod || "PayPal",
    paidAt: new Date().toISOString(),
    notes: invoice.notes || ""
  };
}


export async function loadRemoteInvoices() {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable) {
    return null;
  }

  const { data, error } = await supabase.from("invoices").select("*").order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) {
      invoicesTableAvailable = false;
      return null;
    }
    throw new Error(error.message || "No se pudieron cargar las facturas desde Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemoteInvoice).filter(Boolean) : [];
}

export async function loadRemotePayments() {
  if (!hasSupabaseConfig || !supabase || !paymentsTableAvailable) {
    return null;
  }

  const { data, error } = await supabase.from("payments").select("*").order("date", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) {
      paymentsTableAvailable = false;
      return null;
    }
    throw new Error(error.message || "No se pudieron cargar los pagos desde Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemotePayment).filter(Boolean) : [];
}

export async function createRemoteInvoice(payload) {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable) {
    return null;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n autenticada para crear facturas");
  }

  const invoiceNumber = payload.invoiceNumber || (await generateNextInvoiceNumber());
  const invoicePayload = buildInvoicePayload({ ...payload, invoiceNumber }, userId);

  console.log("SUPABASE INVOICE INSERT START", {
    quoteId: payload?.quoteId || null,
    invoiceNumber,
    mode: "insert"
  });
  console.log("SUPABASE INVOICE INSERT PAYLOAD", { payload: invoicePayload, columns: Object.keys(invoicePayload), uuidFields: { user_id: invoicePayload.user_id ?? null, quote_id: invoicePayload.quote_id ?? null, client_id: invoicePayload.client_id ?? null } });

  const { data, error } = await supabase
    .from("invoices")
    .insert(invoicePayload)
    .select()
    .single();

  if (error) {
    console.error("SUPABASE INVOICE INSERT ERROR", {
      quoteId: payload?.quoteId || null,
      invoiceNumber,
      message: error.message || "",
      code: error.code || "",
      details: error.details || "",
      hint: error.hint || ""
    });
    throw new Error(error.message || "No se pudo crear la factura en Supabase");
  }

  console.log("SUPABASE INVOICE INSERT RESPONSE", {
    quoteId: payload?.quoteId || null,
    invoiceNumber,
    data
  });

  return normalizeRemoteInvoice(data);
}

export async function updateRemoteInvoice(id, payload) {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable) {
    return null;
  }

  console.log("SUPABASE INVOICE UPDATE START", { invoiceId: id, expectedColumnType: "uuid", query: "invoices.eq(id, invoiceId)" });

  if (!isUuid(id)) {
    console.error("INVALID SUPABASE INVOICE ID", { file: "invoicesPaymentsRemote.js", fn: "updateRemoteInvoice", invoiceId: id, expectedType: "uuid" });
    throw new Error("El id real de la factura no es un UUID vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido.");
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError) {
    throw new Error(existingError.message || "No se pudo cargar la factura para actualizarla");
  }

  const invoicePayload = buildInvoicePayload(payload);
  console.log("SUPABASE INVOICE UPDATE PAYLOAD", { invoiceId: id, payload: invoicePayload, columns: Object.keys(invoicePayload), uuidFields: { user_id: invoicePayload.user_id ?? null, quote_id: invoicePayload.quote_id ?? null, client_id: invoicePayload.client_id ?? null } });

  const { data, error } = await supabase
    .from("invoices")
    .update(invoicePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("SUPABASE INVOICE UPDATE ERROR", {
      invoiceId: id,
      message: error.message || "",
      code: error.code || "",
      details: error.details || "",
      hint: error.hint || ""
    });
    throw new Error(error.message || "No se pudo actualizar la factura en Supabase");
  }

  console.log("SUPABASE INVOICE UPDATE RESPONSE", { invoiceId: id, data });

  let createdPayment = null;
  if (existingInvoice.status !== "paid" && data.status === "paid") {
    const { data: existingPayments, error: paymentCheckError } = await supabase
      .from("payments")
      .select("id")
      .eq("invoice_id", id)
      .limit(1);

    if (paymentCheckError) {
      throw new Error(paymentCheckError.message || "No se pudo validar el pago asociado");
    }

    if (!existingPayments || existingPayments.length === 0) {
      createdPayment = await createRemotePayment(createPaymentFromInvoice(normalizeRemoteInvoice(data)));
    }
  }

  return {
    invoice: normalizeRemoteInvoice(data),
    payment: createdPayment
  };
}

export async function deleteRemoteInvoice(id) {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable) {
    return null;
  }

  console.log("SUPABASE INVOICE DELETE START", { invoiceId: id, query: "invoices.eq(id, invoiceId)" });

  if (!isUuid(id)) {
    console.error("INVALID SUPABASE INVOICE DELETE ID", { file: "invoicesPaymentsRemote.js", fn: "deleteRemoteInvoice", invoiceId: id, expectedType: "uuid" });
    throw new Error("El id real de la factura no es un UUID válido.");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) {
    console.error("SUPABASE INVOICE DELETE ERROR", {
      invoiceId: id,
      message: error.message || "",
      code: error.code || "",
      details: error.details || "",
      hint: error.hint || ""
    });
    throw new Error(error.message || "No se pudo eliminar la factura en Supabase");
  }

  console.log("SUPABASE INVOICE DELETE SUCCESS", { invoiceId: id });
  return { ok: true };
}

export async function createRemotePayment(payload) {
  if (!hasSupabaseConfig || !supabase || !paymentsTableAvailable) {
    return null;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n autenticada para registrar pagos");
  }

  const { data, error } = await supabase
    .from("payments")
    .insert(buildPaymentPayload(payload, userId))
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo registrar el pago en Supabase");
  }

  return normalizeRemotePayment(data);
}

export async function migrateLocalInvoicesToRemote(localInvoices, references = {}) {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable || !Array.isArray(localInvoices) || localInvoices.length === 0) {
    return [];
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n autenticada para migrar facturas");
  }

  const localQuotes = Array.isArray(references.localQuotes) ? references.localQuotes : [];
  const remoteQuotes = Array.isArray(references.remoteQuotes) ? references.remoteQuotes : [];
  const remoteClients = Array.isArray(references.remoteClients) ? references.remoteClients : [];

  const payload = localInvoices.map((invoice) => {
    const localQuote = localQuotes.find((quote) => quote.id === invoice.quoteId);
    const remoteQuote = localQuote ? remoteQuotes.find((quote) => quote.quoteNumber === localQuote.quoteNumber) : null;
    const remoteClient = remoteClients.find((client) => {
      const targetName = invoice.clientSnapshot?.businessName || invoice.clientSnapshot?.name || "";
      return (client.businessName || client.name) === targetName;
    });

    return buildInvoicePayload(
      {
        ...invoice,
        quoteId: remoteQuote?.id || null,
        clientId: remoteClient?.id || invoice.clientId || null
      },
      userId
    );
  });

  const { data, error } = await supabase.from("invoices").insert(payload).select();
  if (error) {
    throw new Error(error.message || "No se pudieron migrar las facturas locales a Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemoteInvoice).filter(Boolean) : [];
}

export async function migrateLocalPaymentsToRemote(localPayments, references = {}) {
  if (!hasSupabaseConfig || !supabase || !paymentsTableAvailable || !Array.isArray(localPayments) || localPayments.length === 0) {
    return [];
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n autenticada para migrar pagos");
  }

  const localInvoices = Array.isArray(references.localInvoices) ? references.localInvoices : [];
  const remoteInvoices = Array.isArray(references.remoteInvoices) ? references.remoteInvoices : [];

  const payload = localPayments
    .map((payment) => {
      const localInvoice = localInvoices.find((invoice) => invoice.id === payment.invoiceId);
      const remoteInvoice = localInvoice ? remoteInvoices.find((invoice) => invoice.invoiceNumber === localInvoice.invoiceNumber) : null;
      if (!remoteInvoice?.id) {
        return null;
      }

      return buildPaymentPayload(
        {
          ...payment,
          invoiceId: remoteInvoice.id
        },
        userId
      );
    })
    .filter(Boolean);

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("payments").insert(payload).select();
  if (error) {
    throw new Error(error.message || "No se pudieron migrar los pagos locales a Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemotePayment).filter(Boolean) : [];
}






