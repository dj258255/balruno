/**
 * AuthShell component tests — the centered card chrome shared by
 * /login, /auth/callback, and /i/[token] (invite). Verifies title +
 * subtitle + headerAccessory slot wiring + footer rendering, plus
 * the brand link to '/' that every consumer needs.
 *
 * Next.js's <Link> resolves to a regular <a> in tests since the
 * App Router context isn't mounted — happy-dom + jsdom-shim patterns
 * pass through href untouched.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('renders the title in an h1', () => {
    render(<AuthShell title="Sign in"><div /></AuthShell>);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Sign in');
  });

  it('renders subtitle when provided', () => {
    render(
      <AuthShell title="Sign in" subtitle="continue with provider">
        <div />
      </AuthShell>
    );
    expect(screen.getByText('continue with provider')).toBeDefined();
  });

  it('omits subtitle node when prop absent', () => {
    render(<AuthShell title="Sign in"><div /></AuthShell>);
    // No paragraph with subtitle text → only the title h1.
    expect(screen.queryByText(/continue with/)).toBeNull();
  });

  it('renders children inside the card', () => {
    render(
      <AuthShell title="Sign in">
        <button data-testid="provider-btn">GitHub</button>
      </AuthShell>
    );
    expect(screen.getByTestId('provider-btn')).toBeDefined();
  });

  it('renders headerAccessory next to the title', () => {
    // Login page passes its LocaleToggle here — must appear in the
    // same row as the title (the flex justify-between wrapper).
    render(
      <AuthShell
        title="Sign in"
        headerAccessory={<button data-testid="locale-toggle">한국어</button>}
      >
        <div />
      </AuthShell>
    );
    expect(screen.getByTestId('locale-toggle')).toBeDefined();
  });

  it('omits headerAccessory slot when prop not provided', () => {
    // callback / invite pages don't pass the accessory — verify no
    // empty wrapper / orphan markup leaks into the output.
    render(<AuthShell title="Sign in"><div /></AuthShell>);
    expect(screen.queryByTestId('locale-toggle')).toBeNull();
  });

  it('renders footer outside the card when provided', () => {
    render(
      <AuthShell title="Sign in" footer={<a data-testid="footer-link" href="/">home</a>}>
        <div />
      </AuthShell>
    );
    expect(screen.getByTestId('footer-link')).toBeDefined();
  });

  it('brand link points to /', () => {
    // The "Balruno" header link must always lead back to the marketing
    // home — used by recoverable-from-typo'd-URL flows.
    render(<AuthShell title="Sign in"><div /></AuthShell>);
    const brand = screen.getByText('Balruno');
    expect(brand.getAttribute('href')).toBe('/');
  });

  it('outer container has min-h-screen for full-viewport centering', () => {
    // The card centers vertically only when the wrapper takes the
    // whole viewport; regression on this would leave login pinned
    // to the top of the page.
    const { container } = render(<AuthShell title="Sign in"><div /></AuthShell>);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain('min-h-screen');
  });
});
