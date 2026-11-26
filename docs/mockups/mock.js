// Shared sample data and chart drawing for the Accountable mockups.
// "Today" is 26 Nov 2026. Figures are computed from the same deal list, so every screen agrees.

const TODAY = new Date(2026, 10, 26);

const STAGES = [
  { key: "new", name: "New", color: "#CDD8DB", ink: "#4E6A75", p: 10 },
  { key: "qualified", name: "Qualified", color: "#0E7A9F", ink: "#0B6A8A", p: 25 },
  { key: "proposal", name: "Proposal", color: "#FFC145", ink: "#8A5A00", p: 50 },
  { key: "negotiation", name: "Negotiation", color: "#F78C6B", ink: "#B0472A", p: 75 },
  { key: "won", name: "Won", color: "#06D6A0", ink: "#037A5C", p: 100 },
  { key: "lost", name: "Lost", color: "#D33259", ink: "#C0264E", p: 0 },
];
const OPEN = ["new", "qualified", "proposal", "negotiation"];

const CONTACTS = {
  MK: "Marta Kowalski", JO: "James Okafor", AL: "Anna Lindqvist", RT: "Rosa Torres", DP: "Dev Patel",
  SN: "Sara Nguyen", PV: "Priya Varma", LB: "Liam Byrne", CW: "Chen Wei", HG: "Hannah Gray",
  TF: "Tom Fischer", EM: "Elena Moreno", NR: "Noah Reyes", OB: "Olivia Brooks", GS: "George Shaw",
};

// [name, organization, contact initials, stage, value, close date "YYYY-MM-DD"]
const DEALS = [
  ["Espresso machine lease", "Harbor Street Café", "MK", "new", 12500, "2027-01-15"],
  ["Gym towel supply", "Pinecrest Fitness", "JO", "new", 6800, "2027-02-20"],
  ["Classroom supplies 2027", "Oakridge Academy", "AL", "new", 9200, "2027-01-31"],
  ["Spa linen starter order", "Crescent Spa", "RT", "new", 4300, "2027-02-13"],
  ["Breakroom snacks", "Atlas Logistics", "DP", "new", 3900, "2027-01-10"],
  ["Bags and packaging", "Elm Row Boutique", "SN", "new", 7600, "2027-03-06"],
  ["Lobby furniture", "Greenleaf Co-working", "CW", "qualified", 22500, "2026-11-20"],
  ["Dental consumables", "Summit Dental Group", "PV", "qualified", 18900, "2026-12-18"],
  ["Bakery flour contract", "Maple & Rye Bakery", "LB", "qualified", 14200, "2027-01-12"],
  ["Produce crates", "Riverside Grocers", "EM", "qualified", 11300, "2027-01-29"],
  ["Cleaning supplies", "Bayview Medical", "HG", "qualified", 8700, "2027-01-08"],
  ["Kitchen smallwares", "Copper Kettle Diner", "TF", "qualified", 5400, "2026-12-22"],
  ["Guest room amenities", "Brightwell Hotels", "NR", "proposal", 36000, "2026-12-15"],
  ["Office chairs, phase 2", "Northwind Office Park", "GS", "proposal", 27400, "2026-12-10"],
  ["Display shelving", "Elm Row Boutique", "SN", "proposal", 15600, "2027-01-19"],
  ["Cafeteria trays", "Lakeside Primary School", "OB", "proposal", 9800, "2026-11-14"],
  ["Protein bar restock", "Pinecrest Fitness", "JO", "proposal", 4900, "2026-12-05"],
  ["Banquet linen contract", "Brightwell Hotels", "NR", "negotiation", 39500, "2026-12-18"],
  ["Freezer units", "Riverside Grocers", "EM", "negotiation", 28700, "2026-12-12"],
  ["Annual coffee beans", "Harbor Street Café", "MK", "negotiation", 21800, "2026-12-03"],
  ["Exam gloves and masks", "Bayview Medical", "HG", "negotiation", 16200, "2026-11-21"],
  ["Treatment room towels", "Crescent Spa", "RT", "negotiation", 7300, "2026-11-30"],
  ["Conference room supplies", "Atlas Logistics", "DP", "won", 24500, "2026-11-17"],
  ["Holiday gift boxes", "Summit Dental Group", "PV", "won", 12800, "2026-10-29"],
  ["Bulk napkins", "Copper Kettle Diner", "TF", "lost", 8900, "2026-11-04", "Went with a cheaper supplier"],
].map(([name, org, who, stage, value, close, lostReason]) => {
  const d = new Date(close + "T00:00:00");
  const p = STAGES.find((s) => s.key === stage).p;
  return { name, org, who, contact: CONTACTS[who], stage, value, p, close: d, lostReason,
    late: OPEN.includes(stage) && d < TODAY };
});

const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const MONTHS_LONG = ["Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026",
  "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"];
const REVENUE = [18400, 0, 22100, 9800, 41500, 14200, 27600, 35900, 0, 31200, 12800, 24500];
const WON = [1, 0, 1, 1, 2, 1, 1, 2, 0, 1, 1, 1];
const LOST = [0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1];

// Value that reached each stage, deals created in the last 12 months
const FUNNEL = [
  { key: "new", deals: 40, value: 644900 },
  { key: "qualified", deals: 33, value: 583200 },
  { key: "proposal", deals: 26, value: 486600 },
  { key: "negotiation", deals: 19, value: 372800 },
  { key: "won", deals: 12, value: 238000 },
];

const FOLLOW_UPS = [
  { text: "Send revised quote for guest room amenities", on: "Guest room amenities", kind: "deal", date: "19 Nov 2026", overdue: true },
  { text: "Confirm new delivery date for trays", on: "Olivia Brooks", kind: "contact", date: "21 Nov 2026", overdue: true },
  { text: "Ask how the coffee samples went", on: "Marta Kowalski", kind: "contact", date: "24 Nov 2026", overdue: true },
  { text: "Confirm freezer delivery window", on: "Freezer units", kind: "deal", date: "27 Nov 2026" },
  { text: "Go through contract terms with Marta", on: "Annual coffee beans", kind: "deal", date: "1 Dec 2026" },
  { text: "Book a tasting visit at the bakery", on: "Liam Byrne", kind: "contact", date: "3 Dec 2026" },
  { text: "Send gym towel samples", on: "Gym towel supply", kind: "deal", date: "8 Dec 2026" },
];

const RECENT = [
  { type: "stage", text: "Moved from Proposal to Negotiation", on: "Freezer units", when: "Today, 10:42" },
  { type: "call", text: "Talked through a volume discount on linen", on: "Banquet linen contract", when: "Today, 09:15" },
  { type: "email", text: "Sent the 2027 catalogue", on: "Anna Lindqvist", when: "Yesterday, 16:20" },
  { type: "note", text: "Prefers deliveries before 8am", on: "Tom Fischer", when: "Yesterday, 11:05" },
  { type: "stage", text: "Moved from Negotiation to Won", on: "Conference room supplies", when: "17 Nov 2026, 14:30" },
  { type: "call", text: "Checked on lobby furniture budget", on: "Chen Wei", when: "16 Nov 2026, 10:00" },
  { type: "stage", text: "Moved from Proposal to Lost: Went with a cheaper supplier", on: "Bulk napkins", when: "4 Nov 2026, 15:12" },
];

// ---------- Figures ----------
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const openDeals = DEALS.filter((d) => OPEN.includes(d.stage));
const FIG = {
  revenue12: sum(REVENUE),
  won12: sum(WON),
  lost12: sum(LOST),
  openValue: sum(openDeals, (d) => d.value),
  openExpected: sum(openDeals, (d) => (d.value * d.p) / 100),
  openCount: openDeals.length,
  lateCount: openDeals.filter((d) => d.late).length,
};
FIG.winRate = Math.round((FIG.won12 / (FIG.won12 + FIG.lost12)) * 100);
const byStage = (key) => DEALS.filter((d) => d.stage === key);
const stageTotals = (key) => {
  const ds = byStage(key);
  return { count: ds.length, value: sum(ds, (d) => d.value), expected: sum(ds, (d) => (d.value * d.p) / 100) };
};

// ---------- Formatting ----------
const usd = (n) => "US$" + Math.round(n).toLocaleString("en-US");
const usdShort = (n) => {
  if (n >= 1e6) return "US$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return "US$" + (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return "US$" + n;
};
const dateShort = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const stage = (key) => STAGES.find((s) => s.key === key);

// ---------- Tooltip ----------
const tip = document.createElement("div");
tip.className = "tip";
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
function bindTip(el, html) {
  el.addEventListener("mousemove", (e) => {
    tip.innerHTML = typeof html === "function" ? html(e) : html;
    tip.style.opacity = 1;
    tip.style.left = e.clientX + 14 + "px";
    tip.style.top = e.clientY + 14 + "px";
  });
  el.addEventListener("mouseleave", () => (tip.style.opacity = 0));
}

// ---------- SVG helpers ----------
const NS = "http://www.w3.org/2000/svg";
function svg(el, h) {
  const w = el.clientWidth;
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("width", w);
  s.setAttribute("height", h);
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("role", "img");
  el.appendChild(s);
  return [s, w];
}
function node(parent, tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  parent.appendChild(n);
  return n;
}
// Bar path with 4px rounded top, square at the baseline
function barPath(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return v;
}

// ---------- Charts ----------

// Revenue won per month: line with a soft area, gridlines, crosshair tooltip.
function lineChart(el, { height = 240, values = REVENUE, labels = MONTHS, longLabels = MONTHS_LONG, area = true, pad = {} } = {}) {
  const [s, w] = svg(el, height);
  s.setAttribute("aria-label", `Revenue won per month. ${usdShort(values[0])} in ${longLabels[0]}, ${usdShort(values.at(-1))} in ${longLabels.at(-1)}.`);
  const P = { l: 64, r: 16, t: 12, b: 28, ...pad };
  const max = niceMax(Math.max(...values) * 1.1);
  const x = (i) => P.l + (i * (w - P.l - P.r)) / (values.length - 1);
  const y = (v) => P.t + (1 - v / max) * (height - P.t - P.b);
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    node(s, "line", { x1: P.l, x2: w - P.r, y1: y(v), y2: y(v), stroke: "#E3EAEC" });
    node(s, "text", { x: P.l - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-num" }, usdShort(v));
  }
  labels.forEach((m, i) => node(s, "text", { x: x(i), y: height - 8, "text-anchor": "middle", class: "axis-label" }, m));
  const id = "g" + Math.random().toString(36).slice(2);
  const defs = node(s, "defs", {});
  const g = node(defs, "linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  node(g, "stop", { offset: "0%", "stop-color": "#06D6A0", "stop-opacity": 0.25 });
  node(g, "stop", { offset: "100%", "stop-color": "#06D6A0", "stop-opacity": 0 });
  const pts = values.map((v, i) => [x(i), y(v)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join("");
  if (area) node(s, "path", { d: d + `L${x(values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: `url(#${id})` });
  node(s, "path", { d, fill: "none", stroke: "#06B888", "stroke-width": 2, "stroke-linejoin": "round" });
  const last = pts.at(-1);
  node(s, "circle", { cx: last[0], cy: last[1], r: 4.5, fill: "#06B888", stroke: "#fff", "stroke-width": 2 });
  const peak = values.indexOf(Math.max(...values));
  const nearEdge = pts[peak][0] > w - P.r - 40;
  node(s, "text", { x: pts[peak][0] - (nearEdge ? 8 : 0), y: pts[peak][1] - 10, "text-anchor": nearEdge ? "end" : "middle", class: "chart-num" }, usdShort(values[peak]));
  // crosshair
  const cross = node(s, "line", { y1: P.t, y2: height - P.b, stroke: "#4E6A75", "stroke-dasharray": "3 3", opacity: 0 });
  const dot = node(s, "circle", { r: 5, fill: "#06B888", stroke: "#fff", "stroke-width": 2, opacity: 0 });
  const hit = node(s, "rect", { x: P.l, y: 0, width: w - P.l - P.r, height, fill: "transparent" });
  bindTip(hit, (e) => {
    const r = s.getBoundingClientRect();
    const i = Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left - P.l) / (w - P.l - P.r)) * (values.length - 1))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
    dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(values[i])); dot.setAttribute("opacity", 1);
    return `${longLabels[i]}<br><b>${usd(values[i])}</b> won · ${WON[i]} ${WON[i] === 1 ? "deal" : "deals"}`;
  });
  hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); });
}

// Deals won and lost per month, grouped bars.
function wonLostBars(el, { height = 220 } = {}) {
  const [s, w] = svg(el, height);
  s.setAttribute("aria-label", `Deals won and lost per month. ${FIG.won12} won and ${FIG.lost12} lost in 12 months.`);
  const P = { l: 28, r: 8, t: 12, b: 28 };
  const max = 3;
  const band = (w - P.l - P.r) / 12;
  const bw = Math.min(14, (band - 10) / 2);
  const y = (v) => P.t + (1 - v / max) * (height - P.t - P.b);
  for (let k = 0; k <= max; k++) {
    node(s, "line", { x1: P.l, x2: w - P.r, y1: y(k), y2: y(k), stroke: "#E3EAEC" });
    node(s, "text", { x: P.l - 8, y: y(k) + 4, "text-anchor": "end", class: "axis-num" }, k);
  }
  MONTHS.forEach((m, i) => {
    const cx = P.l + band * i + band / 2;
    node(s, "text", { x: cx, y: height - 8, "text-anchor": "middle", class: "axis-label" }, m);
    [[WON[i], "#06D6A0", -1], [LOST[i], "#F78C6B", 1]].forEach(([v, c, side]) => {
      const bx = side < 0 ? cx - bw - 1 : cx + 1;
      node(s, "path", { d: barPath(bx, y(v), bw, y(0) - y(v)), fill: c });
    });
    const hit = node(s, "rect", { x: cx - band / 2, y: P.t, width: band, height: height - P.t - P.b, fill: "transparent" });
    bindTip(hit, `${MONTHS_LONG[i]}<br><b>${WON[i]}</b> won · <b>${LOST[i]}</b> lost`);
  });
}

// Revenue won per month as bars (used where the line chart shows something else).
function revenueBars(el, { height = 200, color = "#06D6A0" } = {}) {
  const [s, w] = svg(el, height);
  s.setAttribute("aria-label", "Revenue won per month as bars.");
  const P = { l: 64, r: 8, t: 18, b: 28 };
  const max = niceMax(Math.max(...REVENUE) * 1.1);
  const band = (w - P.l - P.r) / 12;
  const bw = Math.min(28, band - 10);
  const y = (v) => P.t + (1 - v / max) * (height - P.t - P.b);
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    node(s, "line", { x1: P.l, x2: w - P.r, y1: y(v), y2: y(v), stroke: "#E3EAEC" });
    node(s, "text", { x: P.l - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-num" }, usdShort(v));
  }
  REVENUE.forEach((v, i) => {
    const cx = P.l + band * i + band / 2;
    node(s, "text", { x: cx, y: height - 8, "text-anchor": "middle", class: "axis-label" }, MONTHS[i]);
    node(s, "path", { d: barPath(cx - bw / 2, y(v), bw, y(0) - y(v)), fill: color });
    const hit = node(s, "rect", { x: cx - band / 2, y: P.t, width: band, height: height - P.t - P.b, fill: "transparent" });
    bindTip(hit, `${MONTHS_LONG[i]}<br><b>${usd(v)}</b> won`);
  });
}

// Funnel as horizontal bars, one per stage, with value and deal count labels.
function funnelBars(el, { rowH = 34, gap = 10, centered = false } = {}) {
  const height = FUNNEL.length * (rowH + gap) - gap;
  const [s, w] = svg(el, height);
  s.setAttribute("aria-label", `Sales funnel. ${usdShort(FUNNEL[0].value)} entered New and ${usdShort(FUNNEL.at(-1).value)} reached Won.`);
  const labelW = 92, numW = 150;
  const max = FUNNEL[0].value;
  const track = w - labelW - numW;
  FUNNEL.forEach((f, i) => {
    const st = stage(f.key);
    const y = i * (rowH + gap);
    const bw = Math.max(6, (f.value / max) * track);
    const x = centered ? labelW + (track - bw) / 2 : labelW;
    node(s, "text", { x: 0, y: y + rowH / 2 + 4, class: "chart-label" }, st.name);
    node(s, "rect", { x, y, width: bw, height: rowH, rx: 6, fill: st.color });
    node(s, "text", { x: w, y: y + rowH / 2 - 2, "text-anchor": "end", class: "chart-num" }, usdShort(f.value));
    const conv = i ? Math.round((f.value / FUNNEL[i - 1].value) * 100) + "% of value kept" : "all deals";
    node(s, "text", { x: w, y: y + rowH / 2 + 12, "text-anchor": "end", class: "axis-label", style: "font-size:11px" }, `${f.deals} deals · ${conv}`);
    const hit = node(s, "rect", { x: 0, y, width: w, height: rowH, fill: "transparent" });
    bindTip(hit, `${st.name}<br><b>${usd(f.value)}</b> across ${f.deals} deals`);
  });
}

// Tapered funnel: stacked trapezoids, labels to the right.
function funnelTaper(el, { height = 250 } = {}) {
  const [s, w] = svg(el, height);
  s.setAttribute("aria-label", `Sales funnel. ${usdShort(FUNNEL[0].value)} entered New and ${usdShort(FUNNEL.at(-1).value)} reached Won.`);
  const shapeW = Math.min(220, w * 0.5);
  const rowH = (height - (FUNNEL.length - 1) * 3) / FUNNEL.length;
  const max = FUNNEL[0].value;
  FUNNEL.forEach((f, i) => {
    const st = stage(f.key);
    const top = (f.value / max) * shapeW;
    const bot = ((FUNNEL[i + 1]?.value ?? f.value * 0.85) / max) * shapeW;
    const y = i * (rowH + 3);
    const cx = shapeW / 2;
    node(s, "path", { d: `M${cx - top / 2},${y}H${cx + top / 2}L${cx + bot / 2},${y + rowH}H${cx - bot / 2}Z`, fill: st.color });
    node(s, "text", { x: shapeW + 16, y: y + rowH / 2 - 3, class: "chart-label" }, st.name);
    node(s, "text", { x: shapeW + 16, y: y + rowH / 2 + 13, class: "chart-num", style: "fill:#4E6A75" }, `${usdShort(f.value)} · ${f.deals} deals`);
    const hit = node(s, "rect", { x: 0, y, width: w, height: rowH, fill: "transparent" });
    bindTip(hit, `${st.name}<br><b>${usd(f.value)}</b> across ${f.deals} deals`);
  });
}

// One horizontal bar split by open stage, with direct labels under each segment.
function stageStrip(el, { height = 18, labels = true } = {}) {
  const [s, w] = svg(el, height + (labels ? 44 : 0));
  s.setAttribute("aria-label", `Open pipeline by stage, ${usd(FIG.openValue)} in total.`);
  let x = 0, labelEnd = -Infinity;
  OPEN.forEach((k, i) => {
    const t = stageTotals(k);
    const st = stage(k);
    const sw = (t.value / FIG.openValue) * w - (i < OPEN.length - 1 ? 2 : 0);
    const r = 6;
    const d = i === 0
      ? `M${x + r},0H${x + sw}V${height}H${x + r}Q${x},${height} ${x},${height - r}V${r}Q${x},0 ${x + r},0Z`
      : i === OPEN.length - 1
        ? `M${x},0H${x + sw - r}Q${x + sw},0 ${x + sw},${r}V${height - r}Q${x + sw},${height} ${x + sw - r},${height}H${x}Z`
        : `M${x},0H${x + sw}V${height}H${x}Z`;
    const p = node(s, "path", { d, fill: st.color });
    bindTip(p, `${st.name}<br><b>${usd(t.value)}</b> · ${t.count} deals<br>Expected ${usd(t.expected)}`);
    if (labels) {
      // Keep labels from running into the previous segment's label
      const lx = Math.max(x, labelEnd + 12);
      const a = node(s, "text", { x: lx, y: height + 18, class: "chart-label" }, st.name);
      const b = node(s, "text", { x: lx, y: height + 36, class: "chart-num", style: "fill:#4E6A75" }, usdShort(t.value));
      labelEnd = lx + Math.max(a.getComputedTextLength(), b.getComputedTextLength());
    }
    x += sw + 2;
  });
}

// Open pipeline by stage as horizontal bars: value with the expected part darker.
function stageBars(el, { rowH = 26, gap = 14 } = {}) {
  const height = OPEN.length * (rowH + gap) - gap;
  const [s, w] = svg(el, height + Math.max(0, 18 - rowH / 2));
  s.setAttribute("aria-label", "Open pipeline by stage, value and expected revenue.");
  const labelW = 92, numW = 150;
  const max = Math.max(...OPEN.map((k) => stageTotals(k).value));
  OPEN.forEach((k, i) => {
    const t = stageTotals(k);
    const st = stage(k);
    const y = i * (rowH + gap);
    const track = w - labelW - numW;
    const vw = (t.value / max) * track;
    const ew = (t.expected / max) * track;
    node(s, "text", { x: 0, y: y + rowH / 2 + 4, class: "chart-label" }, st.name);
    node(s, "rect", { x: labelW, y, width: vw, height: rowH, rx: 4, fill: st.color, opacity: 0.35 });
    node(s, "rect", { x: labelW, y, width: ew, height: rowH, rx: 4, fill: st.color });
    node(s, "text", { x: w, y: y + rowH / 2 - 2, "text-anchor": "end", class: "chart-num" }, usd(t.value));
    node(s, "text", { x: w, y: y + rowH / 2 + 12, "text-anchor": "end", class: "axis-label", style: "font-size:11px" }, `expected ${usdShort(t.expected)}`);
    const hit = node(s, "rect", { x: 0, y, width: w, height: rowH, fill: "transparent" });
    bindTip(hit, `${st.name} · ${t.count} deals<br>Value <b>${usd(t.value)}</b><br>Expected <b>${usd(t.expected)}</b>`);
  });
}

function sparkline(el, values, { height = 36, color = "#06B888", bars = false } = {}) {
  const [s, w] = svg(el, height);
  s.setAttribute("aria-hidden", "true");
  const max = Math.max(...values) || 1;
  if (bars) {
    const band = w / values.length;
    values.forEach((v, i) => {
      const h = Math.max(2, (v / max) * (height - 2));
      node(s, "path", { d: barPath(i * band + 1, height - h, band - 3, h, 2), fill: color });
    });
    return;
  }
  const x = (i) => 2 + (i * (w - 4)) / (values.length - 1);
  const y = (v) => 3 + (1 - v / max) * (height - 6);
  node(s, "path", { d: values.map((v, i) => (i ? "L" : "M") + x(i) + "," + y(v)).join(""), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round" });
  node(s, "circle", { cx: x(values.length - 1), cy: y(values.at(-1)), r: 3, fill: color });
}

// ---------- Shared bits of markup ----------
const ICONS = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  orgs: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  contacts: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3"/>',
  deals: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  pipeline: '<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  stage: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
};
const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const ACT_STYLE = {
  note: { bg: "rgb(255 193 69 / 0.22)", fg: "#8A5A00" },
  call: { bg: "rgb(6 214 160 / 0.2)", fg: "#037A5C" },
  email: { bg: "rgb(14 122 159 / 0.14)", fg: "#0B6A8A" },
  stage: { bg: "rgb(7 59 76 / 0.08)", fg: "#073B4C" },
};

const NAV = [
  ["dashboard", "Dashboard"], ["orgs", "Organizations"], ["contacts", "Contacts"], ["deals", "Deals"], ["pipeline", "Pipeline"],
];

function ready(fn) {
  const go = () => (document.fonts ? document.fonts.ready.then(fn) : fn());
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
}

const LOGO = `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#06D6A0"/><path d="M9 23 16 8l7 15M11.8 17.5h8.4" fill="none" stroke="#073B4C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PAGES = { dashboard: "dashboard.html", pipeline: "pipeline.html" };

// Brand mark plus the five sections. Each mockup styles .nav-item and .brand its own way.
function sideNav(active, prefix = "") {
  return `<a class="brand">${LOGO}<span>Accountable</span></a>
    <div class="nav">${NAV.map(([k, label]) => {
      const href = PAGES[k] ? `href="${prefix}${PAGES[k]}"` : "";
      return `<a class="nav-item ${k === active ? "active" : ""}" ${href}>${icon(k)}<span>${label}</span></a>`;
    }).join("")}</div>`;
}
