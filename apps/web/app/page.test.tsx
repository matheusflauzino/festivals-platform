import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Home page', () => {
  it('renders the platform name', () => {
    render(<Page />);
    expect(screen.getByText('FENAC Platform')).toBeDefined();
  });
});
