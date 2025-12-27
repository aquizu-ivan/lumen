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
## QA PROD — Identidad de deploy verificable
1) curl /health sin Origin (debe dar 200)
2) curl /health con Origin Pages (debe incluir Access-Control-Allow-Origin correcto)
3) verificar build.gitSha/region no nulos si Railway los provee
4) confirmar BOOT log en Railway
5) Setear Healthcheck Path = /health (paso humano)