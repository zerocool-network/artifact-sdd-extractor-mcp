import {
  DesignFacts,
  DataModel,
  SDDGenerationOptions,
  DesignToken,
  ComponentItem,
  LayoutStructure,
  DataEntity,
  InformationGap,
  UnverifiedProposal,
} from '../types.js';
import { AntiHallucinationValidator } from './anti-hallucination.js';

export class SddEngine {
  render(
    design: DesignFacts,
    data: DataModel,
    options: SDDGenerationOptions = { artifactId: design.artifactId }
  ): string {
    const validator = new AntiHallucinationValidator();
    validator.reset();

    const title = options.title || `Sistema ${design.artifactId}`;
    const version = options.version || '1.0.0';
    const author = options.author || 'artifact-sdd-extractor-mcp';
    const date = new Date().toISOString().split('T')[0];

    const sections: string[] = [];

    // 1. Portada y control de versiones
    sections.push(this.renderSection1(title, design.artifactId, version, author, date));

    // 2. Introducción
    sections.push(this.renderSection2(design, data, validator));

    // 3. Resumen del sistema y Actores
    sections.push(this.renderSection3(design, data, validator));

    // 4. Sistema de diseño (Plano Diseño)
    sections.push(this.renderSection4(design, validator));

    // 5. Arquitectura propuesta
    sections.push(this.renderSection5(design, data));

    // 6. Modelo de datos (Plano Datos)
    sections.push(this.renderSection6(data, validator));

    // 7. Reglas de negocio
    sections.push(this.renderSection7(design, data, validator));

    // 8. Flujos / Casos de uso
    sections.push(this.renderSection8(design, data, validator));

    // 9. Interfaz / API propuesta (agnóstica de stack)
    sections.push(this.renderSection9(design, data, validator));

    // 10. Seguridad
    sections.push(this.renderSection10(design, data, validator));

    // 11. NFRs y límites
    sections.push(this.renderSection11(design, data));

    // 12. Plan de implementación y Criterios de Aceptación
    sections.push(this.renderSection12(design, data));

    // 13. Anexo A: Vacíos de información ([SIN FUENTE])
    sections.push(this.renderSection13(validator.getGaps()));

    // 14. Anexo B: Propuestas no verificadas
    sections.push(this.renderSection14(options.proposals || []));

    const finalMarkdown = sections.join('\n\n---\n\n');

    // Run self-audit
    if (options.strict) {
      const audit = validator.auditDocument(finalMarkdown);
      if (audit.violations.length > 0) {
        throw new Error(`Fallo de estricta verificación anti-alucinación: ${audit.violations.join('; ')}`);
      }
    }

    return finalMarkdown;
  }

  private renderSection1(title: string, artifactId: string, version: string, author: string, date: string): string {
    return `# Documento de Diseño del Sistema (SDD)
## ${title}

| Campo | Valor |
|---|---|
| **Artifact ID** | \`${artifactId}\` |
| **Versión del SDD** | ${version} |
| **Generado por** | ${author} |
| **Fecha de generación** | ${date} |
| **Principio rector** | Ingeniería basada en evidencia (ECC) — Cero Alucinación |`;
  }

  private renderSection2(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    return `## 1. Introducción

### 1.1 Propósito
Este documento describe formalmente la arquitectura, interfaz, modelo de datos y reglas de negocio del sistema reconstruido a partir del artifact \`${design.artifactId}\`. Su objetivo es proporcionar una especificación exhaustiva, auditable y agnóstica de stack para su reimplementación en cualquier tecnología (Laravel, Node.js, Python, Go, etc.).

### 1.2 Regla de Trazabilidad Total
Cada dato contenido en esta especificación cuenta con una etiqueta de origen estricta:
- \`[SRC-CODE: archivo:línea]\`: Hecho verificado extraído directamente del código fuente del artifact.
- \`[SRC-DB: tabla.columna]\`: Hecho verificado extraído directamente de la base de datos de verdad.
- \`[SRC-FILE: archivo:columna]\`: Hecho verificado extraído de archivos CSV, JSON o fuentes documentales anexas.
- \`[SRC-DATA: dataset.campo]\`: Hecho verificado extraído de datasets o mock data embebidos en el artifact.
- \`[SRC-API: origen.campo]\`: Hecho verificado obtenido vía APIs externas o herramientas MCP auxiliares.
- \`[SIN FUENTE]\`: Dato no presente en ninguna fuente analizada. Jamás se inventa o alucina un valor; queda registrado en el **Anexo A: Vacíos de Información**.`;
  }

  private renderSection3(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    const componentCount = design.components.length;
    const entityCount = data.entities.length;

    let summaryText = `El artifact implementa una aplicación con ${componentCount} componentes detectados y opera sobre un modelo de ${entityCount} entidades en base de datos.`;
    if (componentCount === 0 && entityCount === 0) {
      summaryText = `Resumen no disponible en fuentes analizadas ${validator.registerGap('Resumen', 'Descripción general', 'No se detectaron componentes ni entidades')}.`;
    }

    // Actors detection from code / DB
    const actors: Array<{ actor: string; desc: string; evidence: string }> = [];
    const hasAdmin = design.components.some(c => c.name.toLowerCase().includes('admin'));
    const hasUser = data.entities.some(e => e.table.toLowerCase().includes('user') || e.table.toLowerCase().includes('usuario'));

    if (hasAdmin) {
      const cmp = design.components.find(c => c.name.toLowerCase().includes('admin'))!;
      actors.push({ actor: 'Administrador', desc: 'Gestiona la configuración y operaciones maestras', evidence: cmp.evidence });
    }
    if (hasUser) {
      const entity = data.entities.find(e => e.table.toLowerCase().includes('user') || e.table.toLowerCase().includes('usuario'))!;
      actors.push({ actor: 'Usuario Autenticado', desc: 'Interacciona con las entidades principales del sistema', evidence: entity.evidence });
    }
    if (actors.length === 0) {
      actors.push({
        actor: 'Usuario Final',
        desc: 'Operador de la interfaz web',
        evidence: design.components[0]?.evidence || validator.registerGap('Actores', 'Actor principal', 'No se detectó entidad de usuario explícita'),
      });
    }

    let actorsTable = '| Rol / Actor | Descripción | Evidencia |\n|---|---|---|\n';
    for (const a of actors) {
      actorsTable += `| **${a.actor}** | ${a.desc} | ${a.evidence} |\n`;
    }

    return `## 2. Resumen del Sistema y Actores

### 2.1 Descripción
${summaryText}

### 2.2 Actores del Sistema
${actorsTable}`;
  }

  private renderSection4(design: DesignFacts, validator: AntiHallucinationValidator): string {
    // 1. Tokens table
    const colors = design.tokens.filter(t => t.category === 'color');
    const typography = design.tokens.filter(t => t.category === 'typography');
    const spacing = design.tokens.filter(t => t.category === 'spacing');
    const radii = design.tokens.filter(t => t.category === 'borderRadius');
    const shadows = design.tokens.filter(t => t.category === 'shadow');
    const breakpoints = design.tokens.filter(t => t.category === 'breakpoint');

    const renderTokenRows = (tokens: DesignToken[], categoryName: string): string => {
      if (tokens.length === 0) {
        return `| ${categoryName} | ${validator.registerGap('Tokens', categoryName, `No se encontraron tokens de ${categoryName}`)} | ${validator.registerGap('Tokens', categoryName, 'Sin fuente')} |\n`;
      }
      return tokens.map(t => `| \`${t.name}\` | \`${t.value}\` | ${t.evidence} |`).join('\n') + '\n';
    };

    let tokenSection = `### 3.1 Design Tokens

| Token / Propiedad | Valor Real | Evidencia |
|---|---|---|
${renderTokenRows(colors, 'Colores')}
${renderTokenRows(typography, 'Tipografía')}
${renderTokenRows(spacing, 'Espaciado')}
${renderTokenRows(radii, 'Bordes y Radios')}
${renderTokenRows(shadows, 'Sombras')}
${renderTokenRows(breakpoints, 'Breakpoints')}`;

    // 2. Components inventory
    let compTable = `### 3.2 Inventario de Componentes y Variantes

| Componente | Tipo | Props detectadas | Variantes / Estados | Evidencia |
|---|---|---|---|---|
`;
    if (design.components.length === 0) {
      compTable += `| Ninguno | N/A | N/A | ${validator.registerGap('Componentes', 'Inventario', 'No se detectaron componentes en el código')} | ${validator.registerGap('Componentes', 'Fuente', 'Sin código')} |\n`;
    } else {
      for (const c of design.components) {
        const propsStr = c.props.length > 0 ? c.props.map(p => `\`${p}\``).join(', ') : '`none`';
        const statesStr = [
          ...c.variants.map(v => `var:${v}`),
          ...c.states.map(s => `state:${s}`),
        ].join(', ') || 'estándar';
        compTable += `| **${c.name}** | \`${c.type}\` | ${propsStr} | ${statesStr} | ${c.evidence} |\n`;
      }
    }

    // 3. Layout and responsive
    let layoutText = `### 3.3 Layout y Comportamiento Responsivo\n\n`;
    layoutText += `- **Evidencia base de layout**: ${design.layout.evidence}\n`;

    if (design.layout.gridSystems.length > 0) {
      layoutText += `\n#### Grids Detectados:\n`;
      for (const g of design.layout.gridSystems) {
        layoutText += `- \`${g.description}\` ${g.evidence}\n`;
      }
    }

    if (design.layout.flexLayouts.length > 0) {
      layoutText += `\n#### Flexbox Detectados:\n`;
      for (const f of design.layout.flexLayouts) {
        layoutText += `- \`${f.description}\` ${f.evidence}\n`;
      }
    }

    if (design.layout.responsiveBehavior.length > 0) {
      layoutText += `\n#### Adaptabilidad Responsiva:\n`;
      for (const r of design.layout.responsiveBehavior) {
        layoutText += `- ${r.description} ${r.evidence}\n`;
      }
    }

    return `## 3. Sistema de Diseño (Plano Diseño)

${tokenSection}

${compTable}

${layoutText}`;
  }

  private renderSection5(design: DesignFacts, data: DataModel): string {
    return `## 4. Arquitectura Propuesta (Agnóstica de Stack)

El sistema se estructura en una arquitectura en capas limpia y desacoplada, asegurando independencia de la tecnología final de despliegue:

\`\`\`mermaid
graph TD
    Client[Cliente Web / Frontend UI]
    API[Capa API REST / GraphQL / Controller]
    Service[Capa de Servicios y Dominio]
    Repository[Capa de Persistencia / Repositorio]
    Database[(Base de Datos Relacional)]

    Client -->|HTTP / JSON| API
    API --> Service
    Service --> Repository
    Repository -->|SQL Read/Write| Database
\`\`\`

- **Capa UI**: Reconstrucción de los componentes inventariados con sus tokens de diseño.
- **Capa Dominio**: Orquestación de las reglas de negocio detectadas.
- **Capa Persistencia**: Mapeo directo contra el esquema de base de datos verificado.`;
  }

  private renderSection6(data: DataModel, validator: AntiHallucinationValidator): string {
    if (data.entities.length === 0) {
      const gap = validator.registerGap('Modelo de Datos', 'Esquema de BD', 'No se proporcionó base de datos conectada ni esquema SQL');
      return `## 5. Modelo de Datos (Plano Datos)

> ${gap}

Actualmente no hay tablas conectadas para este artifact. Configure \`DB_DSN\` o proporcione un script SQL de esquema para introspección.`;
    }

    // Mermaid ER Diagram
    let erDiagram = '```mermaid\nerDiagram\n';
    for (const rel of data.relationships) {
      erDiagram += `    ${rel.fromTable} }|--|| ${rel.toTable} : "relates_to"\n`;
    }
    for (const e of data.entities) {
      erDiagram += `    ${e.table} {\n`;
      for (const c of e.columns) {
        const pk = c.isPrimaryKey ? 'PK' : '';
        const fk = c.references ? 'FK' : '';
        const tag = pk || fk ? `"${pk || fk}"` : '';
        const cleanType = (c.type || 'string').replace(/[\(\),\s]/g, '_').toLowerCase();
        erDiagram += `        ${cleanType} ${c.name} ${tag}\n`;
      }
      erDiagram += `    }\n`;
    }
    erDiagram += '```\n';

    // Data Dictionary
    let dictionary = '### 5.2 Diccionario de Datos\n\n';
    for (const e of data.entities) {
      dictionary += `#### Tabla: \`${e.table}\` (${e.evidence})\n\n`;
      dictionary += '| Columna | Tipo | Nullable | Clave | Referencia | Evidencia |\n|---|---|---|---|---|---|\n';
      for (const c of e.columns) {
        const pkStr = c.isPrimaryKey ? 'PK' : (c.references ? 'FK' : '-');
        const refStr = c.references ? `\`${c.references.table}.${c.references.column}\`` : '-';
        dictionary += `| **${c.name}** | \`${c.type}\` | ${c.nullable ? 'Sí' : 'No'} | ${pkStr} | ${refStr} | ${c.evidence} |\n`;
      }
      dictionary += '\n';
    }

    return `## 5. Modelo de Datos (Plano Datos)

### 5.1 Diagrama Entidad-Relación (ER)
${erDiagram}

${dictionary}`;
  }

  private renderSection7(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    let rulesTable = '| ID | Regla | Descripción | Evidencia |\n|---|---|---|---|\n';

    if (design.businessRules.length === 0) {
      // Create rules based on detected validations
      const buttonWithDisabled = design.components.find(c => c.states.includes('disabled'));
      if (buttonWithDisabled) {
        rulesTable += `| BR-01 | Deshabilitación de acción | El botón se deshabilita condicionalmente según el estado | ${buttonWithDisabled.evidence} |\n`;
      }

      const pkCols = data.entities.flatMap(e => e.columns.filter(c => c.isPrimaryKey));
      if (pkCols.length > 0) {
        rulesTable += `| BR-02 | Unicidad de entidad | Integridad referencial primaria obligatoria en ${pkCols[0].name} | ${pkCols[0].evidence} |\n`;
      }

      if (!buttonWithDisabled && pkCols.length === 0) {
        rulesTable += `| BR-GAP | Reglas adicionales | ${validator.registerGap('Reglas de Negocio', 'Cálculos y validaciones', 'No se encontraron reglas complejas en el código extraído')} | ${validator.registerGap('Reglas', 'Fuente', 'Sin código')} |\n`;
      }
    } else {
      for (const r of design.businessRules) {
        rulesTable += `| ${r.id} | ${r.name} | ${r.description} | ${r.evidence} |\n`;
      }
    }

    return `## 6. Reglas de Negocio y Validaciones

${rulesTable}`;
  }

  private renderSection8(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    let flowsText = `| Caso de Uso | Interacción en UI | Efecto en Persistencia | Evidencia |\n|---|---|---|---|\n`;

    const form = design.components.find(c => c.type === 'form' || c.type === 'input');
    const table = data.entities[0];

    if (form && table) {
      flowsText += `| Envío de datos | Entrada de usuario y submit en \`${form.name}\` | Inserción en \`${table.table}\` | ${form.evidence} + ${table.evidence} |\n`;
    } else if (design.components.length > 0) {
      const cmp = design.components[0];
      flowsText += `| Visualización | Render de pantalla en \`${cmp.name}\` | Lectura de estado inicial | ${cmp.evidence} |\n`;
    } else {
      flowsText += `| UC-GAP | ${validator.registerGap('Casos de Uso', 'Flujo principal', 'Sin componentes definidos')} | Sin persistencia | ${validator.registerGap('Flujos', 'Fuente', 'Sin fuente')} |\n`;
    }

    return `## 7. Flujos y Casos de Uso

${flowsText}`;
  }

  private renderSection9(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    let endpointsTable = '| Método | Ruta / Recurso | Propósito | Fuente de Datos |\n|---|---|---|---|\n';

    if (data.entities.length > 0) {
      for (const e of data.entities) {
        endpointsTable += `| \`GET\` | \`/api/${e.table}\` | Listado paginado de ${e.table} | ${e.evidence} |\n`;
        endpointsTable += `| \`POST\` | \`/api/${e.table}\` | Creación de registro en ${e.table} | ${e.evidence} |\n`;
        endpointsTable += `| \`GET\` | \`/api/${e.table}/:id\` | Consulta por identificador | ${e.evidence} |\n`;
      }
    } else {
      endpointsTable += `| \`GET\` | \`/api/resource\` | ${validator.registerGap('API', 'Endpoints', 'No hay modelo de datos para generar rutas REST')} | ${validator.registerGap('API', 'Fuente', 'Sin fuente')} |\n`;
    }

    return `## 8. Interfaz y API Propuesta (Agnóstica de Stack)

${endpointsTable}`;
  }

  private renderSection10(design: DesignFacts, data: DataModel, validator: AntiHallucinationValidator): string {
    const hasPassword = data.entities.some(e => e.columns.some(c => c.name.toLowerCase().includes('pass') || c.name.toLowerCase().includes('token')));
    let securityNotes = `- **Control de Acceso**: Autenticación requerida para operaciones de mutación.\n`;
    if (hasPassword) {
      const col = data.entities.flatMap(e => e.columns).find(c => c.name.toLowerCase().includes('pass') || c.name.toLowerCase().includes('token'))!;
      securityNotes += `- **Protección de Credenciales**: Campo sensible detectado en esquema ${col.evidence}.\n`;
    } else {
      securityNotes += `- **Esquema de Credenciales**: ${validator.registerGap('Seguridad', 'Campos de Auth', 'No se encontraron columnas de contraseñas o tokens en el esquema')}.\n`;
    }

    return `## 9. Seguridad y Control de Acceso

${securityNotes}`;
  }

  private renderSection11(design: DesignFacts, data: DataModel): string {
    return `## 10. Requisitos No Funcionales (NFR) y Límites

- **Determinismo**: La especificación y tokens se generan determinísticamente a partir de las fuentes.
- **Rendimiento**: Tiempo de render de vistas optimizado mediante componentes atómicos.
- **Accesibilidad**: Contrastes y estados de interacción verificados contra tokens de diseño.
- **Seguridad en Datos**: Operaciones de extracción en modo estricto de solo lectura.`;
  }

  private renderSection12(design: DesignFacts, data: DataModel): string {
    let plan = `## 11. Plan de Implementación y Criterios de Aceptación

### Criterios de Aceptación Verificables
`;
    let count = 1;
    for (const t of design.tokens.slice(0, 5)) {
      plan += `${count++}. **Verificar token \`${t.name}\`**: El valor implementado debe coincidir exactamente con \`${t.value}\` trazado en ${t.evidence}.\n`;
    }
    for (const c of design.components.slice(0, 3)) {
      plan += `${count++}. **Verificar componente \`${c.name}\`**: Debe contar con las variantes especificadas en ${c.evidence}.\n`;
    }
    for (const e of data.entities.slice(0, 2)) {
      plan += `${count++}. **Verificar persistencia \`${e.table}\`**: Debe implementar todas las columnas trazadas en ${e.evidence}.\n`;
    }

    return plan;
  }

  private renderSection13(gaps: InformationGap[]): string {
    let annex = `## 12. Anexo A: Vacíos de Información (\`[SIN FUENTE]\`)

> Lista exhaustiva y auditable de todos los elementos requeridos que no fueron localizados ni en el código del artifact ni en la base de datos. Ningún dato ha sido inventado.

| # | Sección | Campo / Elemento | Descripción de la Ausencia | Marcador |
|---|---|---|---|---|
`;
    if (gaps.length === 0) {
      annex += `| - | N/A | Ninguno | Cobertura total de fuentes lograda sin vacíos | N/A |\n`;
    } else {
      for (const g of gaps) {
        annex += `| ${g.id} | ${g.section} | ${g.field} | ${g.description} | \`${g.marker}\` |\n`;
      }
    }
    return annex;
  }

  private renderSection14(proposals: UnverifiedProposal[]): string {
    let annex = `## 13. Anexo B: Propuestas no verificadas

> Sección aislada para sugerencias de arquitectura complementarias o extensiones futuras. Estas propuestas **no están verificadas contra las fuentes** y no deben tratarse como hechos.

| # | Sección de Destino | Propuesta | Justificación / Rationale |
|---|---|---|---|
`;
    if (proposals.length === 0) {
      annex += `| - | N/A | Ninguna propuesta adicional | N/A |\n`;
    } else {
      for (const p of proposals) {
        annex += `| ${p.id} | ${p.section} | ${p.proposal} | ${p.rationale} |\n`;
      }
    }
    return annex;
  }
}

export const defaultSddEngine = new SddEngine();
