# artifact-sdd-extractor-mcp

> **Motor de Ingeniería Inversa y Generador de Documentos de Diseño de Software (SDD) con Trazabilidad Total Basada en Evidencia.**

`artifact-sdd-extractor-mcp` es un servidor MCP (Model Context Protocol) diseñado para analizar código fuente de aplicaciones web (artifacts, dashboards, componentes React/HTML/CSS) e introspeccionar esquemas de bases de datos relacionales (MySQL, SQLite), generando un **Documento de Diseño de Software (SDD)** formal, auditable y agnóstico de stack tecnológico (listo para su implementación en Laravel, Node.js, Python, Go, etc.).

---

## 🎯 Propósito y Casos de Uso

Cuando se construyen prototipos interactivos o artifacts de aplicaciones web, estos contienen decisiones visuales, lógica de negocio y estructuras de datos funcionales, pero carecen de una especificación técnica formal descargable para el equipo de desarrollo. 

Este proyecto resuelve ese vacío operativo:
1. **Reconstrucción 1:1 de Dashboards y Paneles Web**: Extrae la jerarquía de vistas, tarjetas de métricas (KPIs), gráficos estadísticos, filtros y tablas, vinculándolos directamente con las tablas y columnas de la base de datos (**MySQL** / **SQLite**).
2. **Extracción Determinista de Design Tokens**: Analiza hojas de estilo y clases mediante AST (PostCSS) para inventariar la paleta de colores, tipografías, espaciados, bordes redondeados, sombras y breakpoints responsivos.
3. **Especificación Agnóstica de Stack**: Produce un documento técnico estandarizado que permite a cualquier equipo de ingeniería programar la solución en su framework habitual sin depender del código fuente original.
4. **Gobierno y Permisos Controlados**: Opera bajo autorización explícita antes de realizar exportaciones al sistema de archivos local.

---

## 🔬 Principio Rector: Ingeniería Basada en Evidencia (ECC)

El motor opera bajo una regla de trazabilidad estricta: **ninguna afirmación técnica carece de origen verificado**.

Cada elemento documentado incluye su identificador de evidencia:
- `[SRC-CODE: archivo:línea]` — Dato extraído de forma determinista del código fuente (estilo, prop, evento, estado).
- `[SRC-DB: tabla.columna]` — Dato extraído de la introspección de base de datos relacional (MySQL / SQLite).
- `[SRC-FILE: archivo:columna]` — Dato extraído de hojas CSV, archivos JSON o tablas exportadas desde hojas de cálculo (Excel).
- `[SRC-DATA: dataset.campo]` — Dato extraído de arrays de datos o mock data embebidos en el código del componente.
- `[SRC-API: origen.campo]` — Dato estructurado provisto por APIs o servidores MCP complementarios.
- `[SIN FUENTE]` — Marcador obligatorio cuando un dato no existe en ninguna fuente analizada. El sistema **jamás infiere o supone valores**: deja el marcador y lo traslada al **Anexo A (Vacíos de Información)** para su definición con los responsables del proyecto.

---

## 🏗️ Arquitectura Técnica

```
artifact-sdd-extractor-mcp
 ├── src/
 │    ├── parser/
 │    │    ├── css-parser.ts        # Extractor AST (PostCSS) de design tokens con línea exacta
 │    │    ├── component-parser.ts  # Inventario de componentes, props, variantes, KPIs y charts
 │    │    ├── layout-parser.ts     # Grids, Flexbox, media queries y comportamiento responsivo
 │    │    └── dataset-parser.ts    # Inferencia de esquemas para CSV, JSON y mock data en código
 │    ├── db/
 │    │    ├── client.ts            # Conexión MySQL / SQLite e introspección de esquema
 │    │    └── guard.ts             # SqlGuard (Filtro estricto de solo lectura: SELECT / PRAGMA)
 │    ├── sdd/
 │    │    ├── engine.ts            # Motor determinista con plantilla fija de 14 secciones
 │    │    └── anti-hallucination.ts# Validador de cobertura de fuentes y auditor de vacíos
 │    ├── server.ts                 # Servidor MCP (Tools y Resources según especificación)
 │    └── index.ts                  # CLI ejecutable con soporte stdio y streamable HTTP/SSE
 ├── scripts/
 │    ├── setup-wizard.js           # Asistente interactivo de terminal para Claude Desktop
 │    └── install-claude.js         # Instalador directo automatizado
 └── test/                          # Batería de pruebas automatizadas (>85% cobertura)
```

---

## 🛠️ Herramientas MCP Disponibles

| Herramienta | Entradas | Salida | Función |
|---|---|---|---|
| `ingest_artifact_source` | `artifact_id`, `code` o `files[]` | Resumen técnico + Hash SHA-256 | Valida, versiona y almacena el código fuente en memoria |
| `parse_design_tokens` | `artifact_id` | `tokens[]` | Extrae colores, tipografía, espaciado y media queries con `[SRC-CODE]` |
| `extract_component_inventory` | `artifact_id` | `components[]` | Inventario de componentes (botones, tablas, KPIs, gráficos, modales) |
| `extract_layout` | `artifact_id`, `screen?` | `layout` | Mapeo de sistemas Grid, Flexbox y adaptación responsiva |
| `extract_data_model` | `artifact_id`, `entities?`, `schema_sql?`, `db_dsn?` | `entities[]`, `relationships[]` | Introspección universal: CSV, JSON, mock data en código, otros MCPs o SQL |
| `generate_sdd` | `artifact_id`, `title?`, `version?`, `entities?`, `strict?` | Markdown | Renderiza el SDD con 14 secciones fijas y diagramas Mermaid |
| `export_sdd` | `artifact_id`, `destination?`, `filename?` | Ruta de archivo o inline | Guarda el SDD en el directorio configurado (`EXPORT_DIR`) |

### Recursos MCP (Resources)
- `artifact://{id}/spec`: Retorna el documento SDD Markdown generado.
- `artifact://{id}/tokens`: Retorna la especificación estructurada de design tokens en formato JSON.

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos
- Node.js 20+ (recomendado Node 22+)
- npm

### 1. Clonar y Compilar
```bash
git clone git@github.com:zerocool-network/artifact-sdd-extractor-mcp.git
cd artifact-sdd-extractor-mcp
npm install
npm run build
```

### 2. Asistente Interactivo de Terminal (Setup Wizard)
Para configurar el servidor mediante el asistente interactivo de terminal (TUI) con diagnóstico de entorno, selección de carpetas de exportación y previsualización de cambios:
```bash
npm run setup
```

O si prefieres la instalación directa en modo desatendido:
```bash
npm run install:claude
```
El asistente detectará automáticamente tu sistema operativo (Mac o Windows), creará un respaldo de seguridad de tu configuración previa y registrará `artifact-sdd-extractor` sin alterar tus otros servidores MCP.

Una vez finalizado, reinicia Claude Desktop (`Cmd+Q` en Mac / `Alt+F4` en Windows).

---

## ⚙️ Cero Configuración de Base de Datos

`artifact-sdd-extractor-mcp` **NO requiere configurar credenciales, usuarios ni contraseñas de bases de datos**.

Claude Desktop ya dispone de acceso a tus datos a través de tus herramientas habituales (como Tabularis u otros MCPs de bases de datos que ya tengas instalados):
- **Integración transparente**: Claude consulta el esquema con Tabularis y lo incorpora automáticamente en el SDD.
- **Extracción desde código**: Si no se consulta ninguna base de datos, el motor extrae las entidades de datos directamente de las interfaces y modelos de TypeScript del propio artifact.
- **Instalación limpia**: Solo registras el ejecutable en `claude_desktop_config.json`, sin contraseñas ni variables de conexión:

```json
{
  "mcpServers": {
    "artifact-sdd-extractor": {
      "command": "node",
      "args": [
        "/Volumes/CORSAIR/Proyectos/mcp-artifacts/dist/index.js"
      ],
      "env": {
        "EXPORT_DIR": "/Volumes/CORSAIR/Proyectos/mcp-artifacts/exports"
      }
    }
  }
}
```

---

## 💻 Guía de Uso del Flujo de Trabajo

### Uso Directo en el Cliente MCP (Claude Desktop)
Al interactuar con un artifact o vista en tu cliente MCP, solicita la extracción de forma natural:

> **Instrucción de ejemplo:**  
> *"Genera el SDD completo del artifact actual sin omitir su lógica de negocio, comportamiento interactivo, componentes visuales ni modelo de datos de MySQL. Solicita confirmación antes de guardar el archivo en disco."*

El cliente MCP:
1. Recupera el código fuente de la vista actual y lo remite a `ingest_artifact_source`.
2. Si la vista interactúa con una base de datos relacional, introspecciona el esquema de MySQL.
3. Extrae la paleta visual, componentes (KPIs, gráficas, formularios) y sus estados interactivos.
4. Ensambla el SDD completo y te solicita confirmación antes de ejecutar `export_sdd`.

Para consultar la guía detallada de integración, consulta el documento:  
👉 **[Guía de Uso y Casos de Integración](docs/GUIA_DE_USO.md)**

---

## 🔒 Seguridad y Control de Acceso

1. **Permisos Interactivos (Human-in-the-Loop)**: Cualquier operación de escritura en disco mediante `export_sdd` requiere aprobación explícita en la interfaz del cliente.
2. **Garantía Read-Only en Base de Datos (NFR-3)**: El módulo `SqlGuard` inspecciona cada sentencia SQL antes de su ejecución. Solo se autorizan consultas de inspección de esquema (`SELECT`, `PRAGMA` de solo lectura). Cualquier intento de `DROP`, `ALTER`, `TRUNCATE`, `INSERT`, `UPDATE` o `DELETE` es bloqueado con una excepción de seguridad `QUERY_REJECTED`.
3. **Aislamiento de Transporte**: Todo mensaje de registro interno se dirige exclusivamente a `stderr`, manteniendo el flujo `stdout` reservado de forma pura para el protocolo JSON-RPC de MCP.

---

## 🧪 Pruebas Automatizadas y Calidad de Código

El proyecto sigue una metodología de desarrollo dirigida por pruebas (TDD) implementada con **Vitest**:

```bash
# Ejecutar todas las pruebas unitarias y de integración
npm test

# Ejecutar auditoría de cobertura de código
npm run test:coverage
```

### Cobertura de Pruebas
- **Pruebas de Lexer y Parser AST**: Validación de extracción de tokens con líneas de código verificables.
- **Pruebas de Componentes de Dashboard**: Detección de tarjetas KPI, gráficos de ingresos y estados de formulario.
- **Pruebas de Introspección MySQL y SQLite**: Validación de claves foráneas y tipos de datos relacionales.
- **Pruebas de Seguridad `SqlGuard`**: Verificación de rechazo de sentencias DDL y DML.
- **Prueba Golden E2E**: Flujo completo de ingesta, renderizado determinista de las 14 secciones del SDD y verificación del 100% de cumplimiento de citas de evidencia.

---

## 📄 Licencia

MIT License — Desarrollado para la infraestructura de ingeniería de **ZeroCool Network**.
