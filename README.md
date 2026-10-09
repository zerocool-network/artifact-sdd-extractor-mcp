# artifact-sdd-extractor-mcp

> **Generador de SDDs (Software Design Documents) con trazabilidad total y cero alucinaciones a partir de artifacts de Claude.**

Construido bajo el principio rector de **Ingeniería Basada en Evidencia (ECC)**. Cada afirmación, token de estilo, componente o entidad del documento resultante cita de manera auditable e inmutable su fuente exacta:
- `[SRC-CODE: archivo:línea]` — Hecho extraído del código fuente del artifact.
- `[SRC-DB: tabla.columna]` — Hecho extraído del esquema de la base de datos conectada.
- `[SIN FUENTE]` — Marcador obligatorio cuando un dato no existe en ninguna fuente (registrado en el Anexo A de vacíos de información). **El sistema jamás inventa o alucina valores.**

---

## 🚀 Características Principales

1. **Plano de Diseño Determinista**:
   - Extrae tokens de diseño reales (colores hex/rgb, tipografía, espaciados, radios, sombras, breakpoints) con números de línea exactos vía PostCSS y AST.
   - Inventario de componentes (botones, tablas, formularios, modales, etc.), props, variantes y estados interactivos (`hover`, `disabled`, etc.).
   - Análisis de arquitectura de layouts (CSS Grids, Flexbox, media queries y clases responsivas).
2. **Plano de Datos de Solo Lectura (NFR-3)**:
   - Introspección de esquema de base de datos relacional (SQLite nativo de Node 22, soporte para scripts `schema.sql`).
   - `SqlGuard`: Doble barrera de seguridad que valida estrictamente operaciones de solo lectura (`SELECT`, `PRAGMA` read-only) y rechaza cualquier `DROP`, `ALTER`, `TRUNCATE`, `INSERT`, `UPDATE` o `DELETE`.
3. **Motor SDD de 14 Secciones Fijas**:
   - Genera especificaciones completas agnósticas de stack (implementables en Laravel, Python, Node.js, Go, etc.).
   - Diagramas Mermaid automáticos (Arquitectura en capas y Diagrama Entidad-Relación).
   - Anexo A: Lista numerada de vacíos de información (`[SIN FUENTE]`).
   - Anexo B: Propuestas no verificadas (sugerencias aisladas de los hechos comprobados).
4. **Transporte Dual**:
   - `stdio` para clientes de escritorio (Claude Desktop, Cursor, VS Code).
   - Streamable `HTTP/SSE` para conexiones remotas.
5. **Garantía ECC / TDD**:
   - Suite de pruebas con Vitest superando el 80% de cobertura.
   - Determinismo estricto (mismo input produce el mismo documento byte por byte).

---

## 🛠️ Herramientas MCP (Tools)

| Herramienta | Entrada | Salida | Descripción |
|---|---|---|---|
| `ingest_artifact_source` | `artifact_id`, `code` o `files[]` | Resumen + Hash SHA-256 | Valida, versiona y almacena el código fuente del artifact |
| `parse_design_tokens` | `artifact_id` | `tokens[]` | Extrae tokens con `[SRC-CODE: file:line]` |
| `extract_component_inventory` | `artifact_id` | `components[]` | Inventario de componentes, props, variantes y estados |
| `extract_layout` | `artifact_id`, `screen?` | `layout` | Layouts, grids, flexbox y breakpoints detectados |
| `extract_data_model` | `artifact_id`, `schema_sql?`, `db_dsn?` | `entities[]`, `relationships[]` | Introspección del esquema de datos con `[SRC-DB]` |
| `generate_sdd` | `artifact_id`, `title?`, `version?`, `strict?` | Markdown | Renderiza el SDD completo bajo la plantilla fija |
| `export_sdd` | `artifact_id`, `destination?`, `filename?` | Ruta o contenido | Exporta el SDD a un archivo (`EXPORT_DIR`) o lo devuelve inline |

### Recursos MCP (Resources)

- `artifact://{id}/spec`: Devuelve el documento SDD Markdown generado para el artifact.
- `artifact://{id}/tokens`: Devuelve los design tokens extraídos en formato JSON.

---

## 📦 Instalación y Configuración

### Requisitos
- Node.js 20+ (recomendado Node 22+)
- npm

### 1. Compilación local
```bash
npm install
npm run build
```

### 2. Configuración en Claude Desktop
Añadir la siguiente entrada en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "artifact-sdd-extractor": {
      "command": "node",
      "args": [
        "/Volumes/CORSAIR/Proyectos/mcp-artifacts/dist/index.js"
      ],
      "env": {
        "DB_DSN": "sqlite:///ruta/a/tu/base_de_datos.sqlite",
        "EXPORT_DIR": "/Volumes/CORSAIR/Proyectos/mcp-artifacts/exports"
      }
    }
  }
}
```

### 3. Configuración en Cursor / VS Code
Añadir en el archivo de configuración de MCP:
```json
{
  "mcpServers": {
    "artifact-sdd-extractor": {
      "command": "node",
      "args": ["/Volumes/CORSAIR/Proyectos/mcp-artifacts/dist/index.js"]
    }
  }
}
```

---

## 💻 Flujo de Trabajo Típico

1. **Ingesta del artifact copiado de Claude**:
   ```json
   {
     "artifact_id": "crm-app",
     "files": [
       { "path": "styles.css", "content": "..." },
       { "path": "App.tsx", "content": "..." },
       { "path": "schema.sql", "content": "..." }
     ]
   }
   ```
2. **Inspección de tokens y componentes**:
   Llamar a `parse_design_tokens` o `extract_component_inventory` para auditar los hechos extraídos.
3. **Generación del SDD**:
   Llamar a `generate_sdd` con `strict: true` para verificar la conformidad con la regla de cero alucinaciones.
4. **Exportación**:
   Llamar a `export_sdd` para generar el archivo Markdown en `exports/crm-app-SDD.md`.

---

## 📖 Documentación Adicional y Prompts para Agentes

Para consultar una guía detallada con plantillas de prompts listas para copiar y pegar en Claude, Cursor o cualquier asistente, consulta:
👉 **[Guía de Uso y Prompts para Agentes](docs/GUIA_DE_USO_Y_PROMPTS.md)**

---

## 🧪 Pruebas y Cobertura (TDD)

```bash
# Ejecutar todas las pruebas unitarias y de integración
npm test

# Ejecutar reporte de cobertura
npm run test:coverage
```

Las pruebas incluyen:
- Pruebas unitarias de parsers CSS y JSX con validación de líneas de código exactas.
- Pruebas de seguridad `SqlGuard` (bloqueo de DDL/DML e inyecciones multicomando).
- Pruebas del validador anti-alucinación y auditoría de vacíos de información.
- **Golden E2E Test**: flujo completo de ingesta, introspección SQLite, renderizado determinista de 14 secciones y exportación a disco con 100% de cumplimiento de evidencia.

---

## 📄 Licencia

MIT
