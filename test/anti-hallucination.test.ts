import { describe, it, expect } from 'vitest';
import { AntiHallucinationValidator } from '../src/sdd/anti-hallucination.js';

describe('AntiHallucinationValidator (Política Anti-Alucinación R1-R5)', () => {
  it('debe registrar y auditar correctamente vacíos de información [SIN FUENTE]', () => {
    const validator = new AntiHallucinationValidator();
    const marker = validator.registerGap('Seguridad', 'Roles', 'No se encontraron roles');

    expect(marker).toBe('[SIN FUENTE]');
    expect(validator.getGaps().length).toBe(1);
    expect(validator.getGaps()[0].marker).toBe('[SIN FUENTE]');
  });

  it('debe auditar un documento y calcular tasa de conformidad de evidencia', () => {
    const validator = new AntiHallucinationValidator();
    const markdown = `
# SDD
| Token | Valor | Evidencia |
|---|---|---|
| primary | #4F46E5 | [SRC-CODE: styles.css:12] |
| table | customers | [SRC-DB: customers.id] |
| auth | basic | [SIN FUENTE] |
`;

    const report = validator.auditDocument(markdown);
    expect(report.codeEvidencedClaims).toBe(1);
    expect(report.dbEvidencedClaims).toBe(1);
    expect(report.unverifiedGapsCount).toBe(1);
    expect(report.complianceRate).toBe(100);
    expect(report.violations.length).toBe(0);
  });

  it('debe detectar violaciones cuando una fila de tabla técnica no tiene evidencia', () => {
    const validator = new AntiHallucinationValidator();
    const badMarkdown = `
| Token | Valor |
|---|---|
| secret-key | 1234567890 |
`;

    const report = validator.auditDocument(badMarkdown);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0]).toContain('sin etiqueta de evidencia');
  });
});
