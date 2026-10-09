# SDD — Documento de Diseño del Sistema
## artifact-sdd-extractor-mcp — Generador de SDDs con trazabilidad total (sin alucinaciones)

| Campo | Valor |
|---|---|
| Proyecto | artifact-sdd-extractor-mcp |
| Versión del documento | 3.0 |
| Estado | Aprobado para desarrollo |
| Última revisión | 2026-10-09 |

---

## 1. Introducción

### 1.1 Propósito

Diseñar **artifact-sdd-extractor-mcp**: un servidor MCP que reconstruye la especificación completa de un artifact de Claude (aplicación web completa y probada) y genera un **SDD real, completo y agnóstico de stack** — implementable en Laravel, Python, Node, etc. — con **trazabilidad total: cada afirmación del SDD proviene de una fuente verificable (código del artifact o esquema de la BD). Nada se supone. Nada se alucina.**

### 1.2 Problema concreto

- El usuario tiene artifacts de Claude que son **diseños/aplicaciones web completos que le gustan y funcionan**.
- Claude **no ofrece exportar MD** del diseño ni de cómo está hecho.
- El código del artifact existe (se puede ver/copiar dentro de Claude), pero no hay documentación, no es portable, no es reimplementable.
- La información de datos sí vive en nuestra BD.

### 1.3 Principio rector: ingeniería basada en evidencia (ECC)

El sistema opera bajo una regla inviolable:

> **Toda afirmación del SDD generado debe citar su fuente:**
> - `[SRC-CODE: archivo:línea]` — dato extraído del código fuente del artifact (color, fuente, componente, regla).
> - `[SRC-DB: tabla.columna]` — dato extraído del esquema de la BD (entidad, tipo, relación).
> - `[SIN FUENTE]` — marcador obligatorio cuando un dato NO existe en ninguna fuente. El sistema NUNCA inventa un valor: deja el marcador y lo lista en un anexo de "vacíos de información".

Consecuencia: el SDD generado es **auditable línea por línea**. Un ingeniero puede verificar cada color, cada breakpoint y cada regla contra su fuente.

### 1.4 Los dos planos de extracción

El SDD del artifact tiene dos planos, con dos fuentes distintas:

| Plano | Fuente de verdad | Método |
|---|---|---|
| **PLANO DISEÑO** (UI/UX) | Código del artifact (HTML/CSS/JS o React), **pegado por el usuario** vía herramienta de ingesta | Parser determinístico: design tokens, componentes, layout, estados |
| **PLANO DATOS** (dominio) | Nuestra BD (esquema, datos) | Extracción SQL read-only |

> Nota de diseño clave: el MCP **no puede leer el código del artifact directamente** (vive dentro de Claude). Por eso existe la herramienta de ingesta: el usuario copia el código del artifact (Claude permite ver/copiar código, aunque no exporte MD) y el MCP lo convierte en especificación estructurada con evidencia.

### 1.5 Definiciones

| Término | Definición |
|---|---|
| MCP | Protocolo abierto (JSON-RPC 2.0) cliente-servidor para conectar IA con herramientas y datos. |
| Artifact | Aplicación web completa construida con Claude; código no exportable como MD pero visible/copiable. |
| Design token | Valor de diseño atómico con nombre: color, tipografía, espaciado, radio, breakpoint, sombra. |
| Evidencia | Referencia a fuente `[SRC-CODE]`/`[SRC-DB]` adjunta a cada dato del SDD. |
| Spec MCP | Revisión 2026-07-28 (la implementada). |

### 1.6 Referencias

- Spec MCP: https://modelcontextprotocol.io/specification/2026-07-28
- Guía de servidores: https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server
- SDK TS: github.com/modelcontextprotocol/typescript-sdk · SDK Python: github.com/modelcontextprotocol/python-sdk
- Design Tokens (W3C Community Group): design-tokens concepto y formato
- MCP Inspector (depuración oficial)

---

## 2. Requisitos

### 2.1 Funcionales (FR)

| ID | Requisito | Prioridad |
|---|---|---|
| FR-1 | `ingest_artifact_source`: recibir el código del artifact (texto) asociado a un `artifact_id`; validar, almacenar y versionar internamente. | Alta |
| FR-2 | `parse_design_tokens`: extraer tokens de estilo del código: colores (hex/rgb reales), fuentes, tamaños, espaciados, radios, sombras, breakpoints. Cada token con `[SRC-CODE]`. | Alta |
| FR-3 | `extract_component_inventory`: inventario de componentes/pantallas (botones, cards, formularios, tablas, modales…), con props, variantes y estados (hover/disabled/loading). | Alta |
| FR-4 | `extract_layout`: estructura de layout por pantalla (grids, flex, breakpoints, comportamiento responsive). | Alta |
| FR-5 | `extract_data_model` (plano datos): entidades, columnas, tipos, relaciones desde la BD. `[SRC-DB]`. | Alta |
| FR-6 | `generate_sdd`: consolidar ambos planos y renderizar el SDD completo en Markdown con plantilla fija, trazabilidad por dato, anexo de `[SIN FUENTE]`. | Alta |
| FR-7 | `export_sdd`: guardar el SDD en `EXPORT_DIR` o devolverlo inline. | Alta |
| FR-8 | Transporte stdio + Streamable HTTP. Resource `artifact://{id}/spec`. | Alta |

### 2.2 No funcionales (NFR)

| ID | Requisito | Criterio |
|---|---|---|
| NFR-1 | **Cero alucinación** | Test automático: ninguna afirmación del SDD sin etiqueta de fuente; 100 % de valores de diseño trazables a línea de código. |
| NFR-2 | Determinismo | Mismo código + misma BD ⇒ byte-identical SDD. |
| NFR-3 | Solo lectura (BD) | Usuario SELECT únicamente; validador rechaza DML/DDL. |
| NFR-4 | Credenciales fuera del repo | Secret manager / env vars. |
| NFR-5 | Límites | Timeout 30 s, máx. 10 000 filas, máx. tamaño de SDD con paginación por secciones. |
| NFR-6 | Compatibilidad | Claude Desktop, Cursor, VS Code, cualquier cliente MCP compliant. |
| NFR-7 | Observabilidad | Logs a stderr; auditoría por ingesta/extracción. |
| NFR-8 | Mantenibilidad | Type checking estricto; tests ≥ 80 % en parser y extractor. |

---

## 3. Arquitectura

```
Cliente MCP (Claude Desktop / Cursor / VS Code)
   │ stdio o HTTPS+SSE
   ▼
artifact-sdd-extractor-mcp
   ├── tools/
   │    ├── ingest_artifact_source   ◀── usuario pega el código del artifact
   │    ├── parse_design_tokens      ──┐
   │    ├── extract_component_inventory│  PARSER (plano diseño)
   │    ├── extract_layout           ──┘  → hechos con [SRC-CODE]
   │    ├── extract_data_model       ─────  EXTRACTOR (plano datos)
   │    │                                   → hechos con [SRC-DB]
   │    ├── generate_sdd             ─────  MOTOR SDD (plantilla fija)
   │    └── export_sdd
   ├── parser/      (lexer CSS/HTML/React → tokens/árbol de componentes)
   ├── extractor/   (introspección de esquema BD)
   ├── sdd/         (plantilla Markdown, render determinista, anexos)
   ├── db/client.ts (pool read-only) + db/guard.ts (solo SELECT)
   └── logger.ts    (stderr; NUNCA stdout en stdio)
```

**Stack recomendado:** TypeScript + Node 20+, `@modelcontextprotocol/sdk`, Zod para validación de inputs, `postcss`/`postcss-scss` para parsear CSS de forma robusta, `node-html-parser` o similar para el HTML/React parseable. (Alternativa: Python + SDK `mcp>=2.0` + FastMCP + `tinycss2` + `beautifulsoup4`.)

---

## 4. Diseño Detallado

### 4.1 Flujo de uso extremo a extremo

1. El usuario, en Claude con el artifact abierto, **copia el código del artifact** (vista de código del artifact).
2. En su cliente MCP: `ingest_artifact_source(artifact_id="crm-v1", code="...")` → el MCP valida y guarda el código, devuelve resumen (nº archivos, lenguaje detectado).
3. `parse_design_tokens` → devuelve tabla de tokens con evidencia:
   ```
   primary:   #4F46E5  [SRC-CODE: styles.css:12]
   font-base: Inter, 16px [SRC-CODE: styles.css:3]
   spacing-4: 1rem      [SRC-CODE: styles.css:28]
   ```
4. `extract_data_model` → entidades con `[SRC-DB]` por columna.
5. `generate_sdd("crm-v1")` → SDD Markdown completo, ambos planos, secciones fijas, anexo de vacíos.
6. `export_sdd(destination="file")` → `/data/sdds/crm-v1-SDD.md`.

### 4.2 Política anti-alucinación (núcleo del sistema)

Reglas implementadas en `sdd/` y verificadas por test:

- R1: Todo valor del plano diseño debe provenir del parseo del código; el parser **no conoce defaults estéticos**: si no hay color definido, no hay color en el SDD → `[SIN FUENTE]`.
- R2: Todo valor del plano datos debe venir de `information_schema`/introspección real de la BD.
- R3: El render falla (error explícito) si una sección obligatoria carece de fuente y no tiene marcador `[SIN FUENTE]`.
- R4: Anexo final "Vacíos de información": lista numerada de todo `[SIN FUENTE]` para que el equipo los resuelva con el negocio.
- R5: El modelo de IA (cliente) puede *sugerir* completados, pero las sugerencias quedan en sección separada "Propuestas (no verificadas)" — nunca mezcladas con hechos.

### 4.3 Contratos de herramientas (resumen)

| Tool | Input | Output |
|---|---|---|
| ingest_artifact_source | `{ artifact_id, files: [{path, content}] }` | resumen de ingesta + hash de versión |
| parse_design_tokens | `{ artifact_id }` | tokens[] `{name, value, evidence}` |
| extract_component_inventory | `{ artifact_id }` | componentes[] `{name, props, variants, states, evidence}` |
| extract_layout | `{ artifact_id, screen? }` | layout por pantalla con evidencia |
| extract_data_model | `{ artifact_id }` | entidades[] con `[SRC-DB]` |
| generate_sdd | `{ artifact_id }` | SDD Markdown completo |
| export_sdd | `{ artifact_id, destination }` | ruta o contenido |

Errores tipados: `ARTIFACT_NOT_FOUND`, `SOURCE_NOT_INGESTED`, `QUERY_REJECTED`, `TIMEOUT`, `PARSE_ERROR` (con línea/columna).

### 4.4 Esqueleto (TypeScript)

```typescript
server.tool(
  "parse_design_tokens",
  "Extrae design tokens del código del artifact con evidencia",
  { artifact_id: z.string() },
  async ({ artifact_id }) => {
    const files = await store.getSource(artifact_id);       // valida ingesta previa
    const tokens = parser.extractTokens(files);             // postcss: hechos + evidencia
    return { content: [{ type: "text", text: JSON.stringify(tokens, null, 2) }] };
  }
);

server.tool(
  "generate_sdd",
  "Genera el SDD completo, trazable y sin alucinaciones",
  { artifact_id: z.string() },
  async ({ artifact_id }) => {
    const design = await buildDesignFacts(artifact_id);     // parser: [SRC-CODE]
    const data   = await extractor.buildDataModel(artifact_id); // [SRC-DB]
    const sdd    = sddEngine.render(design, data);          // plantilla + anti-alucinación R1-R5
    return { content: [{ type: "text", text: sdd }] };
  }
);
```

### 4.5 Configuración

| Variable | Descripción |
|---|---|
| `DB_DSN` | Conexión BD fuente (usuario solo SELECT) |
| `MCP_TRANSPORT` | `stdio` \| `http` |
| `HTTP_PORT`, `QUERY_TIMEOUT_MS`, `MAX_ROWS`, `MAX_SDD_CHARS` | Límites |
| `EXPORT_DIR` | Salida de SDDs |
| `LOG_LEVEL` | Nivel de log |

---

## 5. Plantilla del SDD generado (secciones fijas)

1. Portada y control de versiones
2. Introducción (propósito, alcance, definiciones)
3. Resumen del sistema (qué hace el artifact, actores) — evidencia mixta
4. **Sistema de diseño** (plano diseño): tokens (colores, tipografía, espaciado, radios, sombras, breakpoints), componentes y variantes, estados, layout responsive — todo `[SRC-CODE]`
5. **Arquitectura propuesta** (agnóstica de stack, diagramas Mermaid)
6. **Modelo de datos** (plano datos): ER, diccionario de datos — todo `[SRC-DB]`
7. **Reglas de negocio** (extraídas del código: validaciones, cálculos) `[SRC-CODE]` + `[SRC-DB]`
8. **Flujos / Casos de uso** — `[SRC-CODE]` (interacciones) + `[SRC-DB]` (efectos)
9. **Interfaz / API propuesta** (endpoints o rutas) agnóstica de stack
10. Seguridad (roles, validaciones encontradas)
11. NFRs y límites
12. Plan de implementación + criterios de aceptación (incluye: "verificar X contra línea Y")
13. Anexo A: Vacíos de información (`[SIN FUENTE]`)
14. Anexo B: Propuestas no verificadas (si el modelo sugirió algo)

---

## 6. Seguridad y límites

Read-only en BD; doble barrera (permisos + guard SQL); credenciales en secret manager; OAuth + HTTPS si HTTP remoto; auditoría por operación; límites de tamaño con paginación.

## 7. Pruebas

1. MCP Inspector E2E.
2. Unitarios: parser CSS (colores reales extraídos de fixtures), validador anti-alucinación (debe FALLAR si falta evidencia).
3. Integración: cliente SDK ↔ servidor.
4. **Test de oro**: fixture con código + BD conocidos → SDD cuya cada afirmación se valida contra su `[SRC-...]`.
5. E2E: artifact real → SDD → checklist de paridad funcional con el artifact.

## 8. Despliegue

stdío: registro en Claude Desktop vía JSON de config (`node build/index.js`). HTTP remoto: Streamable HTTP + OAuth detrás de HTTPS.

## 9. Plan de implementación

| Fase | Entregable | Salida |
|---|---|---|
| 1 | Esqueleto + ingest_artifact_source + almacenamiento | Código ingerido y versionado |
| 2 | Parser de design tokens + componentes | Tokens con evidencia de artifact real |
| 3 | extract_data_model + extractor BD | Modelo con `[SRC-DB]` |
| 4 | Motor SDD + política anti-alucinación + generate/export | SDD completo real |
| 5 | HTTP, auditoría, tests de oro, CI/CD | Release 1.0 |

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El usuario no pega todo el código | El SDD lo marca `[SIN FUENTE]`; anexo A lo lista; nunca se inventa |
| Código dinámico (estilos inline en JS) difícil de parsear | Parser con fallback: regex acotada sobre literales; lo no parseable → `[SIN FUENTE]` |
| Reglas de negocio solo en la cabeza del negocio | Anexo A las expone; fase 2: flujo de completado asistido |
| Código duplicado/inconsistente en el artifact | Parser reporta conflictos (mismo token, dos valores) — no elige por sí mismo |

## 11. Métricas de éxito

- 100 % de afirmaciones del SDD con evidencia o marcador `[SIN FUENTE]` (0 valores inventados).
- Un equipo reimplementa el diseño en otro stack con paridad visual verificable.
- Determinismo: mismo input ⇒ SDD idéntico (hash igual).
- Tiempo: SDD completo de artifact típico en < 60 s tras ingesta.

---
*Fin — artifact-sdd-extractor-mcp SDD v3.0 (ingeniería basada en evidencia)*
