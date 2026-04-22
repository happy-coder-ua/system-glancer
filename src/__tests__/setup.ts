import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import type { SystemSnapshot } from '@/types/system';

const snapshot: SystemSnapshot = {
  hostname: 'ubuntu-box',
  platform: 'linux x64',
  kernel: 'Linux 6.8.0',
  cpu: {
    model: 'Intel Core i7',
    cores: 4,
    overall: 0.32,
    perCore: [
      { label: 'CPU 1', usage: 0.25 },
      { label: 'CPU 2', usage: 0.31 },
      { label: 'CPU 3', usage: 0.35 },
      { label: 'CPU 4', usage: 0.37 },
    ],
  },
  memory: {
    total: 16 * 1024 * 1024 * 1024,
    used: 6 * 1024 * 1024 * 1024,
    free: 10 * 1024 * 1024 * 1024,
    swapTotal: 4 * 1024 * 1024 * 1024,
    swapUsed: 512 * 1024 * 1024,
  },
  load: {
    one: 0.22,
    five: 0.44,
    fifteen: 0.51,
    uptime: '2d 4h 12m',
  },
  disks: [
    {
      device: '/dev/nvme0n1p2',
      deviceLabel: 'SAMSUNG MZALQ512HBLU-00BL2',
      deviceDetails: 'FW 5L2QFXM7 • /dev/nvme0n1p2',
      mount: '/',
      used: 20,
      total: 100,
      usage: 0.2,
    },
  ],
  networks: [
    {
      name: 'enp0s31f6',
      addresses: ['192.168.0.10', 'fe80::1234'],
      subnetMasks: ['255.255.255.0', '/64'],
      gateways: ['192.168.0.1'],
      rxBytesPerSecond: 2048,
      txBytesPerSecond: 1024,
    },
    {
      name: 'lo',
      addresses: ['127.0.0.1', '::1'],
      subnetMasks: ['255.0.0.0', '/128'],
      gateways: [],
      rxBytesPerSecond: 128,
      txBytesPerSecond: 128,
    },
  ],
  processes: [
    {
      pid: 1001,
      user: 'sekam',
      state: 'R',
      elapsed: '00:12',
      command: '/usr/bin/gnome-shell',
      commandLine: '/usr/bin/gnome-shell --wayland',
      cpu: 3.2,
      memory: 2.1,
    },
  ],
  sensors: [
    { name: 'Core 0', value: '+42.0°C' },
  ],
  timestamp: 1,
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    getSystemSnapshot: vi.fn().mockResolvedValue(snapshot),
    killProcess: vi.fn().mockResolvedValue({ ok: true }),
    storeGet: vi.fn().mockResolvedValue(2000),
    storeSet: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});
