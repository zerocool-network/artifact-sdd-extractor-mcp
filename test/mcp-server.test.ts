import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/server.js';
import { ArtifactSddService } from '../src/service.js';
import { ArtifactStore } from '../src/store/artifact-store.js';
import { SAMPLE_CSS, SAMPLE_REACT_APP, SAMPLE_SCHEMA_SQL } from './fixtures/sample-artifact.js';

describe('MCP Server Registration & Execution', () => {
  it('debe registrar y ejecutar todas las herramientas según la especificación MCP', async () => {
    const service = new ArtifactSddService(new ArtifactStore());
    const server: any = createMcpServer(service);

    const tools = server._registeredTools;
    expect(Object.keys(tools)).toEqual([
      'ingest_artifact_source',
      'parse_design_tokens',
      'extract_component_inventory',
      'extract_layout',
      'extract_data_model',
      'generate_sdd',
      'export_sdd',
    ]);

    // 1. Test ingest_artifact_source tool handler
    const ingestRes = await tools.ingest_artifact_source.handler({
      artifact_id: 'test-app',
      files: [
        { path: 'styles.css', content: SAMPLE_CSS },
        { path: 'App.tsx', content: SAMPLE_REACT_APP },
        { path: 'schema.sql', content: SAMPLE_SCHEMA_SQL },
      ],
    });
    expect(ingestRes.isError).toBeFalsy();
    expect(ingestRes.content[0].text).toContain('SUCCESS');

    // 1b. Test error when neither code nor files provided
    const ingestErr = await tools.ingest_artifact_source.handler({
      artifact_id: 'bad-app',
    });
    expect(ingestErr.isError).toBe(true);

    // 2. Test parse_design_tokens tool handler
    const tokensRes = await tools.parse_design_tokens.handler({
      artifact_id: 'test-app',
    });
    expect(tokensRes.isError).toBeFalsy();
    const tokensJson = JSON.parse(tokensRes.content[0].text);
    expect(tokensJson.total_tokens).toBeGreaterThan(0);

    // 3. Test extract_component_inventory tool handler
    const compRes = await tools.extract_component_inventory.handler({
      artifact_id: 'test-app',
    });
    expect(compRes.isError).toBeFalsy();
    const compJson = JSON.parse(compRes.content[0].text);
    expect(compJson.total_components).toBeGreaterThan(0);

    // 4. Test extract_layout tool handler
    const layoutRes = await tools.extract_layout.handler({
      artifact_id: 'test-app',
      screen: 'Main',
    });
    expect(layoutRes.isError).toBeFalsy();
    const layoutJson = JSON.parse(layoutRes.content[0].text);
    expect(layoutJson.layout.screen).toBe('Main');

    // 5. Test extract_data_model tool handler
    const dmRes = await tools.extract_data_model.handler({
      artifact_id: 'test-app',
    });
    expect(dmRes.isError).toBeFalsy();
    const dmJson = JSON.parse(dmRes.content[0].text);
    expect(dmJson.total_entities).toBe(2);

    // 6. Test generate_sdd tool handler
    const sddRes = await tools.generate_sdd.handler({
      artifact_id: 'test-app',
      title: 'Test SDD Title',
    });
    expect(sddRes.isError).toBeFalsy();
    expect(sddRes.content[0].text).toContain('# Documento de Diseño del Sistema (SDD)');

    // 7. Test export_sdd tool handler (inline)
    const exportInlineRes = await tools.export_sdd.handler({
      artifact_id: 'test-app',
      destination: 'inline',
    });
    expect(exportInlineRes.isError).toBeFalsy();
    expect(exportInlineRes.content[0].text).toContain('inline');

    // 8. Test export_sdd tool handler (file)
    const exportFileRes = await tools.export_sdd.handler({
      artifact_id: 'test-app',
      destination: 'file',
      filename: 'mcp-test-sdd.md',
    });
    expect(exportFileRes.isError).toBeFalsy();
    expect(exportFileRes.content[0].text).toContain('mcp-test-sdd.md');

    // 9. Test resource artifact://{id}/tokens
    const tokensResource = server._registeredResourceTemplates['artifact-tokens'];
    expect(tokensResource).toBeDefined();
    const resTokens = await tokensResource.readCallback(new URL('artifact://test-app/tokens'), {
      id: 'test-app',
    });
    expect(resTokens.contents[0].mimeType).toBe('application/json');

    // 10. Test resource artifact://{id}/spec
    const specResource = server._registeredResourceTemplates['artifact-spec'];
    expect(specResource).toBeDefined();
    const resSpec = await specResource.readCallback(new URL('artifact://test-app/spec'), {
      id: 'test-app',
    });
    expect(resSpec.contents[0].mimeType).toBe('text/markdown');
  });

  it('debe manejar errores gracefully cuando el artifact no existe', async () => {
    const service = new ArtifactSddService(new ArtifactStore());
    const server: any = createMcpServer(service);
    const tools = server._registeredTools;

    const res = await tools.parse_design_tokens.handler({
      artifact_id: 'non-existent',
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('ARTIFACT_NOT_FOUND');
  });
});
