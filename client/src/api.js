import { localApi, syncLocalClients, syncLocalSettings } from "./utils/localStore";
import { createRemoteClient, deleteRemoteClient, loadRemoteClients, updateRemoteClient } from "./utils/clientsRemote";
import { loadRemoteStudioSettings, saveRemoteStudioSettings } from "./utils/studioSettingsRemote";
import { hasSupabaseConfig, supabase } from "./utils/supabaseClient";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const LOCAL_MODE_KEY = "freelance-designer-suite.local-mode";

let lastStudioSettingsSource = "LocalStorage";
let lastClientsSource = "LocalStorage Fallback";

export function getStudioSettingsSource() {
  return lastStudioSettingsSource;
}

export function getClientsDataSource() {
  return lastClientsSource;
}

function setStudioSettingsSource(source) {
  lastStudioSettingsSource = source;
}

function setClientsDataSource(source) {
  lastClientsSource = source;
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
    return hydrateClients(withSettings);
  },
  createClient: async (payload) => {
    try {
      const remoteClient = await createRemoteClient(payload);
      if (remoteClient) {
        setClientsDataSource("Supabase");
        return remoteClient;
      }
    } catch (_error) {
      // Fall back to local storage below.
    }

    setClientsDataSource("LocalStorage Fallback");
    return localApi.createClient(payload);
  },
  updateClient: async (id, payload) => {
    try {
      const remoteClient = await updateRemoteClient(id, payload);
      if (remoteClient) {
        setClientsDataSource("Supabase");
        return remoteClient;
      }
    } catch (_error) {
      // Fall back to local storage below.
    }

    setClientsDataSource("LocalStorage Fallback");
    return localApi.updateClient(id, payload);
  },
  deleteClient: async (id) => {
    try {
      const remoteResult = await deleteRemoteClient(id);
      if (remoteResult?.ok) {
        setClientsDataSource("Supabase");
        return remoteResult;
      }
    } catch (_error) {
      // Fall back to local storage below.
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
  createQuote: (payload) =>
    runWithFallback(
      () => request("/quotes", { method: "POST", body: JSON.stringify(payload) }),
      () => localApi.createQuote(payload)
    ),
  updateQuote: (id, payload) =>
    runWithFallback(
      () => request(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => localApi.updateQuote(id, payload)
    ),
  convertQuoteToInvoice: (id, payload) =>
    runWithFallback(
      () =>
        request(`/quotes/${id}/convert-to-invoice`, {
          method: "POST",
          body: JSON.stringify(payload)
        }),
      () => localApi.convertQuoteToInvoice(id, payload)
    ),
  updateInvoice: (id, payload) =>
    runWithFallback(
      () => request(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => localApi.updateInvoice(id, payload)
    ),
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


