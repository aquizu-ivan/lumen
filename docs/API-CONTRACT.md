# API Contract

## Principios
- Contrato primero
- Error shape único
- Ejemplos reproducibles

## GET /health
- Request: sin body
- Response 200:
```json
{
  "ok": true,
  "service": "lumen-api",
  "env": "development",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "version": "dev"
}
```

## GET /meta
- Request: sin body
- Response 200:
```json
{
  "ok": true,
  "meta": {
    "dataset": {
      "kind": "demo",
      "days": 90,
      "seed": "lumen-demo",
      "from": "2025-01-01",
      "to": "2025-03-31"
    },
    "services": [
      { "id": "svc-1", "name": "Corte", "durationMin": 30 }
    ],
    "defaults": {
      "recommendedRangeDays": 7
    }
  }
}
```

## GET /metrics/overview
- Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), serviceId (string)
- Response 200 (sin params):
```json
{
  "ok": true,
  "data": {
    "range": { "from": "2025-01-01", "to": "2025-03-31" },
    "serviceId": null,
    "total": 540,
    "ok": 486,
    "noShow": 54,
    "noShowRate": 0.1,
    "byService": [
      { "serviceId": "svc-1", "count": 135, "noShow": 0 },
      { "serviceId": "svc-2", "count": 135, "noShow": 27 },
      { "serviceId": "svc-3", "count": 135, "noShow": 0 },
      { "serviceId": "svc-4", "count": 135, "noShow": 27 }
    ]
  }
}
```
- Response 200 (from/to):
```json
{
  "ok": true,
  "data": {
    "range": { "from": "2025-01-01", "to": "2025-01-01" },
    "serviceId": null,
    "total": 6,
    "ok": 6,
    "noShow": 0,
    "noShowRate": 0,
    "byService": [
      { "serviceId": "svc-1", "count": 2, "noShow": 0 },
      { "serviceId": "svc-2", "count": 2, "noShow": 0 },
      { "serviceId": "svc-3", "count": 1, "noShow": 0 },
      { "serviceId": "svc-4", "count": 1, "noShow": 0 }
    ]
  }
}
```
- Response 200 (serviceId):
```json
{
  "ok": true,
  "data": {
    "range": { "from": "2025-01-01", "to": "2025-03-31" },
    "serviceId": "svc-2",
    "total": 135,
    "ok": 108,
    "noShow": 27,
    "noShowRate": 0.2,
    "byService": [
      { "serviceId": "svc-2", "count": 135, "noShow": 27 }
    ]
  }
}
```
- Response 400 (from inválido):
```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Parámetros inválidos",
    "details": { "field": "from" },
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

## GET /metrics/timeseries
- Query params: from (YYYY-MM-DD), to (YYYY-MM-DD), serviceId (string)
- Response 200 (sin params):
```json
{
  "ok": true,
  "series": [
    { "date": "2025-03-25", "total": 24, "noShow": 2, "cancelled": 1 },
    { "date": "2025-03-26", "total": 25, "noShow": 1, "cancelled": 0 }
  ],
  "summary": {
    "from": "2025-03-25",
    "to": "2025-03-31",
    "serviceId": null,
    "days": 7
  }
}
```

## Errores
- Error shape único:
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Ruta no encontrada",
    "details": {},
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```
- 404 ejemplo:
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Ruta no encontrada",
    "details": {},
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```
- 500 ejemplo:
```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Error inesperado",
    "details": {},
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```
