/// <reference types="vite/client" />

import type { SystemSnapshot } from '@/types/system';

interface ElectronAPI {
  getSystemSnapshot: () => Promise<SystemSnapshot>;
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
