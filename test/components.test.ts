import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../src/parser/component-parser.js';
import { LayoutParser } from '../src/parser/layout-parser.js';
import { SAMPLE_REACT_APP, SAMPLE_CSS } from './fixtures/sample-artifact.js';

describe('ComponentParser & LayoutParser (Plano Diseño)', () => {
  const compParser = new ComponentParser();
  const layoutParser = new LayoutParser();

  it('debe extraer componentes React con sus props y estados interactivos', () => {
    const files = [{ path: 'App.tsx', content: SAMPLE_REACT_APP }];
    const components = compParser.extractComponents(files);

    expect(components.length).toBeGreaterThanOrEqual(2);

    const tableComp = components.find((c) => c.name === 'CustomerTable');
    expect(tableComp).toBeDefined();
    expect(tableComp?.props).toContain('customers');
    expect(tableComp?.props).toContain('onSelectCustomer');
    expect(tableComp?.evidence).toMatch(/^\[SRC-CODE: App\.tsx:\d+\]$/);

    const btnComp = components.find((c) => c.name === 'ActionButton');
    expect(btnComp).toBeDefined();
    expect(btnComp?.states).toContain('disabled');
    expect(btnComp?.states).toContain('hover');
  });

  it('debe extraer grids, flexbox y responsive behavior con evidencia', () => {
    const files = [
      { path: 'styles.css', content: SAMPLE_CSS },
      { path: 'App.tsx', content: SAMPLE_REACT_APP },
    ];
    const layout = layoutParser.extractLayout(files, 'Dashboard');

    expect(layout.screen).toBe('Dashboard');
    expect(layout.gridSystems.length).toBeGreaterThan(0);
    expect(layout.flexLayouts.length).toBeGreaterThan(0);
    expect(layout.breakpoints.length).toBeGreaterThan(0);
  });

  it('debe extraer componentes de archivos HTML semánticos', () => {
    const htmlFile = {
      path: 'index.html',
      content: `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="card shadow-lg">
            <h2>Card Title</h2>
            <button class="btn btn-primary" disabled>Guardar</button>
            <input type="text" name="username" class="form-control" />
            <table class="table-striped">
              <tr><td>Dato</td></tr>
            </table>
          </div>
        </body>
        </html>
      `,
    };

    const components = compParser.extractComponents([htmlFile]);
    expect(components.length).toBeGreaterThanOrEqual(3);
    expect(components.some((c) => c.type === 'button')).toBe(true);
    expect(components.some((c) => c.type === 'card')).toBe(true);
    expect(components.some((c) => c.type === 'table')).toBe(true);
  });
});
