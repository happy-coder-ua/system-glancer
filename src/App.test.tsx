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
  expect(screen.getByText('gnome shell')).toBeInTheDocument();
  expect(screen.getByText('User sekam')).toBeInTheDocument();
    expect(screen.getByText('CPU core 1')).toBeInTheDocument();
    expect(screen.getByText(/Uptime 2d 4h 12m/)).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText(/RX 2\.0 KB\/s/)).toBeInTheDocument();
    expect(screen.getAllByText('Terminate')[0]).toBeInTheDocument();
  });
});
