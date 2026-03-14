import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const seedPath = path.join(dataDir, "seed-data.json");
const runtimePath = path.join(dataDir, "runtime-app-data.json");

function normalizeLegacyService(service, index) {
  const options = [];
  if (service.allowsQuantity) options.push("cantidad");
  if (service.allowsComplexity) options.push("complejidad");
  if (service.allowsUrgency) options.push("urgencia");
  if (service.allowsRevisions) options.push("revisiones");
  if (service.allowsResearch) options.push("investigacion");
  if (service.allowsStrategy) options.push("estrategia");
  return {
    id: service.id || `service-${index + 1}`,
    category: service.category || "Servicios",
    name: service.name || `Servicio ${index + 1}`,
    base_price: Number(service.base_price ?? service.basePrice ?? 0),
    unit: service.unit ?? service.billingUnit ?? "proyecto",
    options
  };
}

function normalizeService(service, index) {
  if (Array.isArray(service.options) && Object.prototype.hasOwnProperty.call(service, "base_price")) {
    return {
      id: service.id || `service-${index + 1}`,
      category: service.category,
      name: service.name,
      base_price: Number(service.base_price || 0),
      unit: service.unit || "proyecto",
      options: service.options
    };
  }
  return normalizeLegacyService(service, index);
}

function normalizeData(data) {
  return {
    ...data,
    services: Array.isArray(data.services) ? data.services.map(normalizeService) : []
  };
}

function ensureRuntimeFile() {
  if (!fs.existsSync(runtimePath)) {
    fs.copyFileSync(seedPath, runtimePath);
  }
}

export function readStore() {
  ensureRuntimeFile();
  const current = JSON.parse(fs.readFileSync(runtimePath, "utf-8"));
  const normalized = normalizeData(current);
  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    fs.writeFileSync(runtimePath, JSON.stringify(normalized, null, 2));
  }
  return normalized;
}

export function writeStore(nextData) {
  ensureRuntimeFile();
  const normalized = normalizeData(nextData);
  fs.writeFileSync(runtimePath, JSON.stringify(normalized, null, 2));
  return normalized;
}

export function updateStore(mutator) {
  const current = readStore();
  const next = mutator(structuredClone(current));
  return writeStore(next);
}

export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function nextDocumentNumber(prefix, items) {
  const year = new Date().getFullYear();
  const nextIndex = items.length + 1;
  return `${prefix}-${year}-${String(nextIndex).padStart(4, "0")}`;
}

export function normalizeServiceRecord(service, fallbackId) {
  return normalizeService({ ...service, id: service.id || fallbackId }, 0);
}