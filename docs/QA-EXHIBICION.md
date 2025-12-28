# QA Exhibición

## Estado v1
- ✔ Exhibible
- ✔ Cliente-facing
- ✔ Técnica con acceso restringido (debug=1)
- ✔ Accesible (teclado + aria)
- ✔ Compartible (Compartir demo)

## Guión 30 segundos
1) Abrir https://aquizu-ivan.github.io/lumen/?demo=1
2) Leer Hoy en tu operación.
3) Ver Resumen + Lecturas clave.
4) Hover/tap en tooltips de Evolución y mapa de calor.
5) Compartir demo y abrir el link en pestaña nueva.

## Checklist base
- [ ] Health
- [ ] Contrato
- [ ] Acción
- [ ] Colisión
- [ ] UX

## QA local
1) pnpm -C apps/api install
2) pnpm -C apps/api run dev
3) Abrir /health y /meta y validar campos clave
4) Abrir /metrics/overview en browser o curl y validar campos clave
5) Probar from/to fuera de rango y validar total 0 y noShowRate 0

## PROD (Pages + Railway) - TICKET-02
- URL Pages: https://USUARIO.github.io/lumen/
- La web debe apuntar a Railway via VITE_API_BASE_URL (https).
- Checklist: /health público, /metrics/overview público, web carga sin errores de consola.

## QA - Contrato /health (TICKET-06)
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

## QA Interfaz - Filtros + contrato vivo
- Abrir Pages y validar inputs/select/botones.
- Aplicar filtro serviceId y ver cambiar totales.
- Aplicar rango from/to y ver cambiar totales.
- Validar que el JSON en pre coincide con /health y /metrics/overview.
- Caso error: setear VITE_API_BASE_URL a URL inválida y ver estado ERROR sin crash.

## QA PROD - Identidad de deploy verificable
1) curl /health sin Origin (debe dar 200)
2) curl /health con Origin Pages (debe incluir Access-Control-Allow-Origin correcto)
3) Verificar build.gitSha/region no nulos si Railway los provee
4) Confirmar BOOT log en Railway
5) Setear Healthcheck Path = /health (paso humano)

## QA Interfaz - Premium (TICKET-08)
- Abrir Pages y validar paneles, estados y filtros visibles.
- Aplicar y limpiar filtros; Resumen cambia y no rompe.
- Validar contrato vivo con JSON de /health y /metrics/overview.
- Forzar total 0 y ver mensaje sin datos para este rango/servicio.
- Caso error: VITE_API_BASE_URL inválida y ver ERROR sin crash.

## QA Interfaz - Sincronización de URL (TICKET-09)
- Abrir con query params y ver inputs hidratados + Resumen actualizado.
- Aplicar filtros y confirmar update de URL sin reload.
- Probar from > to y validar intercambio en interfaz + URL.
- Probar from/to inválidos y confirmar fallback sin crash.
- Preset 7d actualiza URL y datos.
- Copiar link copia la URL actual (incluye serviceId si está seteado).

## Ticket-09 - Exhibición completa
- URLs demo:
  - https://aquizu-ivan.github.io/lumen/?from=2025-01-05&to=2025-01-20
  - https://aquizu-ivan.github.io/lumen/?from=2025-02-10&to=2025-02-01
  - https://aquizu-ivan.github.io/lumen/?from=2025-01-01&to=2025-01-10&serviceId=svc-2
- Pasos:
  - Abrir URL, verificar hidratación de inputs y Resumen.
  - Click preset 7d, confirmar URL actualiza sin reload.
  - Click copiar link, ver feedback Copiado.
  - Recargar y verificar persistencia de filtros.
  - Confirmar base /lumen/ en URL.
- Evidencia esperada:
  - Nota "Rango corregido automáticamente" cuando from > to.
  - Mensaje "Sin datos para este rango/servicio. Probá presets 7d o 30d." si total=0.
  - Estado ERROR con texto de causa probable si falla la carga.

## Ticket-10 - Estado inicial y carga
- Primera carga sin filtros: Resumen muestra "Selecciona un rango o usa un atajo para ver el resumen."
- Loading visible: durante fetch se ve "Cargando..." sin dejar panel vacío.
- Empty-state guiado: total=0 mantiene mensaje de sin datos y sugiere presets.
- Confirmar sin flashes ni paneles en blanco sin texto.
- Base /lumen/ intacta.

## Ticket-11 - Accesibilidad premium
- Navegación por teclado: TAB y SHIFT+TAB recorren inputs, select, presets, compartir demo y acciones.
- Foco visible consistente en botones, inputs y select.
- Estados anunciados: inicial, loading, sin datos y error se leen con aria-live.
- Confirmar que no cambia la estética ni el layout.

## Ticket-12 - Caché liviano y deduplicación
- Aplicar mismos filtros 2 veces dentro de 30s: no hay loading duro y "Actualizado hace Xs" se mantiene.
- Doble acción rápida con misma key: no hay parpadeo y se mantiene una sola actualización visible.
- Esperar más de 30s y reaplicar: vuelve a cargar y se actualiza el timestamp.

## Ticket-13 - Demo curada + contrato vivo
- URL demo: https://aquizu-ivan.github.io/lumen/?demo=1
- Demo activo: aplica 7d, mantiene serviceId si existe y abre contrato vivo.
- Toggle demo: agrega demo=1 al activar y lo remueve al desactivar sin borrar filtros.
- Copiar JSON: health y overview muestran feedback Copiado.
- Accesibilidad: TAB y ENTER/SPACE funcionan en toggle, colapsables y copiar JSON.

## Ticket-14 - Responsive
- Viewports: 360x800, 768x1024, 1024x768.
- Sin overflow horizontal en body.
- Controles con targets cómodos (presets, copiar link, aplicar/limpiar).
- Contrato vivo y pre no rompen layout, con scroll interno.
- Hero legible y jerarquía clara.
- Modo demo sigue funcionando.

## Ticket-15 - Dataset + timeseries + gráfico
- curl https://lumen-lumen-api.up.railway.app/meta
- curl https://lumen-lumen-api.up.railway.app/metrics/timeseries
- curl https://lumen-lumen-api.up.railway.app/metrics/timeseries?from=2025-03-01&to=2025-03-15&serviceId=svc-2
- Web: abrir https://aquizu-ivan.github.io/lumen/?demo=1 y ver panel Evolución con datos.
- Preset 30d cambia la tendencia.
- Cambiar serviceId y confirmar que la tendencia cambia.

## Ticket-16 - Presets y demo desde meta
- curl https://lumen-lumen-api.up.railway.app/meta y observar dataset.from/to.
- Web: abrir https://aquizu-ivan.github.io/lumen/?demo=1 y validar rango dentro de meta.from/to.
- Presets 7d/30d siempre quedan dentro de meta.from/to y muestran datos.
- Si el dataset es más corto que el preset, usar rango completo.
- Fallback: si /meta falla, presets y demo siguen funcionando sin crash.

## Ticket-17 - Mapa de calor
- curl https://lumen-lumen-api.up.railway.app/metrics/heatmap
- curl https://lumen-lumen-api.up.railway.app/metrics/heatmap?from=2025-03-01&to=2025-03-15&serviceId=svc-2
- Web: abrir https://aquizu-ivan.github.io/lumen/?demo=1 y ver panel Cuándo te buscan con datos.
- Preset 30d cambia densidad del mapa de calor.
- Cambiar serviceId y confirmar que el mapa de calor cambia.
- Rango extremo sin datos => max=0 y mensaje "Sin datos para este rango/servicio."

## Ticket-18 - Script 30s
1) Abrir https://aquizu-ivan.github.io/lumen/?demo=1
2) Confirmar:
   - Resumen arriba con KPIs legibles y formato humano.
   - Lecturas clave visibles si hay datos.
   - Evolución y mapa de calor visibles sin scrollear demasiado.
   - Técnica colapsada por defecto.
3) Cambiar serviceId + preset 30d:
   - KPIs cambian, lecturas cambian, gráficos cambian.

## Ticket-19 - Pulido premium
- No hay decimales largos en KPIs o lecturas.
- % con 1 decimal y coma ES.
- Copy humano (sin palabras técnicas visibles).
- Resumen se entiende en 30s con demo=1.
- Técnica colapsada por defecto.

## Ticket-20 - Vista cliente final
- Vista cliente (sin debug=1): todo en español, sin información técnica ni contrato visible.
- Bloque "Hoy en tu operación" arriba con bullets humanos (o mensaje sin datos).
- Resumen + Lecturas clave legibles en 30s; Evolución y Cuándo te buscan visibles.
- Vista técnica (debug=1): aparece "Información técnica" colapsada y copiar JSON funciona.
- URLs: https://aquizu-ivan.github.io/lumen/?demo=1 (cliente), https://aquizu-ivan.github.io/lumen/?demo=1&debug=1 (técnica visible).

## Ticket-21 - Gráficos premium IAQUIZU
- Evolución: pico resaltado (halo + punto + etiqueta) y línea/área suaves.
- Mapa de calor: pasar el mouse muestra tooltip con día/hora/turnos; tocar en móvil fija tooltip y tocar afuera lo cierra.
- Leyenda: "Menos demanda — Más demanda · pico: N".
- No regresiones: demo=1, presets anclados a /meta, caché y deduplicación intactos, foco visible intacto.

## Ticket-22 - Narrativa visual (30 segundos)
1) Abrir https://aquizu-ivan.github.io/lumen/?demo=1
2) Leer Hoy + Resumen + 1 lectura clave.
3) Confirmar que "Pico principal" aparece también en Cuándo te buscan y que Evolución muestra la fecha del pico.
4) Confirmar tooltip en mapa de calor y etiqueta de pico en evolución.

## Ticket-23 - Motor ECharts
1) /lumen/?demo=1:
   - Evolución visible con área suave + pico marcado "Pico: X turnos".
   - Tooltip humano al pasar el mouse.
   - Mapa de calor con tooltip humano y escala premium.
2) Preset 30d + cambiar servicio:
   - Los gráficos cambian sin parpadeo duro.
3) Resize:
   - Cambiar tamaño de ventana y confirmar ajuste de gráficos.
4) No regresiones:
   - Presets anclados a /meta, caché y deduplicación intactos, técnica sigue con acceso restringido por debug=1.

## Exhibición final
1) Fold:
   - En 1366x768 se ve Hoy + Resumen + Lecturas clave sin scroll grande.
2) Compartir demo:
   - Click en "Compartir demo" => "Link copiado".
   - Abrir el link en nueva pestaña: entra en modo demo con filtros actuales.
3) Debug:
   - Modo cliente: no aparece técnica ni en DOM.
   - Con debug=1: aparece "Información técnica" colapsada.

## Cierre IAQUIZU
- No hay duplicación del pico en Evolución ni en Cuándo te buscan (solo chip/nota mínima).
- Acordeones: abiertos por default, hover suave, transición fluida, aria-expanded y aria-controls correctos.
- Técnica no aparece sin debug=1.
- Presets/demo/caché/deduplicación y compartir demo siguen funcionando.
- A11y: TAB/SHIFT+TAB, foco visible y estados anunciados sin ruido.
