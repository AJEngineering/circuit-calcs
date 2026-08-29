#!/usr/bin/env node
/* Tests for calc.html.
 *
 *   node test.js
 *
 * No dependencies and nothing to install, because the thing being tested has
 * none either. The page's script is pulled out of the HTML and run in a vm
 * with just enough of a DOM under it to reach the end without throwing; the
 * checks then work on the pure parts — the calculators' run() functions, the
 * diagram builders, and the reference tables, all of which return values or
 * strings and touch nothing.
 *
 * Most of what is in here was written after something was found by hand. The
 * drawing checks in particular exist because six faults went unnoticed for
 * months: a load box sitting on top of an amplifier, a return wire running
 * through the ADC, an amplifier input landing outside its own box. None of
 * them were visible in a glance at the page; all of them are obvious to a
 * measurement.
 */

"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ------------------------------------------------------------------ report */
let passed = 0;
const failures = [];
let group = "";

const section = name => { group = name; console.log("\n" + name); };
const ok = msg => { passed++; console.log("  · " + msg); };
const bad = (msg, detail) => {
  failures.push({ group, msg, detail });
  console.log("  ✗ " + msg + (detail ? "\n      " + String(detail).replace(/\n/g, "\n      ") : ""));
};
const check = (cond, msg, detail) => cond ? ok(msg) : bad(msg, detail);

/* ------------------------------------------------------- load the page's JS */
const HTML = fs.readFileSync(path.join(__dirname, "calc.html"), "utf8");
const m = HTML.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("no <script> block in calc.html"); process.exit(1); }

/* A DOM only deep enough that the bootstrap at the end of the script runs to
   completion. Everything the tests use is computed, not rendered.          */
const noop = () => {};
const stubEl = {
  style: {}, dataset: {}, hidden: false, value: "", textContent: "", className: "",
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, appendChild: noop,
  setAttribute: noop, getAttribute: () => null, scrollIntoView: noop, focus: noop,
  querySelector: () => null, querySelectorAll: () => [],
  get innerHTML() { return ""; }, set innerHTML(_) {}
};
const store = {};
const sandbox = {
  console,
  document: {
    addEventListener: noop, createElement: () => Object.create(stubEl),
    querySelector: () => Object.create(stubEl), querySelectorAll: () => [],
    getElementById: () => Object.create(stubEl),
    body: stubEl, documentElement: stubEl
  },
  window: { addEventListener: noop, scrollTo: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) },
  location: { hash: "", href: "http://localhost/calc.html" },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  navigator: { userAgent: "node", clipboard: { writeText: () => Promise.resolve() } },
  setTimeout, clearTimeout, requestAnimationFrame: cb => cb(0),
  Blob: function () {}, URL: { createObjectURL: () => "", revokeObjectURL: noop }
};
sandbox.window.location = sandbox.location;
sandbox.globalThis = sandbox;

/* Top-level const bindings live in the script's own scope and never reach the
   sandbox object, so the script is asked on its way out to hand them over. */
const EXPORTS = ["CALCS", "TABLES", "DIAGRAMS", "ui", "calcById", "tableById", "calcSeed",
                 "calcRun", "siFmt", "parseSI", "indCode", "capCode", "noteHTML",
                 "E6_M", "E24_M", "ELEC_DEC", "SMD_SIZES", "APP_VERSION"];
const source = m[1] + "\n;globalThis.__api = {" + EXPORTS.join(", ") + "};";

let api;
try {
  vm.runInNewContext(source, sandbox, { filename: "calc.html", timeout: 20000 });
  api = sandbox.__api;
} catch (err) {
  console.error("the page's script threw while loading:\n" + (err.stack || err));
  process.exit(1);
}
const { CALCS, TABLES, DIAGRAMS, ui, calcSeed, calcRun, indCode, capCode, SMD_SIZES, APP_VERSION } = api;

/* ------------------------------------------------------------ svg geometry */
/* The diagrams are strings, so they are read as strings. A monospace glyph is
   about 0.6 of the font size across; the tolerance below keeps that estimate
   from inventing failures on a label that only just touches something.     */
const GLYPH = 0.6;
const SLACK = 2.5;
/* A label sitting on the wire it names is the fault this catches, and there
   the baseline and the wire are the same number — so the text box has to be
   measured tightly and judged with almost no tolerance. */
const TEXT_SLACK = 1;
/* Two labels have to be apart, not merely not overlapping. */
const TEXT_GAP = 3;
const ASCENT = 0.78, DESCENT = 0.22;

function parseSVG(svg) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const out = { w: vb ? +vb[1] : 0, h: vb ? +vb[2] : 0, boxes: [], segs: [], texts: [] };

  for (const r of svg.matchAll(/<rect class="diagram-part"[^>]*?x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g))
    out.boxes.push({ x: +r[1], y: +r[2], w: +r[3], h: +r[4] });

  for (const p of svg.matchAll(/<polyline class="diagram-wire[^"]*" points="([^"]+)"/g)) {
    const pts = p[1].trim().split(/\s+/).map(q => q.split(",").map(Number));
    for (let i = 0; i < pts.length - 1; i++)
      out.segs.push({ x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] });
  }
  for (const l of svg.matchAll(/<line class="diagram-wire"[^>]*x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g))
    out.segs.push({ x1: +l[1], y1: +l[2], x2: +l[3], y2: +l[4] });

  for (const t of svg.matchAll(/<text class="diagram-text[^"]*" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)"[^>]*?font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)) {
    const body = t[5].replace(/&[a-z]+;/g, "x").trim();
    if (!body) continue;
    const size = +t[4], w = body.length * size * GLYPH, anchor = t[3];
    const x = anchor === "middle" ? +t[1] - w / 2 : anchor === "end" ? +t[1] - w : +t[1];
    out.texts.push({ text: body, x, y: +t[2] - size * ASCENT, w, h: size * (ASCENT + DESCENT), size });
  }
  return out;
}

const overlaps = (a, b, slack) =>
  a.x + a.w - slack > b.x && b.x + b.w - slack > a.x &&
  a.y + a.h - slack > b.y && b.y + b.h - slack > a.y;

/* Overlapping a box is not the fault; going in one side and out the other is.
   A diode's own leads live inside its outline, and a wire is allowed to reach
   a box's edge and stop. What must never happen is a wire passing straight
   through — that is how the rectifier's return ran across the ADC. */
function segCrossesBox(s, b, slack) {
  const lx = Math.min(s.x1, s.x2), hx = Math.max(s.x1, s.x2);
  const ly = Math.min(s.y1, s.y2), hy = Math.max(s.y1, s.y2);
  const spansX = lx < b.x - slack && hx > b.x + b.w + slack;
  const spansY = ly < b.y - slack && hy > b.y + b.h + slack;
  const insideX = lx < b.x + b.w - slack && b.x + slack < hx;
  const insideY = ly < b.y + b.h - slack && b.y + slack < hy;
  return (spansX && insideY) || (spansY && insideX);
}

/* Text is a different matter: a label only has to touch a wire to be unreadable. */
function segTouchesText(s, t, slack) {
  const lx = Math.min(s.x1, s.x2), hx = Math.max(s.x1, s.x2);
  const ly = Math.min(s.y1, s.y2), hy = Math.max(s.y1, s.y2);
  return lx < t.x + t.w - slack && t.x + slack < hx &&
         ly < t.y + t.h - slack && t.y + slack < hy;
}

/* --------------------------------------------------------------- the checks */

section("The page loads");
check(typeof APP_VERSION === "string" && /^\d+\.\d+\.\d+$/.test(APP_VERSION),
  "version is set: " + APP_VERSION);
check(Array.isArray(CALCS) && CALCS.length > 0, CALCS.length + " calculators defined");
check(Array.isArray(TABLES) && TABLES.length > 0, TABLES.length + " reference sections defined");
{
  const seen = new Set(), dup = [];
  CALCS.forEach(c => { if (seen.has(c.id)) dup.push(c.id); seen.add(c.id); });
  check(dup.length === 0, "calculator ids are unique", dup.join(", "));
}
{
  const seen = new Set(), dup = [];
  TABLES.forEach(t => { if (seen.has(t.id)) dup.push(t.id); seen.add(t.id); });
  check(dup.length === 0, "table ids are unique", dup.join(", "));
}
{
  const dead = [];
  CALCS.forEach(c => [].concat(c.tbl || []).forEach(id => {
    if (!TABLES.some(t => t.id === id)) dead.push(c.id + " → " + id);
  }));
  check(dead.length === 0, "every table pointer resolves", dead.join(", "));
}

section("Every calculator answers its own defaults");
{
  const empty = [], nan = [], unlabelled = [];
  for (const c of CALCS) {
    calcSeed(c);
    const rows = calcRun(c);
    if (!Array.isArray(rows) || rows.length === 0) { empty.push(c.id); continue; }
    for (const r of rows) {
      if (!r || !r.label) unlabelled.push(c.id);
      if (typeof r.value === "number" && !Number.isFinite(r.value)) nan.push(c.id + ": " + r.label);
    }
  }
  check(empty.length === 0, "all " + CALCS.length + " return rows from their placeholder values", empty.join(", "));
  check(unlabelled.length === 0, "every row carries a label", unlabelled.join(", "));
  check(nan.length === 0, "no row comes out NaN or infinite", nan.join("\n"));
}

section("Every calculator says how it got there");
{
  /* A percentage floor would let a relation be deleted without anyone
     noticing, so the rows that legitimately carry none are named instead.
     Each is a value you entered, a lookup, a verdict in prose, or the same
     number in another unit. If a row is added that genuinely needs no
     relation, put it here — and if one disappears from this list without a
     relation replacing it, that is the failure worth having. */
  const ALLOWED_BARE = {
    ohm:       ["Voltage", "Current"],                  /* whichever two you typed */
    led:       ["Nearest E24"],                         /* a lookup */
    rcolor:    ["Value", "Bands", "Tolerance"],         /* read off the bands */
    netcombo:  ["Parts", "Largest", "Smallest"],        /* said by their own names */
    adc:       ["Input-referred noise (RMS)"],          /* entered */
    tempsense: ["Sensor temperature (entered)"]         /* entered */
  };
  let rows = 0, withNote = 0;
  const unexpected = [];
  for (const c of CALCS) {
    calcSeed(c);
    const allowed = ALLOWED_BARE[c.id] || [];
    for (const r of (calcRun(c) || [])) {
      rows++;
      if (r.note) withNote++;
      else if (!allowed.includes(r.label)) unexpected.push(c.id + ": " + r.label);
    }
  }
  check(unexpected.length === 0,
    withNote + " of " + rows + " rows carry a relation, and the rest are the ones that should not",
    unexpected.join("\n"));
}

/* A calculator that offers topologies draws a different circuit for each, and
   checking only the one it opens on is how a high-side shunt kept a load box
   sitting on its amplifier. Every option of every dropdown is drawn — one at
   a time, the rest left at their defaults, so the list stays linear. */
function variants(c) {
  const out = [{ label: "default", vals: {} }];
  for (const f of (c.fields || [])) {
    if (f.t !== "sel" || !Array.isArray(f.opts)) continue;
    for (const opt of f.opts) out.push({ label: f.k + " = " + opt, vals: { [f.k]: opt } });
  }
  return out;
}

section("Nothing in a drawing sits on anything else");
{
  const boxHits = [], wireHits = [], textHits = [], escapes = [], collisions = [];
  let drawn = 0;
  for (const c of CALCS) {
    if (!DIAGRAMS[c.id]) continue;
    calcSeed(c);
    const base = Object.assign({}, ui.calcVals[c.id]);
    for (const variant of variants(c)) {
    ui.calcVals[c.id] = Object.assign({}, base, variant.vals);
    const where = c.id + (variant.label === "default" ? "" : " [" + variant.label + "]");
    drawn++;
    let svg;
    try { svg = DIAGRAMS[c.id](ui.calcVals[c.id] || {}, calcRun(c)); }
    catch (e) { bad("diagram " + where + " threw", e.message); continue; }
    const g = parseSVG(svg);

    for (let i = 0; i < g.boxes.length; i++)
      for (let j = i + 1; j < g.boxes.length; j++)
        if (overlaps(g.boxes[i], g.boxes[j], 0))
          boxHits.push(where + ": two parts overlap");

    for (const s of g.segs)
      for (const b of g.boxes)
        if (segCrossesBox(s, b, 1)) wireHits.push(where + ": a wire runs through a part");

    for (const t of g.texts) {
      for (const s of g.segs)
        if (segTouchesText(s, t, TEXT_SLACK)) textHits.push(where + ': "' + t.text + '" is crossed by a wire');
      if (t.x + t.w > g.w + SLACK || t.x < -SLACK || t.y + t.h > g.h + SLACK)
        escapes.push(where + ': "' + t.text + '" runs off the canvas');
    }
    /* Two labels printed over one another read as one word: a node called
       "signal" beside its value made signal12V. Overlapping at all is a
       fault. Merely touching is a fault too, but only side by side, where
       "12V" and "5.6 kΩ" a pixel apart read as one run — a value sitting
       directly under its own label is the house style and is meant to be
       close, so a stack is judged on overlap alone. */
    for (let i = 0; i < g.texts.length; i++)
      for (let j = i + 1; j < g.texts.length; j++) {
        const a = g.texts[i], b = g.texts[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        const sideBySide = gapY < 0 && gapX >= 0 && gapX < TEXT_GAP;
        if (Math.max(gapX, gapY) < 0)
          collisions.push(where + ': "' + a.text + '" and "' + b.text + '" overlap');
        else if (sideBySide)
          collisions.push(where + ': "' + a.text + '" and "' + b.text + '" run together');
      }
    }
    ui.calcVals[c.id] = base;
  }
  const uniq = a => [...new Set(a)];
  check(boxHits.length === 0, "no two parts overlap, over " + drawn + " drawings", uniq(boxHits).join("\n"));
  check(wireHits.length === 0, "no wire runs through a part", uniq(wireHits).join("\n"));
  check(textHits.length === 0, "no label is crossed by a wire", uniq(textHits).join("\n"));
  check(escapes.length === 0, "no text runs off the canvas", uniq(escapes).join("\n"));
  check(collisions.length === 0, "no two labels are printed over one another", uniq(collisions).join("\n"));
}

section("Every reference section renders");
{
  const broken = [], headless = [], loose = [];
  for (const t of TABLES) {
    let html;
    try { html = t.html(); } catch (e) { broken.push(t.id + ": " + e.message); continue; }
    if (!html || !/<h2>/.test(html)) headless.push(t.id);
    /* A table of five columns or more has to be able to scroll, or its last
       columns are unreachable on a narrow screen — which is how the chip
       resistor table lost its two right-hand columns. Four columns and under
       fit, and those sit two-up in a grid that collapses on a phone.
       Whether a table is inside a scroller needs the div nesting followed,
       not a count of tags: the grids are divs too.                        */
    let depth = 0, scrollAt = -1;
    for (const tag of html.matchAll(/<div\b[^>]*>|<\/div>|<table\b/g)) {
      if (tag[0] === "</div>") { if (depth === scrollAt) scrollAt = -1; depth--; }
      else if (tag[0].startsWith("<div")) { if (/class="[^"]*\btscroll\b/.test(tag[0]) && scrollAt < 0) scrollAt = depth; depth++; }
      else {
        const rest = html.slice(tag.index);
        /* <th[\s>] and not <th, or every <thead> counts as a column */
        const cols = ((rest.slice(0, rest.indexOf("</table>")).match(/<th[\s>]/g)) || []).length;
        if (cols >= 5 && scrollAt < 0) loose.push(t.id + ": a " + cols + "-column table with no scroller");
      }
    }
  }
  check(broken.length === 0, "all " + TABLES.length + " sections build", broken.join("\n"));
  check(headless.length === 0, "each opens with a heading", headless.join(", "));
  check(loose.length === 0, "wide tables can scroll", [...new Set(loose)].join("\n"));
}

section("A unit heading keeps its own case");
{
  /* CSS uppercases table headings. Shouting an English word is the design;
     shouting a unit destroys it, because the uppercase of the micro sign is
     a Greek capital mu. Microfarads were being drawn as MF and permeability
     as MI. Only the characters uppercase actually breaks are policed here —
     the micro sign and the Greek lower case — and those headings have to
     opt out with the asis class. */
  const shouted = [];
  for (const t of TABLES) {
    const html = t.html();
    for (const th of html.matchAll(/<th([^>]*)>([^<]+)<\/th>/g)) {
      const attrs = th[1], body = th[2].trim();
      if (/[µα-ω]/.test(body) && !/\basis\b/.test(attrs))
        shouted.push(t.id + ': "' + body + '"');
    }
  }
  check(shouted.length === 0, "unit headings opt out of the uppercase", shouted.join("\n"));
}

/* ------------------------------------------------------------- regressions */
/* One test per fault that was actually found. Each names what went wrong. */

const run = (id, vals) => {
  const c = CALCS.find(x => x.id === id);
  calcSeed(c);
  Object.assign(ui.calcVals[c.id], vals || {});
  const rows = calcRun(c) || [];
  const by = {};
  rows.forEach(r => { by[r.label] = r; });
  return by;
};

section("Faults that were found once");
{
  /* Ohm's law names the pair it worked out, and says nothing under the two
     that were typed in. */
  const a = run("ohm", { V: "12", I: "0.5", R: "", P: "" });
  check(!a["Voltage"].note && !a["Current"].note && /V .{1,3} I/.test(a["Resistance"].note || ""),
    "ohm: the relation follows which two boxes were filled",
    JSON.stringify({ V: a["Voltage"].note, R: a["Resistance"].note }));

  /* An RLC band-stop takes its output across L + C, so the phase is a small
     negative angle below resonance. atan2(R, X) alone returned it 180 out. */
  const f0 = 1 / (2 * Math.PI * Math.sqrt(0.01 * 100e-9));
  const lo = run("rc", { type: "RLC band-stop", R: "10", L: "10m", C: "100n", f: String(f0 / 10) });
  const ph = lo["Phase at test frequency"].value;
  check(ph < 0 && ph > -90, "rc band-stop: phase below f0 is a small negative angle, not +180°",
    "got " + ph + "°");
  const at0 = run("rc", { type: "RLC band-stop", R: "10", L: "10m", C: "100n", f: String(f0) });
  check(at0["Phase at test frequency"].value === null,
    "rc band-stop: phase at f0 is refused, because the output is a null",
    JSON.stringify(at0["Phase at test frequency"]));

  /* A boost's output capacitor carries the load alone while the switch is on,
     then the whole inductor current when it opens: the ESR step is the peak,
     not the ripple, and using delta-IL made the figure three times small. */
  const b = run("boost", { Vin: "3.7", Vout: "12", Iout: "0.5", f: "500k", L: "10u", Cout: "47u", ESR: "20m" });
  const esr = b["Output ripple (ESR)"].value;
  const pk = b["Inductor peak current"].value, dIL = b["Inductor ripple ΔIL"].value;
  check(Math.abs(esr - pk * 0.02) < 1e-9, "boost: the ESR step follows the peak current",
    "ESR row " + esr + ", peak × ESR " + pk * 0.02 + ", ΔIL × ESR " + dIL * 0.02);

  /* A buck's capacitor really does carry only the ripple, so that one stays. */
  const k = run("buck", { Vin: "12", Vout: "5", Iout: "2", f: "500k", L: "10u", Cout: "47u", ESR: "20m" });
  check(Math.abs(k["Output ripple (ESR)"].value - k["Inductor ripple ΔIL"].value * 0.02) < 1e-9,
    "buck: the ESR step follows ΔIL, which is different and still right");

  /* Gate charge is spent in the driver and the gate loop. It belongs in the
     efficiency and not in the junction estimate; it was in both. */
  const s = run("sync", { topo: "Synchronous buck", Vin: "12", Vout: "5", Iout: "3", fs: "500k",
                          RthH: "35", Ta: "40" });
  const die = s["High-side total loss"].value - s["High-side gate-drive loss"].value;
  check(Math.abs(s["High-side junction estimate"].value - (40 + die * 35)) < 0.05,
    "sync: the gate-drive loss is left out of the junction estimate",
    "Tj " + s["High-side junction estimate"].value + ", expected " + (40 + die * 35));
  check(s["High-side total loss"].value > die,
    "sync: and is still counted against the converter");

  /* A bridge blocks one peak. Two is the centre-tapped and the half-wave. */
  const r = run("rectifier", {});
  const piv = r["Bridge PIV (ideal)"].value, sec = r["No-load transformer secondary"].value;
  check(Math.abs(piv - sec * Math.SQRT2) < 0.01,
    "rectifier: bridge PIV is one no-load secondary peak, not two",
    "PIV " + piv + ", one peak " + sec * Math.SQRT2);
  check(Math.abs(r["Suggested bridge VRRM minimum"].value - 2 * piv) < 0.01,
    "rectifier: the 2× stays where it belongs, on the suggested rating");
}

section("Counts that are counted, not typed");
{
  /* The subtitle said thirty-seven while the page held forty-one, and had
     been wrong since the count last changed. Nothing that states how many
     calculators there are may state it as a literal. */
  check(/\$\("#brandSub"\)\.textContent = CALCS\.length/.test(HTML),
    "the header subtitle is taken from the list, not written down");
  const spelled = /\b(twenty|thirty|forty|fifty)[- ](one|two|three|four|five|six|seven|eight|nine)?\b/i;
  const inApp = (HTML.match(/brand-sub[^>]*>([^<]*)</) || [, ""])[1];
  check(!spelled.test(inApp), "no spelled-out count is left in the header", inApp);
  const idxPath = path.join(__dirname, "index.html");
  if (fs.existsSync(idxPath)) {
    const desc = (fs.readFileSync(idxPath, "utf8").match(/name="description" content="([^"]*)"/) || [, ""])[1];
    check(!spelled.test(desc) && !/\b\d+ bench/.test(desc),
      "the landing page description carries no count to go stale", desc);
  }
}

section("Values that were typed by hand and came out wrong");
{
  /* The electrolytic list was hand-picked and held 33 and 330 but not 3.3.
     It is generated from the E6 mantissas now, so the series cannot gap. */
  const html = TABLES.find(t => t.id === "elec").html();
  const cells = [...html.matchAll(/<td class="num m"><b>([\d.]+)<\/b><\/td>/g)].map(x => x[1]);
  const want = ["0.1", "0.15", "0.22", "0.33", "0.47", "0.68", "1", "1.5", "2.2", "3.3", "4.7", "6.8",
                "10", "15", "22", "33", "47", "68", "6800"];
  const missing = want.filter(v => !cells.includes(v));
  check(missing.length === 0, "electrolytics: the whole E6 series is present", "missing " + missing.join(", "));
  const drift = cells.filter(v => v.length > 6);
  check(drift.length === 0, "electrolytics: no floating-point tails", drift.join(", "));

  /* A whole microhenry is marked 1R0, not 1. */
  check(indCode(1) === "1R0", "inductor marking: 1 µH is 1R0", "got " + indCode(1));
  check(indCode(4.7) === "4R7" && indCode(100) === "101" && indCode(22000) === "223",
    "inductor marking: 4R7 is 4.7 µH, 101 is 100 µH, 223 is 22 mH",
    [indCode(4.7), indCode(100), indCode(22000)].join(" "));
  check(capCode(100000) === "104" && capCode(4700) === "472",
    "capacitor marking: 104 is 100 nF and 472 is 4.7 nF");

  /* The counter-intuitive column: a 0603 reaches its voltage limit at a lower
     resistance than an 0402, because both stand off 50 V and the bigger part
     is allowed to dissipate more. If that ever inverts, the column is wrong. */
  const bind = imp => { const s = SMD_SIZES.find(x => x.imp === imp); return s.v * s.v / s.p; };
  check(bind("0603") < bind("0402"),
    "chip sizes: the volts bind lower on an 0603 than an 0402, as they should",
    "0603 " + Math.round(bind("0603")) + " Ω, 0402 " + Math.round(bind("0402")) + " Ω");
}

/* ------------------------------------------------------------------ verdict */
console.log("");
if (failures.length === 0) {
  console.log(passed + " checks passed.");
  process.exit(0);
}
console.log(passed + " passed, " + failures.length + " failed:");
failures.forEach(f => console.log("  ✗ [" + f.group + "] " + f.msg));
process.exit(1);
