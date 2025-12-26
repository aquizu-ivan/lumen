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
  const line = document.createElement("div");
  line.textContent = `service: ${data.service} | env: ${data.env} | startedAt: ${data.startedAt}`;
  statusEl.appendChild(line);
}

function renderOverview(data) {
  clearEl(overviewEl);
  const summary = document.createElement("div");
  summary.textContent = `total: ${data.total} | noShowRate: ${data.noShowRate}`;
  overviewEl.appendChild(summary);
  const list = document.createElement("ul");
  data.byService.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.serviceId}: ${item.count} (no-show: ${item.noShow})`;
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
    setError(statusEl, healthResult);
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
