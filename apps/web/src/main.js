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
const demoToggleEl = document.getElementById("demo-toggle");
const demoPillEl = document.getElementById("demo-pill");
const preset24Btn = document.getElementById("preset-24h");
const preset7Btn = document.getElementById("preset-7d");
const preset30Btn = document.getElementById("preset-30d");
const applyFiltersBtn = document.getElementById("apply-filters");
const clearFiltersBtn = document.getElementById("clear-filters");
const copyLinkBtn = document.getElementById("copy-link");
const copyFeedbackEl = document.getElementById("copy-feedback");
const contractHealthEl = document.getElementById("contract-health");
const contractOverviewEl = document.getElementById("contract-overview");
const contractHealthSectionEl = document.getElementById("contract-health-section");
const contractOverviewSectionEl = document.getElementById("contract-overview-section");
const copyHealthBtn = document.getElementById("copy-health");
const copyOverviewBtn = document.getElementById("copy-overview");
const copyHealthFeedbackEl = document.getElementById("copy-health-feedback");
const copyOverviewFeedbackEl = document.getElementById("copy-overview-feedback");
const statusAnnounceEl = document.getElementById("status-announce");
const overviewAnnounceEl = document.getElementById("overview-announce");
const overviewUpdatedEl = document.getElementById("overview-updated");
const trendEl = document.getElementById("trend-content");
const trendAnnounceEl = document.getElementById("trend-announce");

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseUrl = import.meta.env.DEV ? envBaseUrl || "http://localhost:4000" : envBaseUrl;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
let pendingServiceId = "";
let copyFeedbackTimeout = null;
let filterNoteTimeout = null;
let lastStatusAnnouncement = "";
let lastOverviewAnnouncement = "";
let lastTrendAnnouncement = "";
let demoMode = false;
let metaRangeFrom = "";
let metaRangeTo = "";
let recommendedRangeDays = 7;
let metaLoading = true;
let metaFailed = false;
let pendingMetaNote = false;
const feedbackTimeouts = new Map();
const overviewCache = new Map();
const overviewInflight = new Map();
const OVERVIEW_TTL_MS = 30000;
const timeseriesCache = new Map();
const timeseriesInflight = new Map();
const TIMESERIES_TTL_MS = 30000;

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

function readDemoFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1";
}

function setDemoMode(enabled) {
  demoMode = enabled;
  if (demoToggleEl) {
    demoToggleEl.checked = enabled;
  }
  if (demoPillEl) {
    demoPillEl.classList.toggle("is-visible", enabled);
  }
  if (contractHealthSectionEl) {
    contractHealthSectionEl.open = enabled;
  }
  if (contractOverviewSectionEl) {
    contractOverviewSectionEl.open = enabled;
  }
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

function announceTrend(message) {
  if (!trendAnnounceEl || !message || message === lastTrendAnnouncement) {
    return;
  }
  trendAnnounceEl.textContent = message;
  lastTrendAnnouncement = message;
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

function buildTimeseriesKey() {
  return buildOverviewKey();
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

function fetchTimeseriesWithCache() {
  const key = buildTimeseriesKey();
  const now = Date.now();
  const cached = timeseriesCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    return Promise.resolve({ data: cached.data, source: "cache" });
  }
  if (timeseriesInflight.has(key)) {
    return timeseriesInflight.get(key);
  }
  const promise = fetchJson(buildTimeseriesUrl())
    .then((result) => {
      timeseriesInflight.delete(key);
      if (result.ok) {
        const fetchedAtMs = Date.now();
        timeseriesCache.set(key, {
          data: result.data,
          fetchedAtMs,
          expiresAtMs: fetchedAtMs + TIMESERIES_TTL_MS
        });
        return { data: result.data, source: "network" };
      }
      return Promise.reject(result);
    })
    .catch((err) => {
      timeseriesInflight.delete(key);
      return Promise.reject(err);
    });
  timeseriesInflight.set(key, promise);
  return promise;
}

function formatDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateString(value, days) {
  const base = new Date(`${value}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
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
  if (demoMode) {
    params.set("demo", "1");
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

function showInlineFeedback(el, message) {
  if (!el) {
    return;
  }
  el.textContent = message;
  el.classList.add("is-visible");
  if (feedbackTimeouts.has(el)) {
    clearTimeout(feedbackTimeouts.get(el));
  }
  const timeout = setTimeout(() => {
    el.classList.remove("is-visible");
  }, 1200);
  feedbackTimeouts.set(el, timeout);
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

function showTrendMessage(message, tone) {
  clearEl(trendEl);
  const msg = document.createElement("div");
  msg.className = "state-message";
  if (tone) {
    msg.classList.add(tone);
  }
  msg.textContent = message;
  trendEl.appendChild(msg);
  requestAnimationFrame(() => {
    msg.classList.add("is-visible");
  });
  announceTrend(message);
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

function renderTimeseries(data) {
  clearEl(trendEl);
  const safeData = data && typeof data === "object" ? data : {};
  const series = Array.isArray(safeData.series) ? safeData.series : [];
  if (series.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-message is-visible";
    empty.textContent = "Sin datos para este rango.";
    trendEl.appendChild(empty);
    announceTrend("Sin datos para este rango.");
    return;
  }
  const totals = series.map((point) =>
    typeof point.total === "number" ? point.total : 0
  );
  const maxValue = Math.max(...totals, 0);
  const width = 640;
  const height = 180;
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const points = series.map((point, index) => {
    const value = typeof point.total === "number" ? point.total : 0;
    const ratio = maxValue === 0 ? 0 : value / maxValue;
    const x =
      padding + (innerWidth * index) / Math.max(1, series.length - 1);
    const y = padding + innerHeight - ratio * innerHeight;
    return { x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const bottom = padding + innerHeight;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottom} L ${
    points[0].x
  } ${bottom} Z`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Tendencia de turnos por dia");
  svg.classList.add("trend-svg");

  const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
  area.setAttribute("d", areaPath);
  area.classList.add("trend-area");
  svg.appendChild(area);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", linePath);
  line.classList.add("trend-line");
  svg.appendChild(line);

  const meta = document.createElement("div");
  meta.className = "trend-meta";
  const from =
    safeData.summary && typeof safeData.summary.from === "string"
      ? safeData.summary.from
      : series[0].date;
  const to =
    safeData.summary && typeof safeData.summary.to === "string"
      ? safeData.summary.to
      : series[series.length - 1].date;
  const left = document.createElement("span");
  left.textContent = from;
  const center = document.createElement("span");
  center.textContent = `max: ${maxValue}`;
  const right = document.createElement("span");
  right.textContent = to;
  meta.appendChild(left);
  meta.appendChild(center);
  meta.appendChild(right);

  const wrapper = document.createElement("div");
  wrapper.className = "trend-chart";
  wrapper.appendChild(svg);
  wrapper.appendChild(meta);
  trendEl.appendChild(wrapper);
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
  const meta = metaData && metaData.meta && typeof metaData.meta === "object" ? metaData.meta : null;
  const services = meta && Array.isArray(meta.services) ? meta.services : [];
  const dataset = meta && meta.dataset && typeof meta.dataset === "object" ? meta.dataset : null;
  if (dataset && typeof dataset.from === "string" && typeof dataset.to === "string") {
    metaRangeFrom = dataset.from;
    metaRangeTo = dataset.to;
  }
  const defaults = meta && meta.defaults && typeof meta.defaults === "object" ? meta.defaults : null;
  if (defaults && typeof defaults.recommendedRangeDays === "number") {
    recommendedRangeDays = defaults.recommendedRangeDays;
  }
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

function getFirstServiceId() {
  if (!filterServiceEl) {
    return "";
  }
  const option = Array.from(filterServiceEl.options).find((item) => item.value);
  return option ? option.value : "";
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
    pendingMetaNote = false;
  } else if (pendingMetaNote) {
    showFilterNote("Preparando dataset...");
    pendingMetaNote = false;
  } else {
    clearFilterNote();
  }
  if (normalized.values.from || normalized.values.to || normalized.values.serviceId) {
    loadOverview();
    loadTimeseries();
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver metricas.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
    setUpdatedLine(null);
    showTrendMessage("Selecciona un rango o usa un preset para ver tendencia.", "is-initial");
  }
}

function getDatasetRange() {
  if (dateRegex.test(metaRangeFrom) && dateRegex.test(metaRangeTo)) {
    return { from: metaRangeFrom, to: metaRangeTo };
  }
  return null;
}

function computePresetRange(days) {
  const datasetRange = getDatasetRange();
  if (!datasetRange) {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - days);
    return { from: formatDate(fromDate), to: formatDate(today), usedDataset: false };
  }
  const to = datasetRange.to;
  const from = days > 1 ? shiftDateString(to, -(days - 1)) : to;
  if (from < datasetRange.from) {
    return { from: datasetRange.from, to: datasetRange.to, usedDataset: true };
  }
  return { from, to, usedDataset: true };
}

function applyPreset(days) {
  const range = computePresetRange(days);
  if (!range.usedDataset && metaLoading && !metaFailed) {
    pendingMetaNote = true;
  }
  const current = readFiltersFromInputs();
  applyFilters({
    from: range.from,
    to: range.to,
    serviceId: current.serviceId
  });
}

function applyDemoFilters() {
  const range = computePresetRange(7);
  if (!range.usedDataset && metaLoading && !metaFailed) {
    pendingMetaNote = true;
  }
  const current = readFiltersFromInputs();
  const serviceId = current.serviceId || getFirstServiceId();
  applyFilters({
    from: range.from,
    to: range.to,
    serviceId
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

function buildTimeseriesUrl() {
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
  return `${baseUrl}/metrics/timeseries${query ? `?${query}` : ""}`;
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

async function loadTimeseries() {
  const key = buildTimeseriesKey();
  const now = Date.now();
  const cached = timeseriesCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    renderTimeseries(cached.data);
    return;
  }
  showTrendMessage("Cargando tendencia...", "is-loading");
  try {
    const result = await fetchTimeseriesWithCache();
    const series = result.data && Array.isArray(result.data.series) ? result.data.series : [];
    if (series.length === 0) {
      showTrendMessage("Sin datos para este rango.", "is-empty");
      return;
    }
    renderTimeseries(result.data);
  } catch (error) {
    showTrendMessage(describeError(error), "is-error");
  }
}

async function init() {
  const demoFromUrl = readDemoFromUrl();
  setDemoMode(demoFromUrl);
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
    showTrendMessage("Cargando tendencia...", "is-loading");
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver metricas.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
    showTrendMessage("Selecciona un rango o usa un preset para ver tendencia.", "is-initial");
  }
  setText(contractHealthEl, "Consultando /health...");

  if (!baseUrl) {
    renderStatusError(null, "VITE_API_BASE_URL requerida en produccion");
    setText(overviewEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(trendEl, "Error: VITE_API_BASE_URL requerida en produccion");
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
    metaLoading = false;
  } else {
    metaLoading = false;
    metaFailed = true;
    applyServiceSelection(pendingServiceId);
    pendingServiceId = "";
  }

  if (demoMode) {
    applyDemoFilters();
    return;
  }

  if (initialFilters.values.from || initialFilters.values.to || initialFilters.values.serviceId) {
    await Promise.all([loadOverview(), loadTimeseries()]);
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

if (demoToggleEl) {
  demoToggleEl.addEventListener("change", () => {
    const enabled = demoToggleEl.checked;
    setDemoMode(enabled);
    if (enabled) {
      applyDemoFilters();
    } else {
      writeFiltersToUrl(readFiltersFromInputs());
    }
  });
}

if (copyHealthBtn) {
  copyHealthBtn.addEventListener("click", async () => {
    const text = contractHealthEl ? contractHealthEl.textContent : "";
    const ok = await copyText(text);
    showInlineFeedback(copyHealthFeedbackEl, ok ? "Copiado" : "No se pudo copiar");
  });
}

if (copyOverviewBtn) {
  copyOverviewBtn.addEventListener("click", async () => {
    const text = contractOverviewEl ? contractOverviewEl.textContent : "";
    const ok = await copyText(text);
    showInlineFeedback(copyOverviewFeedbackEl, ok ? "Copiado" : "No se pudo copiar");
  });
}

init();
