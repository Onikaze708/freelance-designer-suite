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
    throw new Error(error.message || "No se pudo calcular el próximo número de factura");
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

  return {
    id: String(row.id),
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

  return {
    id: String(row.id),
    userId: row.user_id || null,
    invoiceId: row.invoice_id || null,
    amount: normalizeNumber(row.amount),
    method: row.method || "PayPal",
    paidAt: row.date || row.paid_at || row.created_at || null,
    notes: row.notes || "",
    createdAt: row.created_at || null
  };
}

function buildInvoicePayload(invoice, userId) {
  return {
    ...(userId ? { user_id: userId } : {}),
    invoice_number: invoice.invoiceNumber || undefined,
    quote_id: invoice.quoteId || null,
    client_name:
      invoice.clientSnapshot?.businessName ||
      invoice.clientSnapshot?.name ||
      invoice.clientName ||
      "",
    client_id: invoice.clientId || invoice.clientSnapshot?.id || null,
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
    payment_method: invoice.paymentMethod || "PayPal",
    paypal_link: invoice.paypalLink || "",
    items: Array.isArray(invoice.items) ? invoice.items : [],
    updated_at: new Date().toISOString()
  };
}

function buildPaymentPayload(payment, userId) {
  return {
    ...(userId ? { user_id: userId } : {}),
    invoice_id: payment.invoiceId,
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
    throw new Error("No hay una sesión autenticada para crear facturas");
  }

  const invoiceNumber = payload.invoiceNumber || (await generateNextInvoiceNumber());
  const { data, error } = await supabase
    .from("invoices")
    .insert(buildInvoicePayload({ ...payload, invoiceNumber }, userId))
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo crear la factura en Supabase");
  }

  return normalizeRemoteInvoice(data);
}

export async function updateRemoteInvoice(id, payload) {
  if (!hasSupabaseConfig || !supabase || !invoicesTableAvailable) {
    return null;
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError) {
    throw new Error(existingError.message || "No se pudo cargar la factura para actualizarla");
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(buildInvoicePayload(payload))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la factura en Supabase");
  }

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

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "No se pudo eliminar la factura en Supabase");
  }

  return { ok: true };
}

export async function createRemotePayment(payload) {
  if (!hasSupabaseConfig || !supabase || !paymentsTableAvailable) {
    return null;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesión autenticada para registrar pagos");
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
    throw new Error("No hay una sesión autenticada para migrar facturas");
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
    throw new Error("No hay una sesión autenticada para migrar pagos");
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
