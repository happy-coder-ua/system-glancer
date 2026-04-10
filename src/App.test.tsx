import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '@/App';

describe('App', () => {
  it('renders the dashboard with system data', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('System Monitor')).toBeInTheDocument();
    });

    expect(screen.getByText('ubuntu-box')).toBeInTheDocument();
    expect(screen.getByText('gnome-shell')).toBeInTheDocument();
    expect(screen.getByText('Core 0')).toBeInTheDocument();
  });
});
