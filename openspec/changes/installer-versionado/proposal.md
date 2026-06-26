# Proposal — Installer versionado de brain (Slice 6)

> **Estado:** Borrador para implementar · **Implementa:** [ADR-0006](../../../brain/project/decisions/adr-0006-distribucion-installer-versionado.md)

## Contexto

`brain` ya está extraí­do como repo standalone (este repo). Falta el mecanismo por el cual un proyecto consumidor **instala** y **actualiza** el core genérico sin tocar lo suyo. La arquitectura completa está en los ADRs de este repo (`brain/project/decisions/adr-0001..0007`) — **leelos primero**, especialmente ADR-0003 (split core/project + self-hosting) y ADR-0006 (distribución).

## Qué construir

1. **`brain:upgrade`** — comando que instala/actualiza una versión del core en un proyecto consumidor:
   - Mecanismo: `npm i -D github:csrinaldi/brain#<tag>` (o un script que fetchea el tag y copia los archivos gestionados al consumidor).
   - **Regla de oro (ADR-0003/0006): core read-only en el consumidor.** El upgrade SOBREESCRIBE los paths gestionados y NUNCA toca los locales.
2. **Manifiesto de paths gestionados** — define qué es upstream vs local:
   - Gestionado (se sobreescribe): `brain/core/**`, `scripts/**` (harness), `.gitattributes`.
   - Local (intocable): `brain/project/**`, `brain.config.json`, `.env`, `openspec/changes/**`, `.memory/**`.
3. **Versionado por git tags** — `v0.1.0`, `v1.0.0`… Taggear el estado actual como primer release.
4. **Migración de `brain.config.json`** — cuando una versión nueva agrega keys al schema, el upgrade las suma SIN pisar los valores del usuario (migraciones versionadas).
5. **Check-and-notify en `day:start`** — detecta si hay versión nueva y AVISA (no auto-aplica — respeta `brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md`).

## Fuera de scope (slices futuros)

- **Adapter de VCS (gh vs glab):** los scripts del harness hoy usan `glab` + API de GitLab. Este repo vive en GitHub, así que `ticket:start`/`tracker:board`/MR no funcionan acá todaví­a. El installer en sí­ es VCS-agnóstico (npm/git/file-copy), así que se puede construir igual. El adapter de VCS es otra historia.
- **Adopción en el consumidor (catastro):** se hace del lado de plataforma-scit (otra sesión), una vez que este installer tenga un release.

## Criterios de aceptación

- [ ] `brain:upgrade` instala una versión (git tag) y copia solo los paths gestionados.
- [ ] Los paths locales (`brain/project`, `brain.config.json`, `.env`) quedan intactos tras un upgrade (probado).
- [ ] Migración de config: agregar una key nueva en una versión no pisa valores existentes (probado).
- [ ] `day:start` detecta versión nueva y notifica sin auto-aplicar.
- [ ] Primer release taggeado (ej. `v0.1.0`).
- [ ] El propio repo brain se documenta: actualizar el README con cómo adoptar/actualizar.
