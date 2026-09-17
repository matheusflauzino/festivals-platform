import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge tone="success">Aberto</Badge>);
    expect(screen.getByText('Aberto')).toBeDefined();
  });
});
