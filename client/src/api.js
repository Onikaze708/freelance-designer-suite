import { localApi, syncLocalSettings } from "./utils/localStore";
import { loadRemoteStudioSettings, saveRemoteStudioSettings } from "./utils/studioSettingsRemote";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const LOCAL_MODE_KEY = "freelance-designer-suite.local-mode";

let lastStudioSettingsSource = "LocalStorage Fallback";

export function getStudioSettingsSource() {
  return lastStudioSettingsSource;
}

function setStudioSettingsSource(source) {
  lastStudioSettingsSource = source;
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
      setStudioSettingsSource("LocalStorage Fallback");
      return appData;
    }

    const syncedSettings = syncLocalSettings(remoteSettings);
    console.log("SUPABASE READ SUCCESS");
    setStudioSettingsSource("Supabase");
    return { ...appData, settings: syncedSettings };
  } catch (error) {
    console.log("SUPABASE READ FAILED", error);
    console.log("LOCAL FALLBACK USED");
    setStudioSettingsSource("LocalStorage Fallback");
    return appData;
  }
}

export const api = {
  bootstrap: async () => hydrateStudioSettings(await runWithFallback(() => request("/bootstrap"), () => localApi.bootstrap())),
  createClient: (payload) =>
    runWithFallback(
      () => request("/clients", { method: "POST", body: JSON.stringify(payload) }),
      () => localApi.createClient(payload)
    ),
  updateClient: (id, payload) =>
    runWithFallback(
      () => request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => localApi.updateClient(id, payload)
    ),
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

    setStudioSettingsSource("LocalStorage Fallback");
    return localSettings;
  }
};
