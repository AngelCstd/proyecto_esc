# PENDIENTES — Noktos Auth

Cosas conscientemente **diferidas**, no olvidadas. Cada una dice por qué se difirió y qué hace
falta para retomarla.

Última actualización: 2026-09-10.

---

## Contexto que manda sobre todo lo de abajo

**Destino de despliegue: Vercel (serverless).**

Consecuencia práctica: **no hay estado compartido en memoria entre peticiones.** Cada invocación
puede caer en una instancia distinta, y las instancias se apagan solas. Cualquier funcionalidad
que dependa de "recordar algo entre peticiones dentro del proceso" no funciona ahí, aunque
funcione perfecto en un servidor tradicional.

Registrado formalmente como **D-020** en `.loop/ARCHITECTURE_DECISIONS.md`.

---

## 1. Rate limiting — DIFERIDO

**Estado:** implementado una vez, apartado sin aprobar.
**Dónde vive:** rama `deferred/rate-limiting`, commit `2fea86b`. Ver `RAMA_RATE_LIMITING.md` en
esa rama para el detalle completo.

**Por qué se difirió:** la implementación usaba contadores en memoria del proceso, que en
serverless ni se comparten entre instancias ni sobreviven. El límite sería inexistente en la
práctica. Además identificaba al cliente por `socket.remoteAddress`, que detrás del proxy de
Vercel devuelve la IP del proxy y no la del usuario real.

**Qué hace falta para retomarlo:**
1. **Decisión humana:** elegir backend de estado compartido (Upstash/Redis, Vercel KV, u otro).
   El loop tiene prohibido elegirlo solo.
2. Cambiar el almacenamiento del throttler a ese backend.
3. Definir política de `X-Forwarded-For` (en cuántos proxies confiar).
4. Instalar dependencias desde el host (el sandbox del Implementer no tiene red).
5. Rehacerlo por el loop completo, **no** fusionar el diff viejo a mano.

**Rescatable de esa rama sin arrastrar nada:** el refactor de `requirePositiveInteger` en
`environment.validation.ts` es útil por sí solo y no tiene relación con serverless.

---

## 2. Caché en memoria — DIFERIDO (preventivo)

No hay nada implementado todavía, pero se deja anotado: cualquier caché que viva en la memoria
del proceso tiene exactamente el mismo problema que el rate limiting. Si en algún momento se
necesita caché, requiere el mismo backend externo compartido y la misma decisión humana previa.

---

## 3. Conexiones a Postgres en serverless — A REVISAR ANTES DE DESPLEGAR

**No es código pendiente, es configuración a verificar.**

En serverless, cada invocación puede abrir su propia conexión a Postgres, y eso agota rápido el
límite de conexiones de Supabase bajo carga. Supabase ofrece un endpoint de *connection pooler*
justo para este escenario; normalmente es cuestión de usar una URL de conexión distinta en
`DATABASE_URL`.

**Acción sugerida:** verificarlo antes del primer despliegue real a Vercel. No se ha investigado
ni configurado nada al respecto.

---

## 4. Tests automatizados — DIFERIDO POR DECISIÓN

La versión actual del loop **no escribe ni ejecuta tests**. Es una decisión explícita de costo,
registrada como `D-017`. Hoy solo se verifica que el proyecto compile y que el esquema de datos
sea válido.

**Si se quiere revertir**, la ruta acordada es:
1. Registrar la decisión humana que revierte `D-017`.
2. Instalar el framework (Jest/Vitest) desde el host.
3. Modificar `.loop/scripts/verify.sh` para que ejecute los tests de verdad — si no, son
   decoración: nadie se entera si se rompen.
4. Meter tareas de test al backlog, **empezando por lo crítico de seguridad** (generación y
   hasheo de API keys, la desambiguación del header `Authorization` de D-019, y la clasificación
   de identidad por `rol` de D-018). No intentar "testear todo" de golpe.

**Advertencia honesta:** la IA testeando su propio código tiende a escribir tests que confirman
lo que el código hace, no lo que debería hacer. Se mitiga (el Reviewer independiente también
revisa los tests, y las tareas se redactan desde los criterios de aceptación), pero no
desaparece. No sustituye revisión humana.

---

## 5. Decisiones arquitectónicas todavía abiertas

Estas viven en `.loop/ARCHITECTURE_DECISIONS.md`, sección `OPEN`. El loop **frenará solo** y
preguntará cuando llegue a ellas:

- **Q-001** — la matriz exacta de qué puede hacer cada rol (`administrador` / `reservante` /
  `viajero`). Es la más probable de aparecer pronto.
- **Q-002** — el flujo OAuth específico para la integración con MCP/ChatGPT.
- **Q-003** — el token interno firmado entre Auth y Core (hoy va sin token, con el hueco listo
  para meterlo después sin romper nada).
