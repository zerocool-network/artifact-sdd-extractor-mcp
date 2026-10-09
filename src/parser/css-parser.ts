import postcss, { Root, Declaration, AtRule } from 'postcss';
import { ArtifactFile, DesignToken, TokenCategory } from '../types.js';
import { logger } from '../logger.js';

export class CssTokenParser {
  /**
   * Extracts all design tokens from artifact files with exact [SRC-CODE: file:line] evidence.
   */
  extractTokens(files: ArtifactFile[]): DesignToken[] {
    const tokens: DesignToken[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      try {
        const cssBlocks = this.extractCssBlocks(file);
        for (const block of cssBlocks) {
          this.parseCssBlock(file.path, block.content, block.lineOffset, tokens, seen);
        }

        // Also extract inline CSS / Tailwind tokens / style props from JSX/HTML
        this.parseInlineTokens(file, tokens, seen);
      } catch (err) {
        logger.warn(`Error al procesar tokens en archivo ${file.path}:`, err);
      }
    }

    // Sort tokens deterministically: category -> name -> file -> line
    return tokens.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
  }

  /**
   * Extracts raw CSS strings with line offsets from standard CSS files or <style> tags in HTML/Vue.
   */
  private extractCssBlocks(file: ArtifactFile): Array<{ content: string; lineOffset: number }> {
    const blocks: Array<{ content: string; lineOffset: number }> = [];
    const isCssFile = file.path.endsWith('.css') || file.path.endsWith('.scss') || file.path.endsWith('.sass');

    if (isCssFile) {
      blocks.push({ content: file.content, lineOffset: 0 });
      return blocks;
    }

    // If HTML or Vue, extract content within <style>...</style>
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match: RegExpExecArray | null;
    while ((match = styleRegex.exec(file.content)) !== null) {
      const preceding = file.content.substring(0, match.index);
      const lineOffset = preceding.split(/\r?\n/).length - 1;
      blocks.push({
        content: match[1],
        lineOffset,
      });
    }

    return blocks;
  }

  private parseCssBlock(
    filePath: string,
    cssContent: string,
    lineOffset: number,
    tokens: DesignToken[],
    seen: Set<string>
  ): void {
    let root: Root;
    try {
      root = postcss.parse(cssContent);
    } catch {
      // If postcss fails, e.g. due to non-standard syntax, skip or fallback
      return;
    }

    // 1. Process CSS declarations
    root.walkDecls((decl: Declaration) => {
      const line = (decl.source?.start?.line ?? 1) + lineOffset;
      const prop = decl.prop.trim();
      const val = decl.value.trim();

      const category = this.categorizeProperty(prop, val);
      if (!category) return;

      const tokenKey = `${filePath}:${line}:${prop}:${val}`;
      if (seen.has(tokenKey)) return;
      seen.add(tokenKey);

      tokens.push({
        name: prop.startsWith('--') ? prop : `${decl.parent && 'selector' in decl.parent ? (decl.parent as any).selector + ' -> ' : ''}${prop}`,
        category,
        value: val,
        evidence: `[SRC-CODE: ${filePath}:${line}]`,
        file: filePath,
        line,
      });
    });

    // 2. Process @media breakpoints
    root.walkAtRules('media', (atRule: AtRule) => {
      const line = (atRule.source?.start?.line ?? 1) + lineOffset;
      const params = atRule.params.trim();
      const tokenKey = `${filePath}:${line}:media:${params}`;
      if (seen.has(tokenKey)) return;
      seen.add(tokenKey);

      tokens.push({
        name: `@media ${params}`,
        category: 'breakpoint',
        value: params,
        evidence: `[SRC-CODE: ${filePath}:${line}]`,
        file: filePath,
        line,
      });
    });
  }

  private parseInlineTokens(file: ArtifactFile, tokens: DesignToken[], seen: Set<string>): void {
    const lines = file.content.split(/\r?\n/);

    // Scan for Tailwind arbitrary values or color constants like #4F46E5, rgb(...), rgba(...)
    const hexColorRegex = /#([0-9a-fA-F]{3,8})\b/g;
    const rgbColorRegex = /(?:rgb|hsl)a?\([^)]+\)/g;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineContent = lines[i];

      // Don't re-parse inside pure CSS files since PostCSS handled them
      if (file.path.endsWith('.css')) continue;

      let match: RegExpExecArray | null;

      // Extract hex colors
      while ((match = hexColorRegex.exec(lineContent)) !== null) {
        const colorVal = match[0];
        const tokenKey = `${file.path}:${lineNum}:color:${colorVal}`;
        if (!seen.has(tokenKey)) {
          seen.add(tokenKey);
          tokens.push({
            name: `literal-color-${colorVal.toLowerCase()}`,
            category: 'color',
            value: colorVal,
            evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            file: file.path,
            line: lineNum,
          });
        }
      }

      // Extract rgb/hsl colors
      while ((match = rgbColorRegex.exec(lineContent)) !== null) {
        const colorVal = match[0];
        const tokenKey = `${file.path}:${lineNum}:color:${colorVal}`;
        if (!seen.has(tokenKey)) {
          seen.add(tokenKey);
          tokens.push({
            name: `literal-color`,
            category: 'color',
            value: colorVal,
            evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            file: file.path,
            line: lineNum,
          });
        }
      }

      // Look for font families
      if (lineContent.includes('fontFamily') || lineContent.includes('font-family')) {
        const fontMatch = /(?:fontFamily|font-family)[:=]\s*["']?([^"',;{}]+)/i.exec(lineContent);
        if (fontMatch) {
          const fontVal = fontMatch[1].trim();
          const tokenKey = `${file.path}:${lineNum}:font:${fontVal}`;
          if (!seen.has(tokenKey)) {
            seen.add(tokenKey);
            tokens.push({
              name: 'font-family',
              category: 'typography',
              value: fontVal,
              evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
              file: file.path,
              line: lineNum,
            });
          }
        }
      }
    }
  }

  private categorizeProperty(prop: string, val: string): TokenCategory | null {
    const p = prop.toLowerCase();
    const v = val.toLowerCase();

    // Custom CSS Variables
    if (p.startsWith('--')) {
      if (p.includes('color') || p.includes('bg') || p.includes('text') || p.includes('primary') || p.includes('border') || this.isColorValue(v)) {
        return 'color';
      }
      if (p.includes('font') || p.includes('text-size') || p.includes('weight') || p.includes('line-height')) {
        return 'typography';
      }
      if (p.includes('spacing') || p.includes('space') || p.includes('gap') || p.includes('pad') || p.includes('margin')) {
        return 'spacing';
      }
      if (p.includes('radius') || p.includes('rounded')) {
        return 'borderRadius';
      }
      if (p.includes('shadow')) {
        return 'shadow';
      }
      return 'other';
    }

    if (
      p.includes('color') ||
      p === 'background' ||
      p.startsWith('background-') ||
      p === 'border-color' ||
      p === 'fill' ||
      p === 'stroke' ||
      this.isColorValue(v)
    ) {
      return 'color';
    }

    if (
      p.startsWith('font-') ||
      p === 'line-height' ||
      p === 'letter-spacing' ||
      p === 'text-transform'
    ) {
      return 'typography';
    }

    if (
      p.startsWith('margin') ||
      p.startsWith('padding') ||
      p === 'gap' ||
      p === 'row-gap' ||
      p === 'column-gap'
    ) {
      return 'spacing';
    }

    if (p.includes('border-radius')) {
      return 'borderRadius';
    }

    if (p.includes('box-shadow') || p.includes('filter') || p.includes('drop-shadow')) {
      return 'shadow';
    }

    if (p.includes('transition') || p.includes('animation')) {
      return 'transition';
    }

    return null;
  }

  private isColorValue(val: string): boolean {
    return (
      val.startsWith('#') ||
      val.startsWith('rgb(') ||
      val.startsWith('rgba(') ||
      val.startsWith('hsl(') ||
      val.startsWith('hsla(')
    );
  }
}

export const defaultCssTokenParser = new CssTokenParser();
