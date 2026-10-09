import { parse } from 'node-html-parser';
import { ArtifactFile, ComponentItem, ComponentType } from '../types.js';

export class ComponentParser {
  /**
   * Extracts components inventory, props, variants, states and their exact code evidence.
   */
  extractComponents(files: ArtifactFile[]): ComponentItem[] {
    const components: ComponentItem[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      if (file.path.endsWith('.css')) continue;

      this.parseReactComponents(file, components, seen);
      this.parseHtmlComponents(file, components, seen);
    }

    return components.sort((a, b) => a.name.localeCompare(b.name));
  }

  private parseReactComponents(file: ArtifactFile, components: ComponentItem[], seen: Set<string>): void {
    const lines = file.content.split(/\r?\n/);

    // 1. Detect Component definitions: function Button(...) or const Card: React.FC = (...)
    const componentDefRegex = /(?:export\s+)?(?:default\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)/g;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      let match: RegExpExecArray | null;
      while ((match = componentDefRegex.exec(line)) !== null) {
        const name = match[1];
        if (name === 'React' || name === 'Fragment') continue;

        const key = `${file.path}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const type = this.classifyComponent(name);
        const props = this.findPropsForComponent(file.content, name);
        const variants = this.findVariants(file.content, name);
        const states = this.findInteractiveStates(file.content, name);

        components.push({
          name,
          type,
          props,
          variants,
          states,
          evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
          file: file.path,
          line: lineNum,
        });
      }
    }

    // 2. Detect JSX usages if component wasn't declared as top-level function (e.g. standard UI library usages <Modal>, <Button>)
    const jsxTagRegex = /<([A-Z][a-zA-Z0-9_]*)\b([^>]*)/g;
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      let match: RegExpExecArray | null;
      while ((match = jsxTagRegex.exec(line)) !== null) {
        const name = match[1];
        const key = `${file.path}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const attrString = match[2] || '';
        const props = this.extractPropsFromAttributes(attrString);
        const type = this.classifyComponent(name);
        const variants = this.findVariants(file.content, name);
        const states = this.findInteractiveStates(file.content, name);

        components.push({
          name,
          type,
          props,
          variants,
          states,
          evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
          file: file.path,
          line: lineNum,
        });
      }
    }
  }

  private parseHtmlComponents(file: ArtifactFile, components: ComponentItem[], seen: Set<string>): void {
    if (!file.path.endsWith('.html') && !file.path.endsWith('.htm')) return;

    try {
      const root = parse(file.content);
      const lines = file.content.split(/\r?\n/);

      // Inspect common semantic elements / classes
      const selectors = ['button', 'form', 'table', 'modal', '.modal', '.card', '.btn', 'nav', 'input', 'dialog'];
      for (const sel of selectors) {
        const elements = root.querySelectorAll(sel);
        for (const el of elements) {
          const tagName = el.tagName?.toLowerCase() || 'element';
          const className = el.getAttribute('class') || '';
          const name = className ? `${tagName}.${className.split(' ')[0]}` : tagName;

          const key = `${file.path}:${name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // Find approximate line number
          let lineNum = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`<${tagName}`) || (className && lines[i].includes(className.split(' ')[0]))) {
              lineNum = i + 1;
              break;
            }
          }

          const type = this.classifyComponent(name);
          const states = this.findInteractiveStates(file.content, name);

          components.push({
            name,
            type,
            props: Array.from(Object.keys(el.attributes)),
            variants: className ? className.split(' ').filter(c => c.includes('-')) : [],
            states,
            evidence: `[SRC-CODE: ${file.path}:${lineNum}]`,
            file: file.path,
            line: lineNum,
          });
        }
      }
    } catch {
      // ignore html parse failure
    }
  }

  private classifyComponent(name: string): ComponentType {
    const n = name.toLowerCase();
    if (n.includes('button') || n.includes('btn')) return 'button';
    if (n.includes('card')) return 'card';
    if (n.includes('modal') || n.includes('dialog')) return 'modal';
    if (n.includes('form')) return 'form';
    if (n.includes('table') || n.includes('grid')) return 'table';
    if (n.includes('input') || n.includes('field') || n.includes('select')) return 'input';
    if (n.includes('nav') || n.includes('header') || n.includes('sidebar')) return 'navigation';
    if (n.includes('badge') || n.includes('tag') || n.includes('chip')) return 'badge';
    if (n.includes('alert') || n.includes('toast') || n.includes('banner')) return 'alert';
    if (n.includes('layout') || n.includes('container') || n.includes('wrapper')) return 'layout';
    return 'custom';
  }

  private findPropsForComponent(content: string, componentName: string): string[] {
    const propsSet = new Set<string>();

    // 1. Look for TypeScript interface/type Props e.g. interface ButtonProps { variant?: string; onClick: () => void }
    const interfaceRegex = new RegExp(`(?:interface|type)\\s+${componentName}Props[^{]*{([^}]*)}`, 's');
    const match = interfaceRegex.exec(content);
    if (match) {
      const propLines = match[1].split(';');
      for (const line of propLines) {
        const propName = line.split(':')[0]?.replace('?', '').trim();
        if (propName && !propName.startsWith('//')) {
          propsSet.add(propName);
        }
      }
    }

    // 2. Look for destructured props: ({ variant, size, onClick, children }: Props)
    const destructRegex = new RegExp(`${componentName}\\s*(?:=|:)?\\s*\\(?\\s*{([^}]+)}\\s*:[^)]*\\)`, 's');
    const destructMatch = destructRegex.exec(content);
    if (destructMatch) {
      const items = destructMatch[1].split(',');
      for (const item of items) {
        const clean = item.split('=')[0]?.trim();
        if (clean && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(clean)) {
          propsSet.add(clean);
        }
      }
    }

    return Array.from(propsSet);
  }

  private extractPropsFromAttributes(attrString: string): string[] {
    const props: string[] = [];
    const attrRegex = /([a-zA-Z0-9_-]+)(?:=|\b)/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(attrString)) !== null) {
      const prop = match[1];
      if (prop !== 'className' && prop !== 'class' && prop !== 'style' && !props.includes(prop)) {
        props.push(prop);
      }
    }
    return props;
  }

  private findVariants(content: string, componentName: string): string[] {
    const variants: string[] = [];
    // Search for variant patterns: variant="primary" | variant === 'secondary'
    const variantRegex = new RegExp(`(?:variant|size|color)\\s*(?:===?|:|=)\\s*["']([^"']+)["']`, 'g');
    let match: RegExpExecArray | null;
    while ((match = variantRegex.exec(content)) !== null) {
      if (!variants.includes(match[1])) {
        variants.push(match[1]);
      }
    }
    return variants;
  }

  private findInteractiveStates(content: string, componentName: string): string[] {
    const states: string[] = [];
    const lower = content.toLowerCase();

    if (lower.includes(':hover') || lower.includes('hover:')) states.push('hover');
    if (lower.includes(':focus') || lower.includes('focus:') || lower.includes('focus-visible')) states.push('focus');
    if (lower.includes(':active') || lower.includes('active:')) states.push('active');
    if (lower.includes(':disabled') || lower.includes('disabled:') || lower.includes('disabled')) states.push('disabled');
    if (lower.includes('loading') || lower.includes('isloading') || lower.includes('spinner')) states.push('loading');

    return states;
  }
}

export const defaultComponentParser = new ComponentParser();
