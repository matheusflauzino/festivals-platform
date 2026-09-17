'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardHeader, CardTitle } from './card';
import { Table, TableBody, TableHead, TableHeaderCell, TableRow } from './table';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { SearchIcon } from './icons';

export interface DataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  action?: ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchFields?: (row: T) => string[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  title,
  action,
  columns,
  rows,
  rowKey,
  isLoading = false,
  searchPlaceholder = 'Buscar…',
  searchFields,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchFields || query.trim() === '') return rows;
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => searchFields(row).some((field) => field.toLowerCase().includes(normalizedQuery)));
  }, [rows, query, searchFields]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-3">
          {searchFields && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-border bg-canvas py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none sm:w-56"
              />
            </div>
          )}
          {action}
        </div>
      </CardHeader>
      {isLoading ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeaderCell key={column.header} className={column.className}>
                  {column.header}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} className={`px-4 py-3 text-text ${column.className ?? ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
