import { describe, it, expect } from 'vitest';
import { DbIntrospector, DbClient } from '../src/db/client.js';
import { ArtifactSddService } from '../src/service.js';
import { ArtifactStore } from '../src/store/artifact-store.js';

describe('Soporte MySQL y Dashboards (Plano Datos + UI)', () => {
  const MYSQL_DASHBOARD_DDL = `
CREATE TABLE \`clientes\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`nombre\` varchar(100) NOT NULL,
  \`email\` varchar(150) NOT NULL,
  \`pais\` varchar(50) DEFAULT 'España',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`pedidos\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`cliente_id\` int(11) NOT NULL,
  \`total\` decimal(10,2) NOT NULL,
  \`estado\` varchar(50) DEFAULT 'completado',
  \`creado_en\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`fk_cliente\` (\`cliente_id\`),
  CONSTRAINT \`fk_cliente_pedidos\` FOREIGN KEY (\`cliente_id\`) REFERENCES \`clientes\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`metricas_dashboard\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`fecha\` date NOT NULL,
  \`ingresos_totales\` decimal(12,2) NOT NULL,
  \`pedidos_activos\` int(11) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

  const DASHBOARD_REACT_ARTIFACT = `
import React from 'react';

export function StatCard({ title, value, change }: { title: string; value: string; change: string }) {
  return (
    <div className="card p-4 rounded-xl bg-white shadow-sm border border-gray-100">
      <span className="text-gray-500 text-sm font-medium">{title}</span>
      <h3 className="text-2xl font-bold text-[#1E293B] mt-1">{value}</h3>
      <span className="text-emerald-600 text-xs font-semibold">{change}</span>
    </div>
  );
}

export function RevenueLineChart({ data }: { data: any[] }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h4 className="text-lg font-bold mb-4">Evolución de Ingresos</h4>
      <div className="h-64 flex items-end gap-2">
        <div className="w-8 bg-[#4F46E5] rounded-t-sm" style={{ height: '65%' }} />
        <div className="w-8 bg-[#4F46E5] rounded-t-sm" style={{ height: '80%' }} />
      </div>
    </div>
  );
}

export default function DashboardApp() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#0F172A]">Panel de Control de Ventas</h1>
      </header>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Ingresos Totales" value="$128,450.00" change="+14.2%" />
        <StatCard title="Pedidos Activos" value="342" change="+5.1%" />
        <StatCard title="Clientes Nuevos" value="1,280" change="+8.7%" />
      </section>
      <RevenueLineChart data={[]} />
    </div>
  );
}
`;

  it('debe parsear esquemas DDL de MySQL con tipos VARCHAR, INT, DECIMAL y relaciones de clave foránea', () => {
    const dataModel = DbIntrospector.parseMysqlDdl(MYSQL_DASHBOARD_DDL);

    expect(dataModel.entities.length).toBe(3);
    const clientes = dataModel.entities.find((e) => e.table === 'clientes');
    const pedidos = dataModel.entities.find((e) => e.table === 'pedidos');
    const metricas = dataModel.entities.find((e) => e.table === 'metricas_dashboard');

    expect(clientes).toBeDefined();
    expect(pedidos).toBeDefined();
    expect(metricas).toBeDefined();

    // Check columns and evidence
    const totalCol = pedidos?.columns.find((c) => c.name === 'total');
    expect(totalCol?.type).toContain('DECIMAL');
    expect(totalCol?.evidence).toBe('[SRC-DB: pedidos.total]');

    // Check foreign keys
    expect(dataModel.relationships.length).toBe(1);
    expect(dataModel.relationships[0].fromTable).toBe('pedidos');
    expect(dataModel.relationships[0].toTable).toBe('clientes');
    expect(dataModel.relationships[0].evidence).toBe('[SRC-DB: pedidos.cliente_id -> clientes.id]');
  });

  it('debe detectar componentes de dashboard (KPIs y Gráficos) y vincularlos con el modelo MySQL', async () => {
    const service = new ArtifactSddService(new ArtifactStore());
    const artifactId = 'sales-dashboard';

    service.ingestArtifact(artifactId, [
      { path: 'DashboardApp.tsx', content: DASHBOARD_REACT_ARTIFACT },
      { path: 'schema.sql', content: MYSQL_DASHBOARD_DDL },
    ]);

    const components = service.extractComponents(artifactId);
    expect(components.some((c) => c.type === 'kpi')).toBe(true);
    expect(components.some((c) => c.type === 'chart')).toBe(true);

    const dataModel = await service.extractDataModel(artifactId);
    expect(dataModel.entities.length).toBe(3);

    const sdd = await service.generateSdd({
      artifactId,
      title: 'Dashboard de Ventas y Métricas',
      strict: true,
    });

    expect(sdd).toContain('## 5. Modelo de Datos (Plano Datos)');
    expect(sdd).toContain('[SRC-DB: pedidos.total]');
    expect(sdd).toContain('[SRC-DB: metricas_dashboard.ingresos_totales]');
    expect(sdd).toContain('pedidos }|--|| clientes');
  });

  it('debe inicializar pool de MySQL cuando DB_DSN usa protocolo mysql://', () => {
    const client = new DbClient('mysql://root:secret@127.0.0.1:3306/mi_tienda');
    expect(client.getDbType()).toBe('mysql');
    expect(client.getMysqlDatabaseName()).toBe('mi_tienda');
    expect(client.hasConnection()).toBe(true);
    client.close();
  });

  it('debe extraer el modelo de datos de las interfaces TypeScript del código sin requerir ninguna conexión de BD', async () => {
    const service = new ArtifactSddService(new ArtifactStore());
    const artifactId = 'dashboard-no-db';

    const ARTIFACT_WITH_INTERFACES = `
      interface Customer {
        id: number;
        name: string;
        email: string;
        country: string;
      }

      interface Order {
        id: number;
        customerId: number;
        amount: number;
        status: string;
      }

      export default function App() {
        return <div>Test</div>;
      }
    `;

    service.ingestArtifact(artifactId, ARTIFACT_WITH_INTERFACES);
    const dataModel = await service.extractDataModel(artifactId);

    expect(dataModel.entities.length).toBe(2);
    expect(dataModel.entities.some(e => e.table === 'customer')).toBe(true);
    expect(dataModel.entities.some(e => e.table === 'order')).toBe(true);

    const customer = dataModel.entities.find(e => e.table === 'customer');
    expect(customer?.columns.some(c => c.name === 'email')).toBe(true);
    expect(customer?.columns.find(c => c.name === 'email')?.evidence).toBe('[SRC-DB: customer.email]');
  });
});
