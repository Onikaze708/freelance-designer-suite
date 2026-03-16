import { hasSupabaseConfig, supabase } from "./supabaseClient";

function normalizeRemoteClient(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userId: row.user_id || null,
    name: row.name || "",
    businessName: row.company || row.business_name || row.businessName || "",
    company: row.company || row.business_name || row.businessName || "",
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    notes: row.notes || "",
    workHistory: row.work_history || row.workHistory || "",
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message || "No se pudo obtener el usuario autenticado");
  }

  return data.user?.id || null;
}

function buildRemoteClientPayload(client, userId) {
  return {
    ...(userId ? { user_id: userId } : {}),
    name: client.name || "",
    company: client.businessName || client.company || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    notes: client.notes || "",
    work_history: client.workHistory || "",
    updated_at: new Date().toISOString()
  };
}

export async function loadRemoteClients() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.from("clients").select("*").order("updated_at", { ascending: false });
  if (error) {
    throw new Error(error.message || "No se pudieron cargar los clientes desde Supabase");
  }

  return Array.isArray(data) ? data.map(normalizeRemoteClient).filter(Boolean) : [];
}

export async function createRemoteClient(payload) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("No hay una sesión autenticada para crear clientes");
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(buildRemoteClientPayload(payload, userId))
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo crear el cliente en Supabase");
  }

  return normalizeRemoteClient(data);
}

export async function updateRemoteClient(id, payload) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("clients")
    .update(buildRemoteClientPayload(payload))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo actualizar el cliente en Supabase");
  }

  return normalizeRemoteClient(data);
}

export async function deleteRemoteClient(id) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "No se pudo eliminar el cliente en Supabase");
  }

  return { ok: true };
}
