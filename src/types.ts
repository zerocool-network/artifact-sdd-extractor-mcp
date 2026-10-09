export type EvidenceType = 'SRC-CODE' | 'SRC-DB' | 'SIN-FUENTE';

export interface ArtifactFile {
  path: string;
  content: string;
}

export interface IngestSummary {
  totalFiles: number;
  totalLines: number;
  languages: string[];
}

export interface IngestedArtifact {
  artifactId: string;
  versionHash: string;
  ingestedAt: string;
  files: ArtifactFile[];
  summary: IngestSummary;
}

export type TokenCategory =
  | 'color'
  | 'typography'
  | 'spacing'
  | 'borderRadius'
  | 'shadow'
  | 'breakpoint'
  | 'transition'
  | 'other';

export interface DesignToken {
  name: string;
  category: TokenCategory;
  value: string;
  evidence: string; // [SRC-CODE: file:line]
  file: string;
  line: number;
}

export type ComponentType =
  | 'button'
  | 'card'
  | 'form'
  | 'input'
  | 'table'
  | 'modal'
  | 'navigation'
  | 'badge'
  | 'alert'
  | 'layout'
  | 'custom';

export interface ComponentItem {
  name: string;
  type: ComponentType;
  props: string[];
  variants: string[];
  states: string[]; // e.g. ['hover', 'active', 'disabled', 'loading', 'focus']
  evidence: string; // [SRC-CODE: file:line]
  file: string;
  line: number;
}

export interface LayoutBreakpoint {
  name: string;
  query: string;
  evidence: string; // [SRC-CODE: file:line]
}

export interface LayoutStructure {
  screen: string;
  gridSystems: Array<{ description: string; evidence: string }>;
  flexLayouts: Array<{ description: string; evidence: string }>;
  breakpoints: LayoutBreakpoint[];
  responsiveBehavior: Array<{ description: string; evidence: string }>;
  evidence: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  references?: {
    table: string;
    column: string;
  };
  evidence: string; // [SRC-DB: table.column]
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  evidence: string; // [SRC-DB: table.column]
}

export interface DataEntity {
  table: string;
  columns: ColumnDefinition[];
  relationships: TableRelationship[];
  evidence: string; // [SRC-DB: table]
}

export interface DataModel {
  entities: DataEntity[];
  relationships: TableRelationship[];
  sourceDsn?: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  evidence: string; // [SRC-CODE: file:line] or [SRC-DB: table.column]
}

export interface InformationGap {
  id: number;
  section: string;
  field: string;
  description: string;
  marker: '[SIN FUENTE]';
}

export interface UnverifiedProposal {
  id: number;
  section: string;
  proposal: string;
  rationale: string;
}

export interface DesignFacts {
  artifactId: string;
  tokens: DesignToken[];
  components: ComponentItem[];
  layout: LayoutStructure;
  businessRules: BusinessRule[];
}

export interface SDDGenerationOptions {
  artifactId: string;
  title?: string;
  version?: string;
  author?: string;
  proposals?: UnverifiedProposal[];
  strict?: boolean;
}
