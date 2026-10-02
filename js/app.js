import { defaultRequirements, sizeInstall, MODES, displayName } from "./calc.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};
const fmt = (n, d = 2) => Number(n).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = (n) => Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });

let data;
let state;

// ---------------------------------------------------------------- data + state
async function loadData() {
  const get = async (name) => {
    const r = await fetch(`data/${name}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Could not load data/${name}.json (${r.status})`);
    return r.json();
  };
  const [connectors, apps, devices, assumptions] = await Promise.all(["connectors", "apps", "devices", "assumptions"].map(get));
  return { connectors, apps, devices, assumptions };
}

const encodeState = (s) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
const decodeState = (h) => JSON.parse(decodeURIComponent(escape(atob(h))));

function loadState() {
  const base = defaultRequirements(data);
  const hash = location.hash.replace(/^#s=/, "");
  if (hash) {
    try {
      const s = decodeState(hash);
      // merge over defaults so new catalog entries never break an old link
      return {
        mode: s.mode === "general" ? "general" : "dps",
        connections: { ...base.connections, ...s.connections },
        wincc: { ...base.wincc, ...s.wincc },
        network: { ...base.network, ...s.network },
        storage: { ...base.storage, ...s.storage },
        apps: { ...base.apps, ...s.apps },
        hardware: { ...base.hardware, ...s.hardware },
      };
    } catch (e) { /* fall through to defaults */ }
  }
  return base;
}

// ---------------------------------------------------------------- tabs
function showTab(which) {
  const req = which === "req";
  $("#page-req").hidden = !req;
  $("#page-rec").hidden = req;
  $("#tab-req").setAttribute("aria-selected", String(req));
  $("#tab-rec").setAttribute("aria-selected", String(!req));
  if (!req) renderRecommendation();
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------- form helpers
const numInput = (value, onChange, { min = 0, max, step = 1, id } = {}) =>
  el("input", {
    type: "number", inputmode: "decimal", min, max, step, value, id,
    oninput: (e) => { const v = Number(e.target.value); onChange(Number.isFinite(v) && v >= 0 ? v : 0); refresh(); },
  });

const toggle = (label, checked, onChange) =>
  el("label", { class: "switch" }, el("input", { type: "checkbox", checked, onchange: (e) => { onChange(e.target.checked); refresh(); } }), label);

function evidenceChip(conf) {
  const v = Object.values(conf);
  const key = v.includes("field") ? "field" : v.includes("siemens") ? "siemens" : "estimate";
  const text = { field: "measured", siemens: "documented", estimate: "estimate" }[key];
  return el("span", { class: `ev ev-${key}`, title: "Evidence behind this catalog entry" }, text);
}

const chip = (text, cls) => el("span", { class: `chip ${cls || text.split(" ")[0]}` }, text);

// ---------------------------------------------------------------- Requirements page
function buildRequirements() {
  const root = $("#page-req");
  root.replaceChildren();

  // 0 install type
  const modeOption = (key, title, text) =>
    el("label", { class: "mode-option" },
      el("input", { type: "radio", name: "mode", value: key, checked: state.mode === key, onchange: () => { state.mode = key; refresh(); } }),
      el("span", { class: "mode-body" }, el("strong", {}, title), el("span", {}, text)));
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "Install type"),
      el("p", { class: "hint" }, "Choose which hardware the requirements are checked against."),
      el("div", { class: "mode-grid", role: "radiogroup", "aria-label": "Install type" },
        modeOption("dps", MODES.dps, "Checks the two standard packages only: DPS Core (SIMATIC IPC BX-21A) and DPS Pro (SIMATIC IPC BX-39A)."),
        modeOption("general", MODES.general, "Checks every Siemens Industrial Edge device in the catalog and picks the cheapest that fits.")))
  );

  // 1 connectors
  const tbody = el("tbody");
  data.connectors.forEach((c) => {
    const r = state.connections[c.name];
    tbody.append(
      el("tr", { "data-conn": c.name },
        el("td", {}, c.name),
        el("td", { class: "num" }, numInput(r.connections, (v) => (r.connections = v))),
        el("td", { class: "num" }, numInput(r.tags, (v) => (r.tags = v))),
        el("td", { class: "num" }, numInput(r.rateMs, (v) => (r.rateMs = v), { step: 10 })),
        el("td", { class: "num", "data-pts": "" }, "0"),
        el("td", { "data-check": "" }, ""))
    );
  });
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "1. Data connections"),
      el("p", { class: "hint" }, "For each connector type: number of PLCs / devices, total tags (data points) and the sample rate. Leave connections at 0 for unused connectors. The limit column compares against Siemens' documented limits."),
      el("div", { class: "table-wrap" },
        el("table", {},
          el("thead", {}, el("tr", {}, el("th", {}, "Connector"), el("th", { class: "num" }, "Connections"), el("th", { class: "num" }, "Tags"), el("th", { class: "num" }, "Sample rate (ms)"), el("th", { class: "num" }, "Pts / sec"), el("th", {}, "Limit check"))),
          tbody)))
  );

  // 2 WinCC
  const wc = el("div", { class: "grid", id: "wincc-fields" },
    el("label", { class: "field" }, el("span", {}, "WinCC Unified tags"), numInput(state.wincc.tags, (v) => (state.wincc.tags = v))),
    el("label", { class: "field" }, el("span", {}, "Concurrent web / HMI clients"), numInput(state.wincc.clients, (v) => (state.wincc.clients = v))));
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "2. WinCC Unified on Edge"),
      el("p", { class: "hint" }, "Rules out ARM devices and the IPC127E. Siemens recommends IPC427E or newer for larger projects."),
      toggle("Run WinCC Unified runtime on the Edge device", state.wincc.enabled, (v) => { state.wincc.enabled = v; }),
      wc)
  );

  // 3 network
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "3. Ethernet / network"),
      el("p", { class: "hint" }, "1 = machine/OT network only, 2 = plus plant/IT network, 3 = plus PROFINET or DMZ. Segregation and the PROFINET connector raise the minimum automatically."),
      el("div", { class: "grid" },
        el("label", { class: "field" }, el("span", {}, "Physical Ethernet ports needed"), numInput(state.network.ports, (v) => (state.network.ports = v), { min: 1, max: 8 }))),
      toggle("Physical OT / IT network segregation required", state.network.segregation, (v) => { state.network.segregation = v; }))
  );

  // 4 storage
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "4. Local data storage"),
      el("p", { class: "hint" }, "Time-series history kept on the Edge device itself. Archiving on-change / with a deadband usually stores far less than 100% of samples."),
      toggle("Store data locally", state.storage.local, (v) => { state.storage.local = v; }),
      el("div", { class: "grid", id: "storage-fields" },
        el("label", { class: "field" }, el("span", {}, "Retention (days)"), numInput(state.storage.days, (v) => (state.storage.days = v))),
        el("label", { class: "field" }, el("span", {}, "% of samples actually stored"),
          numInput(Math.round(state.storage.percentStored * 100), (v) => (state.storage.percentStored = Math.min(v, 100) / 100), { max: 100 }))))
  );

  // 5 apps
  const appsCard = el("div", { class: "card" },
    el("h2", {}, "5. Apps"),
    el("p", { class: "hint" }, "Number of instances of each app (0 = not used). Databus is needed by every connector; Common Configurator by most. Hover a name for its source."));
  for (const cat of [...new Set(data.apps.map((a) => a.category))]) {
    const rows = el("tbody");
    data.apps.filter((a) => a.category === cat).forEach((a) => {
      rows.append(el("tr", { title: a.basis },
        el("td", {}, a.name),
        el("td", {}, evidenceChip({ cpu: a.confidence.cpu, ram: a.confidence.ramGb })),
        el("td", { class: "num" }, numInput(state.apps[a.name], (v) => (state.apps[a.name] = v)))));
    });
    appsCard.append(el("div", { class: "app-cat" }, cat), el("div", { class: "table-wrap" }, el("table", {}, rows)));
  }
  root.append(appsCard);

  // 6 hardware
  const hw = state.hardware;
  root.append(
    el("div", { class: "card" },
      el("h2", {}, "6. Security & hardware requirements"),
      el("p", { class: "hint" }, "Matched against each device. Software security (TLS, certificates, access control) is available on every device, so add firewall / IDS apps above if you need them sized."),
      toggle("TPM 2.0 / disk encryption", hw.tpm, (v) => (hw.tpm = v)),
      toggle("Secure boot", hw.secureBoot, (v) => (hw.secureBoot = v)),
      toggle("IEC 62443-4-2 certified device", hw.iec62443, (v) => (hw.iec62443 = v)),
      toggle("GPU acceleration (vision / AI)", hw.gpu, (v) => (hw.gpu = v)))
  );

  // actions
  const toast = el("span", { class: "toast", role: "status" });
  const say = (m) => { toast.textContent = m; setTimeout(() => (toast.textContent = ""), 3500); };
  root.append(
    el("div", { class: "actions" },
      el("button", { class: "btn primary", onclick: () => showTab("rec") }, "See recommendation →"),
      el("button", { class: "btn", onclick: () => { state = defaultRequirements(data); buildRequirements(); refresh(); say("Reset to the example install."); } }, "Reset to example"),
      el("button", {
        class: "btn",
        onclick: async () => {
          const url = `${location.origin}${location.pathname}#s=${encodeState(state)}`;
          try { await navigator.clipboard.writeText(url); say("Link copied - it contains your inputs."); }
          catch { location.hash = `s=${encodeState(state)}`; say("Link is now in the address bar."); }
        },
      }, "Copy link to these inputs"),
      toast)
  );
  refresh();
}

// ---------------------------------------------------------------- live refresh
function refresh() {
  const result = sizeInstall(state, data);
  // computed cells on the requirements page
  document.querySelectorAll("tr[data-conn]").forEach((tr) => {
    const row = result.need.connectorRows.find((r) => r.name === tr.dataset.conn);
    tr.querySelector("[data-pts]").textContent = fmt0(row.pts);
    const cell = tr.querySelector("[data-check]");
    cell.replaceChildren(row.check === "-" ? "" : chip(row.check, row.check.startsWith("EXCEEDS") ? "EXCEEDS" : "OK"));
  });
  const w = $("#wincc-fields");
  if (w) w.classList.toggle("disabled-block", !state.wincc.enabled);
  const s = $("#storage-fields");
  if (s) s.classList.toggle("disabled-block", !state.storage.local);
  $("#live-device").textContent = result.recommended
    ? displayName(result.recommended.device)
    : state.mode === "dps" ? "Neither DPS package fits" : "None fully meets requirements";
  if (!$("#page-rec").hidden) renderRecommendation(result);
}

// ---------------------------------------------------------------- Recommendation page
function confidenceBadge(need) {
  const worst = Math.max(need.estimateShare.cpu, need.estimateShare.ram);
  if (worst < 0.25) return { label: "High", cls: "PASS", text: "Most of the load is based on measured or documented figures." };
  if (worst < 0.6) return { label: "Medium", cls: "OK", text: `About ${Math.round(need.estimateShare.cpu * 100)}% of the CPU and ${Math.round(need.estimateShare.ram * 100)}% of the RAM requirement comes from estimated catalog values.` };
  return { label: "Low", cls: "EXCEEDS", text: `Most of the requirement (${Math.round(need.estimateShare.cpu * 100)}% of CPU, ${Math.round(need.estimateShare.ram * 100)}% of RAM) comes from estimated values - treat the result as a guide and verify on a test unit.` };
}

function renderRecommendation(pre) {
  const root = $("#page-rec");
  const res = pre || sizeInstall(state, data);
  const { need, rows, recommended, next, closest } = res;
  const head = data.assumptions.headroom.value;
  root.replaceChildren();

  // hero
  const conf = confidenceBadge(need);
  const dps = state.mode === "dps";
  const hero = el("div", { class: `card hero ${recommended ? "" : "none"}` });
  hero.append(el("div", { class: "mode-tag" }, `Install type: ${MODES[state.mode]}`));
  if (recommended) {
    hero.append(
      el("div", { class: "label" }, dps ? "Recommended DPS package" : "Recommended device (cheapest that meets every requirement)"),
      el("div", { class: "device" }, displayName(recommended.device)),
      el("div", { class: "sub" }, recommended.device.notes),
      el("p", { class: "sub" },
        next ? `Next option: ${displayName(next.device)}. ` : dps ? "The other DPS package does not meet every requirement. " : "No other device passes. ",
        `Confidence: `, chip(conf.label, conf.cls), ` ${conf.text}`));
  } else {
    hero.append(
      el("div", { class: "label" }, dps ? "Neither DPS package meets every requirement" : "No single device meets every requirement"),
      el("div", { class: "device" }, "None suitable"),
      el("p", { class: "sub" }, closest ? `Closest: ${displayName(closest.device)} – fails on ${closest.reasons.join(", ")}.` : ""),
      el("p", { class: "sub" }, dps
        ? "Check other Siemens Industrial Edge devices with a general install, or split the load across two DPS units."
        : "Consider splitting the load across two devices, reducing tags / apps, or using an Edge server / virtual device."),
      dps ? el("button", { class: "btn primary", onclick: () => { state.mode = "general"; buildRequirements(); renderRecommendation(); } }, "Check all Edge devices (general install)") : null);
  }
  const tiles = el("div", { class: "tiles" },
    tile("CPU", `${fmt(need.raw.cpu)} core-eq`, `${fmt(need.check.cpu)} with ${Math.round(head * 100)}% headroom`),
    tile("RAM", `${fmt(need.raw.ram, 1)} GB`, `${fmt(need.check.ram, 1)} GB reserved (Memory Limit Check)`),
    tile("Storage", `${fmt(need.raw.storage, 0)} GB`, `${fmt(need.check.storage, 0)} GB with headroom` + (need.dataStorage > 0 ? ` (${fmt(need.dataStorage, 1)} GB local history)` : "")),
    tile("Data rate", `${fmt0(need.derived.pts)} pts/s`, "total across connectors"),
    tile("Ethernet", `${need.derived.ports} ports`, need.derived.armBlockers > 0 ? `x86 only (${need.derived.armBlockers} item(s) not on ARM)` : "ARM compatible"));
  hero.append(tiles);
  if (need.warnings.length) {
    hero.append(el("div", { class: "callout warn" }, el("strong", {}, "Connector limits exceeded"), " (Siemens manuals) – one connector instance cannot carry this load; split across devices or reduce tags:",
      el("ul", {}, need.warnings.map((w) => el("li", {}, w)))));
  }
  root.append(hero);

  // device table
  const thead = el("thead", {}, el("tr", {},
    ["Device", "CPU", "RAM", "Storage", "Eth", "Rate", "Arch", "WinCC", "GPU", "TPM", "Boot", "IEC", "Overall"].map((h, i) => el("th", { class: i === 0 ? "" : "num" }, h))));
  const tb = el("tbody");
  rows.forEach((r) => {
    const c = r.checks;
    const cell = (k) => el("td", { class: "num" }, chip(c[k] === "n/a" ? "n/a" : c[k], c[k] === "n/a" ? "NA" : c[k]));
    const utilCell = (k, passKey) =>
      el("td", { class: "num" },
        chip(c[passKey], c[passKey]),
        el("div", { class: `bar ${r.util[k] > 1 ? "over" : ""}`, title: `${Math.round(r.util[k] * 100)}% of device capacity` }, el("i", { style: `width:${Math.min(r.util[k], 1) * 100}%` })),
        el("div", { class: "util" }, `${Math.round(r.util[k] * 100)}%`));
    tb.append(el("tr", { class: recommended && r === recommended ? "winner" : "" },
      el("td", {}, el("strong", {}, displayName(r.device)), r.reasons.length ? el("div", { class: "reasons" }, `Fails: ${r.reasons.join(", ")}`) : null),
      utilCell("cpu", "cpu"), utilCell("ram", "ram"), utilCell("storage", "storage"),
      cell("ethernet"), cell("dataRate"), cell("arch"), cell("wincc"), cell("gpu"), cell("tpm"), cell("secureBoot"), cell("iec62443"),
      el("td", { class: "num" }, chip(r.suitable ? "SUITABLE" : "NOT SUITABLE", r.suitable ? "SUITABLE" : "NOT"))));
  });
  root.append(
    el("div", { class: "card" },
      el("h2", {}, dps ? "DPS packages" : "All devices"),
      el("p", { class: "hint" }, `CPU and storage bars show the raw requirement against device capacity; RAM shows reserved memory against the memory available to apps. A PASS includes ${Math.round(head * 100)}% headroom. CPU capacity = cores × per-core performance index.`),
      el("div", { class: "table-wrap" }, el("table", {}, thead, tb))));

  // breakdown
  const bt = el("tbody");
  need.parts.forEach((p) => bt.append(el("tr", {},
    el("td", {}, p.group), el("td", {}, p.name), el("td", { class: "num" }, fmt(p.cpu, 3)), el("td", { class: "num" }, fmt(p.ram)), el("td", { class: "num" }, fmt(p.storage, 1)),
    el("td", {}, el("span", { class: `ev ev-${p.cpuConf}` }, p.cpuConf)))));
  if (need.dataStorage > 0) bt.append(el("tr", {}, el("td", {}, "Local data"), el("td", {}, "Time-series history"), el("td", { class: "num" }, "-"), el("td", { class: "num" }, "-"), el("td", { class: "num" }, fmt(need.dataStorage, 1)), el("td", {}, "")));
  bt.append(el("tr", {}, el("td", {}, el("strong", {}, "Total")), el("td", {}), el("td", { class: "num" }, el("strong", {}, fmt(need.raw.cpu, 3))), el("td", { class: "num" }, el("strong", {}, fmt(need.raw.ram))), el("td", { class: "num" }, el("strong", {}, fmt(need.raw.storage, 1))), el("td", {})));
  root.append(
    el("div", { class: "card" },
      el("details", {},
        el("summary", {}, "What drives these numbers"),
        el("div", { class: "table-wrap" }, el("table", {},
          el("thead", {}, el("tr", {}, ["Group", "Component", "CPU (core-eq)", "RAM (GB)", "Storage (GB)", "CPU evidence"].map((h, i) => el("th", { class: i > 1 && i < 5 ? "num" : "" }, h)))),
          bt)))));

  // actions
  root.append(el("div", { class: "actions" },
    el("button", { class: "btn", onclick: () => showTab("req") }, "← Edit requirements"),
    el("button", { class: "btn", onclick: () => window.print() }, "Print / save as PDF")));
}

const tile = (k, v, s) => el("div", { class: "tile" }, el("div", { class: "k" }, k), el("div", { class: "v" }, v), el("div", { class: "s" }, s));

// ---------------------------------------------------------------- boot
async function boot() {
  try {
    data = await loadData();
  } catch (e) {
    $("main").replaceChildren(el("div", { class: "card" }, el("h2", {}, "Could not load catalog data"), el("p", {}, String(e.message)),
      el("p", { class: "hint" }, "This page must be served over http(s) - for local testing run a static server in this folder (see README).")));
    return;
  }
  state = loadState();
  buildRequirements();
  $("#tab-req").addEventListener("click", () => showTab("req"));
  $("#tab-rec").addEventListener("click", () => showTab("rec"));
}
boot();
