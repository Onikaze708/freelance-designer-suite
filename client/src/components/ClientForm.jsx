const emptyClient = { name: "", businessName: "", email: "", phone: "", notes: "", workHistory: "" };

export function ClientForm({ editingClient, onSubmit, onCancel }) {
  const initial = editingClient || emptyClient;
  return (
    <form key={editingClient?.id || "new-client"} className="panel grid gap-4 p-6 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      onSubmit({
        name: formData.get("name"),
        businessName: formData.get("businessName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        notes: formData.get("notes"),
        workHistory: formData.get("workHistory")
      });
    }}>
      <div><label className="label">Nombre</label><input name="name" className="input" defaultValue={initial.name} required /></div>
      <div><label className="label">Negocio</label><input name="businessName" className="input" defaultValue={initial.businessName} /></div>
      <div><label className="label">Correo</label><input name="email" type="email" className="input" defaultValue={initial.email} /></div>
      <div><label className="label">Teléfono</label><input name="phone" className="input" defaultValue={initial.phone} /></div>
      <div className="md:col-span-2"><label className="label">Notas</label><textarea name="notes" className="input min-h-24" defaultValue={initial.notes} /></div>
      <div className="md:col-span-2"><label className="label">Historial de trabajos previos</label><textarea name="workHistory" className="input min-h-24" defaultValue={initial.workHistory} /></div>
      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button className="button-primary" type="submit">{editingClient ? "Guardar cambios" : "Guardar cliente"}</button>
        {editingClient ? <button className="button-secondary" type="button" onClick={onCancel}>Cancelar edición</button> : null}
      </div>
    </form>
  );
}
