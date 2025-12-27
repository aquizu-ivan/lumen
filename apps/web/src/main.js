const statusEl = document.getElementById("status-content");
const overviewEl = document.getElementById("overview-content");
const metaServiceEl = document.getElementById("meta-service");
const metaEnvEl = document.getElementById("meta-env");
const metaStartedEl = document.getElementById("meta-started");
const metaUptimeEl = document.getElementById("meta-uptime");
const filterFromEl = document.getElementById("filter-from");
const filterToEl = document.getElementById("filter-to");
const filterServiceEl = document.getElementById("filter-service");
const filterNoteEl = document.getElementById("filter-note");
const preset24Btn = document.getElementById("preset-24h");
const preset7Btn = document.getElementById("preset-7d");
const preset30Btn = document.getElementById("preset-30d");
const applyFiltersBtn = document.getElementById("apply-filters");
const clearFiltersBtn = document.getElementById("clear-filters");
const copyLinkBtn = document.getElementById("copy-link");
const copyFeedbackEl = document.getElementById("copy-feedback");
const contractHealthEl = document.getElementById("contract-health");
const contractOverviewEl = document.getElementById("contract-overview");
const statusAnnounceEl = document.getElementById("status-announce");
const overviewAnnounceEl = document.getElementById("overview-announce");
const overviewUpdatedEl = document.getElementById("overview-updated");

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseUrl = import.meta.env.DEV ? envBaseUrl || "http://localhost:4000" : envBaseUrl;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
let pendingServiceId = "";
let copyFeedbackTimeout = null;
let filterNoteTimeout = null;
let lastStatusAnnouncement = "";
let lastOverviewAnnouncement = "";
const overviewCache = new Map();
const overviewInflight = new Map();
const OVERVIEW_TTL_MS = 30000;

function setText(el, text) {
  el.textContent = text;
}

function setError(el, info) {
  setText(el, describeError(info));
}

function setContractError(el, info) {
  if (info && info.type === "http") {
    setText(el, `ERROR HTTP ${info.status}`);
    return;
  }
  setText(el, "ERROR network");
}

function setContractJson(el, data) {
  const payload = data === undefined ? null : data;
  setText(el, JSON.stringify(payload, null, 2));
}

function announceStatus(message) {
  if (!statusAnnounceEl || !message || message === lastStatusAnnouncement) {
    return;
  }
  statusAnnounceEl.textContent = message;
  lastStatusAnnouncement = message;
}

function announceOverview(message) {
  if (!overviewAnnounceEl || !message || message === lastOverviewAnnouncement) {
    return;
  }
  overviewAnnounceEl.textContent = message;
  lastOverviewAnnouncement = message;
}

function describeError(info) {
  if (info && info.type === "http") {
    if (info.status >= 500) {
      return "No se pudo cargar. Problema del servidor.";
    }
    return "No se pudo cargar. Revisa filtros o permisos.";
  }
  return "No se pudo conectar. Revisa conexion o CORS.";
}

function showFilterNote(message) {
  if (!filterNoteEl) {
    return;
  }
  filterNoteEl.textContent = message;
  filterNoteEl.classList.add("is-visible");
  if (filterNoteTimeout) {
    clearTimeout(filterNoteTimeout);
  }
  filterNoteTimeout = setTimeout(() => {
    filterNoteEl.classList.remove("is-visible");
  }, 2200);
}

function clearFilterNote() {
  if (!filterNoteEl) {
    return;
  }
  filterNoteEl.classList.remove("is-visible");
  filterNoteEl.textContent = "";
  if (filterNoteTimeout) {
    clearTimeout(filterNoteTimeout);
    filterNoteTimeout = null;
  }
}

function setUpdatedLine(timestampMs) {
  if (!overviewUpdatedEl) {
    return;
  }
  if (!timestampMs) {
    overviewUpdatedEl.textContent = "";
    overviewUpdatedEl.classList.remove("is-visible");
    return;
  }
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - timestampMs) / 1000));
  let label;
  if (diffSeconds < 60) {
    label = `Actualizado hace ${diffSeconds}s`;
  } else {
    const minutes = Math.floor(diffSeconds / 60);
    label = `Actualizado hace ${minutes}m`;
  }
  overviewUpdatedEl.textContent = label;
  overviewUpdatedEl.classList.add("is-visible");
}

function buildOverviewKey() {
  const from = filterFromEl && filterFromEl.value ? filterFromEl.value : "";
  const to = filterToEl && filterToEl.value ? filterToEl.value : "";
  const serviceId = filterServiceEl && filterServiceEl.value ? filterServiceEl.value : "";
  return `${from}|${to}|${serviceId}`;
}

function fetchOverviewWithCache() {
  const key = buildOverviewKey();
  const now = Date.now();
  const cached = overviewCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    return Promise.resolve({ data: cached.data, source: "cache" });
  }
  if (overviewInflight.has(key)) {
    return overviewInflight.get(key);
  }
  const promise = fetchJson(buildOverviewUrl())
    .then((result) => {
      overviewInflight.delete(key);
      if (result.ok) {
        const fetchedAtMs = Date.now();
        overviewCache.set(key, {
          data: result.data,
          fetchedAtMs,
          expiresAtMs: fetchedAtMs + OVERVIEW_TTL_MS
        });
        return { data: result.data, source: "network" };
      }
      return Promise.reject(result);
    })
    .catch((err) => {
      overviewInflight.delete(key);
      return Promise.reject(err);
    });
  overviewInflight.set(key, promise);
  return promise;
}

function formatDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }
  if (dateRegex.test(value)) {
    return value;
  }
  if (dateTimeRegex.test(value)) {
    return value.slice(0, 10);
  }
  return "";
}

function normalizeFilters(values) {
  const rawFrom = values.from || "";
  const rawTo = values.to || "";
  const normalized = {
    from: normalizeDate(rawFrom),
    to: normalizeDate(rawTo),
    serviceId: typeof values.serviceId === "string" ? values.serviceId : ""
  };
  let corrected = false;
  if (rawFrom && rawFrom !== normalized.from) {
    corrected = true;
  }
  if (rawTo && rawTo !== normalized.to) {
    corrected = true;
  }
  if (normalized.from && normalized.to && normalized.from > normalized.to) {
    const temp = normalized.from;
    normalized.from = normalized.to;
    normalized.to = temp;
    corrected = true;
  }
  return { values: normalized, corrected };
}

function readFiltersFromInputs() {
  return {
    from: filterFromEl ? filterFromEl.value : "",
    to: filterToEl ? filterToEl.value : "",
    serviceId: filterServiceEl ? filterServiceEl.value : ""
  };
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    from: params.get("from") || "",
    to: params.get("to") || "",
    serviceId: params.get("serviceId") || ""
  };
}

function writeFiltersToUrl(values) {
  const params = new URLSearchParams();
  if (values.from) {
    params.set("from", values.from);
  }
  if (values.to) {
    params.set("to", values.to);
  }
  if (values.serviceId) {
    params.set("serviceId", values.serviceId);
  }
  const query = params.toString();
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", newUrl);
}

function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => false);
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return Promise.resolve(ok);
}

function showCopyFeedback(message) {
  if (!copyFeedbackEl) {
    return;
  }
  copyFeedbackEl.textContent = message;
  copyFeedbackEl.classList.add("is-visible");
  if (copyFeedbackTimeout) {
    clearTimeout(copyFeedbackTimeout);
  }
  copyFeedbackTimeout = setTimeout(() => {
    copyFeedbackEl.classList.remove("is-visible");
  }, 1200);
}

function clearEl(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function showOverviewMessage(message, tone) {
  clearEl(overviewEl);
  const msg = document.createElement("div");
  msg.className = "state-message";
  if (tone) {
    msg.classList.add(tone);
  }
  msg.textContent = message;
  overviewEl.appendChild(msg);
  requestAnimationFrame(() => {
    msg.classList.add("is-visible");
  });
  announceOverview(message);
  setUpdatedLine(null);
}

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, type: "http", status: response.status };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, type: "network", error };
  }
}

function renderHealth(data) {
  clearEl(statusEl);
  const hasBase =
    data &&
    typeof data === "object" &&
    ["service", "env", "startedAt", "version", "uptimeSeconds", "build"].every((key) => key in data);
  const build = data && data.build;
  const hasBuild =
    build &&
    typeof build === "object" &&
    ["gitSha", "deployId", "serviceId", "serviceInstanceId", "region"].every((key) => key in build);
  const statusText = data && data.ok === true && hasBase && hasBuild ? "OK" : "DEGRADED";
  const statusLine = document.createElement("div");
  statusLine.className = `status-pill status-${statusText.toLowerCase()}`;
  statusLine.textContent = `Status: ${statusText}`;
  statusEl.appendChild(statusLine);
  setMetaLine(data);
  announceStatus(`Status ${statusText}`);
  const service = data && typeof data.service === "string" ? data.service : "n/a";
  const env = data && typeof data.env === "string" ? data.env : "n/a";
  const startedAt = data && typeof data.startedAt === "string" ? data.startedAt : "n/a";
  const line = document.createElement("div");
  line.textContent = `service: ${service} | env: ${env} | startedAt: ${startedAt}`;
  statusEl.appendChild(line);
}

function renderOverview(data) {
  clearEl(overviewEl);
  const safeData = data && typeof data === "object" ? data : {};
  const total = typeof safeData.total === "number" ? safeData.total : 0;
  const noShowRate = typeof safeData.noShowRate === "number" ? safeData.noShowRate : 0;
  const summary = document.createElement("div");
  summary.textContent = `total: ${total} | noShowRate: ${noShowRate}`;
  overviewEl.appendChild(summary);
  if (total === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Sin datos para este rango/servicio. Proba presets 7d o 30d.";
    overviewEl.appendChild(empty);
    announceOverview("Sin datos para este rango/servicio. Proba presets 7d o 30d.");
  }
  const list = document.createElement("ul");
  const byService = Array.isArray(safeData.byService) ? safeData.byService : [];
  byService.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const li = document.createElement("li");
    const serviceId = typeof item.serviceId === "string" ? item.serviceId : "n/a";
    const count = typeof item.count === "number" ? item.count : 0;
    const noShow = typeof item.noShow === "number" ? item.noShow : 0;
    li.textContent = `${serviceId}: ${count} (no-show: ${noShow})`;
    list.appendChild(li);
  });
  overviewEl.appendChild(list);
}

function setMetaLine(data) {
  if (!metaServiceEl || !metaEnvEl || !metaStartedEl || !metaUptimeEl) {
    return;
  }
  const service = data && typeof data.service === "string" ? data.service : "n/a";
  const env = data && typeof data.env === "string" ? data.env : "n/a";
  const startedAt = data && typeof data.startedAt === "string" ? data.startedAt : "n/a";
  const uptimeSeconds = data && typeof data.uptimeSeconds === "number" ? data.uptimeSeconds : null;
  const uptime = uptimeSeconds === null ? "n/a" : `${uptimeSeconds}s`;
  metaServiceEl.textContent = `service: ${service}`;
  metaEnvEl.textContent = `env: ${env}`;
  metaStartedEl.textContent = `startedAt: ${startedAt}`;
  metaUptimeEl.textContent = `uptime: ${uptime}`;
}

function renderStatusError(info, message) {
  clearEl(statusEl);
  const statusLine = document.createElement("div");
  statusLine.className = "status-pill status-error";
  statusLine.textContent = "Status: ERROR";
  statusEl.appendChild(statusLine);
  const detail = document.createElement("div");
  if (message) {
    detail.textContent = message;
  } else {
    detail.textContent = describeError(info);
  }
  statusEl.appendChild(detail);
  setMetaLine(null);
  announceStatus("Status ERROR");
}

function populateServices(metaData) {
  if (!filterServiceEl) {
    return;
  }
  filterServiceEl.innerHTML = '<option value="">Todos</option>';
  const services =
    metaData && metaData.data && Array.isArray(metaData.data.services) ? metaData.data.services : [];
  services.forEach((service) => {
    if (!service || typeof service !== "object") {
      return;
    }
    const id = typeof service.id === "string" ? service.id : "";
    if (!id) {
      return;
    }
    const name = typeof service.name === "string" ? service.name : id;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    filterServiceEl.appendChild(option);
  });
  applyServiceSelection(pendingServiceId);
  pendingServiceId = "";
}

function applyServiceSelection(value) {
  if (!filterServiceEl) {
    return;
  }
  if (!value) {
    filterServiceEl.value = "";
    return;
  }
  const exists = Array.from(filterServiceEl.options).some((option) => option.value === value);
  if (!exists) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    filterServiceEl.appendChild(option);
  }
  filterServiceEl.value = value;
}

function applyFilters(values) {
  const normalized = normalizeFilters(values);
  if (filterFromEl) {
    filterFromEl.value = normalized.values.from;
  }
  if (filterToEl) {
    filterToEl.value = normalized.values.to;
  }
  if (filterServiceEl) {
    filterServiceEl.value = normalized.values.serviceId;
  }
  writeFiltersToUrl(normalized.values);
  if (normalized.corrected) {
    showFilterNote("Rango corregido automaticamente");
  } else {
    clearFilterNote();
  }
  if (normalized.values.from || normalized.values.to || normalized.values.serviceId) {
    loadOverview();
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver metricas.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
    setUpdatedLine(null);
  }
}

function applyPreset(days) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - days);
  const current = readFiltersFromInputs();
  applyFilters({
    from: formatDate(fromDate),
    to: formatDate(today),
    serviceId: current.serviceId
  });
}

function buildOverviewUrl() {
  const params = new URLSearchParams();
  if (filterFromEl && filterFromEl.value) {
    params.set("from", filterFromEl.value);
  }
  if (filterToEl && filterToEl.value) {
    params.set("to", filterToEl.value);
  }
  if (filterServiceEl && filterServiceEl.value) {
    params.set("serviceId", filterServiceEl.value);
  }
  const query = params.toString();
  return `${baseUrl}/metrics/overview${query ? `?${query}` : ""}`;
}

async function loadOverview() {
  const key = buildOverviewKey();
  const now = Date.now();
  const cached = overviewCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    renderOverview(cached.data.data);
    setContractJson(contractOverviewEl, cached.data);
    setUpdatedLine(cached.fetchedAtMs);
    return;
  }
  showOverviewMessage("Cargando metricas...", "is-loading");
  setText(contractOverviewEl, "Consultando /metrics/overview...");
  try {
    const result = await fetchOverviewWithCache();
    renderOverview(result.data.data);
    setContractJson(contractOverviewEl, result.data);
    const latest = overviewCache.get(key);
    if (latest) {
      setUpdatedLine(latest.fetchedAtMs);
    } else {
      setUpdatedLine(Date.now());
    }
  } catch (error) {
    showOverviewMessage(describeError(error), "is-error");
    setContractError(contractOverviewEl, error);
  }
}

async function init() {
  const initialFilters = normalizeFilters(readFiltersFromUrl());
  if (filterFromEl) {
    filterFromEl.value = initialFilters.values.from;
  }
  if (filterToEl) {
    filterToEl.value = initialFilters.values.to;
  }
  pendingServiceId = initialFilters.values.serviceId;
  writeFiltersToUrl(initialFilters.values);
  if (initialFilters.corrected) {
    showFilterNote("Rango corregido automaticamente");
  }
  setText(statusEl, "Consultando /health...");
  announceStatus("Consultando /health...");
  if (initialFilters.values.from || initialFilters.values.to || initialFilters.values.serviceId) {
    showOverviewMessage("Cargando metricas...", "is-loading");
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver metricas.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
  }
  setText(contractHealthEl, "Consultando /health...");

  if (!baseUrl) {
    renderStatusError(null, "VITE_API_BASE_URL requerida en produccion");
    setText(overviewEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(contractHealthEl, "ERROR baseUrl");
    setText(contractOverviewEl, "ERROR baseUrl");
    return;
  }

  const healthResult = await fetchJson(`${baseUrl}/health`);
  if (!healthResult.ok) {
    renderStatusError(healthResult);
    setContractError(contractHealthEl, healthResult);
  } else {
    renderHealth(healthResult.data);
    setContractJson(contractHealthEl, healthResult.data);
  }

  const metaResult = await fetchJson(`${baseUrl}/meta`);
  if (metaResult.ok) {
    populateServices(metaResult.data);
  } else {
    applyServiceSelection(pendingServiceId);
    pendingServiceId = "";
  }

  if (initialFilters.values.from || initialFilters.values.to || initialFilters.values.serviceId) {
    await loadOverview();
  }
}

if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener("click", () => {
    applyFilters(readFiltersFromInputs());
  });
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    applyFilters({ from: "", to: "", serviceId: "" });
  });
}

if (preset24Btn) {
  preset24Btn.addEventListener("click", () => {
    applyPreset(1);
  });
}

if (preset7Btn) {
  preset7Btn.addEventListener("click", () => {
    applyPreset(7);
  });
}

if (preset30Btn) {
  preset30Btn.addEventListener("click", () => {
    applyPreset(30);
  });
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    const ok = await copyText(window.location.href);
    showCopyFeedback(ok ? "Copiado" : "No se pudo copiar");
  });
}

init();
