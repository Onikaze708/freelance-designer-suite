import { localApi, readLocalStore, syncLocalClients, syncLocalInvoices, syncLocalPayments, syncLocalQuotes, syncLocalSettings } from "./utils/localStore";
import { createRemoteClient, deleteRemoteClient, loadRemoteClients, updateRemoteClient } from "./utils/clientsRemote";
import { createRemoteQuote, deleteRemoteQuote, loadRemoteQuotes, migrateLocalQuotesToRemote, updateRemoteQuote } from "./utils/quotesRemote";
import { createRemoteInvoice, loadRemoteInvoices, loadRemotePayments, migrateLocalInvoicesToRemote, migrateLocalPaymentsToRemote, updateRemoteInvoice } from "./utils/invoicesPaymentsRemote";
import { loadRemoteStudioSettings, saveRemoteStudioSettings } from "./utils/studioSettingsRemote";
import { hasSupabaseConfig, supabase } from "./utils/supabaseClient";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const LOCAL_MODE_KEY = "freelance-designer-suite.local-mode";

let lastStudioSettingsSource = "LocalStorage";
let lastClientsSource = "LocalStorage Fallback";
let lastQuotesSource = "LocalStorage Fallback";

export function getStudioSettingsSource() {
  return lastStudioSettingsSource;
}

export function getClientsDataSource() {
  return lastClientsSource;
}

export function getQuotesDataSource() {
  return lastQuotesSource;
}

function setStudioSettingsSource(source) {
  lastStudioSettingsSource = source;
}

function setClientsDataSource(source) {
  lastClientsSource = source;
}

function setQuotesDataSource(source) {
  lastQuotesSource = source;
}

function readLocalModePreference() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(LOCAL_MODE_KEY) === "true";
  } catch (_error) {
    return false;
  }
}

function persistLocalModePreference(enabled) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(LOCAL_MODE_KEY, "true");
    } else {
      window.localStorage.removeItem(LOCAL_MODE_KEY);
    }
  } catch (_error) {
    // Ignore storage access issues and continue using in-memory mode.
  }
}

let localModeEnabled = readLocalModePreference();

function enableLocalMode() {
  localModeEnabled = true;
  persistLocalModePreference(true);
}

function buildApiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request(path, options = {}) {
  const response = await fetch(buildApiUrl(path), { headers: JSON_HEADERS, ...options });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Error inesperado" }));
    throw new Error(error.message || "Error inesperado");
  }
  return response.json();
}

async function runWithFallback(remoteCall, localCall) {
  if (localModeEnabled) {
    return localCall();
  }

  try {
    return await remoteCall();
  } catch (_error) {
    enableLocalMode();
    return localCall();
  }
}

async function hydrateStudioSettings(appData) {
  console.log("SUPABASE READ START");

  try {
    const remoteSettings = await loadRemoteStudioSettings();
    if (!remoteSettings) {
      console.log("SUPABASE READ FAILED");
      console.log("LOCAL FALLBACK USED");
      setStudioSettingsSource("LocalStorage");
      return appData;
    }

    const syncedSettings = syncLocalSettings(remoteSettings);
    console.log("SUPABASE READ SUCCESS");
    setStudioSettingsSource("Supabase");
    return { ...appData, settings: syncedSettings };
  } catch (error) {
    console.log("SUPABASE READ FAILED", error);
    console.log("LOCAL FALLBACK USED");
    setStudioSettingsSource("LocalStorage");
    return appData;
  }
}

async function hydrateClients(appData) {
  try {
    const remoteClients = await loadRemoteClients();
    if (!remoteClients) {
      setClientsDataSource("LocalStorage Fallback");
      return appData;
    }

    const syncedClients = syncLocalClients(remoteClients);
    setClientsDataSource("Supabase");
    return { ...appData, clients: syncedClients };
  } catch (_error) {
    setClientsDataSource("LocalStorage Fallback");
    return appData;
  }
}

async function hydrateQuotes(appData) {
  if (!hasSupabaseConfig || !supabase) {
    setQuotesDataSource("LocalStorage Fallback");
    return appData;
  }

  try {
    const remoteQuotes = await loadRemoteQuotes();
    if (Array.isArray(remoteQuotes) && remoteQuotes.length > 0) {
      const syncedQuotes = syncLocalQuotes(remoteQuotes);
      setQuotesDataSource("Supabase");
      return { ...appData, quotes: syncedQuotes };
    }

    const localQuotes = Array.isArray(appData.quotes) ? appData.quotes : [];
    if (localQuotes.length > 0) {
      const migratedQuotes = await migrateLocalQuotesToRemote(localQuotes);
      const syncedQuotes = syncLocalQuotes(migratedQuotes);
      setQuotesDataSource("Supabase");
      return { ...appData, quotes: syncedQuotes };
    }

    const syncedQuotes = syncLocalQuotes([]);
    setQuotesDataSource("Supabase");
    return { ...appData, quotes: syncedQuotes };
  } catch (_error) {
    setQuotesDataSource("LocalStorage Fallback");
    return appData;
  }
}

async function hydrateInvoicesAndPayments(appData, originalLocalData) {
  if (!hasSupabaseConfig || !supabase) {
    return appData;
  }

  try {
    let remoteInvoices = await loadRemoteInvoices();
    const localInvoices = Array.isArray(originalLocalData?.invoices) ? originalLocalData.invoices : [];

    if ((!remoteInvoices || remoteInvoices.length === 0) && localInvoices.length > 0) {
      remoteInvoices = await migrateLocalInvoicesToRemote(localInvoices, {
        localQuotes: Array.isArray(originalLocalData?.quotes) ? originalLocalData.quotes : [],
        remoteQuotes: appData.quotes,
        remoteClients: appData.clients
      });
    }

    const syncedInvoices = syncLocalInvoices(Array.isArray(remoteInvoices) ? remoteInvoices : []);

    let remotePayments = await loadRemotePayments();
    const localPayments = Array.isArray(originalLocalData?.payments) ? originalLocalData.payments : [];

    if ((!remotePayments || remotePayments.length === 0) && localPayments.length > 0) {
      remotePayments = await migrateLocalPaymentsToRemote(localPayments, {
        localInvoices,
        remoteInvoices: syncedInvoices
      });
    }

    const syncedPayments = syncLocalPayments(Array.isArray(remotePayments) ? remotePayments : []);

    return {
      ...appData,
      invoices: syncedInvoices,
      payments: syncedPayments
    };
  } catch (_error) {
    return appData;
  }
}

export async function signInWithPassword({ email, password }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase Auth no está configurado.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message || "No se pudo iniciar sesión.");
  }
}

export async function signOut() {
  if (!hasSupabaseConfig || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message || "No se pudo cerrar sesión.");
  }
}

export async function getCurrentSession() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message || "No se pudo obtener la sesión.");
  }

  return data.session;
}

export function subscribeToAuthChanges(callback) {
  if (!hasSupabaseConfig || !supabase) {
    return () => {};
  }

  const subscription = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.data.subscription.unsubscribe();
}

export { hasSupabaseConfig };

export const api = {
  bootstrap: async () => {
    const baseData = await runWithFallback(() => request("/bootstrap"), () => localApi.bootstrap());
    const withSettings = await hydrateStudioSettings(baseData);
    const withClients = await hydrateClients(withSettings);
    const withQuotes = await hydrateQuotes(withClients);
    return hydrateInvoicesAndPayments(withQuotes, baseData);
  },
  createClient: async (payload) => {
    if (hasSupabaseConfig && supabase) {
      const remoteClient = await createRemoteClient(payload);
      setClientsDataSource("Supabase");
      return remoteClient;
    }

    setClientsDataSource("LocalStorage Fallback");
    return localApi.createClient(payload);
  },
  updateClient: async (id, payload) => {
    if (hasSupabaseConfig && supabase) {
      const remoteClient = await updateRemoteClient(id, payload);
      setClientsDataSource("Supabase");
      return remoteClient;
    }

    setClientsDataSource("LocalStorage Fallback");
    return localApi.updateClient(id, payload);
  },
  deleteClient: async (id) => {
    if (hasSupabaseConfig && supabase) {
      const remoteResult = await deleteRemoteClient(id);
      setClientsDataSource("Supabase");
      return remoteResult;
    }

    setClientsDataSource("LocalStorage Fallback");
    return localApi.deleteClient(id);
  },
  createService: (payload) =>
    runWithFallback(
      () => request("/services", { method: "POST", body: JSON.stringify(payload) }),
      () => localApi.createService(payload)
    ),
  updateService: (id, payload) =>
    runWithFallback(
      () => request(`/services/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => localApi.updateService(id, payload)
    ),
  deleteService: (id) =>
    runWithFallback(
      () => request(`/services/${id}`, { method: "DELETE" }),
      () => localApi.deleteService(id)
    ),
  createQuote: async (payload) => {
    console.log("QUOTE SAVE START", {
      mode: hasSupabaseConfig && supabase ? "supabase-first" : "local",
      items: Array.isArray(payload?.items) ? payload.items.length : 0,
      clientId: payload?.clientId || payload?.clientSnapshot?.id || null,
      discountType: payload?.discountType || null,
      discountValue: Number(payload?.discountValue ?? 0),
      discountAmount: Number(payload?.totals?.discountAmount ?? payload?.totals?.discount ?? 0),
      subtotal: Number(payload?.totals?.subtotal ?? 0),
      taxes: Number(payload?.totals?.taxes ?? 0),
      total: Number(payload?.totals?.total ?? 0)
    });

    if (hasSupabaseConfig && supabase) {
      try {
        const remoteQuote = await createRemoteQuote(payload);
        if (!remoteQuote) {
          setQuotesDataSource("LocalStorage Fallback");
          const localQuote = await localApi.createQuote(payload);
          console.log("QUOTE SAVE SUCCESS", { source: "LocalStorage Fallback", quoteId: localQuote?.id || null });
          return localQuote;
        }

        if (!remoteQuote.id) {
          throw new Error("No se recibió la cotización creada desde Supabase.");
        }

        const current = readLocalStore();
        syncLocalQuotes([remoteQuote, ...current.quotes.filter((quote) => quote.id !== remoteQuote.id)]);
        setQuotesDataSource("Supabase");
        console.log("QUOTE SAVE SUCCESS", { source: "Supabase", quoteId: remoteQuote.id });
        return remoteQuote;
      } catch (error) {
        console.error("QUOTE SAVE FAILED", error);
        setQuotesDataSource("Supabase");
        throw error;
      }
    }

    setQuotesDataSource("LocalStorage Fallback");
    const localQuote = await localApi.createQuote(payload);
    console.log("QUOTE SAVE SUCCESS", { source: "LocalStorage Fallback", quoteId: localQuote?.id || null });
    return localQuote;
  },
  updateQuote: async (id, payload) => {
    if (hasSupabaseConfig && supabase) {
      try {
        const remoteQuote = await updateRemoteQuote(id, payload);
        if (!remoteQuote) {
          setQuotesDataSource("LocalStorage Fallback");
          return localApi.updateQuote(id, payload);
        }
        if (!remoteQuote.id) {
          throw new Error("No se recibió la cotización actualizada desde Supabase.");
        }
        const current = readLocalStore();
        syncLocalQuotes(current.quotes.map((quote) => (quote.id === id ? remoteQuote : quote)));
        setQuotesDataSource("Supabase");
        return remoteQuote;
      } catch (error) {
        setQuotesDataSource("Supabase");
        throw error;
      }
    }

    setQuotesDataSource("LocalStorage Fallback");
    return localApi.updateQuote(id, payload);
  },
  deleteQuote: async (id) => {
    if (hasSupabaseConfig && supabase) {
      try {
        const remoteResult = await deleteRemoteQuote(id);
        const current = readLocalStore();
        syncLocalQuotes(current.quotes.filter((quote) => quote.id !== id));
        setQuotesDataSource("Supabase");
        return remoteResult;
      } catch (_error) {
        setQuotesDataSource("LocalStorage Fallback");
        return localApi.deleteQuote(id);
      }
    }

    setQuotesDataSource("LocalStorage Fallback");
    return localApi.deleteQuote(id);
  },
  convertQuoteToInvoice: async (id, payload) => {
    if (hasSupabaseConfig && supabase) {
      try {
        const current = readLocalStore();
        const currentQuote = current.quotes.find((quote) => quote.id === id);
        if (!currentQuote) {
          throw new Error("Cotizaci?n no encontrada");
        }

        const remoteQuote = await updateRemoteQuote(id, { ...currentQuote, status: "approved" });
        syncLocalQuotes(current.quotes.map((quote) => (quote.id === id ? remoteQuote : quote)));
        setQuotesDataSource("Supabase");
        const remoteInvoice = await createRemoteInvoice({
          quoteId: currentQuote.id,
          clientId: currentQuote.clientId,
          clientSnapshot: currentQuote.clientSnapshot,
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: payload?.dueDate || currentQuote.date,
          items: currentQuote.items,
          totals: currentQuote.totals,
          notes: currentQuote.notes,
          paymentTerms: currentQuote.paymentTerms,
          paymentMethod: "PayPal",
          paypalLink: payload?.paypalLink || current.settings?.paypalLink || "",
          status: "draft"
        });
        const currentInvoices = readLocalStore().invoices;
        syncLocalInvoices([remoteInvoice, ...currentInvoices.filter((invoice) => invoice.id !== remoteInvoice.id)]);
        setQuotesDataSource("Supabase");
        return remoteInvoice;
      } catch (_error) {
        setQuotesDataSource("LocalStorage Fallback");
        return localApi.convertQuoteToInvoice(id, payload);
      }
    }

    setQuotesDataSource("LocalStorage Fallback");
    return localApi.convertQuoteToInvoice(id, payload);
  },
  updateInvoice: async (id, payload) => {
    if (hasSupabaseConfig && supabase) {
      try {
        const current = readLocalStore();
        const currentInvoice = current.invoices.find((invoice) => invoice.id === id);
        if (!currentInvoice) {
          throw new Error("Factura no encontrada");
        }

        const result = await updateRemoteInvoice(id, { ...currentInvoice, ...payload });
        const nextInvoices = current.invoices.map((invoice) => (invoice.id === id ? result.invoice : invoice));
        syncLocalInvoices(nextInvoices);
        if (result.payment) {
          syncLocalPayments([result.payment, ...current.payments.filter((payment) => payment.id !== result.payment.id)]);
        }
        return result.invoice;
      } catch (_error) {
        return localApi.updateInvoice(id, payload);
      }
    }

    return localApi.updateInvoice(id, payload);
  },
  updateSettings: async (payload) => {
    const localSettings = await localApi.updateSettings(payload);

    try {
      const remoteSettings = await saveRemoteStudioSettings(localSettings);
      if (remoteSettings) {
        setStudioSettingsSource("Supabase");
        return syncLocalSettings(remoteSettings);
      }
    } catch (_error) {
      // Keep local settings as fallback.
    }

    setStudioSettingsSource("LocalStorage");
    return localSettings;
  }
};





