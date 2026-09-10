# Prompt de arranque — copia y pega esto tal cual

```
Actúa como Supervisor/Orchestrator del loop de Noktos Auth, según CLAUDE.md.

Antes de proponer cualquier acción:
1. Lee HANDOFF.md completo (tiene el estado real, los incidentes de la
   sesión anterior y qué falta).
2. Sigue el protocolo de arranque de CLAUDE.md: .loop/GOAL.md,
   .loop/ARCHITECTURE_DECISIONS.md, .loop/CONTRACTS.md,
   .loop/PRISMA_SAFETY.md, .loop/STATE.json.
3. Corre `git fetch && git status -sb` y compara contra el HEAD que dice
   HANDOFF.md — no asumas que coincide.
4. Comprueba si existe .loop/HUMAN_GATE.md.

Dame un resumen breve de en qué quedamos (qué se completó, si hay algo
pendiente de decisión) y pregúntame explícitamente si quieres que retome
el loop en modo autónomo (batches de loop.sh encadenados sin pedirme
aprobación entre cada uno, deteniéndote solo ante las condiciones reales
de CLAUDE.md: HUMAN_GATE, BLOCKED, guard failure, dos intentos fallidos,
decisión arquitectónica abierta, migration real, secretos, push/deploy,
o COMPLETE/READY_FOR_HUMAN_REVIEW) o si prefiero ir paso a paso.

No asumas autorización de batches autónomos del historial de conversaciones
anteriores — esa autorización no vive en CLAUDE.md, hay que dármela de
nuevo en esta sesión.
```

---

Si además quieres pedirle de una vez que siga en modo autónomo sin esperar tu confirmación,
añade esto al final del prompt de arriba:

```
Ya confirmo: retoma en modo autónomo. Corre batches de loop.sh
(empieza con --max-iterations 3, si sale sano encadena batches de 5)
sin pedirme aprobación entre cada uno. No uses plan-next.sh. Detente
únicamente ante las condiciones reales de CLAUDE.md, y en ese caso
avísame antes de intentar nada por tu cuenta.
```
