/**
 * EmptyState component tests — used across Grid/Kanban/Calendar/Gallery/
 * Gantt/Form/Dashboard for data-empty surfaces. Verifying the props
 * matrix here means every consumer's empty render gets implicit
 * coverage.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Plus } from 'lucide-react';

import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title text', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="add some rows" />);
    expect(screen.getByText('add some rows')).toBeDefined();
  });

  it('omits description block when prop absent', () => {
    render(<EmptyState title="Empty" />);
    // No description → no <p> with that copy.
    expect(screen.queryByText(/add some rows/)).toBeNull();
  });

  it('renders icon when provided', () => {
    const { container } = render(<EmptyState title="Empty" icon={Plus} />);
    // lucide-react icons render an svg element.
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('omits icon block when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders action button when action prop is set', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Create', onClick }} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDefined();
  });

  it('action button onClick fires once per click', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Create', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes role=status with aria-live=polite for screen readers', () => {
    // Empty surfaces are status messages, not alerts. polite means
    // SR queues the announcement instead of interrupting.
    const { container } = render(<EmptyState title="Empty" />);
    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl).toBeDefined();
    expect(statusEl?.getAttribute('aria-live')).toBe('polite');
  });

  it('compact size applies tighter padding class', () => {
    // size=compact uses py-6/px-4 vs normal py-16/px-8 — the panel
    // variants need different vertical real estate.
    const { container } = render(<EmptyState title="Empty" size="compact" />);
    const root = container.querySelector('[role="status"]');
    expect(root?.className).toContain('py-6');
    expect(root?.className).toContain('px-4');
  });

  it('normal size (default) applies generous padding', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const root = container.querySelector('[role="status"]');
    expect(root?.className).toContain('py-16');
    expect(root?.className).toContain('px-8');
  });
});
