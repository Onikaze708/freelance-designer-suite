import seedData from "../data/local-seed-data.json";

const STORAGE_KEY = "freelance-designer-suite.local-store.v1";
const MOJIBAKE_PATTERN = /[\u00C3\u00C2\u00E2\uFFFD]/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeNestedObjects(baseValue, overrideValue) {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue ?? baseValue;
  }

  if (baseValue && overrideValue && typeof baseValue === "object" && typeof overrideValue === "object") {
    const merged = { ...baseValue };
    for (const [key, value] of Object.entries(overrideValue)) {
      merged[key] = mergeNestedObjects(baseValue[key], value);
    }
    return merged;
  }

  return overrideValue ?? baseValue;
}

function decodeLatin1AsUtf8(value) {
  const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
  return new TextDecoder("utf-8").decode(bytes);
}

function repairString(value) {
  let next = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!MOJIBAKE_PATTERN.test(next)) {
      break;
    }

    const decoded = decodeLatin1AsUtf8(next);
    if (decoded === next) {
      break;
    }

    next = decoded;
  }

  return next;
}

function repairTextTree(value) {
  if (typeof value === "string") {
    return repairString(value);
  }

  if (Array.isArray(value)) {
    return value.map(repairTextTree);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, repairTextTree(entry)]));
  }

  return value;
}

const seedDefaults = repairTextTree(clone(seedData));

function withOptionalServiceFields(target, service) {
  if (typeof service.description === "string") {
    target.description = service.description;
  }
  if (typeof service.notes === "string") {
    target.notes = service.notes;
  }
  if (service.base_package !== undefined) {
    target.base_package = Number(service.base_package || 0);
  }
  if (service.extra_photo_price !== undefined) {
    target.extra_photo_price = Number(service.extra_photo_price || 0);
  }
  return target;
}

function normalizeServiceRecord(service, fallbackId, index = 0) {
  const options = Array.isArray(service.options)
    ? service.options
    : [
        service.allowsQuantity ? "cantidad" : null,
        service.allowsComplexity ? "complejidad" : null,
        service.allowsUrgency ? "urgencia" : null,
        service.allowsRevisions ? "revisiones" : null,
        service.allowsResearch ? "investigacion" : null,
        service.allowsStrategy ? "estrategia" : null
      ].filter(Boolean);

  return withOptionalServiceFields(
    {
      id: service.id || fallbackId || `service-${index + 1}`,
      category: service.category || "Servicios",
      name: service.name || `Servicio ${index + 1}`,
      base_price: Number(service.base_price ?? service.basePrice ?? 0),
      unit: service.unit ?? service.billingUnit ?? "proyecto",
      options
    },
    service
  );
}

function normalizeClientRecord(client, fallbackId) {
  return {
    id: client.id || fallbackId || createId("client"),
    name: client.name || "",
    businessName: client.businessName || client.company || "",
    company: client.company || client.businessName || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    notes: client.notes || "",
    workHistory: client.workHistory || client.work_history || "",
    createdAt: client.createdAt || client.created_at || null,
    updatedAt: client.updatedAt || client.updated_at || null
  };
}
function mergeSettings(existingSettings = {}) {
  return mergeNestedObjects(clone(seedDefaults.settings), repairTextTree(existingSettings));
}

function mergeServices(existingServices = []) {
  const normalizedExisting = Array.isArray(existingServices)
    ? existingServices.map((service, index) =>
        normalizeServiceRecord(repairTextTree(service), service.id, index)
      )
    : [];

  const existingByCatalogKey = new Map(
    normalizedExisting.map((service) => [`${service.category}::${service.name}`, service])
  );

  const missingSeedServices = seedDefaults.services
    .map((service, index) => normalizeServiceRecord(service, service.id, index))
    .filter((service) => !existingByCatalogKey.has(`${service.category}::${service.name}`));

  return [...normalizedExisting, ...missingSeedServices];
}

function normalizeStore(store) {
  const repairedStore = repairTextTree(store || {});

  return {
    settings: mergeSettings(repairedStore.settings),
    clients: Array.isArray(repairedStore.clients) ? repairedStore.clients.map((client) => normalizeClientRecord(client, client.id)) : [],
    services: mergeServices(repairedStore.services),
    quotes: Array.isArray(repairedStore.quotes) ? repairedStore.quotes : [],
    invoices: Array.isArray(repairedStore.invoices) ? repairedStore.invoices : [],
    payments: Array.isArray(repairedStore.payments) ? repairedStore.payments : []
  };
}

function createBaseStore() {
  return normalizeStore(clone(seedDefaults));
}

function ensureLocalStore() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    const initialStore = createBaseStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStore));
    return initialStore;
  }

  try {
    const parsed = JSON.parse(existing);
    const normalized = normalizeStore(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (_error) {
    const fallbackStore = createBaseStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackStore));
    return fallbackStore;
  }
}

export function readLocalStore() {
  return clone(ensureLocalStore());
}

export function readLocalSettings() {
  return readLocalStore().settings;
}

function writeLocalStore(nextStore) {
  const normalized = normalizeStore(nextStore);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return clone(normalized);
}

export function syncLocalSettings(nextSettings) {
  const current = readLocalStore();
  current.settings = mergeSettings({ ...current.settings, ...nextSettings });
  return writeLocalStore(current).settings;
}

export function syncLocalClients(nextClients) {
  const current = readLocalStore();
  current.clients = Array.isArray(nextClients)
    ? nextClients.map((client) => normalizeClientRecord(client, client.id))
    : current.clients;
  return writeLocalStore(current).clients;
}

function updateLocalStore(mutator) {
  const current = readLocalStore();
  const nextStore = mutator(current);
  return writeLocalStore(nextStore);
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function nextDocumentNumber(prefix, items) {
  const year = new Date().getFullYear();
  const nextIndex = items.length + 1;
  return `${prefix}-${year}-${String(nextIndex).padStart(4, "0")}`;
}

function withTimestamps(payload, existing = null) {
  const now = new Date().toISOString();
  return {
    ...payload,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

function createPaymentFromInvoice(invoice) {
  return {
    id: createId("payment"),
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    quoteId: invoice.quoteId || null,
    amount: invoice.totals.total,
    method: invoice.paymentMethod || "PayPal",
    status: "completed",
    paidAt: new Date().toISOString(),
    paypalLink: invoice.paypalLink || "",
    notes: invoice.notes || ""
  };
}

export const localApi = {
  bootstrap() {
    return Promise.resolve(readLocalStore());
  },
  createClient(payload) {
    const saved = updateLocalStore((store) => {
      store.clients.unshift(
        withTimestamps(normalizeClientRecord({
          id: createId("client"),
          name: payload.name,
          businessName: payload.businessName,
          company: payload.company,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          notes: payload.notes,
          workHistory: payload.workHistory
        }))
      );
      return store;
    });
    return Promise.resolve(saved.clients[0]);
  },
  updateClient(id, payload) {
    const saved = updateLocalStore((store) => {
      store.clients = store.clients.map((client) =>
        client.id === id ? withTimestamps(normalizeClientRecord({ ...client, ...payload, id }, id), client) : client
      );
      return store;
    });
    return Promise.resolve(saved.clients.find((item) => item.id === id));
  },
  deleteClient(id) {
    const saved = updateLocalStore((store) => {
      store.clients = store.clients.filter((client) => client.id !== id);
      return store;
    });
    return Promise.resolve({ ok: true, clients: saved.clients });
  },
  createService(payload) {
    const saved = updateLocalStore((store) => {
      store.services.unshift(normalizeServiceRecord(payload, createId("service"), 0));
      return store;
    });
    return Promise.resolve(saved.services[0]);
  },
  updateService(id, payload) {
    const saved = updateLocalStore((store) => {
      store.services = store.services.map((service, index) =>
        service.id === id ? normalizeServiceRecord({ ...service, ...payload, id }, id, index) : service
      );
      return store;
    });
    return Promise.resolve(saved.services.find((item) => item.id === id));
  },
  deleteService(id) {
    const saved = updateLocalStore((store) => {
      store.services = store.services.filter((service) => service.id !== id);
      return store;
    });
    return Promise.resolve({ ok: true, services: saved.services });
  },
  createQuote(payload) {
    const saved = updateLocalStore((store) => {
      const quote = withTimestamps({
        ...payload,
        id: createId("quote"),
        quoteNumber: payload.quoteNumber || nextDocumentNumber("Q", store.quotes),
        status: payload.status || "draft"
      });
      store.quotes.unshift(quote);
      return store;
    });
    return Promise.resolve(saved.quotes[0]);
  },
  updateQuote(id, payload) {
    const saved = updateLocalStore((store) => {
      store.quotes = store.quotes.map((quote) =>
        quote.id === id ? withTimestamps({ ...quote, ...payload }, quote) : quote
      );
      return store;
    });
    return Promise.resolve(saved.quotes.find((item) => item.id === id));
  },
  convertQuoteToInvoice(id, payload) {
    const saved = updateLocalStore((store) => {
      const quote = store.quotes.find((item) => item.id === id);
      if (!quote) {
        throw new Error("CotizaciÃ³n no encontrada");
      }

      const invoice = withTimestamps({
        id: createId("invoice"),
        invoiceNumber: nextDocumentNumber("INV", store.invoices),
        quoteId: quote.id,
        clientId: quote.clientId,
        clientSnapshot: quote.clientSnapshot,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: payload?.dueDate || quote.date,
        items: quote.items,
        totals: quote.totals,
        notes: quote.notes,
        paymentTerms: quote.paymentTerms,
        paymentMethod: "PayPal",
        paypalLink: payload?.paypalLink || store.settings.paypalLink || "",
        status: "draft"
      });

      store.quotes = store.quotes.map((item) =>
        item.id === quote.id ? withTimestamps({ ...item, status: "approved" }, item) : item
      );
      store.invoices.unshift(invoice);
      return store;
    });
    return Promise.resolve(saved.invoices[0]);
  },
  updateInvoice(id, payload) {
    const saved = updateLocalStore((store) => {
      let paymentToAdd = null;
      store.invoices = store.invoices.map((invoice) => {
        if (invoice.id !== id) {
          return invoice;
        }

        const nextInvoice = withTimestamps({ ...invoice, ...payload }, invoice);
        const hadPayment = store.payments.some((payment) => payment.invoiceId === invoice.id);
        if (invoice.status !== "paid" && nextInvoice.status === "paid" && !hadPayment) {
          paymentToAdd = createPaymentFromInvoice(nextInvoice);
        }
        return nextInvoice;
      });

      if (paymentToAdd) {
        store.payments.unshift(paymentToAdd);
      }
      return store;
    });
    return Promise.resolve(saved.invoices.find((item) => item.id === id));
  },
  updateSettings(payload) {
    const saved = updateLocalStore((store) => {
      store.settings = { ...store.settings, ...payload };
      return store;
    });
    return Promise.resolve(saved.settings);
  }
};


