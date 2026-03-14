const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

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

export const api = {
  bootstrap: () => request("/bootstrap"),
  createClient: (payload) => request("/clients", { method: "POST", body: JSON.stringify(payload) }),
  updateClient: (id, payload) => request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  createService: (payload) => request("/services", { method: "POST", body: JSON.stringify(payload) }),
  updateService: (id, payload) => request(`/services/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteService: (id) => request(`/services/${id}`, { method: "DELETE" }),
  createQuote: (payload) => request("/quotes", { method: "POST", body: JSON.stringify(payload) }),
  updateQuote: (id, payload) => request(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  convertQuoteToInvoice: (id, payload) => request(`/quotes/${id}/convert-to-invoice`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updateInvoice: (id, payload) => request(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateSettings: (payload) => request("/settings", { method: "PUT", body: JSON.stringify(payload) })
};
