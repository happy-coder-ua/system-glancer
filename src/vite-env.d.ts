/// <reference types="vite/client" />

import type { KillProcessResult, SystemSnapshot } from '@/types/system';

interface ElectronAPI {
  getSystemSnapshot: () => Promise<SystemSnapshot>;
  killProcess: (pid: number) => Promise<KillProcessResult>;
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
