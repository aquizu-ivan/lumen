# QA Exhibicion

- [ ] Health
- [ ] Contrato
- [ ] Acción
- [ ] Colisión
- [ ] UX

## QA Local
1) pnpm -C apps/api install
2) pnpm -C apps/api run dev
3) Abrir /health y /meta y validar campos clave
4) Abrir /metrics/overview en browser o curl y validar campos clave
5) Probar from/to fuera de rango y validar total 0 y noShowRate 0

## PROD (Pages + Railway) — TICKET-02
- URL Pages: https://USUARIO.github.io/lumen/
- La web debe apuntar a Railway via VITE_API_BASE_URL (https).
- Checklist: /health publico, /metrics/overview publico, web carga sin errores de consola.

## QA — Contrato /health (TICKET-06)
- Siempre incluye ok, service, env, startedAt, version, uptimeSeconds y build.
- build siempre incluye gitSha, deployId, serviceId, serviceInstanceId, region (null si no disponible).
```json
{
  "ok": true,
  "service": "lumen-api",
  "env": "production",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "version": "dev",
  "uptimeSeconds": 123,
  "build": {
    "gitSha": "abc123",
    "deployId": "dpl_123",
    "serviceId": "srv_123",
    "serviceInstanceId": "srvinst_123",
    "region": "us-east"
  }
}
```

## QA UI — Filtros + Contrato vivo
- Abrir Pages y validar inputs/select/botones.
- Aplicar filtro serviceId y ver cambiar totals.
- Aplicar rango from/to y ver cambiar totals.
- Validar que el JSON en pre coincide con /health y /metrics/overview.
- Caso error: setear VITE_API_BASE_URL a URL invalida y ver estado ERROR sin crash.
## QA PROD — Identidad de deploy verificable
1) curl /health sin Origin (debe dar 200)
2) curl /health con Origin Pages (debe incluir Access-Control-Allow-Origin correcto)
3) verificar build.gitSha/region no nulos si Railway los provee
4) confirmar BOOT log en Railway
5) Setear Healthcheck Path = /health (paso humano)

## QA UI — Premium (TICKET-08)
- Abrir Pages y validar paneles, estados y filtros visibles.
- Aplicar y limpiar filtros; Overview cambia y no rompe.
- Validar Contrato vivo con JSON de /health y /metrics/overview.
- Forzar total 0 y ver mensaje Sin datos para este rango/servicio.
- Caso error: VITE_API_BASE_URL invalida y ver ERROR sin crash.

## QA UI — URL sync (TICKET-09)
- Abrir con query params y ver inputs hidratados + Overview actualizado.
- Aplicar filtros y confirmar update de URL sin reload.
- Probar from > to y validar swap en UI + URL.
- Probar from/to invalidos y confirmar fallback sin crash.
- Preset 7d actualiza URL y datos.
- Copiar link copia la URL actual (incluye serviceId si esta seteado).

## Ticket-09 — Exhibicion completa
- URLs demo:
  - https://aquizu-ivan.github.io/lumen/?from=2025-01-05&to=2025-01-20
  - https://aquizu-ivan.github.io/lumen/?from=2025-02-10&to=2025-02-01
  - https://aquizu-ivan.github.io/lumen/?from=2025-01-01&to=2025-01-10&serviceId=svc-2
- Pasos:
  - Abrir URL, verificar hidratacion de inputs y Overview.
  - Click preset 7d, confirmar URL actualiza sin reload.
  - Click copiar link, ver feedback Copiado.
  - Recargar y verificar persistencia de filtros.
  - Confirmar base /lumen/ en URL.
- Evidencia esperada:
  - Nota "Rango corregido automaticamente" cuando from > to.
  - Mensaje "Sin datos para este rango/servicio. Proba presets 7d o 30d." si total=0.
  - Estado ERROR con texto de causa probable si falla la carga.

## Ticket-10 — Estado inicial y carga
- Primera carga sin filtros: Overview muestra "Selecciona un rango o usa un preset para ver metricas."
- Loading visible: durante fetch se ve "Cargando metricas..." sin dejar panel vacio.
- Empty-state guiado: total=0 mantiene mensaje de sin datos y sugiere presets.
- Confirmar sin flashes ni paneles en blanco sin texto.
- Base /lumen/ intacta.

## Ticket-11 — Accesibilidad premium
- Navegacion por teclado: TAB y SHIFT+TAB recorren inputs, select, presets, copiar link y acciones.
- Foco visible consistente en botones, inputs y select.
- Estados anunciados: inicial, loading, sin datos y error se leen con aria-live.
- Confirmar que no cambia la estetica ni el layout.
