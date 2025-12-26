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
  "data": {
    "range": { "from": "2025-01-01", "to": "2025-03-31" },
    "services": [
      { "id": "svc-1", "name": "Corte" }
    ],
    "totalAppointments": 540
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
