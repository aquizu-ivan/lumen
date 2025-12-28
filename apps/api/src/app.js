import express from "express";
import demoData from "./data/demoData.js";
import { errorResponse } from "./errors.js";

const app = express();
const startedAt = new Date().toISOString();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ORIGIN = "https://aquizu-ivan.github.io";

app.use(express.json());

function shiftDate(value, days) {
  const base = new Date(`${value}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function buildDateRange(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

app.use((req, res, next) => {
  if (req.headers.origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/health", (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - Date.parse(startedAt)) / 1000);
  res.status(200).json({
    ok: true,
    service: "lumen-api",
    env: process.env.NODE_ENV ?? "development",
    startedAt,
    version: "dev",
    uptimeSeconds,
    build: {
      gitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      deployId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      serviceId: process.env.RAILWAY_SERVICE_ID ?? null,
      serviceInstanceId: process.env.RAILWAY_SERVICE_INSTANCE_ID ?? null,
      region: process.env.RAILWAY_REGION ?? null
    }
  });
});

app.get("/meta", (req, res) => {
  res.status(200).json({
    ok: true,
    meta: {
      dataset: demoData.meta,
      services: demoData.services,
      defaults: demoData.defaults
    }
  });
});

app.get("/metrics/overview", (req, res) => {
  const { from, to, serviceId } = req.query;
  const fromParam = typeof from === "string" ? from : undefined;
  const toParam = typeof to === "string" ? to : undefined;
  const serviceIdParam = typeof serviceId === "string" ? serviceId : undefined;

  if (fromParam && !dateRegex.test(fromParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "from" }));
    return;
  }

  if (toParam && !dateRegex.test(toParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "to" }));
    return;
  }

  if (serviceIdParam !== undefined) {
    const exists = demoData.services.some((service) => service.id === serviceIdParam);
    if (!exists) {
      res
        .status(400)
        .json(
          errorResponse("BAD_REQUEST", "Parámetros inválidos", {
            field: "serviceId"
          })
        );
      return;
    }
  }

  const effectiveFrom = fromParam ?? demoData.rangeFrom;
  const effectiveTo = toParam ?? demoData.rangeTo;
  const filtered = demoData.bookings.filter((booking) => {
    const date = booking.startAt.slice(0, 10);
    if (date < effectiveFrom || date > effectiveTo) {
      return false;
    }
    if (serviceIdParam !== undefined && booking.serviceId !== serviceIdParam) {
      return false;
    }
    return true;
  });

  const byServiceMap = new Map();
  let okCount = 0;
  let noShowCount = 0;

  for (const booking of filtered) {
    if (booking.status === "no_show") {
      noShowCount += 1;
    } else {
      okCount += 1;
    }

    const current = byServiceMap.get(booking.serviceId);
    if (current) {
      current.count += 1;
      if (booking.status === "no_show") {
        current.noShow += 1;
      }
    } else {
      byServiceMap.set(booking.serviceId, {
        serviceId: booking.serviceId,
        count: 1,
        noShow: booking.status === "no_show" ? 1 : 0
      });
    }
  }

  const total = filtered.length;
  const byService = Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count);
  const noShowRate = total === 0 ? 0 : noShowCount / total;

  res.status(200).json({
    ok: true,
    data: {
      range: { from: effectiveFrom, to: effectiveTo },
      serviceId: serviceIdParam ?? null,
      total,
      ok: okCount,
      noShow: noShowCount,
      noShowRate,
      byService
    }
  });
});

app.get("/metrics/timeseries", (req, res) => {
  const { from, to, serviceId } = req.query;
  const fromParam = typeof from === "string" ? from : undefined;
  const toParam = typeof to === "string" ? to : undefined;
  const serviceIdParam = typeof serviceId === "string" ? serviceId : undefined;

  if (fromParam && !dateRegex.test(fromParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "from" }));
    return;
  }

  if (toParam && !dateRegex.test(toParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "to" }));
    return;
  }

  if (serviceIdParam !== undefined) {
    const exists = demoData.services.some((service) => service.id === serviceIdParam);
    if (!exists) {
      res
        .status(400)
        .json(
          errorResponse("BAD_REQUEST", "Parámetros inválidos", {
            field: "serviceId"
          })
        );
      return;
    }
  }

  const fallbackDays =
    demoData.defaults && typeof demoData.defaults.recommendedRangeDays === "number"
      ? demoData.defaults.recommendedRangeDays
      : 7;
  const fallbackTo = demoData.rangeTo;
  const fallbackFrom = shiftDate(fallbackTo, -(fallbackDays - 1));
  const requestedFrom = fromParam ?? fallbackFrom;
  const requestedTo = toParam ?? fallbackTo;

  if (requestedTo < demoData.rangeFrom || requestedFrom > demoData.rangeTo) {
    res.status(200).json({
      ok: true,
      series: [],
      summary: {
        from: requestedFrom,
        to: requestedTo,
        serviceId: serviceIdParam ?? null,
        days: 0
      }
    });
    return;
  }

  const effectiveFrom =
    requestedFrom < demoData.rangeFrom ? demoData.rangeFrom : requestedFrom;
  const effectiveTo = requestedTo > demoData.rangeTo ? demoData.rangeTo : requestedTo;
  const dateRange = buildDateRange(effectiveFrom, effectiveTo);
  const seriesMap = new Map(
    dateRange.map((date) => [
      date,
      { date, total: 0, noShow: 0, cancelled: 0 }
    ])
  );

  for (const booking of demoData.bookings) {
    const date = booking.startAt.slice(0, 10);
    if (date < effectiveFrom || date > effectiveTo) {
      continue;
    }
    if (serviceIdParam !== undefined && booking.serviceId !== serviceIdParam) {
      continue;
    }
    const entry = seriesMap.get(date);
    if (!entry) {
      continue;
    }
    entry.total += 1;
    if (booking.status === "no_show") {
      entry.noShow += 1;
    } else if (booking.status === "cancelled") {
      entry.cancelled += 1;
    }
  }

  const series = Array.from(seriesMap.values());
  res.status(200).json({
    ok: true,
    series,
    summary: {
      from: effectiveFrom,
      to: effectiveTo,
      serviceId: serviceIdParam ?? null,
      days: series.length
    }
  });
});

app.get("/metrics/heatmap", (req, res) => {
  const { from, to, serviceId } = req.query;
  const fromParam = typeof from === "string" ? from : undefined;
  const toParam = typeof to === "string" ? to : undefined;
  const serviceIdParam = typeof serviceId === "string" ? serviceId : undefined;

  if (fromParam && !dateRegex.test(fromParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "from" }));
    return;
  }

  if (toParam && !dateRegex.test(toParam)) {
    res
      .status(400)
      .json(errorResponse("BAD_REQUEST", "Parámetros inválidos", { field: "to" }));
    return;
  }

  if (serviceIdParam !== undefined) {
    const exists = demoData.services.some((service) => service.id === serviceIdParam);
    if (!exists) {
      res
        .status(400)
        .json(
          errorResponse("BAD_REQUEST", "Parámetros inválidos", {
            field: "serviceId"
          })
        );
      return;
    }
  }

  const fallbackDays =
    demoData.defaults && typeof demoData.defaults.recommendedRangeDays === "number"
      ? demoData.defaults.recommendedRangeDays
      : 7;
  const fallbackTo = demoData.rangeTo;
  const fallbackFrom = shiftDate(fallbackTo, -(fallbackDays - 1));
  const requestedFrom = fromParam ?? fallbackFrom;
  const requestedTo = toParam ?? fallbackTo;

  const days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const hours = [];
  for (let hour = 8; hour <= 20; hour += 1) {
    hours.push(hour);
  }
  const emptyValues = days.map(() => hours.map(() => 0));

  if (requestedTo < demoData.rangeFrom || requestedFrom > demoData.rangeTo) {
    res.status(200).json({
      ok: true,
      heatmap: {
        days,
        hours,
        values: emptyValues,
        max: 0,
        from: requestedFrom,
        to: requestedTo,
        serviceId: serviceIdParam ?? null
      }
    });
    return;
  }

  const effectiveFrom =
    requestedFrom < demoData.rangeFrom ? demoData.rangeFrom : requestedFrom;
  const effectiveTo = requestedTo > demoData.rangeTo ? demoData.rangeTo : requestedTo;
  const values = days.map(() => hours.map(() => 0));
  let max = 0;

  for (const booking of demoData.bookings) {
    const date = booking.startAt.slice(0, 10);
    if (date < effectiveFrom || date > effectiveTo) {
      continue;
    }
    if (serviceIdParam !== undefined && booking.serviceId !== serviceIdParam) {
      continue;
    }
    const dateTime = new Date(booking.startAt);
    const hour = dateTime.getUTCHours();
    if (hour < 8 || hour > 20) {
      continue;
    }
    const dayIndex = (dateTime.getUTCDay() + 6) % 7;
    const hourIndex = hour - 8;
    values[dayIndex][hourIndex] += 1;
    if (values[dayIndex][hourIndex] > max) {
      max = values[dayIndex][hourIndex];
    }
  }

  res.status(200).json({
    ok: true,
    heatmap: {
      days,
      hours,
      values,
      max,
      from: effectiveFrom,
      to: effectiveTo,
      serviceId: serviceIdParam ?? null
    }
  });
});

app.use((req, res) => {
  res.status(404).json(errorResponse("NOT_FOUND", "Ruta no encontrada"));
});

app.use((err, req, res, next) => {
  res.status(500).json(errorResponse("INTERNAL_ERROR", "Error inesperado"));
});

export default app;
