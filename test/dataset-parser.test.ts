import { describe, it, expect } from 'vitest';
import { DatasetParser } from '../src/parser/dataset-parser.js';
import { ArtifactSddService } from '../src/service.js';
import { AntiHallucinationValidator } from '../src/sdd/anti-hallucination.js';

describe('Universal DatasetParser (CSV, JSON, Mock Data)', () => {
  it('debe inferir esquemas y tipos de datos a partir de contenido CSV con evidencia [SRC-FILE]', () => {
    const csvContent = `id,cliente,monto,activo,fecha_registro
101,Acme Corp,1250.50,true,2026-01-15
102,Globex,850.00,false,2026-02-01
103,Soylent,3100.75,true,2026-03-10`;

    const entity = DatasetParser.parseCsv('clientes.csv', csvContent);

    expect(entity).not.toBeNull();
    expect(entity!.table).toBe('clientes');
    expect(entity!.columns.length).toBe(5);

    const idCol = entity!.columns.find(c => c.name === 'id');
    expect(idCol?.type).toBe('INTEGER');
    expect(idCol?.isPrimaryKey).toBe(true);
    expect(idCol?.evidence).toBe('[SRC-FILE: clientes.csv:id]');

    const clienteCol = entity!.columns.find(c => c.name === 'cliente');
    expect(clienteCol?.type).toBe('TEXT');
    expect(clienteCol?.evidence).toBe('[SRC-FILE: clientes.csv:cliente]');

    const montoCol = entity!.columns.find(c => c.name === 'monto');
    expect(montoCol?.type).toBe('REAL');
    expect(montoCol?.evidence).toBe('[SRC-FILE: clientes.csv:monto]');

    const activoCol = entity!.columns.find(c => c.name === 'activo');
    expect(activoCol?.type).toBe('BOOLEAN');

    const fechaCol = entity!.columns.find(c => c.name === 'fecha_registro');
    expect(fechaCol?.type).toBe('DATE');
  });

  it('debe extraer entidades desde archivos JSON estructurados con evidencia [SRC-FILE]', () => {
    const jsonContent = JSON.stringify({
      productos: [
        { id: 1, sku: 'PROD-01', precio: 99.9, stock: 15 },
        { id: 2, sku: 'PROD-02', precio: 149.5, stock: 8 },
      ],
      categorias: [
        { id: 10, nombre: 'Electrónica' },
        { id: 20, nombre: 'Oficina' },
      ],
    });

    const entities = DatasetParser.parseJson('catalogo.json', jsonContent);

    expect(entities.length).toBe(2);
    const prodEntity = entities.find(e => e.table === 'productos');
    expect(prodEntity).toBeDefined();
    expect(prodEntity!.columns.length).toBe(4);
    expect(prodEntity!.columns.find(c => c.name === 'precio')?.type).toBe('REAL');
    expect(prodEntity!.columns.find(c => c.name === 'sku')?.evidence).toBe('[SRC-FILE: catalogo.json:sku]');
  });

  it('debe extraer arrays de mock data embebidos en código TSX/JS con evidencia [SRC-DATA]', () => {
    const file = {
      path: 'src/components/Dashboard.tsx',
      content: `
        import React from 'react';

        const kpis = [
          { metric: 'Ingresos Totales', valor: 45000, periodo: '2026-Q1' },
          { metric: 'Nuevos Clientes', valor: 320, periodo: '2026-Q1' }
        ];

        export const Dashboard = () => {
          return <div>Dashboard</div>;
        };
      `,
    };

    const entities = DatasetParser.parseMockDatasetsFromCode(file);

    expect(entities.length).toBe(1);
    expect(entities[0].table).toBe('kpis');
    expect(entities[0].columns.length).toBe(3);

    const metricCol = entities[0].columns.find(c => c.name === 'metric');
    expect(metricCol?.evidence).toBe('[SRC-DATA: kpis.metric]');
    expect(metricCol?.type).toBe('TEXT');

    const valorCol = entities[0].columns.find(c => c.name === 'valor');
    expect(valorCol?.type).toBe('INTEGER');
    expect(valorCol?.evidence).toBe('[SRC-DATA: kpis.valor]');
  });

  it('debe generar un SDD completo y auditable a partir de un artifact sin base de datos que usa CSV y Mock Data', async () => {
    const service = new ArtifactSddService();
    const artifactId = 'excel-dashboard-app';

    service.ingestArtifact(artifactId, [
      {
        path: 'data/ventas.csv',
        content: `id,sucursal,total,fecha
1,Madrid,15200.50,2026-03-01
2,Barcelona,18400.00,2026-03-02`,
      },
      {
        path: 'src/App.tsx',
        content: `
          import React from 'react';
          const resumenMensual = [
            { mes: 'Enero', ingresos: 45000 },
            { mes: 'Febrero', ingresos: 52000 }
          ];

          export const App = () => {
            return (
              <div className="bg-slate-900 text-white p-6">
                <h1>Reporte Ejecutivo</h1>
                <button className="bg-blue-600 px-4 py-2 rounded">Descargar</button>
              </div>
            );
          };
        `,
      },
      {
        path: 'src/index.css',
        content: `
          :root {
            --color-primary: #2563eb;
            --color-background: #0f172a;
          }
        `,
      },
    ]);

    const sdd = await service.generateSdd({
      artifactId,
      title: 'Dashboard Ejecutivo desde Fuentes Universales',
      strict: true,
    });

    expect(sdd).toContain('## 5. Modelo de Datos (Plano Datos)');
    expect(sdd).toContain('erDiagram');
    expect(sdd).toContain('ventas');
    expect(sdd).toContain('resumenmensual');
    expect(sdd).toContain('[SRC-FILE: data/ventas.csv:');
    expect(sdd).toContain('[SRC-DATA: resumenMensual.');

    // Audit compliance
    const validator = new AntiHallucinationValidator();
    const audit = validator.auditDocument(sdd);
    expect(audit.complianceRate).toBe(100);
    expect(audit.fileEvidencedClaims).toBeGreaterThan(0);
    expect(audit.dataEvidencedClaims).toBeGreaterThan(0);
  });
});
