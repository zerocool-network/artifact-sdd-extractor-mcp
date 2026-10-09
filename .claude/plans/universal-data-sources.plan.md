# Plan de Implementación: Plano de Datos Universal

**PRD de referencia**: `.claude/prds/universal-data-sources.prd.md`

## 1. Arquitectura del Módulo de Datos Universal

Implementaremos un extractor integral: `src/parser/dataset-parser.ts`:
- **Parser de CSV**:
  - Lee cabeceras (headers) como nombres de columnas.
  - Muestrea las filas para inferir tipos de datos (`INTEGER`, `REAL`, `DATE`, `BOOLEAN`, `TEXT`).
  - Identifica claves primarias tentativas (`id`, `uuid`, etc.).
  - Genera evidencia: `[SRC-FILE: archivo.csv:columna]`.
- **Parser de JSON y Datasets en Código**:
  - Parsea archivos `.json` con arrays de objetos o estructuras tabulares.
  - Parsea arrays literales dentro de archivos `.tsx` / `.js` (`const salesData = [...]`, `const initialUsers = [...]`).
  - Infiera esquema: columnas, tipos y valores de ejemplo.
  - Genera evidencia: `[SRC-DATA: dataset.campo]` o `[SRC-FILE: archivo.json:campo]`.
- **Integración con otros MCPs (APIs)**:
  - En `generate_sdd` y `extract_data_model`, acepta objetos de esquema genéricos con origen `api-mcp`, generando etiquetas `[SRC-API: origen.campo]`.

## 2. Actualización de Tipos de Evidencia

En `src/types.ts`:
- Permitir tipos de evidencia:
  - `'SRC-CODE'`
  - `'SRC-DB'`
  - `'SRC-FILE'`
  - `'SRC-DATA'`
  - `'SRC-API'`
  - `'SIN-FUENTE'`
- Actualizar `AntiHallucinationValidator` para auditar y certificar `[SRC-FILE: ...]`, `[SRC-DATA: ...]`, `[SRC-API: ...]`.

## 3. Flujo en `ArtifactSddService`

`extractDataModel(artifactId, options)` orden de resolución:
1. Esquema pasado explícitamente por el cliente / otro MCP.
2. Archivos `.csv` o `.json` ingeridos en el artifact.
3. Archivos `.sql` o DDL DSN si existieran.
4. Arrays de datos / mock data embebidos en el código del artifact (`const data = [...]`).
5. Interfaces y tipos TypeScript en el código.
6. Si no existe ninguno, se marca como vacío en el Anexo A (`[SIN FUENTE]`).

## 4. Pruebas TDD
- Pruebas con archivos CSV ingeridos.
- Pruebas con arrays de mock data embebidos en componentes de Dashboard (`const kpiData = [...]`).
- Pruebas con JSON subido desde hojas de cálculo Excel exportadas.
- Verificación de 100% trazabilidad sin alucinaciones.
