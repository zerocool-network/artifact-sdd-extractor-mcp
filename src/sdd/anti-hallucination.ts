import { InformationGap, UnverifiedProposal } from '../types.js';

export interface AuditReport {
  totalClaims: number;
  codeEvidencedClaims: number;
  dbEvidencedClaims: number;
  unverifiedGapsCount: number;
  complianceRate: number; // 0 to 100%
  violations: string[];
}

export class AntiHallucinationValidator {
  private gaps: InformationGap[] = [];
  private gapCounter = 1;

  registerGap(section: string, field: string, description: string): string {
    const id = this.gapCounter++;
    this.gaps.push({
      id,
      section,
      field,
      description,
      marker: '[SIN FUENTE]',
    });
    return `[SIN FUENTE]`;
  }

  getGaps(): InformationGap[] {
    return [...this.gaps];
  }

  reset(): void {
    this.gaps = [];
    this.gapCounter = 1;
  }

  /**
   * Scans markdown text to verify that every technical claim or specification item
   * includes a valid evidence citation [SRC-CODE: ...], [SRC-DB: ...], or [SIN FUENTE].
   */
  auditDocument(markdown: string): AuditReport {
    const lines = markdown.split(/\r?\n/);
    let codeCount = 0;
    let dbCount = 0;
    let gapsCount = 0;
    const violations: string[] = [];

    const srcCodeRegex = /\[SRC-CODE:[^\]]+\]/g;
    const srcDbRegex = /\[SRC-DB:[^\]]+\]/g;
    const sinFuenteRegex = /\[SIN FUENTE\]/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const codeMatches = line.match(srcCodeRegex);
      if (codeMatches) codeCount += codeMatches.length;

      const dbMatches = line.match(srcDbRegex);
      if (dbMatches) dbCount += dbMatches.length;

      const gapMatches = line.match(sinFuenteRegex);
      if (gapMatches) gapsCount += gapMatches.length;

      // Check for table rows in technical specification sections that lack any evidence tag
      const isTableRow = line.startsWith('|') && line.endsWith('|');
      const isSeparator = line.includes('---|');
      const isHeaderOrMeta =
        line.includes('| Campo |') ||
        line.includes('| ID |') ||
        line.includes('| Rol / Actor |') ||
        line.includes('| Token / Propiedad |') ||
        line.includes('| Componente |') ||
        line.includes('| Columna |') ||
        line.includes('| Caso de Uso |') ||
        line.includes('| Método |') ||
        line.includes('| # |') ||
        line.includes('**Artifact ID**') ||
        line.includes('**Versión del SDD**') ||
        line.includes('**Generado por**') ||
        line.includes('**Fecha de generación**') ||
        line.includes('**Principio rector**') ||
        line.includes('N/A');

      if (isTableRow && !isSeparator && !isHeaderOrMeta) {
        const hasEvidence =
          srcCodeRegex.test(line) ||
          srcDbRegex.test(line) ||
          sinFuenteRegex.test(line) ||
          line.includes('Evidencia') ||
          line.includes('Fuente');

        // Reset regex state
        srcCodeRegex.lastIndex = 0;
        srcDbRegex.lastIndex = 0;
        sinFuenteRegex.lastIndex = 0;

        if (!hasEvidence && line.trim().length > 10) {
          violations.push(`Línea ${i + 1}: Fila de tabla técnica sin etiqueta de evidencia: "${line.substring(0, 50)}..."`);
        }
      }
    }

    const totalClaims = codeCount + dbCount + gapsCount;
    const verifiedClaims = codeCount + dbCount;
    const complianceRate = totalClaims > 0 ? (totalClaims / (totalClaims + violations.length)) * 100 : 100;

    return {
      totalClaims,
      codeEvidencedClaims: codeCount,
      dbEvidencedClaims: dbCount,
      unverifiedGapsCount: gapsCount,
      complianceRate,
      violations,
    };
  }
}

export const defaultValidator = new AntiHallucinationValidator();
