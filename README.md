# LUMEN — Ops & Turnos

Lectura editorial y humana de una operación de turnos: ritmo, picos y señales claras para decidir.

## Qué es
LUMEN es una obra de cara al cliente de analítica premium. No es un tablero genérico ni un BI corporativo.

## Para quién
Negocios con turnos (salones, clínicas, servicios). Personas que necesitan entender su operación sin ruido.

## Qué muestra
- Hoy en tu operación
- Resumen del período
- Lecturas clave
- Evolución día a día
- Cuándo te buscan (mapa de calor)

## Demo pública
- Demo cliente: https://aquizu-ivan.github.io/lumen/?demo=1
- Demo con debug: https://aquizu-ivan.github.io/lumen/?demo=1&debug=1

## Cómo usar (rápido)
- Usá presets o fechas para definir el rango.
- Explorá los tooltips de Evolución y mapa de calor.
- Colapsá o expandí Lecturas/Evolución/Cuándo según tu foco.
- Compartí el estado actual con “Compartir demo”.
- Cambiá el servicio para ver cambios en tiempo real.

## Principios IAQUIZU
- Lectura humana antes que métricas crudas
- Una sola señal clara por sección
- Técnica fuera de la vista del cliente (solo debug=1)
- Compartible por URL (Compartir demo)
- Premium sin exceso

## Arquitectura (mini)
Monorepo con `apps/api` y `apps/web`. El dataset demo vive en la API.

## Desarrollo local (Windows-safe)
- `pnpm -r install`
- `pnpm -C apps/api run dev` (API en puerto 4000)
- `pnpm -C apps/web run dev`

## Deploy
- API: Railway (https://lumen-lumen-api.up.railway.app)
- Web: GitHub Pages con base `/lumen/`

Estado: v1 exhibible (de cara al cliente).
