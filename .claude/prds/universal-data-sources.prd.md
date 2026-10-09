# PRD: Soporte Universal de Fuentes de Datos (Archivos Excel, CSV, JSON, Otros MCPs y Datasets Embebidos)

## Problem
Los artifacts de Claude no siempre se construyen conectándose a una base de datos SQL directa. Con frecuencia, los usuarios crean dashboards a partir de:
1. Archivos subidos a la conversación (**Excel .xlsx, CSV, JSON**).
2. Datos obtenidos a través de **otros servidores MCP** (APIs REST, CRMs, Stripe, Supabase, Airtable, etc.).
3. **Datasets y mock data embebidos** directamente en el código del artifact (`const mockData = [{...}]`, `const metrics = [...]`).

Si el generador de SDD solo contempla introspección SQL clásica, estos artifacts quedan incompletos o sin modelo de datos documentado.

## Evidence
- En el flujo de trabajo real con Claude, los usuarios con frecuencia pegan o cargan hojas de cálculo Excel/CSV o usan MCPs de APIs para prototipar vistas funcionales.
- Los artifacts resultantes contienen la estructura de datos completa en arrays de objetos JavaScript o archivos anexos.

## Users
- **Primary**: Desarrolladores y diseñadores de ZeroCool Network y la comunidad que prototipan interfaces con Claude usando cualquier fuente de datos (Excel, CSV, APIs, MCPs diversos o mock data).
- **Not for**: Sistemas que no manejan ninguna estructura de datos.

## Hypothesis
Si `artifact-sdd-extractor-mcp` implementa un **Plano de Datos Universal** capaz de:
- Inferir esquemas de datos desde archivos CSV y JSON ingeridos,
- Extraer esquemas desde arrays y datasets de datos embebidos en el código (`const data = [...]`),
- Aceptar esquemas arbitrarios procedentes de cualquier otro MCP cliente o API,
- Etiquetar la evidencia según el origen real (`[SRC-DB]`, `[SRC-FILE]`, `[SRC-DATA]`, `[SRC-API]`),

Entonces el SDD generado reflejará el 100% de los datos y su tipado con cero alucinaciones, independientemente de qué herramienta o archivo haya usado el creador del artifact.

## Success Metrics
| Métrica | Objetivo | Método de Medición |
|---|---|---|
| Cobertura de fuentes | 100% | Soporte para CSV, JSON, Arrays en código, APIs y SQL |
| Inferencia de tipos | 100% determinista | Detección de tipos (INTEGER, REAL, TEXT, BOOLEAN, DATE) |
| Trazabilidad de origen | 100% de evidencia | Citas exactas `[SRC-FILE: archivo]`, `[SRC-DATA: dataset.campo]`, `[SRC-API]` |

## Scope
**MVP**
1. **Extractor de Datasets en Código**: Parser que detecta arrays de objetos JSON/JS (`const clientes = [...]`, `const salesData = [...]`) e infiere sus columnas y tipos.
2. **Extractor de Archivos CSV y JSON**: Capacidad de ingerir `.csv` y `.json` en `ingest_artifact_source` y generar entidades y diccionario de datos.
3. **Plano de Datos Agnóstico**: Aceptar esquemas arbitrarios enviados desde cualquier MCP (Stripe, Salesforce, Supabase, etc.).
4. **Etiquetado de Evidencia Específico**:
   - `[SRC-DB: tabla.columna]` para bases de datos relacionales.
   - `[SRC-FILE: archivo:columna]` para CSV, JSON o Excel.
   - `[SRC-DATA: dataset.campo]` para mock data incrustada en el código.
   - `[SRC-API: servicio.campo]` para APIs de otros MCPs.
5. **Diagramas ER Mermaid automáticos** para cualquier fuente de datos inferida.

**Out of scope**
- Parsing de binarios nativos propietarios `.xlsx` en tiempo de ejecución sin dependencias (se gestiona vía JSON/CSV exportado o arrays en código).

## Delivery Milestones

| # | Hito | Resultado | Estado |
|---|---|---|---|
| 1 | PRD & Plan | Definición de especificación de fuentes universales | completado |
| 2 | Parser de Datasets y Archivos | Módulo de inferencia de esquemas (JSON, CSV, JS arrays) | en progreso |
| 3 | Integración en Motor SDD | Actualización de etiquetas de evidencia y diagramas Mermaid | pendiente |
| 4 | Suite de Pruebas TDD | Cobertura de pruebas unitarias y golden test con mock data | pendiente |

---
*Status: Aprobado para desarrollo — metodología ECC.*
