# PRD: Terminal UI Setup Wizard para artifact-sdd-extractor-mcp

## Problem
Los miembros del equipo e ingenieros que usan Claude Desktop necesitan configurar el servidor MCP `artifact-sdd-extractor-mcp` en sus entornos locales (Mac, Windows, Linux). Editar manualmente `claude_desktop_config.json` con rutas absolutas genera fricción, errores de sintaxis JSON y riesgo de sobreescribir otros servidores MCP existentes.

## Evidence
- Configuración manual propensa a errores en rutas y variables de entorno.
- Necesidad del equipo en ZeroCool Network de un proceso de onboarding en 1 paso para Claude Desktop con confirmación interactiva.

## Users
- **Primary**: Desarrolladores e ingenieros que utilizan Claude Desktop en Mac o Windows y quieren documentar e implementar artifacts en sus proyectos.
- **Not for**: Entornos headless de producción que operan puramente por HTTP/SSE sin cliente desktop.

## Hypothesis
Creando una **interfaz interactiva de terminal (TUI)** con detección automática de sistema operativo, validación de prerrequisitos, selección de rutas de exportación y previsualización de cambios, los desarrolladores podrán configurar y verificar el MCP en Claude Desktop en menos de 30 segundos sin editar archivos de configuración a mano.

## Success Metrics
| Métrica | Objetivo | Método de Medición |
|---|---|---|
| Tiempo de configuración | < 30 segundos | Ejecución del wizard de inicio a fin |
| Integridad de configuración | 100% | Sin alterar otros MCPs ya registrados |
| Respaldo automático | 100% | Creación de `.backup` ante cualquier cambio |

## Scope
**MVP**
- CLI interactivo (TUI) ejecutable con `npm run setup`.
- Detección automática del OS y ubicación de `claude_desktop_config.json`.
- Prompt interactivo para personalizar `EXPORT_DIR`, nombre del servidor y `LOG_LEVEL`.
- Previsualización visual de los cambios antes de aplicar.
- Copia de seguridad automática del archivo existente.
- Test de diagnóstico integrado para verificar que el binario compila y responde.

**Out of scope**
- Interfaz gráfica web (GUI en navegador) — innecesaria para configuración de CLI local.

## Delivery Milestones

| # | Hito | Resultado | Estado |
|---|---|---|---|
| 1 | PRD & Plan | Definición de requerimientos y arquitectura del Wizard | completado |
| 2 | Módulo TUI Core | Motor interactivo de terminal con colores ANSI y readline | en progreso |
| 3 | Diagnóstico y Verificación | Health check de herramientas MCP y Claude Desktop config | pendiente |
| 4 | Integración y Documentación | Comando `npm run setup` y actualización de README | pendiente |

---
*Status: Aprobado para desarrollo — metodología ECC.*
