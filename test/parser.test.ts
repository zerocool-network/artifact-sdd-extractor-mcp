import { describe, it, expect } from 'vitest';
import { CssTokenParser } from '../src/parser/css-parser.js';
import { SAMPLE_CSS, SAMPLE_REACT_APP } from './fixtures/sample-artifact.js';

describe('CssTokenParser (Plano Diseño)', () => {
  const parser = new CssTokenParser();

  it('debe extraer tokens de colores reales con evidencia exacta de archivo y línea', () => {
    const files = [{ path: 'styles.css', content: SAMPLE_CSS }];
    const tokens = parser.extractTokens(files);

    const colors = tokens.filter((t) => t.category === 'color');
    expect(colors.length).toBeGreaterThan(0);

    const primaryColor = colors.find((c) => c.value === '#4F46E5');
    expect(primaryColor).toBeDefined();
    expect(primaryColor?.name).toBe('--primary-color');
    expect(primaryColor?.evidence).toMatch(/^\[SRC-CODE: styles\.css:\d+\]$/);
    expect(primaryColor?.file).toBe('styles.css');
    expect(primaryColor?.line).toBeGreaterThan(0);
  });

  it('debe extraer tokens tipográficos y espaciados con [SRC-CODE]', () => {
    const files = [{ path: 'styles.css', content: SAMPLE_CSS }];
    const tokens = parser.extractTokens(files);

    const typography = tokens.filter((t) => t.category === 'typography');
    expect(typography.some((t) => t.name.includes('--font-base'))).toBe(true);

    const spacing = tokens.filter((t) => t.category === 'spacing');
    expect(spacing.some((t) => t.name.includes('--spacing-md'))).toBe(true);
  });

  it('debe extraer breakpoints de media queries', () => {
    const files = [{ path: 'styles.css', content: SAMPLE_CSS }];
    const tokens = parser.extractTokens(files);

    const breakpoints = tokens.filter((t) => t.category === 'breakpoint');
    expect(breakpoints.length).toBeGreaterThanOrEqual(2);
    expect(breakpoints.some((b) => b.value.includes('min-width: 768px'))).toBe(true);
  });

  it('debe extraer colores literales incrustados en componentes React / JSX', () => {
    const files = [{ path: 'App.tsx', content: SAMPLE_REACT_APP }];
    const tokens = parser.extractTokens(files);

    const colors = tokens.filter((t) => t.category === 'color');
    expect(colors.some((c) => c.value === '#4F46E5')).toBe(true);
    expect(colors.some((c) => c.value === '#F3F4F6')).toBe(true);
  });

  it('debe ser determinístico: el mismo contenido produce tokens idénticos', () => {
    const files = [{ path: 'styles.css', content: SAMPLE_CSS }];
    const run1 = parser.extractTokens(files);
    const run2 = parser.extractTokens(files);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });
});
