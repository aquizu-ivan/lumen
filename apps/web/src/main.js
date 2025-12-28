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
const heatmapEl = document.getElementById("heatmap-content");
const heatmapAnnounceEl = document.getElementById("heatmap-announce");
const insightsEl = document.getElementById("insights-content");
const systemPillEl = document.getElementById("system-pill");
const technicalSectionEl = document.getElementById("technical-section");

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
let lastHeatmapAnnouncement = "";
let demoMode = false;
let metaRangeFrom = "";
let metaRangeTo = "";
let recommendedRangeDays = 7;
let metaLoading = true;
let metaFailed = false;
let pendingMetaNote = false;
let latestOverview = null;
let latestTimeseries = null;
let latestHeatmap = null;
const feedbackTimeouts = new Map();
const overviewCache = new Map();
const overviewInflight = new Map();
const OVERVIEW_TTL_MS = 30000;
const timeseriesCache = new Map();
const timeseriesInflight = new Map();
const TIMESERIES_TTL_MS = 30000;
const heatmapCache = new Map();
const heatmapInflight = new Map();
const HEATMAP_TTL_MS = 30000;

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
  if (technicalSectionEl) {
    technicalSectionEl.open = enabled;
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

function announceHeatmap(message) {
  if (!heatmapAnnounceEl || !message || message === lastHeatmapAnnouncement) {
    return;
  }
  heatmapAnnounceEl.textContent = message;
  lastHeatmapAnnouncement = message;
}

function setSystemPill(statusKey) {
  if (!systemPillEl || typeof statusKey !== "string") {
    return;
  }
  const map = {
    OK: "Sistema OK",
    DEGRADED: "Sistema DEGRADADO",
    ERROR: "Sistema ERROR"
  };
  const label = map[statusKey] || "Sistema";
  systemPillEl.textContent = label;
  systemPillEl.className = `status-pill system-pill status-${statusKey.toLowerCase()}`;
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

function buildHeatmapKey() {
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

function fetchHeatmapWithCache() {
  const key = buildHeatmapKey();
  const now = Date.now();
  const cached = heatmapCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    return Promise.resolve({ data: cached.data, source: "cache" });
  }
  if (heatmapInflight.has(key)) {
    return heatmapInflight.get(key);
  }
  const promise = fetchJson(buildHeatmapUrl())
    .then((result) => {
      heatmapInflight.delete(key);
      if (result.ok) {
        const fetchedAtMs = Date.now();
        heatmapCache.set(key, {
          data: result.data,
          fetchedAtMs,
          expiresAtMs: fetchedAtMs + HEATMAP_TTL_MS
        });
        return { data: result.data, source: "network" };
      }
      return Promise.reject(result);
    })
    .catch((err) => {
      heatmapInflight.delete(key);
      return Promise.reject(err);
    });
  heatmapInflight.set(key, promise);
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

function showHeatmapMessage(message, tone) {
  clearEl(heatmapEl);
  const msg = document.createElement("div");
  msg.className = "state-message";
  if (tone) {
    msg.classList.add(tone);
  }
  msg.textContent = message;
  heatmapEl.appendChild(msg);
  requestAnimationFrame(() => {
    msg.classList.add("is-visible");
  });
  announceHeatmap(message);
}

function showInsightsMessage(message, tone) {
  if (!insightsEl) {
    return;
  }
  clearEl(insightsEl);
  const msg = document.createElement("div");
  msg.className = "state-message";
  if (tone) {
    msg.classList.add(tone);
  }
  msg.textContent = message;
  insightsEl.appendChild(msg);
  requestAnimationFrame(() => {
    msg.classList.add("is-visible");
  });
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
  setSystemPill(statusText);
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

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Math.round(value).toLocaleString("es-AR");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }
  return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}

function countDaysInclusive(from, to) {
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return 0;
  }
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const diff = Math.floor((end - start) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

function buildKpi(label, value, sub) {
  const card = document.createElement("div");
  card.className = "kpi-card";
  const labelEl = document.createElement("div");
  labelEl.className = "kpi-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.className = "kpi-value";
  valueEl.textContent = value;
  card.appendChild(labelEl);
  card.appendChild(valueEl);
  if (sub) {
    const subEl = document.createElement("div");
    subEl.className = "kpi-sub";
    subEl.textContent = sub;
    card.appendChild(subEl);
  }
  return card;
}

function getHeatmapPeak(heatmap) {
  if (!heatmap || !Array.isArray(heatmap.values)) {
    return null;
  }
  const days = Array.isArray(heatmap.days) ? heatmap.days : [];
  const hours = Array.isArray(heatmap.hours) ? heatmap.hours : [];
  let best = null;
  for (let dayIndex = 0; dayIndex < heatmap.values.length; dayIndex += 1) {
    const row = Array.isArray(heatmap.values[dayIndex]) ? heatmap.values[dayIndex] : [];
    for (let hourIndex = 0; hourIndex < row.length; hourIndex += 1) {
      const count = typeof row[hourIndex] === "number" ? row[hourIndex] : 0;
      if (!best || count > best.count) {
        best = {
          day: days[dayIndex] || "n/a",
          hour: hours[hourIndex] ?? null,
          count
        };
      }
    }
  }
  if (!best || best.count === 0 || best.hour === null) {
    return null;
  }
  return best;
}

function getHeatmapBestDay(heatmap) {
  if (!heatmap || !Array.isArray(heatmap.values)) {
    return null;
  }
  const days = Array.isArray(heatmap.days) ? heatmap.days : [];
  let best = null;
  for (let dayIndex = 0; dayIndex < heatmap.values.length; dayIndex += 1) {
    const row = Array.isArray(heatmap.values[dayIndex]) ? heatmap.values[dayIndex] : [];
    const total = row.reduce((acc, value) => acc + (typeof value === "number" ? value : 0), 0);
    if (!best || total > best.total) {
      best = { day: days[dayIndex] || "n/a", total };
    }
  }
  if (!best || best.total === 0) {
    return null;
  }
  return best;
}

function renderInsights() {
  if (!insightsEl || !latestOverview) {
    return;
  }
  const insights = [];
  const noShowRate =
    latestOverview && typeof latestOverview.noShowRate === "number"
      ? latestOverview.noShowRate
      : 0;
  const heatmap = latestHeatmap && latestHeatmap.heatmap ? latestHeatmap.heatmap : null;
  const peak = getHeatmapPeak(heatmap);
  if (peak) {
    const hour = String(peak.hour).padStart(2, "0");
    insights.push(`Pico principal: ${peak.day} ${hour}:00 (${peak.count} turnos)`);
  }
  const bestDay = getHeatmapBestDay(heatmap);
  if (bestDay) {
    insights.push(`Dia mas fuerte: ${bestDay.day}`);
  }
  if (latestTimeseries && Array.isArray(latestTimeseries.series)) {
    const series = latestTimeseries.series;
    if (series.length >= 14) {
      const last7 = series.slice(-7);
      const prev7 = series.slice(-14, -7);
      const sumLast = last7.reduce(
        (acc, item) => acc + (typeof item.total === "number" ? item.total : 0),
        0
      );
      const sumPrev = prev7.reduce(
        (acc, item) => acc + (typeof item.total === "number" ? item.total : 0),
        0
      );
      if (sumPrev === 0 && sumLast > 0) {
        insights.push("Tendencia al alza en los ultimos 7 dias.");
      } else if (sumPrev > 0) {
        const ratio = (sumLast - sumPrev) / sumPrev;
        if (ratio > 0.08) {
          insights.push("Tendencia al alza en los ultimos 7 dias.");
        } else if (ratio < -0.08) {
          insights.push("Tendencia a la baja en los ultimos 7 dias.");
        } else {
          insights.push("Tendencia estable en los ultimos 7 dias.");
        }
      }
    }
  }
  if (noShowRate > 0.1) {
    insights.push(`No-shows altos: ${formatPercent(noShowRate)}`);
  }
  if (heatmap && Array.isArray(heatmap.values)) {
    const total = heatmap.values.reduce(
      (acc, row) =>
        acc +
        (Array.isArray(row)
          ? row.reduce((rowAcc, value) => rowAcc + (typeof value === "number" ? value : 0), 0)
          : 0),
      0
    );
    const cells = heatmap.values.reduce(
      (acc, row) => acc + (Array.isArray(row) ? row.length : 0),
      0
    );
    const average = cells > 0 ? total / cells : 0;
    if (average > 0 && heatmap.max >= average * 2.5) {
      insights.push("Demanda concentrada en pocas horas.");
    }
  }
  clearEl(insightsEl);
  if (insights.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-message is-visible";
    empty.textContent = "Sin insights disponibles para este rango.";
    insightsEl.appendChild(empty);
    return;
  }
  const list = document.createElement("ul");
  list.className = "insights-list";
  insights.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  insightsEl.appendChild(list);
}

function renderSummary() {
  if (!latestOverview) {
    return;
  }
  clearEl(overviewEl);
  const total = typeof latestOverview.total === "number" ? latestOverview.total : 0;
  const noShow = typeof latestOverview.noShow === "number" ? latestOverview.noShow : 0;
  const noShowRate =
    typeof latestOverview.noShowRate === "number" ? latestOverview.noShowRate : 0;
  const range = latestOverview.range || {};
  const timeseries =
    latestTimeseries && Array.isArray(latestTimeseries.series) ? latestTimeseries.series : null;
  const dayCount = timeseries ? timeseries.length : countDaysInclusive(range.from || "", range.to || "");
  const avgPerDay = dayCount > 0 ? total / dayCount : 0;
  const cancelled = timeseries
    ? timeseries.reduce(
        (acc, item) => acc + (typeof item.cancelled === "number" ? item.cancelled : 0),
        0
      )
    : null;
  const heatmap = latestHeatmap && latestHeatmap.heatmap ? latestHeatmap.heatmap : null;
  const peak = getHeatmapPeak(heatmap);
  const bestDay = getHeatmapBestDay(heatmap);

  const grid = document.createElement("div");
  grid.className = "kpi-grid";
  grid.appendChild(buildKpi("Turnos", formatNumber(total), null));
  grid.appendChild(
    buildKpi(
      "No-shows",
      formatPercent(noShowRate),
      total > 0 ? `${formatNumber(noShow)} de ${formatNumber(total)}` : null
    )
  );
  grid.appendChild(buildKpi("Promedio diario", avgPerDay.toFixed(1), null));
  if (cancelled !== null) {
    grid.appendChild(buildKpi("Cancelaciones", formatNumber(cancelled), null));
  }
  if (peak) {
    const hour = String(peak.hour).padStart(2, "0");
    grid.appendChild(buildKpi("Pico principal", `${peak.day} ${hour}:00`, null));
  }
  if (bestDay) {
    grid.appendChild(buildKpi("Mejor dia", bestDay.day, null));
  }
  overviewEl.appendChild(grid);
  if (total === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Sin datos para este rango/servicio. Proba presets 7d o 30d.";
    overviewEl.appendChild(empty);
    announceOverview("Sin datos para este rango/servicio. Proba presets 7d o 30d.");
  }
}

function renderOverview(data) {
  latestOverview = data && typeof data === "object" ? data : null;
  renderSummary();
  renderInsights();
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

function renderHeatmap(data) {
  clearEl(heatmapEl);
  const safeData = data && typeof data === "object" ? data : {};
  const heatmap =
    safeData.heatmap && typeof safeData.heatmap === "object" ? safeData.heatmap : null;
  const days = heatmap && Array.isArray(heatmap.days) ? heatmap.days : [];
  const hours = heatmap && Array.isArray(heatmap.hours) ? heatmap.hours : [];
  const values = heatmap && Array.isArray(heatmap.values) ? heatmap.values : [];
  const max = heatmap && typeof heatmap.max === "number" ? heatmap.max : 0;
  if (days.length === 0 || hours.length === 0 || values.length === 0) {
    showHeatmapMessage("Sin datos para este rango/servicio.", "is-empty");
    return;
  }
  if (max === 0) {
    showHeatmapMessage("Sin datos para este rango/servicio.", "is-empty");
    return;
  }
  const cellSize = 16;
  const gap = 4;
  const leftLabel = 36;
  const topLabel = 18;
  const gridWidth = hours.length * cellSize + (hours.length - 1) * gap;
  const gridHeight = days.length * cellSize + (days.length - 1) * gap;
  const width = leftLabel + gridWidth + 8;
  const height = topLabel + gridHeight + 8;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Heatmap de turnos por dia y hora");
  svg.classList.add("heatmap-svg");

  hours.forEach((hour, index) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.textContent = String(hour);
    label.setAttribute(
      "x",
      leftLabel + index * (cellSize + gap) + cellSize / 2
    );
    label.setAttribute("y", "12");
    label.setAttribute("text-anchor", "middle");
    label.classList.add("heatmap-label");
    svg.appendChild(label);
  });

  days.forEach((day, index) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.textContent = day;
    label.setAttribute("x", String(leftLabel - 6));
    label.setAttribute(
      "y",
      topLabel + index * (cellSize + gap) + cellSize / 2 + 4
    );
    label.setAttribute("text-anchor", "end");
    label.classList.add("heatmap-label");
    svg.appendChild(label);
  });

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const row = Array.isArray(values[dayIndex]) ? values[dayIndex] : [];
    for (let hourIndex = 0; hourIndex < hours.length; hourIndex += 1) {
      const raw = row[hourIndex];
      const count = typeof raw === "number" ? raw : 0;
      const ratio = max === 0 ? 0 : count / max;
      const alpha = Math.min(0.82, 0.08 + ratio * 0.74);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute(
        "x",
        String(leftLabel + hourIndex * (cellSize + gap))
      );
      rect.setAttribute(
        "y",
        String(topLabel + dayIndex * (cellSize + gap))
      );
      rect.setAttribute("width", String(cellSize));
      rect.setAttribute("height", String(cellSize));
      rect.setAttribute("rx", "3");
      rect.setAttribute("fill", `rgba(76, 212, 198, ${alpha})`);
      rect.classList.add("heatmap-cell");
      svg.appendChild(rect);
    }
  }

  const wrapper = document.createElement("div");
  wrapper.className = "heatmap-wrapper";
  wrapper.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "heatmap-legend";
  legend.textContent = `Bajo - Alto | max: ${max}`;
  wrapper.appendChild(legend);
  heatmapEl.appendChild(wrapper);
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
  setSystemPill("ERROR");
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
    latestOverview = null;
    latestTimeseries = null;
    latestHeatmap = null;
    showInsightsMessage("Cargando insights...", "is-loading");
    loadOverview();
    loadTimeseries();
    loadHeatmap();
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver el resumen.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
    setUpdatedLine(null);
    showTrendMessage("Selecciona un rango o usa un preset para ver tendencia.", "is-initial");
    showHeatmapMessage("Selecciona un rango o usa un preset para ver heatmap.", "is-initial");
    showInsightsMessage("Selecciona un rango o usa un preset para ver insights.", "is-initial");
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

function buildHeatmapUrl() {
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
  return `${baseUrl}/metrics/heatmap${query ? `?${query}` : ""}`;
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
  showOverviewMessage("Cargando resumen...", "is-loading");
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
    latestOverview = null;
    showOverviewMessage(describeError(error), "is-error");
    setContractError(contractOverviewEl, error);
    showInsightsMessage(describeError(error), "is-error");
  }
}

async function loadTimeseries() {
  const key = buildTimeseriesKey();
  const now = Date.now();
  const cached = timeseriesCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    latestTimeseries = cached.data;
    renderTimeseries(cached.data);
    renderSummary();
    renderInsights();
    return;
  }
  showTrendMessage("Cargando tendencia...", "is-loading");
  try {
    const result = await fetchTimeseriesWithCache();
    latestTimeseries = result.data;
    const series = result.data && Array.isArray(result.data.series) ? result.data.series : [];
    if (series.length === 0) {
      showTrendMessage("Sin datos para este rango.", "is-empty");
      renderSummary();
      renderInsights();
      return;
    }
    renderTimeseries(result.data);
    renderSummary();
    renderInsights();
  } catch (error) {
    latestTimeseries = null;
    showTrendMessage(describeError(error), "is-error");
    renderSummary();
    renderInsights();
  }
}

async function loadHeatmap() {
  const key = buildHeatmapKey();
  const now = Date.now();
  const cached = heatmapCache.get(key);
  if (cached && now < cached.expiresAtMs) {
    latestHeatmap = cached.data;
    renderHeatmap(cached.data);
    renderSummary();
    renderInsights();
    return;
  }
  showHeatmapMessage("Cargando heatmap...", "is-loading");
  try {
    const result = await fetchHeatmapWithCache();
    latestHeatmap = result.data;
    const heatmap = result.data && typeof result.data.heatmap === "object" ? result.data.heatmap : null;
    if (heatmap && typeof heatmap.max === "number" && heatmap.max === 0) {
      showHeatmapMessage("Sin datos para este rango/servicio.", "is-empty");
      renderSummary();
      renderInsights();
      return;
    }
    renderHeatmap(result.data);
    renderSummary();
    renderInsights();
  } catch (error) {
    latestHeatmap = null;
    showHeatmapMessage(describeError(error), "is-error");
    renderSummary();
    renderInsights();
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
    showOverviewMessage("Cargando resumen...", "is-loading");
    showTrendMessage("Cargando tendencia...", "is-loading");
    showHeatmapMessage("Cargando heatmap...", "is-loading");
    showInsightsMessage("Cargando insights...", "is-loading");
  } else {
    showOverviewMessage("Selecciona un rango o usa un preset para ver el resumen.", "is-initial");
    setText(contractOverviewEl, "Esperando filtros...");
    showTrendMessage("Selecciona un rango o usa un preset para ver tendencia.", "is-initial");
    showHeatmapMessage("Selecciona un rango o usa un preset para ver heatmap.", "is-initial");
    showInsightsMessage("Selecciona un rango o usa un preset para ver insights.", "is-initial");
  }
  setText(contractHealthEl, "Consultando /health...");

  if (!baseUrl) {
    renderStatusError(null, "VITE_API_BASE_URL requerida en produccion");
    setText(overviewEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(trendEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(heatmapEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(insightsEl, "Error: VITE_API_BASE_URL requerida en produccion");
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
    await Promise.all([loadOverview(), loadTimeseries(), loadHeatmap()]);
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
