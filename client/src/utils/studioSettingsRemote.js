import { hasSupabaseConfig, supabase } from "./supabaseClient";

let cachedSettingsRow = null;

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

  const metadataKeys = new Set(["id", "created_at", "updated_at", "user_id", "key", "slug", "name"]);
  const entries = Object.entries(row).filter(([key, value]) => !metadataKeys.has(key) && value !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

async function fetchSingleSettingsRow() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.from("studio_settings").select("*").limit(1);
  if (error) {
    throw new Error(error.message || "No se pudieron cargar los ajustes desde Supabase");
  }

  const row = Array.isArray(data) ? data[0] || null : null;
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
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const row = await fetchSingleSettingsRow();
  return normalizeRowToSettings(row);
}

export async function saveRemoteStudioSettings(settings) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const row = cachedSettingsRow || (await fetchSingleSettingsRow());
  if (!row || row.id === undefined || row.id === null) {
    throw new Error("No se encontró una fila válida en studio_settings para actualizar");
  }

  const { data, error } = await supabase
    .from("studio_settings")
    .update(buildPatchPayload(row, settings))
    .eq("id", row.id)
    .select()
    .limit(1);

  if (error) {
    throw new Error(error.message || "No se pudieron guardar los ajustes en Supabase");
  }

  const updatedRow = Array.isArray(data) ? data[0] || row : row;
  cachedSettingsRow = updatedRow;
  return normalizeRowToSettings(updatedRow);
}
