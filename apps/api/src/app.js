import express from "express";
import demoData from "./data/demoData.js";
import { errorResponse } from "./errors.js";

const app = express();
const startedAt = new Date().toISOString();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ORIGIN = "https://aquizu-ivan.github.io";

app.use(express.json());

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
  const { rangeFrom, rangeTo, services, appointments } = demoData;
  res.status(200).json({
    ok: true,
    data: {
      range: { from: rangeFrom, to: rangeTo },
      services,
      totalAppointments: appointments.length
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
  const filtered = demoData.appointments.filter((appointment) => {
    if (appointment.date < effectiveFrom || appointment.date > effectiveTo) {
      return false;
    }
    if (serviceIdParam !== undefined && appointment.serviceId !== serviceIdParam) {
      return false;
    }
    return true;
  });

  const byServiceMap = new Map();
  let okCount = 0;
  let noShowCount = 0;

  for (const appointment of filtered) {
    if (appointment.status === "no-show") {
      noShowCount += 1;
    } else {
      okCount += 1;
    }

    const current = byServiceMap.get(appointment.serviceId);
    if (current) {
      current.count += 1;
      if (appointment.status === "no-show") {
        current.noShow += 1;
      }
    } else {
      byServiceMap.set(appointment.serviceId, {
        serviceId: appointment.serviceId,
        count: 1,
        noShow: appointment.status === "no-show" ? 1 : 0
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

app.use((req, res) => {
  res.status(404).json(errorResponse("NOT_FOUND", "Ruta no encontrada"));
});

app.use((err, req, res, next) => {
  res.status(500).json(errorResponse("INTERNAL_ERROR", "Error inesperado"));
});

export default app;
