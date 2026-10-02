// Regression scenarios. Expected sizing values were taken from the Excel workbook (Edge Device Selector v6),
// so any change to calc.js or the data files that shifts results shows up here.
import { defaultRequirements, sizeInstall, devicesForMode } from "../js/calc.js";

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** Client 2-style heavy install (tag counts assumed). */
function client2(data, mode) {
  const req = defaultRequirements(data);
  req.mode = mode;
  req.connections["S7 Connector (S7-1200/1500/300/400)"] = { connections: 2, tags: 1500, rateMs: 1000 };
  req.connections["OPC UA Connector"] = { connections: 2, tags: 1500, rateMs: 1000 };
  req.connections["Modbus TCP Connector"] = { connections: 2, tags: 500, rateMs: 1000 };
  req.wincc = { enabled: true, tags: 3000, clients: 5 };
  req.apps["Remote Service client (RS-Client)"] = 1;
  req.apps["Custom Python / Docker analytics app"] = 1;
  return req;
}

export function runAll(data) {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, pass: !!ok, detail });
  const general = () => { const r = defaultRequirements(data); r.mode = "general"; return r; };

  // 0. Install-type modes
  {
    check("Default install type is DPS", defaultRequirements(data).mode === "dps");
    const dps = devicesForMode(data, "dps").map((d) => d.dpsPackage).sort().join(", ");
    check("DPS mode considers exactly DPS Core + DPS Pro", dps === "DPS Core, DPS Pro", dps);
    check("General mode considers every catalog device", devicesForMode(data, "general").length === data.devices.length, String(data.devices.length));
    const core = data.devices.find((d) => d.dpsPackage === "DPS Core");
    const pro = data.devices.find((d) => d.dpsPackage === "DPS Pro");
    check("DPS Core = BX-21A, DPS Pro = BX-39A", core?.name.includes("BX-21A") && pro?.name.includes("BX-39A"), `${core?.name} / ${pro?.name}`);
  }

  // 1. Client 1-style light install (the default inputs) - sizing must match the workbook
  {
    const r = sizeInstall(general(), data);
    check("Client 1-style: CPU 0.38 core-eq", near(r.need.raw.cpu, 0.38, 0.01), r.need.raw.cpu.toFixed(3));
    check("Client 1-style: RAM actual 2.41 GB / reserved 6.0 GB", near(r.need.raw.ram, 2.41, 0.02) && near(r.need.check.ram, 6.02, 0.05), `${r.need.raw.ram.toFixed(2)} / ${r.need.check.ram.toFixed(2)}`);
    check("Client 1-style: storage ~18.4 GB", near(r.need.raw.storage, 18.42, 0.1), r.need.raw.storage.toFixed(2));
    check("Client 1-style: 200 pts/s, 2 ports", r.need.derived.pts === 200 && r.need.derived.ports === 2, `${r.need.derived.pts} pts/s, ${r.need.derived.ports} ports`);
    check("Client 1-style, general: recommends IPC227E, next IPC227G", r.recommended?.device.name === "SIMATIC IPC227E (Edge)" && r.next?.device.name === "SIMATIC IPC227G (Edge)", `${r.recommended?.device.name} / ${r.next?.device.name}`);
    const iot = r.rows.find((x) => x.device.arch === "ARM");
    check("ARM device rejected (x86-only apps)", iot.checks.arch === "FAIL" && !iot.suitable, iot.reasons.join(", "));
    const i127 = r.rows.find((x) => x.device.name.includes("IPC127E"));
    check("IPC127E fails RAM for this install", i127.checks.ram === "FAIL", `reserved ${r.need.check.ram.toFixed(1)} GB vs ${i127.device.ramGb} GB`);

    const d = sizeInstall(defaultRequirements(data), data);
    check("Client 1-style, DPS: recommends DPS Core, next DPS Pro", d.recommended?.device.dpsPackage === "DPS Core" && d.next?.device.dpsPackage === "DPS Pro", `${d.recommended?.device.dpsPackage} / ${d.next?.device.dpsPackage}`);
    check("DPS mode only lists 2 devices", d.rows.length === 2, String(d.rows.length));
  }

  // 2. Client 2-style heavy install (tag counts assumed, as in the workbook's Field Data sheet)
  {
    const r = sizeInstall(client2(data, "general"), data);
    check("Client 2-style: CPU 2.62 core-eq", near(r.need.raw.cpu, 2.62, 0.02), r.need.raw.cpu.toFixed(3));
    check("Client 2-style: RAM actual 4.42 / reserved 11.05 GB", near(r.need.raw.ram, 4.42, 0.03) && near(r.need.check.ram, 11.05, 0.1), `${r.need.raw.ram.toFixed(2)} / ${r.need.check.ram.toFixed(2)}`);
    check("Client 2-style: 3,500 pts/s", r.need.derived.pts === 3500, String(r.need.derived.pts));
    check("Client 2-style, general: recommends IPC227G, next BX-21A", r.recommended?.device.name === "SIMATIC IPC227G (Edge)" && r.next?.device.name === "SIMATIC IPC BX-21A (Edge)", `${r.recommended?.device.name} / ${r.next?.device.name}`);
    const i127 = r.rows.find((x) => x.device.name.includes("IPC127E"));
    check("WinCC excludes IPC127E", i127.checks.wincc === "FAIL", i127.reasons.join(", "));
    const d = sizeInstall(client2(data, "dps"), data);
    check("Client 2-style, DPS: DPS Core still passes (CPU ~79% incl. headroom)", d.recommended?.device.dpsPackage === "DPS Core", `${d.recommended?.device.dpsPackage}, CPU util ${Math.round(d.recommended?.util.cpu * 100)}%`);
  }

  // 3. A heavier HMI load pushes DPS Core out and DPS Pro in
  {
    const req = defaultRequirements(data);
    req.wincc = { enabled: true, tags: 10000, clients: 20 };
    const d = sizeInstall(req, data);
    const core = d.rows.find((x) => x.device.dpsPackage === "DPS Core");
    check("Heavy WinCC: DPS Core fails CPU", core.checks.cpu === "FAIL", core.reasons.join(", "));
    check("Heavy WinCC: DPS Pro recommended", d.recommended?.device.dpsPackage === "DPS Pro", d.recommended?.device.name);
  }

  // 4. Connector limits from the Siemens manuals
  {
    const req = general();
    req.connections["S7 Connector (S7-1200/1500/300/400)"] = { connections: 6, tags: 9000, rateMs: 1000 };
    req.connections["OPC UA Connector"] = { connections: 25, tags: 1500, rateMs: 1000 };
    const r = sizeInstall(req, data);
    const s7 = r.need.connectorRows.find((x) => x.name.startsWith("S7"));
    const opc = r.need.connectorRows.find((x) => x.name === "OPC UA Connector");
    check("S7 over 6,000 pts/s is flagged", s7.check === "EXCEEDS documented 6,000 pts/s", s7.check);
    check("OPC UA over 20 connections is flagged", opc.check === "EXCEEDS max connections (20)", opc.check);
    check("Two warnings raised", r.need.warnings.length === 2, String(r.need.warnings.length));
  }

  // 5. Ethernet rules
  {
    const req = general();
    req.network = { ports: 1, segregation: false };
    check("Ports: 1 when no segregation and no PROFINET", sizeInstall(req, data).need.derived.ports === 1);
    req.network.segregation = true;
    check("Ports: segregation forces 2", sizeInstall(req, data).need.derived.ports === 2);
    req.network = { ports: 1, segregation: false };
    req.connections["PROFINET IO Connector"] = { connections: 2, tags: 100, rateMs: 1000 };
    check("Ports: PROFINET IO forces 2 (dedicated NIC)", sizeInstall(req, data).need.derived.ports === 2);
  }

  // 6. GPU requirement
  {
    const req = general();
    req.hardware.gpu = true;
    const r = sizeInstall(req, data);
    const names = r.rows.filter((x) => x.suitable).map((x) => x.device.name);
    check("GPU required, general: only the BX-59A passes", names.length === 1 && names[0].includes("BX-59A"), names.join(", "));
    req.mode = "dps";
    const d = sizeInstall(req, data);
    check("GPU required, DPS: no package fits, closest given", d.recommended === null && d.closest?.device.dpsPackage, d.closest?.device.dpsPackage);
  }

  // 7. Nothing fits
  {
    const req = general();
    req.connections["OPC UA Connector"] = { connections: 20, tags: 1000000, rateMs: 100 };
    req.storage = { local: true, days: 365, percentStored: 1 };
    const r = sizeInstall(req, data);
    check("Impossible install: no recommendation, closest match given", r.recommended === null && r.closest !== null, r.closest?.device.name);
  }

  // 8. Data integrity
  {
    const names = data.devices.map((d) => d.name);
    check("Device names unique", new Set(names).size === names.length);
    check("Every app has evidence tags", data.apps.every((a) => a.confidence && a.confidence.cpu && a.confidence.ramGb));
    check("Headroom is 20%", data.assumptions.headroom.value === 0.2, String(data.assumptions.headroom.value));
    const fieldBasis = [...data.apps, ...data.connectors].filter((x) => Object.values(x.confidence).includes("field")).map((x) => x.basis);
    check("Measured entries cite anonymised sites (Client N)", fieldBasis.every((b) => /Client \d/.test(b)), `${fieldBasis.length} entries`);
  }
  return results;
}
