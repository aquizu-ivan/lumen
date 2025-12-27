const statusEl = document.getElementById("status-content");
const overviewEl = document.getElementById("overview-content");

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
  statusLine.textContent = `Status: ${statusText}`;
  statusEl.appendChild(statusLine);
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

async function init() {
  setText(statusEl, "Loading...");
  setText(overviewEl, "Loading...");

  if (!baseUrl) {
    setText(statusEl, "Error: VITE_API_BASE_URL requerida en produccion");
    setText(overviewEl, "Error: VITE_API_BASE_URL requerida en produccion");
    return;
  }

  const healthResult = await fetchJson(`${baseUrl}/health`);
  if (!healthResult.ok) {
    setText(statusEl, "ERROR");
  } else {
    renderHealth(healthResult.data);
  }

  const overviewResult = await fetchJson(`${baseUrl}/metrics/overview`);
  if (!overviewResult.ok) {
    setError(overviewEl, overviewResult);
  } else {
    renderOverview(overviewResult.data.data);
  }
}

init();
