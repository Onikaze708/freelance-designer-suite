const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const TABLE_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/studio_settings` : "";
const REMOTE_METADATA_KEYS = new Set(["id", "created_at", "updated_at", "user_id", "key", "slug", "name"]);

let cachedSettingsRow = null;

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function createHeaders(prefer = "return=representation") {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer
  };
}

function rowHasObjectColumn(row, key) {
  return Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] && typeof row[key] === "object";
}

function normalizeRowToSettings(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  if (rowHasObjectColumn(row, "settings")) {
    return row.settings;
  }

  if (rowHasObjectColumn(row, "payload")) {
    return row.payload;
  }

  const entries = Object.entries(row).filter(([key, value]) => !REMOTE_METADATA_KEYS.has(key) && value !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

async function fetchSingleSettingsRow() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const response = await fetch(`${TABLE_URL}?select=*&limit=1`, {
    headers: createHeaders()
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los ajustes desde Supabase");
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] || null : null;
  cachedSettingsRow = row;
  return row;
}

function buildPatchPayload(row, settings) {
  if (Object.prototype.hasOwnProperty.call(row || {}, "settings")) {
    return { settings };
  }

  if (Object.prototype.hasOwnProperty.call(row || {}, "payload")) {
    return { payload: settings };
  }

  return { ...settings };
}

export async function loadRemoteStudioSettings() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const row = await fetchSingleSettingsRow();
  return normalizeRowToSettings(row);
}

export async function saveRemoteStudioSettings(settings) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const row = cachedSettingsRow || (await fetchSingleSettingsRow());
  if (!row || row.id === undefined || row.id === null) {
    throw new Error("No se encontró una fila válida en studio_settings para actualizar");
  }

  const response = await fetch(`${TABLE_URL}?id=eq.${row.id}`, {
    method: "PATCH",
    headers: createHeaders(),
    body: JSON.stringify(buildPatchPayload(row, settings))
  });

  if (!response.ok) {
    throw new Error("No se pudieron guardar los ajustes en Supabase");
  }

  const rows = await response.json();
  const updatedRow = Array.isArray(rows) ? rows[0] || row : row;
  cachedSettingsRow = updatedRow;
  return normalizeRowToSettings(updatedRow);
}
