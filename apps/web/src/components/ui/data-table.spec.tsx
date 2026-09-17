import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alfa' },
  { id: '2', name: 'Beta' },
];

const columns: DataTableColumn<Row>[] = [{ header: 'Nome', render: (row) => row.name }];

describe('DataTable', () => {
  it('renders every row', () => {
    render(<DataTable title="Itens" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByText('Alfa')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });

  it('filters rows by the search box when searchFields is given', () => {
    render(
      <DataTable
        title="Itens"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        searchFields={(row) => [row.name]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'Alfa' } });
    expect(screen.getByText('Alfa')).toBeDefined();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('shows the empty state when there are no rows', () => {
    render(
      <DataTable
        title="Itens"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyTitle="Nada aqui"
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeDefined();
  });

  it('shows loading skeletons when isLoading is true', () => {
    const { container } = render(
      <DataTable title="Itens" columns={columns} rows={[]} rowKey={(row) => row.id} isLoading />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alfa')).toBeNull();
  });
});
