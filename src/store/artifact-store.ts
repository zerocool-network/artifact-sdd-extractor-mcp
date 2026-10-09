import crypto from 'crypto';
import { ArtifactFile, IngestedArtifact, IngestSummary } from '../types.js';
import { logger } from '../logger.js';

export class ArtifactNotFoundError extends Error {
  constructor(artifactId: string) {
    super(`Artifact '${artifactId}' not found or no source ingested yet. Code: ARTIFACT_NOT_FOUND`);
    this.name = 'ArtifactNotFoundError';
  }
}

export class ArtifactStore {
  private artifacts: Map<string, IngestedArtifact> = new Map();

  ingest(artifactId: string, rawFiles: ArtifactFile[] | string): IngestedArtifact {
    if (!artifactId || typeof artifactId !== 'string' || artifactId.trim().length === 0) {
      throw new Error("El 'artifact_id' es obligatorio y no puede estar vacío.");
    }

    const files: ArtifactFile[] = [];

    if (typeof rawFiles === 'string') {
      const trimmed = rawFiles.trim();
      if (!trimmed) {
        throw new Error('El código fuente proporcionado está vacío.');
      }
      // Detect language/file type
      const detectedName = this.detectMainFileName(trimmed);
      files.push({
        path: detectedName,
        content: rawFiles,
      });
    } else if (Array.isArray(rawFiles)) {
      if (rawFiles.length === 0) {
        throw new Error('La lista de archivos está vacía.');
      }
      for (const f of rawFiles) {
        if (!f.path || typeof f.content !== 'string') {
          throw new Error('Cada archivo debe tener una propiedad "path" y "content".');
        }
        files.push({
          path: f.path,
          content: f.content,
        });
      }
    } else {
      throw new Error('Formato de archivos inválido: debe ser un string o una lista de archivos.');
    }

    // Sort files by path for deterministic hashing
    files.sort((a, b) => a.path.localeCompare(b.path));

    // Calculate deterministic SHA-256
    const hash = crypto.createHash('sha256');
    for (const f of files) {
      hash.update(`${f.path}:${f.content}\n`);
    }
    const versionHash = hash.digest('hex');

    // Calculate summary
    const summary = this.calculateSummary(files);

    const ingested: IngestedArtifact = {
      artifactId,
      versionHash,
      ingestedAt: new Date().toISOString(),
      files,
      summary,
    };

    this.artifacts.set(artifactId, ingested);
    logger.info(`Artifact '${artifactId}' ingerido con éxito. Versión: ${versionHash.substring(0, 10)}...`);

    return ingested;
  }

  getArtifact(artifactId: string): IngestedArtifact {
    const item = this.artifacts.get(artifactId);
    if (!item) {
      throw new ArtifactNotFoundError(artifactId);
    }
    return item;
  }

  getSource(artifactId: string): ArtifactFile[] {
    return this.getArtifact(artifactId).files;
  }

  hasArtifact(artifactId: string): boolean {
    return this.artifacts.has(artifactId);
  }

  listArtifacts(): IngestedArtifact[] {
    return Array.from(this.artifacts.values());
  }

  private detectMainFileName(content: string): string {
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      return 'index.html';
    }
    if (
      content.includes('import React') ||
      content.includes('from "react"') ||
      content.includes("from 'react'") ||
      content.includes('export default function') ||
      content.includes('export const') ||
      content.includes('className=')
    ) {
      return 'App.tsx';
    }
    if (content.includes('{') && (content.includes(':') || content.includes('@media')) && !content.includes('function')) {
      return 'styles.css';
    }
    return 'artifact.tsx';
  }

  private calculateSummary(files: ArtifactFile[]): IngestSummary {
    let totalLines = 0;
    const languagesSet = new Set<string>();

    for (const file of files) {
      const lines = file.content.split(/\r?\n/).length;
      totalLines += lines;

      const ext = file.path.split('.').pop()?.toLowerCase();
      if (ext === 'html' || ext === 'htm') languagesSet.add('HTML');
      else if (ext === 'css' || ext === 'scss' || ext === 'sass') languagesSet.add('CSS');
      else if (ext === 'ts' || ext === 'tsx') languagesSet.add('TypeScript/React');
      else if (ext === 'js' || ext === 'jsx') languagesSet.add('JavaScript/React');
      else if (ext === 'vue') languagesSet.add('Vue');
      else if (ext === 'json') languagesSet.add('JSON');
      else {
        // Fallback detection by content
        if (file.content.includes('<html') || file.content.includes('<!DOCTYPE')) languagesSet.add('HTML');
        if (file.content.includes('{') && file.content.includes(':')) languagesSet.add('CSS');
        if (file.content.includes('function') || file.content.includes('const ')) languagesSet.add('JavaScript/TypeScript');
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      languages: Array.from(languagesSet),
    };
  }
}

export const defaultArtifactStore = new ArtifactStore();
