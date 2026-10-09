import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactSddService } from '../src/service.js';
import { ArtifactStore } from '../src/store/artifact-store.js';
import { SAMPLE_CSS, SAMPLE_REACT_APP, SAMPLE_SCHEMA_SQL } from './fixtures/sample-artifact.js';
import fs from 'fs';

describe('Golden E2E Test (artifact real -> SDD con trazabilidad total)', () => {
  let service: ArtifactSddService;

  beforeEach(() => {
    service = new ArtifactSddService(new ArtifactStore());
  });

  it('debe ejecutar el flujo completo de ingesta, parseo, BD, renderizado y exportación sin alucinaciones', () => {
    const artifactId = 'crm-v1';

    // 1. Ingest
    const ingested = service.ingestArtifact(artifactId, [
      { path: 'styles.css', content: SAMPLE_CSS },
      { path: 'App.tsx', content: SAMPLE_REACT_APP },
      { path: 'schema.sql', content: SAMPLE_SCHEMA_SQL },
    ]);

    expect(ingested.artifactId).toBe(artifactId);
    expect(ingested.versionHash).toBeDefined();
    expect(ingested.summary.totalFiles).toBe(3);

    // 2. Parse design tokens
    const tokens = service.parseTokens(artifactId);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.evidence.startsWith('[SRC-CODE:'))).toBe(true);

    // 3. Extract components
    const components = service.extractComponents(artifactId);
    expect(components.length).toBeGreaterThan(0);
    expect(components.some((c) => c.name === 'CustomerTable')).toBe(true);

    // 4. Extract data model from schema.sql
    const dataModel = service.extractDataModel(artifactId);
    expect(dataModel.entities.length).toBe(2);
    expect(dataModel.entities.some((e) => e.table === 'customers')).toBe(true);
    expect(dataModel.entities.some((e) => e.table === 'orders')).toBe(true);
    expect(dataModel.relationships.length).toBe(1);

    // 5. Generate SDD
    const sdd = service.generateSdd({
      artifactId,
      title: 'Sistema CRM Empresarial',
      version: '2.0.0',
      strict: true,
    });

    expect(sdd).toBeDefined();
    expect(sdd).toContain('# Documento de Diseño del Sistema (SDD)');
    expect(sdd).toContain('## Sistema CRM Empresarial');
    expect(sdd).toContain('## 1. Introducción');
    expect(sdd).toContain('## 3. Sistema de Diseño (Plano Diseño)');
    expect(sdd).toContain('## 5. Modelo de Datos (Plano Datos)');
    expect(sdd).toContain('## 12. Anexo A: Vacíos de Información (`[SIN FUENTE]`)');
    expect(sdd).toContain('## 13. Anexo B: Propuestas no verificadas');

    // Verify Mermaid diagrams
    expect(sdd).toContain('```mermaid\nerDiagram');
    expect(sdd).toContain('orders }|--|| customers');

    // Verify evidence citations
    expect(sdd).toContain('[SRC-CODE: styles.css:');
    expect(sdd).toContain('[SRC-CODE: App.tsx:');
    expect(sdd).toContain('[SRC-DB: customers.name]');
    expect(sdd).toContain('[SRC-DB: orders.customer_id]');

    // 6. Test Determinism (NFR-2)
    const secondSdd = service.generateSdd({
      artifactId,
      title: 'Sistema CRM Empresarial',
      version: '2.0.0',
    });
    expect(secondSdd).toBe(sdd);

    // 7. Export SDD
    const exportResult = service.exportSdd(artifactId, 'file', 'crm-v1-golden.md');
    expect(exportResult.destination).toBe('file');
    expect(exportResult.path).toBeDefined();
    expect(fs.existsSync(exportResult.path!)).toBe(true);

    // Clean up exported file
    if (fs.existsSync(exportResult.path!)) {
      fs.unlinkSync(exportResult.path!);
    }
  });
});
