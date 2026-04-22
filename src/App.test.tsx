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
    expect(screen.getByText('SAMSUNG MZALQ512HBLU-00BL2')).toBeInTheDocument();
    expect(screen.getByText('FW 5L2QFXM7 • /dev/nvme0n1p2')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.10 • fe80::1234')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1 • ::1')).toBeInTheDocument();
    expect(screen.getByText('Mask 255.255.255.0 • /64')).toBeInTheDocument();
    expect(screen.getByText('Gateway 192.168.0.1')).toBeInTheDocument();
    expect(screen.getByText(/RX 2\.0 KB\/s/)).toBeInTheDocument();
    expect(screen.getAllByText('Terminate')[0]).toBeInTheDocument();
  });
});
