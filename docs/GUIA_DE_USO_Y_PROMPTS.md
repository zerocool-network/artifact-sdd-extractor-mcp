# Guía de Uso: Cómo Indicarle al Agente que Extraiga y Exporte Artifacts como SDD

Esta guía explica paso a paso cómo interactuar con un agente de IA (en Claude Desktop, Cursor, VS Code o terminal) para que utilice las herramientas de **`artifact-sdd-extractor-mcp`**, ingiera el código de tus artifacts y genere un documento de diseño de software (**SDD**) con trazabilidad total y cero alucinaciones.

---

## 💡 El Problema y la Solución

- **El Problema**: Los artifacts de Claude son aplicaciones web interactivas completas, pero Claude no ofrece un botón para "Exportar Documento de Diseño en Markdown".
- **La Solución**: Copias el código del artifact (o varios archivos), se lo pasas al agente en el chat y le pides que use el servidor MCP para reconstruir la especificación, auditar cada color/componente con su línea de código `[SRC-CODE]` y exportar el SDD a tu disco.

---

## 📋 Flujo de Trabajo en 3 Pasos

```
1. COPIAR CÓDIGO           2. PROMPT AL AGENTE                 3. RESULTADO AUDITABLE
┌──────────────────┐      ┌───────────────────────────┐       ┌───────────────────────┐
│ Artifact Claude  │ ───► │ "Ingiere este artifact y  │ ────► │ exports/crm-SDD.md    │
│ (React/CSS/HTML) │      │  exporta el SDD completo" │       │ 100% fuentes citadas  │
└──────────────────┘      └───────────────────────────┘       └───────────────────────┘
```

---

## 🗣️ Prompts Listos para Copiar y Pegar

### Caso 1: Ingesta directa de código pegado y exportación inmediata (El más común)

> **Prompt para el agente:**
>
> *"Tengo el código de un artifact de Claude que quiero documentar y exportar. Por favor:*
> 1. *Usa la herramienta `ingest_artifact_source` con el `artifact_id: "mi-app-v1"` y el siguiente código fuente.*
> 2. *Extrae los design tokens y el inventario de componentes.*
> 3. *Ejecuta `generate_sdd` con `strict: true` para asegurar cero alucinaciones.*
> 4. *Llama a `export_sdd` con `destination: "file"` para guardarlo en disco y dime la ruta del archivo generado.*
>
> *Aquí está el código del artifact:*
> ```tsx
> [PEGA AQUÍ EL CÓDIGO DEL ARTIFACT]
> ```*"

---

### Caso 2: Artifact con diseño + Esquema de Base de Datos (`schema.sql`)

Si además del código de la interfaz tienes la base de datos o el script DDL de creación de tablas:

> **Prompt para el agente:**
>
> *"Quiero generar el SDD completo para este sistema conectando el plano de diseño y el plano de datos:*
> 1. *Llama a `ingest_artifact_source` con `artifact_id: "sistema-ventas"` pasando dos archivos:*
>    - `App.tsx`: el código del artifact.
>    - `schema.sql`: las sentencias de base de datos.
> 2. *Inspecciona el modelo con `extract_data_model`.*
> 3. *Genera el SDD con `generate_sdd` incluyendo el diagrama Mermaid de base de datos.*
> 4. *Exporta el resultado a disco con `export_sdd(artifact_id="sistema-ventas", filename="sistema-ventas-SDD.md")`.*
>
> *Archivo 1: `App.tsx`:*
> ```tsx
> [CÓDIGO DE REACT/HTML/CSS]
> ```
>
> *Archivo 2: `schema.sql`:*
> ```sql
> [SENTENCIAS CREATE TABLE / DDL]
> ```*"

---

### Caso 3: Ingesta modular (múltiples archivos separados)

Cuando tu artifact tiene archivos CSS y TSX separados:

> **Prompt para el agente:**
>
> *"Ingiere el siguiente conjunto de archivos para el artifact `portal-clientes` usando `ingest_artifact_source`:*
> - Archivo `styles.css`:
> ```css
> :root {
>   --primary: #4F46E5;
>   --radius: 8px;
> }
> ```
> - Archivo `Dashboard.tsx`:
> ```tsx
> export function Dashboard() { ... }
> ```
>
> *Una vez ingerido, ejecuta `export_sdd` para que guarde el documento final en mi carpeta de exportación."*

---

### Caso 4: Consulta rápida o lectura inline sin escribir en disco

Si solo quieres revisar el documento dentro de la conversación o consultar un recurso MCP:

> **Prompt para el agente:**
>
> *"Ingiere este código con el id `dashboard-temp`, genera el SDD y devuélvemelo inline aquí en el chat para revisarlo antes de exportarlo a disco."*

O consultando el recurso MCP:
> *"Lee el recurso `artifact://dashboard-temp/spec` y muéstrame la sección de Design Tokens."*

---

## 🔍 Qué Hace el Agente Detrás de Escena (Llamadas a Herramientas)

Cuando le das cualquiera de los prompts anteriores, el agente ejecuta secuencialmente:

1. **`ingest_artifact_source({ artifact_id, code | files })`**:
   - Valida la sintaxis.
   - Genera un hash SHA-256 inmutable de la versión.
   - Cuenta archivos y líneas de código.
2. **`parse_design_tokens({ artifact_id })`**:
   - Analiza las reglas con PostCSS.
   - Extrae cada color, tipografía o espaciado con su etiqueta `[SRC-CODE: archivo:línea]`.
3. **`extract_component_inventory({ artifact_id })`**:
   - Identifica componentes, propiedades tipadas, variantes y estados (`hover`, `disabled`, `loading`).
4. **`extract_layout({ artifact_id })`**:
   - Mapea CSS Grids, Flexbox y breakpoints responsivos.
5. **`extract_data_model({ artifact_id })`**:
   - Introspecciona las tablas en modo seguro de solo lectura (`SqlGuard` garantiza cero mutaciones).
6. **`generate_sdd({ artifact_id, strict: true })`**:
   - Ensambla la plantilla fija de 14 secciones.
   - Audita que **ninguna tabla técnica carezca de fuente**.
   - Coloca los datos no encontrados en el **Anexo A (`[SIN FUENTE]`)**.
7. **`export_sdd({ artifact_id, destination: "file" })`**:
   - Guarda el archivo en la ruta configurada en `EXPORT_DIR` (por defecto `./exports/<artifact_id>-SDD.md`).

---

## 📁 Dónde se Guardan los SDDs Exportados

Por defecto, los documentos se guardan en:
```
/Volumes/CORSAIR/Proyectos/mcp-artifacts/exports/
```

Puedes cambiar esta ruta mediante la variable de entorno `EXPORT_DIR`:
```bash
EXPORT_DIR=/mi/ruta/personalizada/sdds node dist/index.js
```

---

## ⚠️ Reglas y Buenas Prácticas para el Agente

Cuando le des instrucciones al agente, puedes recordarle estas reglas:
- **No inventar valores**: Si un dato no está en el código ni en la base de datos, el agente debe dejar la etiqueta `[SIN FUENTE]` (el motor SDD lo hace automáticamente).
- **Mantener la plantilla completa**: El SDD resultante debe conservar las 14 secciones estándar para que sea compatible con cualquier equipo de desarrollo.
- **Validación Estricta**: Usar siempre `strict: true` al generar el SDD para garantizar que no existan afirmaciones no trazadas.
