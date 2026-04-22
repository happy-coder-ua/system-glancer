import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { access, readFile, readdir, statfs } from 'node:fs/promises';
import { promisify } from 'node:util';
import Store from 'electron-store';

const execFileAsync = promisify(execFile);
const store = new Store();
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

interface CpuTimesSnapshot {
  idle: number;
  total: number;
}

interface DiskSnapshot {
  device: string;
  deviceLabel: string;
  deviceDetails?: string;
  mount: string;
  used: number;
  total: number;
  usage: number;
}

interface BlockDeviceSnapshot {
  name?: string;
  path?: string;
  type?: string;
  mountpoints?: Array<string | null> | string | null;
  vendor?: string | null;
  model?: string | null;
  serial?: string | null;
  rev?: string | null;
  children?: BlockDeviceSnapshot[];
}

interface MountedDeviceCandidate {
  device: string;
  deviceLabel: string;
  deviceDetails?: string;
  mount: string;
}

interface NetworkSnapshot {
  name: string;
  addresses: string[];
  subnetMasks: string[];
  gateways: string[];
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

interface IpAddressEntry {
  family?: string;
  local?: string;
  prefixlen?: number;
}

interface IpInterfaceEntry {
  ifname?: string;
  addr_info?: IpAddressEntry[];
}

interface IpRouteEntry {
  dst?: string;
  gateway?: string;
  dev?: string;
}

interface ProcessSnapshot {
  pid: number;
  user: string;
  state: string;
  elapsed: string;
  command: string;
  commandLine: string;
  cpu: number;
  memory: number;
}

interface SensorSnapshot {
  name: string;
  value: string;
}

let previousCpuTimes: CpuTimesSnapshot[] | null = null;
let previousNetworkStats: Record<string, { rxBytes: number; txBytes: number }> | null = null;
let previousNetworkTimestamp: number | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'System Glancer',
    backgroundColor: '#08110f',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function formatKernel(): string {
  return `${os.type()} ${os.release()}`;
}

function getCpuUsage() {
  const cpus = os.cpus();
  const current = cpus.map((cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return {
      idle: cpu.times.idle,
      total,
    };
  });

  const perCore = current.map((snapshot, index) => {
    const previous = previousCpuTimes?.[index];
    if (!previous) {
      return {
        label: `CPU ${index + 1}`,
        usage: 0,
      };
    }

    const totalDelta = snapshot.total - previous.total;
    const idleDelta = snapshot.idle - previous.idle;
    const usage = totalDelta > 0 ? Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)) : 0;

    return {
      label: `CPU ${index + 1}`,
      usage,
    };
  });

  previousCpuTimes = current;

  const overall = perCore.length > 0
    ? perCore.reduce((sum, core) => sum + core.usage, 0) / perCore.length
    : 0;

  return {
    model: cpus[0]?.model ?? 'Unknown CPU',
    cores: cpus.length,
    overall,
    perCore,
  };
}

async function getSwapInfo(): Promise<{ total: number; used: number }> {
  try {
    const { stdout } = await execFileAsync('free', ['-b']);
    const line = stdout
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('Swap:'));

    if (!line) {
      return { total: 0, used: 0 };
    }

    const [, total, used] = line.split(/\s+/);
    return {
      total: Number(total) || 0,
      used: Number(used) || 0,
    };
  } catch {
    return { total: 0, used: 0 };
  }
}

function normalizeMountPoints(mountpoints: BlockDeviceSnapshot['mountpoints']): string[] {
  if (Array.isArray(mountpoints)) {
    return mountpoints.filter((mount): mount is string => typeof mount === 'string' && mount.length > 0);
  }

  return typeof mountpoints === 'string' && mountpoints.length > 0
    ? [mountpoints]
    : [];
}

function compareMountPriority(left: string, right: string): number {
  if (left === '/') {
    return -1;
  }

  if (right === '/') {
    return 1;
  }

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return left.localeCompare(right);
}

function normalizeBlockText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function formatDeviceLabel(device: Pick<BlockDeviceSnapshot, 'name' | 'path' | 'vendor' | 'model'>): string {
  const vendor = normalizeBlockText(device.vendor);
  const model = normalizeBlockText(device.model);

  if (vendor && model) {
    return model.toLowerCase().startsWith(vendor.toLowerCase())
      ? model
      : `${vendor} ${model}`;
  }

  if (model) {
    return model;
  }

  if (vendor) {
    return vendor;
  }

  return device.path ?? device.name ?? 'Unknown disk';
}

function formatDeviceDetails(device: Pick<BlockDeviceSnapshot, 'path' | 'rev'>): string | undefined {
  const revision = normalizeBlockText(device.rev);
  const details = [
    revision ? `FW ${revision}` : null,
    device.path ?? null,
  ].filter((value): value is string => value !== null);

  return details.length > 0 ? details.join(' • ') : undefined;
}

function ipv4PrefixToMask(prefixLength: number): string {
  const clampedPrefix = Math.max(0, Math.min(32, prefixLength));
  const octets = Array.from({ length: 4 }, (_, index) => {
    const remainingBits = Math.max(0, clampedPrefix - index * 8);
    if (remainingBits >= 8) {
      return 255;
    }

    if (remainingBits <= 0) {
      return 0;
    }

    return 256 - 2 ** (8 - remainingBits);
  });

  return octets.join('.');
}

function formatSubnetMask(address: IpAddressEntry): string | null {
  const prefixLength = address.prefixlen;
  if (typeof prefixLength !== 'number') {
    return null;
  }

  if (address.family === 'inet') {
    return ipv4PrefixToMask(prefixLength);
  }

  if (address.family === 'inet6') {
    return `/${prefixLength}`;
  }

  return null;
}

async function getLinuxNetworkMetadata(): Promise<{
  addressesByInterface: Map<string, { addresses: string[]; subnetMasks: string[] }>;
  gatewaysByInterface: Map<string, string[]>;
}> {
  try {
    const [{ stdout: addrStdout }, { stdout: routeStdout }, { stdout: route6Stdout }] = await Promise.all([
      execFileAsync('ip', ['-j', 'addr', 'show']),
      execFileAsync('ip', ['-j', 'route', 'show', 'table', 'main']),
      execFileAsync('ip', ['-j', '-6', 'route', 'show', 'table', 'main']),
    ]);

    const addrEntries = JSON.parse(addrStdout) as IpInterfaceEntry[];
    const routeEntries = [
      ...(JSON.parse(routeStdout) as IpRouteEntry[]),
      ...(JSON.parse(route6Stdout) as IpRouteEntry[]),
    ];

    const addressesByInterface = new Map<string, { addresses: string[]; subnetMasks: string[] }>();
    for (const entry of addrEntries) {
      const name = entry.ifname;
      if (!name) {
        continue;
      }

      const normalizedAddresses = (entry.addr_info ?? [])
        .filter((address): address is Required<Pick<IpAddressEntry, 'local'>> & IpAddressEntry => typeof address.local === 'string' && address.local.length > 0)
        .map((address) => ({
          address: address.local,
          subnetMask: formatSubnetMask(address),
        }));

      addressesByInterface.set(name, {
        addresses: normalizedAddresses.map((address) => address.address),
        subnetMasks: normalizedAddresses
          .map((address) => address.subnetMask)
          .filter((mask): mask is string => typeof mask === 'string')
          .filter((mask, index, masks) => masks.indexOf(mask) === index),
      });
    }

    const gatewaysByInterface = new Map<string, string[]>();
    for (const route of routeEntries) {
      if (!route.dev || !route.gateway || route.dst !== 'default') {
        continue;
      }

      const gateways = gatewaysByInterface.get(route.dev) ?? [];
      if (!gateways.includes(route.gateway)) {
        gateways.push(route.gateway);
      }
      gatewaysByInterface.set(route.dev, gateways);
    }

    return { addressesByInterface, gatewaysByInterface };
  } catch {
    return {
      addressesByInterface: new Map<string, { addresses: string[]; subnetMasks: string[] }>(),
      gatewaysByInterface: new Map<string, string[]>(),
    };
  }
}

function selectPrimaryMounts(candidates: MountedDeviceCandidate[]): MountedDeviceCandidate[] {
  const mountsByDevice = new Map<string, MountedDeviceCandidate>();

  for (const candidate of candidates) {
    const existingMount = mountsByDevice.get(candidate.device);
    if (!existingMount || compareMountPriority(candidate.mount, existingMount.mount) < 0) {
      mountsByDevice.set(candidate.device, candidate);
    }
  }

  return [...mountsByDevice.values()];
}

function collectMountedPhysicalMounts(
  devices: BlockDeviceSnapshot[],
  hasPhysicalDiskAncestor = false,
  physicalDisk: BlockDeviceSnapshot | null = null,
): MountedDeviceCandidate[] {
  return devices.flatMap((device) => {
    const type = device.type ?? '';
    const hasPhysicalBacking = hasPhysicalDiskAncestor || type === 'disk';
    const sourceDisk = type === 'disk' ? device : physicalDisk;
    const mounts = hasPhysicalBacking && type !== 'loop' && type !== 'rom' && type !== 'zram'
      ? normalizeMountPoints(device.mountpoints).map((mount) => ({
        device: device.path ?? device.name ?? mount,
        deviceLabel: formatDeviceLabel(sourceDisk ?? device),
        deviceDetails: formatDeviceDetails(sourceDisk ?? device),
        mount,
      }))
      : [];
    const childMounts = collectMountedPhysicalMounts(device.children ?? [], hasPhysicalBacking, sourceDisk);

    return [...mounts, ...childMounts];
  });
}

async function getDiskUsageFromMounts(mounts: MountedDeviceCandidate[]): Promise<DiskSnapshot[]> {
  const seenMounts = new Set<string>();
  const disks = await Promise.all(mounts.map(async ({ device, deviceLabel, deviceDetails, mount }) => {
    if (seenMounts.has(mount)) {
      return null;
    }

    seenMounts.add(mount);

    try {
      const stats = await statfs(mount);
      const blockSize = stats.bsize;
      const total = stats.blocks * blockSize;
      const free = stats.bavail * blockSize;
      const used = Math.max(0, total - free);

      if (total <= 0) {
        return null;
      }

      return {
        device,
        deviceLabel,
        deviceDetails,
        mount,
        used,
        total,
        usage: used / total,
      };
    } catch {
      return null;
    }
  }));

  return disks
    .filter((disk): disk is DiskSnapshot => disk !== null)
    .sort((left, right) => left.device.localeCompare(right.device) || left.mount.localeCompare(right.mount));
}

async function getPhysicalDiskInfo(): Promise<DiskSnapshot[]> {
  try {
    const { stdout } = await execFileAsync('lsblk', ['-J', '-o', 'NAME,PATH,TYPE,MOUNTPOINTS,VENDOR,MODEL,SERIAL,REV']);
    const parsed = JSON.parse(stdout) as { blockdevices?: BlockDeviceSnapshot[] };
    const physicalMounts = selectPrimaryMounts(collectMountedPhysicalMounts(parsed.blockdevices ?? []));

    if (physicalMounts.length === 0) {
      return [];
    }

    return getDiskUsageFromMounts(physicalMounts);
  } catch {
    return [];
  }
}

async function getDiskInfoFromProcMounts(): Promise<DiskSnapshot[]> {
  const ignoredTypes = new Set([
    'autofs',
    'bpf',
    'configfs',
    'cgroup',
    'cgroup2',
    'debugfs',
    'devpts',
    'devtmpfs',
    'efivarfs',
    'fusectl',
    'hugetlbfs',
    'mqueue',
    'proc',
    'pstore',
    'rpc_pipefs',
    'securityfs',
    'squashfs',
    'sysfs',
    'tmpfs',
    'tracefs',
  ]);

  const mounts = await readFile('/proc/mounts', 'utf-8');

  const physicalMounts = selectPrimaryMounts(mounts
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => {
      const filesystem = parts[0] ?? '';
      const mount = parts[1] ?? '/';
      const type = parts[2] ?? '';

      if (ignoredTypes.has(type)) {
        return false;
      }

      if (!filesystem.startsWith('/dev/')) {
        return false;
      }

      if (filesystem.startsWith('/dev/loop') || filesystem.startsWith('/dev/zram')) {
        return false;
      }

      if (mount.startsWith('/snap/') || mount.startsWith('/proc/') || mount.startsWith('/sys/') || mount.startsWith('/dev/')) {
        return false;
      }

      return true;
    })
    .map((parts) => ({
      device: parts[0] ?? '',
      deviceLabel: parts[0] ?? '',
      deviceDetails: undefined,
      mount: parts[1] ?? '/',
    })));

  return getDiskUsageFromMounts(physicalMounts);
}

async function getDiskInfo(): Promise<DiskSnapshot[]> {
  try {
    const physicalDisks = await getPhysicalDiskInfo();

    if (physicalDisks.length > 0) {
      return physicalDisks;
    }

    return getDiskInfoFromProcMounts();
  } catch {
    return [];
  }
}

async function getNetworkInfo(): Promise<NetworkSnapshot[]> {
  const interfaces = os.networkInterfaces();
  const isPhysicalInterface = async (name: string): Promise<boolean> => {
    if (name === 'lo') {
      return true;
    }

    try {
      await access(`/sys/class/net/${name}/device`);
      return true;
    } catch {
      return false;
    }
  };

  const interfaceEntries = await Promise.all(Object.entries(interfaces).map(async ([name, entries]) => ({
    name,
    entries: entries ?? [],
    isVisible: await isPhysicalInterface(name),
  })));

  const visibleInterfaces = interfaceEntries.filter(({ isVisible }) => isVisible);
  const { addressesByInterface, gatewaysByInterface } = await getLinuxNetworkMetadata();

  let counters: Record<string, { rxBytes: number; txBytes: number }> = {};
  try {
    const procNetDev = await readFile('/proc/net/dev', 'utf-8');
    counters = procNetDev
      .split('\n')
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, { rxBytes: number; txBytes: number }>>((accumulator, line) => {
        const [namePart, metricsPart] = line.split(':');
        if (!namePart || !metricsPart) {
          return accumulator;
        }

        const values = metricsPart.trim().split(/\s+/);
        accumulator[namePart.trim()] = {
          rxBytes: Number(values[0]) || 0,
          txBytes: Number(values[8]) || 0,
        };
        return accumulator;
      }, {});
  } catch {
    counters = {};
  }

  const now = Date.now();
  const elapsedSeconds = previousNetworkTimestamp ? Math.max((now - previousNetworkTimestamp) / 1000, 0.001) : null;

  const snapshots = visibleInterfaces
    .map(({ name, entries }) => ({
      name,
      addresses: (addressesByInterface.get(name)?.addresses ?? entries
        .map((entry) => entry.address))
        .filter((address, index, addresses) => address.length > 0 && addresses.indexOf(address) === index)
        .sort((left, right) => {
          if (left === '127.0.0.1') {
            return -1;
          }

          if (right === '127.0.0.1') {
            return 1;
          }

          if (left === '::1') {
            return right === '127.0.0.1' ? 1 : -1;
          }

          if (right === '::1') {
            return left === '127.0.0.1' ? -1 : 1;
          }

          const leftIsIpv4 = !left.includes(':');
          const rightIsIpv4 = !right.includes(':');

          if (leftIsIpv4 !== rightIsIpv4) {
            return leftIsIpv4 ? -1 : 1;
          }

          return left.localeCompare(right);
        }),
      subnetMasks: (addressesByInterface.get(name)?.subnetMasks ?? [])
        .filter((mask, index, masks) => mask.length > 0 && masks.indexOf(mask) === index),
      gateways: (gatewaysByInterface.get(name) ?? [])
        .filter((gateway, index, gateways) => gateway.length > 0 && gateways.indexOf(gateway) === index),
      rxBytesPerSecond: elapsedSeconds && previousNetworkStats?.[name]
        ? Math.max(0, (counters[name]?.rxBytes ?? 0) - previousNetworkStats[name].rxBytes) / elapsedSeconds
        : 0,
      txBytesPerSecond: elapsedSeconds && previousNetworkStats?.[name]
        ? Math.max(0, (counters[name]?.txBytes ?? 0) - previousNetworkStats[name].txBytes) / elapsedSeconds
        : 0,
    }))
    .filter((network) => network.addresses.length > 0)
    .sort((left, right) => {
      if (left.name === 'lo') {
        return 1;
      }

      if (right.name === 'lo') {
        return -1;
      }

      return left.name.localeCompare(right.name);
    });

  previousNetworkStats = counters;
  previousNetworkTimestamp = now;

  return snapshots;
}

async function getProcesses(): Promise<ProcessSnapshot[]> {
  try {
    const { stdout } = await execFileAsync('ps', [
      '-ww',
      '-eo',
      'pid=,user=,state=,etime=,%cpu=,%mem=,comm=,args=',
      '--sort=-%cpu',
      '--no-headers',
    ]);

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
        if (!match) {
          return null;
        }

        return {
          pid: Number(match[1]),
          user: match[2],
          state: match[3],
          elapsed: match[4],
          cpu: Number(match[5]),
          memory: Number(match[6]),
          command: match[7],
          commandLine: match[8],
        };
      })
      .filter((process): process is ProcessSnapshot => process !== null);
  } catch {
    return [];
  }
}

async function getSensors(): Promise<SensorSnapshot[]> {
  try {
    const hwmonBase = '/sys/class/hwmon';
    const result: SensorSnapshot[] = [];
    const devices = await readdir(hwmonBase).catch(() => [] as string[]);

    for (const device of devices) {
      const devicePath = path.join(hwmonBase, device);
      const deviceName = await readFile(path.join(devicePath, 'name'), 'utf8').then((s) => s.trim()).catch(() => device);

      const entries = await readdir(devicePath).catch(() => [] as string[]);
      const tempInputs = entries.filter((e) => /^temp\d+_input$/.test(e)).sort();

      for (const input of tempInputs) {
        const index = input.match(/\d+/)?.[0] ?? '';
        const raw = await readFile(path.join(devicePath, input), 'utf8').catch(() => '');
        if (!raw) continue;

        const current = Number(raw.trim()) / 1000;
        if (!Number.isFinite(current)) continue;

        const label = await readFile(path.join(devicePath, `temp${index}_label`), 'utf8').then((s) => s.trim()).catch(() => '');
        const high = await readFile(path.join(devicePath, `temp${index}_max`), 'utf8').then((s) => Number(s.trim()) / 1000).catch(() => null);
        const crit = await readFile(path.join(devicePath, `temp${index}_crit`), 'utf8').then((s) => Number(s.trim()) / 1000).catch(() => null);

        const name = label || `${deviceName} temp${index}`;
        const limits: string[] = [];
        if (high !== null && Number.isFinite(high)) limits.push(`high = +${high.toFixed(1)}°C`);
        if (crit !== null && Number.isFinite(crit)) limits.push(`crit = +${crit.toFixed(1)}°C`);

        const value = `+${current.toFixed(1)}°C` + (limits.length > 0 ? `  (${limits.join(', ')})` : '');
        result.push({ name, value });
      }
    }

    return result.slice(0, 8);
  } catch {
    return [];
  }
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

async function getSystemSnapshot() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const swap = await getSwapInfo();
  const [diskUsage, processes, sensors, networks] = await Promise.all([
    getDiskInfo(),
    getProcesses(),
    getSensors(),
    getNetworkInfo(),
  ]);

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    kernel: formatKernel(),
    cpu: getCpuUsage(),
    memory: {
      total: memoryTotal,
      used: memoryTotal - memoryFree,
      free: memoryFree,
      swapTotal: swap.total,
      swapUsed: swap.used,
    },
    load: {
      one: os.loadavg()[0],
      five: os.loadavg()[1],
      fifteen: os.loadavg()[2],
      uptime: formatUptime(os.uptime()),
    },
    disks: diskUsage,
    networks,
    processes,
    sensors,
    timestamp: Date.now(),
  };
}

ipcMain.handle('system:get-snapshot', async () => {
  return getSystemSnapshot();
});

ipcMain.handle('system:kill-process', async (_event, pid: number) => {
  try {
    process.kill(pid, 'SIGTERM');
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to terminate process',
    };
  }
});

ipcMain.handle('store-get', (_event, key: string) => {
  return store.get(key) ?? null;
});

ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
  store.set(key, value);
});

function buildAppMenu(): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => { shell.openExternal('https://github.com/happy-coder-ua/system-glancer'); },
        },
        { type: 'separator' },
        {
          label: 'About System Glancer',
          click: () => { app.showAboutPanel(); },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'System Glancer',
    applicationVersion: app.getVersion(),
    authors: ['Serhii Kaminskyi'],
    website: 'https://github.com/happy-coder-ua/system-glancer',
  });
  Menu.setApplicationMenu(buildAppMenu());
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
