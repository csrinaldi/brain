---
status: approved
issue: 305
---

# Diseño — 3-axis-decoupling (issue 305)

## Decisiones técnicas

1. **Config & Dispatcher**:
   - `brain/scripts/harness/cli.mjs` exportará funciones de resolución separadas:
     - `resolvePlatform()`: Inspecciona `AGENT_PLATFORM` -> alias en `SDD_HARNESS` -> default `antigravity`.
     - `resolveEngine()`: Inspecciona `SDD_ENGINE` -> alias en `SDD_HARNESS` -> default `gentle-ai`.
     - `resolveMemory()`: Inspecciona `MEMORY_BACKEND` -> default `engram`.
   - `bootstrap.sh` se actualiza para leer `AGENT_PLATFORM`, `SDD_ENGINE` y `MEMORY_BACKEND` independientemente.

2. **Antigravity Platform Backend**:
   - `brain/scripts/harness/backends/antigravity.mjs` añade `GEMINI_SETTINGS_EMIT_PATH = '.gemini/settings.json'`.
   - Función `compileGeminiSettingsJson()` que retorna la estructura JSON serializada con indentación de 2 espacios.
   - `init()` emite tanto `AGENTS.md` como `.gemini/settings.json`.

3. **Claude Platform Backend**:
   - Formalizar `brain/scripts/harness/backends/claude.mjs` para emitir `.claude/settings.json` de forma determinística en `init()`.

4. **Distribution Manifest**:
   - Agregar `.gemini/settings.json` a `export const managed` en `brain/core/managed-paths.mjs`.

## Contract / API impact
- **Retrocompatibilidad**: `SDD_HARNESS` continuará funcionando como fallback/alias para no romper instalaciones existentes ni scripts de CI.
- **Archivos emitidos**: `.gemini/settings.json` ahora pasa a ser un archivo gestionado por `brain`.

## Alternativas descartadas
- **Sobrecargar `AGENTS.md` con configuración ejecutable**: Descartado porque el runner de Antigravity/Gemini lee hooks nativos desde `.gemini/settings.json`, mientras que `AGENTS.md` sirve como prompt context de lenguaje natural.

