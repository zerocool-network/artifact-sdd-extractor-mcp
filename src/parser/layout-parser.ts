import { ArtifactFile, LayoutBreakpoint, LayoutStructure } from '../types.js';

export class LayoutParser {
  extractLayout(files: ArtifactFile[], screenName: string = 'Main'): LayoutStructure {
    const gridSystems: Array<{ description: string; evidence: string }> = [];
    const flexLayouts: Array<{ description: string; evidence: string }> = [];
    const breakpoints: LayoutBreakpoint[] = [];
    const responsiveBehavior: Array<{ description: string; evidence: string }> = [];
    const seen = new Set<string>();

    for (const file of files) {
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i];

        // 1. Detect Grid systems
        if (
          line.includes('display: grid') ||
          line.includes('grid-template-columns') ||
          line.includes('grid-cols-') ||
          /\bgrid\b/.test(line)
        ) {
          const desc = this.extractSnippetDescription(line, 'CSS Grid Layout');
          const key = `grid:${file.path}:${lineNum}`;
          if (!seen.has(key)) {
            seen.add(key);
            gridSystems.push({
              description: desc,
              evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            });
          }
        }

        // 2. Detect Flex layouts
        if (
          line.includes('display: flex') ||
          line.includes('flex-direction') ||
          /\bflex\b/.test(line) ||
          line.includes('justify-between') ||
          line.includes('items-center')
        ) {
          const desc = this.extractSnippetDescription(line, 'Flexbox Layout');
          const key = `flex:${file.path}:${lineNum}`;
          if (!seen.has(key)) {
            seen.add(key);
            flexLayouts.push({
              description: desc,
              evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            });
          }
        }

        // 3. Detect Breakpoints & Media queries
        if (line.includes('@media')) {
          const match = /@media[^{]*/.exec(line);
          const query = match ? match[0].trim() : line.trim();
          const key = `media:${file.path}:${lineNum}`;
          if (!seen.has(key)) {
            seen.add(key);
            breakpoints.push({
              name: query,
              query,
              evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            });
          }
        }

        // 4. Detect Tailwind responsive classes (sm:, md:, lg:, xl:, 2xl:)
        const responsiveMatch = line.match(/\b(sm|md|lg|xl|2xl):[a-zA-Z0-9_-]+/g);
        if (responsiveMatch) {
          const key = `responsive:${file.path}:${lineNum}`;
          if (!seen.has(key)) {
            seen.add(key);
            responsiveBehavior.push({
              description: `Adaptación responsiva con prefijos: ${responsiveMatch.join(', ')}`,
              evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            });
          }
        }
      }
    }

    // Default evidence fallback if none found
    const primaryEvidence =
      gridSystems[0]?.evidence ||
      flexLayouts[0]?.evidence ||
      breakpoints[0]?.evidence ||
      '[SIN FUENTE]';

    return {
      screen: screenName,
      gridSystems,
      flexLayouts,
      breakpoints,
      responsiveBehavior,
      evidence: primaryEvidence,
    };
  }

  private extractSnippetDescription(line: string, fallback: string): string {
    const trimmed = line.trim();
    if (trimmed.length > 80) {
      return trimmed.substring(0, 77) + '...';
    }
    return trimmed || fallback;
  }
}

export const defaultLayoutParser = new LayoutParser();
