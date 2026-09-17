import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, DropdownItem } from './dropdown-menu';

describe('DropdownMenu', () => {
  it('opens on trigger click and closes when an item is clicked', () => {
    render(
      <DropdownMenu trigger={<span>Abrir</span>}>
        <DropdownItem>Sair</DropdownItem>
      </DropdownMenu>,
    );

    expect(screen.queryByText('Sair')).toBeNull();
    fireEvent.click(screen.getByText('Abrir'));
    expect(screen.getByText('Sair')).toBeDefined();
    fireEvent.click(screen.getByText('Sair'));
    expect(screen.queryByText('Sair')).toBeNull();
  });

  it('closes when Escape is pressed', () => {
    render(
      <DropdownMenu trigger={<span>Abrir</span>}>
        <DropdownItem>Sair</DropdownItem>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    expect(screen.getByText('Sair')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Sair')).toBeNull();
  });
});
