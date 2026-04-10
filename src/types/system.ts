export interface CpuCoreUsage {
  label: string;
  usage: number;
}

export interface CpuSnapshot {
  model: string;
  cores: number;
  overall: number;
  perCore: CpuCoreUsage[];
}

export interface MemorySnapshot {
  total: number;
  used: number;
  free: number;
  swapTotal: number;
  swapUsed: number;
}

export interface LoadSnapshot {
  one: number;
  five: number;
  fifteen: number;
  uptime: string;
}

export interface DiskSnapshot {
  mount: string;
  used: number;
  total: number;
  usage: number;
}

export interface NetworkSnapshot {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

export interface ProcessSnapshot {
  pid: number;
  command: string;
  cpu: number;
  memory: number;
}

export interface SensorSnapshot {
  name: string;
  value: string;
}

export interface SystemSnapshot {
  hostname: string;
  platform: string;
  kernel: string;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  load: LoadSnapshot;
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
  processes: ProcessSnapshot[];
  sensors: SensorSnapshot[];
  timestamp: number;
}
