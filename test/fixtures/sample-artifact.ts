export const SAMPLE_CSS = `
:root {
  --primary-color: #4F46E5;
  --secondary-color: #10B981;
  --font-base: 'Inter', sans-serif;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --radius-md: 8px;
  --radius-lg: 16px;
  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.card {
  background-color: #FFFFFF;
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-card);
}

.button-primary {
  background-color: var(--primary-color);
  color: #FFFFFF;
  border-radius: 6px;
  padding: 8px 16px;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
}

.button-primary:hover {
  background-color: #4338CA;
}

.button-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
}

@media (max-width: 640px) {
  .sidebar {
    display: none;
  }
}
`;

export const SAMPLE_REACT_APP = `
import React, { useState } from 'react';

interface CustomerTableProps {
  customers: Array<{ id: number; name: string; email: string }>;
  onSelectCustomer: (id: number) => void;
}

export function CustomerTable({ customers, onSelectCustomer }: CustomerTableProps) {
  return (
    <div className="table-container rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} onClick={() => onSelectCustomer(c.id)} className="hover:bg-gray-50 cursor-pointer">
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function ActionButton({ variant = 'primary', disabled = false, onClick, children }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={variant === 'primary' ? 'bg-[#4F46E5] text-white hover:bg-[#4338CA] px-4 py-2 rounded-md' : 'bg-gray-200 text-gray-800'}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-6 flex flex-col justify-between">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-sans">CRM Dashboard</h1>
        <ActionButton onClick={() => console.log('nuevo')} disabled={false}>Nuevo Cliente</ActionButton>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CustomerTable customers={[{ id: 1, name: 'Acme Inc', email: 'info@acme.com' }]} onSelectCustomer={setSelectedId} />
      </main>
    </div>
  );
}
`;

export const SAMPLE_SCHEMA_SQL = `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);
`;
