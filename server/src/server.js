import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createId, nextDocumentNumber, normalizeServiceRecord, readStore, updateStore } from "./store.js";

const app = express();
const PORT = process.env.PORT || 4100;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function withTimestamps(payload, existing = null) {
  const now = new Date().toISOString();
  return { ...payload, createdAt: existing?.createdAt ?? now, updatedAt: now };
}

function createPaymentFromInvoice(invoice) {
  return { id: createId("payment"), invoiceId: invoice.id, clientId: invoice.clientId, quoteId: invoice.quoteId || null, amount: invoice.totals.total, method: invoice.paymentMethod || "PayPal", status: "completed", paidAt: new Date().toISOString(), paypalLink: invoice.paypalLink || "", notes: invoice.notes || "" };
}

app.get("/api/bootstrap", (_req, res) => { res.json(readStore()); });

app.post("/api/clients", (req, res) => {
  const payload = req.body;
  const saved = updateStore((store) => { store.clients.unshift(withTimestamps({ id: createId("client"), name: payload.name, businessName: payload.businessName, email: payload.email, phone: payload.phone, notes: payload.notes, workHistory: payload.workHistory })); return store; });
  res.status(201).json(saved.clients[0]);
});

app.put("/api/clients/:id", (req, res) => {
  const saved = updateStore((store) => { store.clients = store.clients.map((client) => client.id === req.params.id ? withTimestamps({ ...client, ...req.body }, client) : client); return store; });
  res.json(saved.clients.find((item) => item.id === req.params.id));
});

app.post("/api/services", (req, res) => {
  const saved = updateStore((store) => { store.services.unshift(normalizeServiceRecord(req.body, createId("service"))); return store; });
  res.status(201).json(saved.services[0]);
});

app.put("/api/services/:id", (req, res) => {
  const saved = updateStore((store) => {
    store.services = store.services.map((service) => service.id === req.params.id ? normalizeServiceRecord({ ...service, ...req.body, id: service.id }, service.id) : service);
    return store;
  });
  res.json(saved.services.find((item) => item.id === req.params.id));
});

app.delete("/api/services/:id", (req, res) => {
  const saved = updateStore((store) => { store.services = store.services.filter((service) => service.id !== req.params.id); return store; });
  res.json({ ok: true, services: saved.services });
});

app.post("/api/quotes", (req, res) => {
  const payload = req.body;
  const saved = updateStore((store) => {
    const quote = withTimestamps({ ...payload, id: createId("quote"), quoteNumber: payload.quoteNumber || nextDocumentNumber("Q", store.quotes), status: payload.status || "draft" });
    store.quotes.unshift(quote);
    return store;
  });
  res.status(201).json(saved.quotes[0]);
});

app.put("/api/quotes/:id", (req, res) => {
  const saved = updateStore((store) => { store.quotes = store.quotes.map((quote) => quote.id === req.params.id ? withTimestamps({ ...quote, ...req.body }, quote) : quote); return store; });
  res.json(saved.quotes.find((item) => item.id === req.params.id));
});

app.post("/api/quotes/:id/convert-to-invoice", (req, res) => {
  const saved = updateStore((store) => {
    const quote = store.quotes.find((item) => item.id === req.params.id);
    if (!quote) throw new Error("Quote not found");
    const invoice = withTimestamps({ id: createId("invoice"), invoiceNumber: nextDocumentNumber("INV", store.invoices), quoteId: quote.id, clientId: quote.clientId, clientSnapshot: quote.clientSnapshot, issueDate: new Date().toISOString().slice(0, 10), dueDate: req.body.dueDate || quote.date, items: quote.items, totals: quote.totals, notes: quote.notes, paymentTerms: quote.paymentTerms, paymentMethod: "PayPal", paypalLink: req.body.paypalLink || store.settings.paypalLink || "", status: "draft" });
    store.quotes = store.quotes.map((item) => item.id === quote.id ? withTimestamps({ ...item, status: "approved" }, item) : item);
    store.invoices.unshift(invoice);
    return store;
  });
  res.status(201).json(saved.invoices[0]);
});

app.put("/api/invoices/:id", (req, res) => {
  const saved = updateStore((store) => {
    let paymentToAdd = null;
    store.invoices = store.invoices.map((invoice) => {
      if (invoice.id !== req.params.id) return invoice;
      const nextInvoice = withTimestamps({ ...invoice, ...req.body }, invoice);
      const hadPayment = store.payments.some((payment) => payment.invoiceId === invoice.id);
      if (invoice.status !== "paid" && nextInvoice.status === "paid" && !hadPayment) paymentToAdd = createPaymentFromInvoice(nextInvoice);
      return nextInvoice;
    });
    if (paymentToAdd) store.payments.unshift(paymentToAdd);
    return store;
  });
  res.json(saved.invoices.find((item) => item.id === req.params.id));
});

app.put("/api/settings", (req, res) => {
  const saved = updateStore((store) => { store.settings = { ...store.settings, ...req.body }; return store; });
  res.json(saved.settings);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => { res.sendFile(path.join(clientDist, "index.html")); });
}

app.use((error, _req, res, _next) => { res.status(500).json({ message: error.message || "Unexpected server error" }); });
app.listen(PORT, () => { console.log(`Freelance Designer Suite API running on http://localhost:${PORT}`); });