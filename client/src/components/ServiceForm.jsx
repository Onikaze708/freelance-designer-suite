import { CATEGORY_OPTIONS, SERVICE_OPTION_LABELS, getServiceOptions } from "../utils/calculations";

const emptyService = {
  name: "",
  category: CATEGORY_OPTIONS[0],
  base_price: 0,
  unit: "proyecto",
  options: []
};

export function ServiceForm({ editingService, onSubmit, onCancel }) {
  const initial = editingService || emptyService;
  const selectedOptions = new Set(getServiceOptions(initial));
  return (
    <form key={editingService?.id || "new-service"} className="panel grid gap-4 p-6 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      onSubmit({
        category: formData.get("category"),
        name: formData.get("name"),
        base_price: Number(formData.get("base_price")),
        unit: formData.get("unit"),
        options: formData.getAll("options")
      });
    }}>
      <div><label className="label">Servicio</label><input name="name" className="input" defaultValue={initial.name} required /></div>
      <div><label className="label">Categoría</label><select name="category" className="input" defaultValue={initial.category}>{CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
      <div><label className="label">Precio base</label><input name="base_price" type="number" min="0" step="0.01" className="input" defaultValue={initial.base_price} /></div>
      <div><label className="label">Unidad</label><input name="unit" className="input" defaultValue={initial.unit} /></div>
      <div className="md:col-span-2 grid gap-3 md:grid-cols-3">{Object.entries(SERVICE_OPTION_LABELS).map(([value, label]) => <label key={value} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm"><input type="checkbox" name="options" value={value} defaultChecked={selectedOptions.has(value)} className="h-4 w-4 rounded border-slate-300" />{label}</label>)}</div>
      <div className="md:col-span-2 flex flex-wrap gap-3"><button className="button-primary" type="submit">{editingService ? "Guardar servicio" : "Crear servicio"}</button>{editingService ? <button className="button-secondary" type="button" onClick={onCancel}>Cancelar edición</button> : null}</div>
    </form>
  );
}
