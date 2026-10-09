# Plan de Implementación: Terminal UI Setup Wizard

**PRD de referencia**: `.claude/prds/cli-setup-wizard.prd.md`

## 1. Arquitectura del Wizard de Terminal

El Wizard se implementará como un módulo ejecutable autónomo en `scripts/setup-wizard.js`:
- Cero dependencias externas pesadas: basado en `node:readline/promises`, `node:fs`, `node:path`, `node:os`.
- Componentes visuales:
  - Banner ASCII estilizado (`ZeroCool Network | artifact-sdd-extractor-mcp Setup`).
  - Paleta de colores ANSI (Cyan para títulos, Verde para éxito, Amarillo para advertencias, Gris para detalles).
  - Cajas y separadores de terminal (`┌─┐`, `│`, `└─┘`).
  - Prompts interactivos con valores por defecto sugeridos.
  - Verificación en seco del servidor MCP (invocación de diagnóstico de tools).

## 2. Flujo de Pasos Interactivos

1. **Bienvenida y Detección de Entorno**:
   - Detecta OS (macOS, Windows, Linux).
   - Localiza `claude_desktop_config.json`.
   - Verifica existencia de `dist/index.js` (si no existe, ejecuta `npm run build` automáticamente).
2. **Formulario Interactivo de Preguntas**:
   - Pregunta 1: Ruta de exportación de los SDDs (`EXPORT_DIR`), default: `/Volumes/CORSAIR/Proyectos/mcp-artifacts/exports`.
   - Pregunta 2: Nivel de registro (`LOG_LEVEL`: `info` | `debug` | `warn`), default: `info`.
   - Pregunta 3: Nombre del servidor MCP en Claude Desktop, default: `artifact-sdd-extractor`.
3. **Previsualización y Confirmación**:
   - Muestra el bloque JSON exacto que se agregará.
   - Muestra los servidores ya instalados en Claude Desktop para confirmar que se preservarán.
   - Pide confirmación explícita `[S/n]`.
4. **Aplicación Segura**:
   - Crea respaldo con timestamp: `claude_desktop_config.json.backup`.
   - Escribe el JSON formateado.
5. **Diagnóstico Integrado**:
   - Ejecuta un health check llamando a `dist/index.js --help` o verificando las herramientas registradas.
   - Emite confirmación de éxito con instrucciones de reinicio de Claude Desktop.

## 3. Criterios de Aceptación
- Ejecución no interactiva vía flags opcionales (`--yes` o `--auto`) y ejecución interactiva por defecto.
- Preservación del 100% de los servidores MCP existentes en el archivo.
- Retorno de código 0 en ejecución exitosa.
