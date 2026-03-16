import { useEffect, useState } from "react";

const DRAFT_STORAGE_KEY = "client_form_draft";
const emptyClient = { name: "", businessName: "", email: "", phone: "", address: "", notes: "", workHistory: "" };

function sanitizeDraft(value) {
  return {
    name: value?.name || "",
    businessName: value?.businessName || value?.company || "",
    email: value?.email || "",
    phone: value?.phone || "",
    address: value?.address || "",
    notes: value?.notes || "",
    workHistory: value?.workHistory || ""
  };
}

function readDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? sanitizeDraft(JSON.parse(raw)) : null;
  } catch (_error) {
    return null;
  }
}

function hasMeaningfulDraft(value) {
  return Object.values(sanitizeDraft(value)).some((entry) => String(entry || "").trim() !== "");
}

function writeDraft(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (hasMeaningfulDraft(value)) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(sanitizeDraft(value)));
    } else {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (_error) {
    // Ignore draft persistence issues.
  }
}

function clearDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_error) {
    // Ignore draft persistence issues.
  }
}

export function ClientForm({ editingClient, onSubmit, onCancel, draftResetToken = 0 }) {
  const [formState, setFormState] = useState(() => {
    if (editingClient) {
      return sanitizeDraft(editingClient);
    }

    return readDraft() || emptyClient;
  });
  const [draftRestored, setDraftRestored] = useState(() => !editingClient && Boolean(readDraft()));

  useEffect(() => {
    if (editingClient) {
      setFormState(sanitizeDraft(editingClient));
      setDraftRestored(false);
      return;
    }

    const restoredDraft = readDraft();
    setFormState(restoredDraft || emptyClient);
    setDraftRestored(Boolean(restoredDraft));
  }, [editingClient]);

  useEffect(() => {
    if (editingClient) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      writeDraft(formState);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [formState, editingClient]);

  useEffect(() => {
    if (!draftResetToken || editingClient) {
      return;
    }

    clearDraft();
    setFormState(emptyClient);
    setDraftRestored(false);
  }, [draftResetToken, editingClient]);

  function updateField(field, value) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      key={editingClient?.id || "new-client"}
      className="panel grid gap-4 p-6 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          ...formState,
          company: formState.businessName
        });
      }}
    >
      {!editingClient && draftRestored ? (
        <div className="md:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Borrador restaurado automaticamente.
        </div>
      ) : null}

      <div><label className="label">Nombre</label><input name="name" className="input" value={formState.name} onChange={(event) => updateField("name", event.target.value)} required /></div>
      <div><label className="label">Negocio</label><input name="businessName" className="input" value={formState.businessName} onChange={(event) => updateField("businessName", event.target.value)} /></div>
      <div><label className="label">Correo</label><input name="email" type="email" className="input" value={formState.email} onChange={(event) => updateField("email", event.target.value)} /></div>
      <div><label className="label">Teléfono</label><input name="phone" className="input" value={formState.phone} onChange={(event) => updateField("phone", event.target.value)} /></div>
      <div className="md:col-span-2"><label className="label">Dirección</label><input name="address" className="input" value={formState.address} onChange={(event) => updateField("address", event.target.value)} /></div>
      <div className="md:col-span-2"><label className="label">Notas</label><textarea name="notes" className="input min-h-24" value={formState.notes} onChange={(event) => updateField("notes", event.target.value)} /></div>
      <div className="md:col-span-2"><label className="label">Historial de trabajos previos</label><textarea name="workHistory" className="input min-h-24" value={formState.workHistory} onChange={(event) => updateField("workHistory", event.target.value)} /></div>
      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button className="button-primary" type="submit">{editingClient ? "Guardar cambios" : "Guardar cliente"}</button>
        {editingClient ? <button className="button-secondary" type="button" onClick={onCancel}>Cancelar edición</button> : null}
      </div>
    </form>
  );
}
