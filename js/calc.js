// Pure sizing logic - no DOM access, so it runs in the browser and in Node tests.
// Ported 1:1 from the Excel workbook (Calc + Recommendation sheets).
// CPU is expressed in "Atom x6413E core-equivalents" (one BX-21A core = 1.0).

const A = (data, key) => data.assumptions[key].value;

export const MODES = {
  dps: "DPS package (Core / Pro)",
  general: "General install (all listed Edge devices)",
};

/** Devices considered in a given mode: DPS mode = only devices mapped to a DPS package. */
export function devicesForMode(data, mode) {
  return mode === "general" ? data.devices : data.devices.filter((d) => d.dpsPackage);
}

/** Name to show for a device, e.g. "DPS Core – SIMATIC IPC BX-21A (Edge)". */
export function displayName(d) {
  return d.dpsPackage ? `${d.dpsPackage} – ${d.name}` : d.name;
}

/** Default inputs (a light, Client 1-style install), sized against the DPS packages. */
export function defaultRequirements(data) {
  const connections = {};
  for (const c of data.connectors) connections[c.name] = { connections: 0, tags: 0, rateMs: 1000 };
  connections["OPC UA Connector"] = { connections: 1, tags: 200, rateMs: 1000 };
  const apps = {};
  for (const a of data.apps) apps[a.name] = 0;
  for (const n of ["Databus (MQTT broker)", "Common Configurator", "IIH Essentials", "IIH Semantics", "Flow Creator (Node-RED)", "Network Tester"]) apps[n] = 1;
  return {
    mode: "dps",
    connections,
    wincc: { enabled: false, tags: 0, clients: 0 },
    network: { ports: 2, segregation: true },
    storage: { local: true, days: 30, percentStored: 0.5 },
    apps,
    hardware: { tpm: true, secureBoot: true, iec62443: false, gpu: false },
  };
}

export function maxPtsPerSec(device, data) {
  return Math.round((device.cores * device.perfIndex * A(data, "dataRatePerCoreEq")) / 1000) * 1000;
}

/** Work out what the install needs. */
export function computeRequirements(req, data) {
  const head = A(data, "headroom");
  const parts = []; // {group, name, cpu, ram, storage, cpuConf, ramConf}
  const warnings = [];

  // A. connectors
  const connectorRows = data.connectors.map((c) => {
    const r = req.connections[c.name] || { connections: 0, tags: 0, rateMs: 1000 };
    const pts = r.rateMs > 0 ? (r.tags * 1000) / r.rateMs : 0;
    const used = r.connections > 0;
    const cpu = used ? c.cpuBase + r.connections * c.cpuPerConn + (pts / 1000) * c.cpuPerKpts : 0;
    const ram = used ? c.ramGb + r.connections * c.ramPerConnGb + (pts / 1000) * c.ramPerKptsGb : 0;
    let check = "-";
    if (used) {
      if (c.maxConnections > 0 && r.connections > c.maxConnections) check = `EXCEEDS max connections (${c.maxConnections})`;
      else if (c.maxPtsPerSec > 0 && pts > c.maxPtsPerSec) check = `EXCEEDS documented ${c.maxPtsPerSec.toLocaleString("en-GB")} pts/s`;
      else check = "OK";
    }
    if (check.startsWith("EXCEEDS")) warnings.push(`${c.name}: ${check}`);
    if (used) parts.push({ group: "Connectors", name: c.name, cpu, ram, storage: 0, cpuConf: c.confidence.cpuBase === "estimate" ? "estimate" : c.confidence.cpuBase, ramConf: c.confidence.ramGb });
    return { name: c.name, connections: r.connections, tags: r.tags, rateMs: r.rateMs, pts, cpu, ram, check, used, arm: c.arm, dedicatedNic: c.dedicatedNic };
  });
  const totalPts = connectorRows.reduce((s, r) => s + r.pts, 0);

  // B. apps
  let armApps = 0;
  let gpuApps = 0;
  const appRows = data.apps.map((a) => {
    const q = req.apps[a.name] || 0;
    if (q > 0 && !a.arm) armApps += 1;
    if (q > 0 && a.gpu) gpuApps += 1;
    if (q > 0) parts.push({ group: "Apps", name: a.name, cpu: q * a.cpu, ram: q * a.ramGb, storage: q * a.storageGb, cpuConf: a.confidence.cpu, ramConf: a.confidence.ramGb });
    return { name: a.name, qty: q, cpu: q * a.cpu, ram: q * a.ramGb, storage: q * a.storageGb };
  });

  // C. WinCC Unified on Edge
  const w = req.wincc;
  const wincc = w.enabled
    ? {
        cpu: A(data, "winccCpuBase") + w.clients * A(data, "winccCpuPerClient") + (w.tags / 1000) * A(data, "winccCpuPer1000Tags"),
        ram: A(data, "winccRamBaseGb") + w.clients * A(data, "winccRamPerClientGb") + (w.tags / 1000) * A(data, "winccRamPer1000TagsGb"),
        storage: A(data, "winccStorageGb"),
      }
    : { cpu: 0, ram: 0, storage: 0 };
  if (w.enabled) parts.push({ group: "WinCC Unified", name: "WinCC Unified Runtime", cpu: wincc.cpu, ram: wincc.ram, storage: wincc.storage, cpuConf: "estimate", ramConf: "field" });

  // D. local time-series storage
  const dataStorage = req.storage.local
    ? (totalPts * req.storage.percentStored * A(data, "bytesPerSample") * 86400 * req.storage.days * A(data, "dbOverhead")) / 1e9
    : 0;

  // E. totals
  parts.unshift({ group: "Platform", name: "Edge OS + management agent", cpu: A(data, "platformCpu"), ram: A(data, "platformRamGb"), storage: A(data, "platformStorageGb"), cpuConf: "field", ramConf: "estimate" });
  const sum = (k) => parts.reduce((s, p) => s + p[k], 0);
  const raw = { cpu: sum("cpu"), ram: sum("ram"), storage: sum("storage") + dataStorage };
  const check = {
    cpu: raw.cpu * (1 + head),
    ram: Math.max(raw.ram * (1 + head), raw.ram * A(data, "memoryReservationFactor")),
    storage: raw.storage * (1 + head),
  };

  // F. derived requirements
  const dedicatedNic = connectorRows.some((r) => r.used && r.dedicatedNic);
  const armBlockers = connectorRows.filter((r) => r.used && !r.arm).length + armApps + (w.enabled ? 1 : 0);
  const derived = {
    pts: totalPts,
    ports: Math.max(req.network.ports, req.network.segregation ? 2 : 1, 1 + (dedicatedNic ? 1 : 0)),
    gpu: req.hardware.gpu || gpuApps > 0,
    armBlockers,
    wincc: w.enabled,
  };

  // how much of each total rests on estimates rather than measured / documented figures
  const share = (key, conf) => {
    const tot = parts.reduce((s, p) => s + p[key], 0);
    const est = parts.filter((p) => p[conf] === "estimate").reduce((s, p) => s + p[key], 0);
    return tot > 0 ? est / tot : 0;
  };
  const estimateShare = { cpu: share("cpu", "cpuConf"), ram: share("ram", "ramConf") };

  return { connectorRows, appRows, wincc, dataStorage, raw, check, derived, parts, warnings, estimateShare };
}

const NA = "n/a";
const PF = (ok) => (ok ? "PASS" : "FAIL");

/** Test every device against the requirements. */
export function evaluateDevices(req, data, need) {
  const head = A(data, "headroom");
  const rows = devicesForMode(data, req.mode).map((d, i) => {
    const cap = d.cores * d.perfIndex;
    const maxPts = maxPtsPerSec(d, data);
    const checks = {
      cpu: PF(need.check.cpu <= cap),
      ram: PF(need.check.ram <= d.ramGb),
      storage: PF(need.check.storage <= d.storageGb),
      ethernet: PF(need.derived.ports <= d.ethernetPorts),
      dataRate: PF(need.derived.pts * (1 + head) <= maxPts),
      arch: PF(!(d.arch === "ARM" && need.derived.armBlockers > 0)),
      wincc: need.derived.wincc ? PF(d.wincc) : NA,
      gpu: need.derived.gpu ? PF(d.gpu) : NA,
      tpm: req.hardware.tpm ? PF(d.tpm) : NA,
      secureBoot: req.hardware.secureBoot ? PF(d.secureBoot) : NA,
      iec62443: req.hardware.iec62443 ? PF(d.iec62443) : NA,
    };
    const labels = {
      cpu: "CPU", ram: "RAM", storage: "Storage", ethernet: "Ethernet ports", dataRate: "Data rate", arch: "Apps/connectors not on ARM",
      wincc: "WinCC Unified", gpu: "GPU", tpm: "TPM", secureBoot: "Secure boot", iec62443: "IEC 62443",
    };
    const fails = Object.keys(checks).filter((k) => checks[k] === "FAIL");
    return {
      device: d,
      index: i,
      cap,
      maxPts,
      util: { cpu: need.raw.cpu / cap, ram: need.check.ram / d.ramGb, storage: need.raw.storage / d.storageGb },
      checks,
      fails,
      reasons: fails.map((k) => labels[k]),
      suitable: fails.length === 0,
    };
  });
  // cheapest suitable first (cost tier, then catalog order, exactly as the workbook ranks)
  const suitable = rows.filter((r) => r.suitable).sort((a, b) => a.device.costTier - b.device.costTier || a.index - b.index);
  suitable.forEach((r, i) => (r.rank = i + 1));
  // the closest match is only reported when nothing passes
  const closest = suitable.length ? null : [...rows].sort((a, b) => a.fails.length - b.fails.length || a.index - b.index)[0];
  return { rows, recommended: suitable[0] || null, next: suitable[1] || null, closest };
}

export function sizeInstall(req, data) {
  const need = computeRequirements(req, data);
  const result = evaluateDevices(req, data, need);
  return { need, ...result };
}
