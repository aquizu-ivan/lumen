import express from "express";
import demoData from "./data/demoData.js";
import { errorResponse } from "./errors.js";

const app = express();
const startedAt = new Date().toISOString();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "lumen-api",
    env: process.env.NODE_ENV ?? "development",
    startedAt,
    version: "dev"
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

app.use((req, res) => {
  res.status(404).json(errorResponse("NOT_FOUND", "Ruta no encontrada"));
});

app.use((err, req, res, next) => {
  res.status(500).json(errorResponse("INTERNAL_ERROR", "Error inesperado"));
});

export default app;