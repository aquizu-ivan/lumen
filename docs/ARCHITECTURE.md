# Arquitectura

## Propósito
LUMEN es una obra de cara al cliente de analítica premium para operaciones con turnos, enfocada en lectura humana y narrativa editorial.

## Componentes
- `apps/api`: API read-only con dataset demo y endpoints `/health`, `/meta`, `/metrics/overview`, `/metrics/timeseries`, `/metrics/heatmap`.
- `apps/web`: interfaz premium con narrativa editorial, gráficos ECharts y técnica visible solo con `debug=1`.

## Decisiones clave
- Presets anclados a `/meta` para mantener rangos dentro del dataset.
- Caché y deduplicación de requests en el cliente.
- Técnica fuera del DOM en modo cliente (solo `debug=1`).
- Vite con base `/lumen/` para GitHub Pages.

## Verificación rápida (opcional)
- `curl https://lumen-lumen-api.up.railway.app/health`
- `curl "https://lumen-lumen-api.up.railway.app/metrics/overview"`
- `curl "https://lumen-lumen-api.up.railway.app/metrics/timeseries?from=2025-03-25&to=2025-03-31"`
