const statusEl = document.getElementById("status-content");
const overviewEl = document.getElementById("overview-content");
const metaServiceEl = document.getElementById("meta-service");
const metaEnvEl = document.getElementById("meta-env");
const metaStartedEl = document.getElementById("meta-started");
const metaUptimeEl = document.getElementById("meta-uptime");
const filterFromEl = document.getElementById("filter-from");
const filterToEl = document.getElementById("filter-to");
const filterServiceEl = document.getElementById("filter-service");
const applyFiltersBtn = document.getElementById("apply-filters");
const clearFiltersBtn = document.getElementById("clear-filters");
const contractHealthEl = document.getElementById("contract-health");
const contractOverviewEl = document.getElementById("contract-overview");

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const baseUrl = import.meta.env.DEV ? envBaseUrl || "http://localhost:4000" : envBaseUrl;

function setText(el, text) {
  el.textContent = text;
}

function setError(el, info) {
  if (info.type === "http") {
    setText(el, `Error HTTP ${info.status}`);
    return;
  }
  setText(el, "Error de red");
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

function clearEl(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
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
    empty.textContent = "Sin datos para este rango/servicio";
    overviewEl.appendChild(empty);
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
  } else if (info && info.type === "http") {
    detail.textContent = `HTTP ${info.status}`;
  } else {
    detail.textContent = "Error de red";
  }
  statusEl.appendChild(detail);
  setMetaLine(null);
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
  setText(overviewEl, "Consultando /metrics/overview...");
  setText(contractOverviewEl, "Consultando /metrics/overview...");
  const overviewResult = await fetchJson(buildOverviewUrl());
  if (!overviewResult.ok) {
    setError(overviewEl, overviewResult);
    setContractError(contractOverviewEl, overviewResult);
  } else {
    renderOverview(overviewResult.data.data);
    setContractJson(contractOverviewEl, overviewResult.data);
  }
}

async function init() {
  setText(statusEl, "Consultando /health...");
  setText(overviewEl, "Consultando /metrics/overview...");
  setText(contractHealthEl, "Consultando /health...");
  setText(contractOverviewEl, "Consultando /metrics/overview...");

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
  }

  await loadOverview();
}

if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener("click", () => {
    loadOverview();
  });
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    if (filterFromEl) {
      filterFromEl.value = "";
    }
    if (filterToEl) {
      filterToEl.value = "";
    }
    if (filterServiceEl) {
      filterServiceEl.value = "";
    }
    loadOverview();
  });
}

init();
