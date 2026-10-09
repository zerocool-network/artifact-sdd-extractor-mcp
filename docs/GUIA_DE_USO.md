# Guía de Uso: Extracción de Especificaciones Técnicas (SDD) con artifact-sdd-extractor-mcp

Este documento describe el flujo de trabajo operativo para extraer documentos de diseño de software (**SDD**) completos, auditables y sin ambigüedades a partir de artifacts y aplicaciones web, utilizando el servidor **`artifact-sdd-extractor-mcp`**.

---

## 🎯 Objetivo Operativo

El objetivo del sistema es transformar aplicaciones web interactivas (dashboards, formularios, vistas de gestión) en una **especificación técnica formal y estructurada** para que cualquier equipo de ingeniería pueda reimplementarla en el stack de producción (Laravel, Node.js, Python, etc.) con total paridad funcional y visual.

---

## 🔄 Flujo de Ejecución

```
1. VISTA / ARTIFACT           2. INSTRUCCIÓN AL CLIENTE MCP       3. ESPECIFICACIÓN GENERADA
┌──────────────────────┐      ┌───────────────────────────────┐   ┌───────────────────────────┐
│ Aplicación Web       │ ───► │ "Genera el SDD completo       │ ─►│ exports/<id>-SDD.md       │
│ (React/CSS + MySQL)  │      │  con diseño, lógica y datos"  │   │ 100% trazabilidad técnica │
└──────────────────────┘      └───────────────────────────────┘   └───────────────────────────┘
```

El cliente MCP (Claude Desktop, Cursor, etc.) interactúa directamente con el servidor para orquestar la ingesta del código, la inspección del esquema de datos y el renderizado del SDD.

---

## 📋 Casos de Uso e Instrucciones de Ejecución

### Caso 1: Extracción de Dashboards y Paneles Analíticos con Base de Datos MySQL

En vistas que implementan paneles de control con tarjetas KPI, gráficos estadísticos y tablas vinculadas a una base de datos **MySQL**:

> **Instrucción:**  
> *"Del artifact que tenemos en pantalla, genera el SDD completo sin omitir su lógica de negocio, comportamiento interactivo, componentes visuales ni modelo de datos de MySQL. Solicita confirmación antes de guardar el archivo en disco."*

**Resultado que produce el motor:**
- Mapea las tarjetas de métricas (`StatCard`, `MetricCard`) a las columnas de MySQL correspondientes (`[SRC-DB: metricas.ingresos]`).
- Documenta las reglas de cálculo de porcentajes y formato de moneda citando la línea exacta del código (`[SRC-CODE: Dashboard.tsx:42]`).
- Genera el diagrama Entidad-Relación Mermaid a partir de las claves foráneas de MySQL.
- Pide autorización interactiva antes de escribir el archivo en la carpeta `exports/`.

---

### Caso 2: Extracción Directa de Componentes y Sistema de Diseño (Design Tokens)

Cuando se desea auditar la interfaz y extraer el sistema de diseño completo:

> **Instrucción:**  
> *"Analiza el artifact actual y genera su especificación técnica enfocándote en los design tokens (paleta de colores reales, tipografías, espaciados y breakpoints responsivos) y el inventario de componentes interactivos con sus variantes y estados. Solicita confirmación para exportar a disco."*

**Resultado que produce el motor:**
- Tabla exhaustiva de tokens con valores exactos en CSS/Hex/RGB.
- Catálogo de componentes con sus props tipadas y estados (`hover`, `disabled`, `focus`).
- Comportamiento responsivo mapeado por media queries y prefijos (`sm:`, `md:`, `lg:`).

---

### Caso 3: Reconstrucción para Migración de Stack (p. ej. a Laravel / Node.js)

Cuando el equipo necesita migrar una vista funcional a un framework backend:

> **Instrucción:**  
> *"Reconstruye la especificación arquitectónica del artifact en un SDD agnóstico de stack. Detalla las rutas de API propuestas, las reglas de validación y la estructura de base de datos requerida para implementarlo en producción."*

**Resultado que produce el motor:**
- Propuesta de endpoints RESTful limpios derivados del modelo de datos (`GET /api/recurso`, `POST /api/recurso`).
- Reglas de integridad referencial y validaciones de formulario.
- Criterios de aceptación verificables línea por línea para QA.

---

### Caso 4: Previsualización en Sesión sin Escritura a Disco

Si solo se desea inspeccionar la especificación dentro de la sesión activa:

> **Instrucción:**  
> *"Genera el SDD de este artifact y muéstrame el resumen y las secciones principales aquí mismo sin guardarlo en disco."*

El cliente mostrará el contenido del SDD directamente utilizando el recurso MCP `artifact://{id}/spec` o la herramienta `export_sdd` con destino `inline`.

---

### Caso 5: Dashboards Basados en Archivos (Excel, CSV, JSON) o Datasets en Código (Sin BD Externa)

Cuando el artifact fue diseñado a partir de hojas de cálculo (Excel / CSV), archivos JSON o datasets y mock data embebidos en el código:

> **Instrucción:**  
> *"Del artifact que tenemos en pantalla, genera el SDD completo extrayendo el modelo de datos a partir de las fuentes tabulares y datasets en el código, sin requerir base de datos externa. Solicita confirmación antes de guardar."*

**Resultado que produce el motor:**
- Infiere los tipos de datos de forma determinista (`INTEGER`, `REAL`, `BOOLEAN`, `DATE`, `TEXT`) y genera el diagrama Entidad-Relación Mermaid correspondiente.
- Asigna trazabilidad exacta según la fuente real:
  - `[SRC-FILE: archivo.csv:columna]` para hojas tabulares y archivos JSON.
  - `[SRC-DATA: dataset.campo]` para mock data y arrays de objetos en el código.
  - `[SRC-API: origen.campo]` para datos provenientes de otros MCPs o APIs complementarias.
- Produce el diccionario de datos completo y auditable con 100% de evidencia verificada.

---

## 🔒 Política de Permisos y Autorización Humana

El servidor sigue estrictamente el principio de **autorización previa antes de cualquier mutación de archivos**:

1. **Confirmación en Interfaz**: Al invocar la herramienta `export_sdd`, el cliente solicita confirmación interactiva al usuario con la ruta de destino.
2. **Revisión de Vacíos de Información**: Si algún dato no existe en las fuentes analizadas, el motor jamás inventa un valor. El usuario puede auditar en el **Anexo A: Vacíos de Información** qué elementos requieren definición con los responsables del proyecto.
3. **Seguridad de Base de Datos**: Las consultas al motor de base de datos se limitan estrictamente a introspección de esquemas mediante `SqlGuard` (solo `SELECT` y metadatos; operaciones `DROP`, `ALTER`, `INSERT`, `UPDATE` o `DELETE` son rechazadas de inmediato).

---

## 📁 Ubicación de Archivos Generados

Por defecto, los documentos de diseño se almacenan en:
```
<directorio-del-proyecto>/exports/<nombre-del-artifact>-SDD.md
```

La ruta puede personalizarse en cualquier momento mediante la variable de entorno `EXPORT_DIR`:
```bash
EXPORT_DIR=/ruta/a/mis/especificaciones node dist/index.js
```
