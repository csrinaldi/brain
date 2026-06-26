# Instaladores auto-actualizantes no son inocuos

- **Descubierto en:** ISSUE-6 / bootstrap del entorno (`env:init`)
- **Aplica a:** todo tooling del ecosistema con subcomando `install`/`upgrade` (gentle-ai, y cualquier CLI que se gestione a sí misma)

## Síntoma

Se ejecuta `gentle-ai install --help` esperando ver la ayuda del subcomando. En su
lugar, el comando dispara el flujo REAL de instalación: crea un backup, se
auto-actualiza vía brew (1.33.2 → 1.37.2), se reinicia, y recién entonces falla con
`Error: flag: help requested`. El sistema quedó modificado por un comando que se
asumía de solo lectura.

## Causa

Las CLIs auto-gestionadas suelen interceptar el subcomando ANTES de parsear los
flags: el auto-update corre como prólogo de `install` sin importar qué flags vengan
después. La convención "`--help` nunca tiene efectos" es eso — una convención, no
una garantía.

## Solución / patrón correcto

- Para inspeccionar capacidades: usar el comando de diagnóstico de solo lectura
  (`gentle-ai doctor`, `gentle-ai config`, `<tool> version`) o la ayuda GLOBAL
  (`gentle-ai --help`), nunca `<subcomando-mutante> --help`.
- En scripts de bootstrap: invocar `install` solo a conciencia, detrás de un guard de
  idempotencia basado en diagnóstico de solo lectura. Ejemplo real en
  `scripts/bootstrap.sh`:

  ```bash
  if gentle-ai doctor 2>/dev/null | grep -q 'state file OK'; then
    ok "ecosistema ya inicializado"
  else
    gentle-ai install   # interactivo y auto-actualizante: TTY heredado, a conciencia
  fi
  ```

- Ojo con el exit code de los doctores: `gentle-ai doctor` reporta "unhealthy" por
  ruido ambiental (duplicados en PATH, endpoint de engram caído). Grepear la línea
  específica que importa, no confiar en el exit code global.
