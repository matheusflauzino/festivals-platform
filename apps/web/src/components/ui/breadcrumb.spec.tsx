import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './breadcrumb';

describe('Breadcrumb', () => {
  it('renders a link for every item except the last', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Festivais', href: '/festivals' },
          { label: 'FENAC 2026' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Festivais' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'FENAC 2026' })).toBeNull();
    expect(screen.getByText('FENAC 2026')).toBeDefined();
  });
});
