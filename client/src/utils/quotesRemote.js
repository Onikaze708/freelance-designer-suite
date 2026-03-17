import { hasSupabaseConfig, supabase } from "./supabaseClient";

let quotesTableAvailable = true;

function isMissingTableError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  const code = String(error?.code || error?.status || "").toLowerCase();
  return code === "404" || message.includes("relation") || message.includes("does not exist") || message.includes("could not find the table") || message.includes("not found");
}

function normalizeNumber(value) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function normalizeRemoteQuote(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userId: row.user_id || null,
    quoteNumber: row.quote_number || "",
    clientId: row.client_id || null,
    clientName: row.client_name || row.client_snapshot?.businessName || row.client_snapshot?.name || "",
    clientSnapshot: row.client_snapshot || {
      id: row.client_id || null,
      name: row.client_name || "",
      businessName: row.client_name || ""
    },
    date: row.date || new Date().toISOString().slice(0, 10),
    status: row.status || "draft",
    discountType: row.discount_type || "percent",
    discountValue: normalizeNumber(row.discount_value),
    applyTax: row.apply_tax ?? true,
    taxRate: normalizeNumber(row.tax_rate),
    notes: row.notes || "",
    paymentTerms: row.payment_terms || "",
    deliveryEstimate: row.delivery_time || "",
    items: Array.isArray(row.items) ? row.items : [],
    totals: {
      subtotal: normalizeNumber(row.subtotal),
      extras: normalizeNumber(row.extras),
      discount: normalizeNumber(row.discount),
      taxes: normalizeNumber(row.tax),
      total: normalizeNumber(row.total)
    },
    archivedAt: row.archived_at || null,
    duplicatedFromId: row.duplicated_from_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message || "No se pudo obtener el usuario autenticado");
  }

  return data.user?.id || null;
}

function buildQuotePayload(quote, userId) {
  return {
    ...(userId ? { user_id: userId } : {}),
    quote_number: quote.quoteNumber || undefined,
    client_name:
      quote.clientName ||
      quote.clientSnapshot?.businessName ||
      quote.clientSnapshot?.name ||
      "",
    client_id: quote.clientId || quote.clientSnapshot?.id || null,
    client_snapshot: quote.clientSnapshot || null,
    date: quote.date || new Date().toISOString().slice(0, 10),
    status: quote.status || "draft",
    subtotal: normalizeNumber(quote.totals?.subtotal),
    extras: normalizeNumber(quote.totals?.extras),
    tax: normalizeNumber(quote.totals?.taxes),
    discount: normalizeNumber(quote.totals?.discount),
    total: normalizeNumber(quote.totals?.total),
    notes: quote.notes || "",
    payment_terms: quote.paymentTerms || "",
    delivery_time: quote.deliveryEstimate || "",
    discount_type: quote.discountType || "percent",
    discount_value: normalizeNumber(quote.discountValue),
    apply_tax: quote.applyTax ?? true,
    tax_rate: normalizeNumber(quote.taxRate),
    items: Array.isArray(quote.items) ? quote.items : [],
    archived_at: quote.archivedAt || null,
    duplicated_from_id: quote.duplicatedFromId || null,
    updated_at: new Date().toISOString()
  };
}

function quoteNumberValue(quoteNumber, year) {
  if (typeof quoteNumber !== "string") {
    return 0;
  }

  const match = quoteNumber.match(new RegExp(`^Q-${year}-(\\d+)$`));
  if (!match) {
    return 0;
  }

  return Number(match[1]) || 0;
}

async function generateNextQuoteNumber() {
  const year = new Date().getFullYear();
  const { data, error } = await supabase.from("quotes").select("quote_number");
  if (error) {
    throw new Error(error.message || "No se pudo calcular el pr?ximo n?mero de cotizaci?n");
  }

  const maxIndex = (data || []).reduce((highest, row) => {
    return Math.max(highest, quoteNumberValue(row.quote_number, year));
  }, 0);

  return `Q-${year}-${String(maxIndex + 1).padStart(4, "0")}`;
}

export async function loadRemoteQuotes() {
  if (!hasSupabaseConfig || !supabase || !quotesTableAvailable) {
    return null;
  }

  const { data, error } = await supabase.from("quotes").select("*").order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) {
      quotesTableAvailable = false;
      return null;
    }
    throw new Error(error.message || "No se pudieron cargar las cotizaciones desde Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemoteQuote).filter(Boolean) : [];
}

export async function createRemoteQuote(payload) {
  if (!hasSupabaseConfig || !supabase || !quotesTableAvailable) {
    return null;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesi?n autenticada para crear cotizaciones");
  }

  const quoteNumber = payload.quoteNumber || (await generateNextQuoteNumber());
  const { data, error } = await supabase
    .from("quotes")
    .insert(buildQuotePayload({ ...payload, quoteNumber }, userId))
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo crear la cotizaci?n en Supabase");
  }

  return normalizeRemoteQuote(data);
}

export async function updateRemoteQuote(id, payload) {
  if (!hasSupabaseConfig || !supabase || !quotesTableAvailable) {
    return null;
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(buildQuotePayload(payload))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la cotizaci?n en Supabase");
  }

  return normalizeRemoteQuote(data);
}

export async function deleteRemoteQuote(id) {
  if (!hasSupabaseConfig || !supabase || !quotesTableAvailable) {
    return null;
  }

  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "No se pudo eliminar la cotizaci?n en Supabase");
  }

  return { ok: true };
}

export async function migrateLocalQuotesToRemote(localQuotes) {
  if (!hasSupabaseConfig || !supabase || !quotesTableAvailable || !Array.isArray(localQuotes) || localQuotes.length === 0) {
    return [];
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesi?n autenticada para migrar cotizaciones");
  }

  const payload = localQuotes.map((quote) => buildQuotePayload(quote, userId));
  const { data, error } = await supabase.from("quotes").insert(payload).select();
  if (error) {
    throw new Error(error.message || "No se pudieron migrar las cotizaciones locales a Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemoteQuote).filter(Boolean) : [];
}
