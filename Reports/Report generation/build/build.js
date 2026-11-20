// Builds the major-project report (.docx) in the BMSCE format extracted from Reports/sample report.
// Content lives in ../content/*.md (light markup, see parse()); figures come from ../../Image generation/Final images.
// Numbers for chapters, sections, figures, tables, equations and citations are assigned here, never typed by hand.
const fs = require("fs");
const path = require("path");
const d = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, TableOfContents, StyleLevel, Header, Footer, PageNumber, TabStopType, NumberFormat, LevelFormat,
  VerticalAlign, TableLayoutType,
} = d;

const ROOT = path.resolve(__dirname, "..");
const FIG = path.resolve(ROOT, "..", "Image generation", "Final images");
const BBL = path.resolve(ROOT, "..", "..", "docs", "paper", "main.bbl");
const META = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "meta.json"), "utf8"));
const FONT = "Times New Roman";
const TEXT_W_IN = 8.27 - 1.5 - 1.0;          // A4 minus left 1.5 in and right 1 in margins
const DXA = (inch) => Math.round(inch * 1440);

// ------------------------------------------------------------------ references (IEEE, from the paper's .bbl)
function clean(s) {
  let t = s.replace(/%.*$/gm, "");
  t = t.replace(/\\hskip[\s\S]*?\\relax/g, " ").replace(/\\BIBentry\w+/g, "").replace(/\\newblock/g, "")
    .replace(/�/g, "Ö").replace(/[–—]/g, "-");
  t = t.replace(/\\url\{([^}]*)\}/g, "$1").replace(/\\emph\{([^}]*)\}/g, "$1");
  t = t.replace(/\$_\{([^}]*)\}\$/g, "$1").replace(/\$/g, "").replace(/\\&/g, "&").replace(/\\_/g, "_");
  t = t.replace(/``|''/g, '"').replace(/~/g, " ").replace(/[{}]/g, "").replace(/\\/g, "");
  t = t.replace(/--/g, "-").replace(/\s+/g, " ").trim();
  const caps = { "pm2.5": "PM2.5", "pm 2.5": "PM2.5", gnn: "GNN", safar: "SAFAR", "wrf-chem": "WRF-Chem", delhi: "Delhi", india: "India",
    "india's": "India's", cams: "CAMS", "merra-2": "MERRA-2", aeronet: "AERONET", era5: "ERA5", lstm: "LSTM", cnn: "CNN", vmd: "VMD",
    "vmd-gat-bilstm": "VMD-GAT-BiLSTM", gat: "GAT", bilstm: "BiLSTM", china: "China", guangzhou: "Guangzhou", beijing: "Beijing",
    "indo-gangetic": "Indo-Gangetic", copernicus: "Copernicus", mos: "MOS", o3: "O3", airformer: "AirFormer", geoman: "GeoMAN",
    wavenet: "WaveNet", "cnn-lstm": "CNN-LSTM", wtcrossformer: "WTCrossformer", tdgtn: "TDGTN", msdgnn: "MSDGNN", aaai: "AAAI",
    ijcai: "IJCAI", acm: "ACM", sigkdd: "SIGKDD", kdd: "KDD", plos: "PLOS", ieee: "IEEE", bpnn: "BPNN", merra: "MERRA", modwt: "MODWT", ai: "AI" };
  t = t.replace(/(?<=[\s"(:])([a-z0-9.\-'/]+)(?=[\s,:)"])/gi,
    (w) => caps[w.toLowerCase()] || w.split(/([-/])/).map((x) => caps[x.toLowerCase()] || x).join(""));
  const phrases = [["copernicus atmosphere monitoring service", "Copernicus Atmosphere Monitoring Service"],
    ["ministry of earth sciences", "Ministry of Earth Sciences"], ["united states", "United States"], ["safar-project", "SAFAR-project"]];
  for (const [a, b] of phrases) t = t.replace(new RegExp(a, "gi"), b);
  return t;
}
function loadBib() {
  const src = fs.readFileSync(BBL, "utf8");
  const out = {};
  for (const part of src.split("\\bibitem{").slice(1)) {
    const key = part.slice(0, part.indexOf("}"));
    let body = part.slice(part.indexOf("}") + 1).replace(/\\end\{thebibliography\}[\s\S]*/, "");
    out[key] = clean(body);
  }
  const extra = ["refs_extra.txt", "refs_recent.txt"].flatMap((f) => fs.readFileSync(path.join(ROOT, "content", f), "utf8").split(/\r?\n/));
  for (const line of extra) {
    if (!line.trim() || line.startsWith("#")) continue;
    const i = line.indexOf("|");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const BIB = loadBib();
const VAL = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "valmetrics.json"), "utf8"));

// ------------------------------------------------------------------ parsing the content files
function readContent() {
  const files = fs.readdirSync(path.join(ROOT, "content")).filter((f) => /^\d\d_.*\.md$/.test(f)).sort();
  const txt = files.map((f) => fs.readFileSync(path.join(ROOT, "content", f), "utf8")).join("\n\n")
    .replace(/^!include\s+(\S+)\s*$/gm, (_, f) => fs.readFileSync(path.join(ROOT, "content", f), "utf8"));
  const bad = txt.match(/.{0,40}[–—].{0,40}/);
  if (bad) throw new Error("dash found (humanizer rule): " + bad[0]);
  return txt;
}

function parse(src) {
  const lines = src.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { blocks.push({ t: "p", text: para.join(" ") }); para.length = 0; } };
  while (i < lines.length) {
    const L = lines[i];
    const s = L.trim();
    if (!s || s.startsWith("<!--")) { flush(); i++; continue; }
    let m;
    if ((m = s.match(/^@chapter\s+(.*)$/))) { flush(); blocks.push({ t: "chapter", title: m[1] }); }
    else if ((m = s.match(/^@front\s+(.*)$/))) { flush(); blocks.push({ t: "front", title: m[1] }); }
    else if ((m = s.match(/^@appendix\s+(\w)\s*\|\s*(.*)$/))) { flush(); blocks.push({ t: "appendix", letter: m[1], title: m[2] }); }
    else if (s === "@references") { flush(); blocks.push({ t: "references" }); }
    else if (s === "@pagebreak") { flush(); blocks.push({ t: "pagebreak" }); }
    else if ((m = s.match(/^(#{2,4})\s+(.*)$/))) { flush(); blocks.push({ t: "h", level: m[1].length, title: m[2] }); }
    else if ((m = s.match(/^!fig\s+(.*)$/))) {
      flush();
      const [file, caption, label, width] = m[1].split("|").map((x) => x.trim());
      blocks.push({ t: "fig", file, caption, label, width: width ? parseFloat(width) : null });
    } else if ((m = s.match(/^!table\s+(.*)$/))) {
      flush();
      const [caption, label, widths] = m[1].split("|").map((x) => x.trim());
      const rows = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!r.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(r);
        i++;
      }
      blocks.push({ t: "table", caption, label, rows, widths: widths ? widths.split(",").map(Number) : null });
      continue;
    } else if ((m = s.match(/^\$\$\s*(.*?)\s*(?:\|\s*(\S+))?\s*$/))) { flush(); blocks.push({ t: "eq", text: m[1], label: m[2] }); }
    else if ((m = s.match(/^-\s+(.*)$/))) { flush(); blocks.push({ t: "li", text: m[1], kind: "bullet" }); }
    else if ((m = s.match(/^\d+\.\s+(.*)$/))) { flush(); blocks.push({ t: "li", text: m[1], kind: "number" }); }
    else para.push(s);
    i++;
  }
  flush();
  return blocks;
}

// ------------------------------------------------------------------ numbering pass
function number(blocks) {
  const labels = {};
  const cites = [];
  let ch = 0, sec = 0, sub = 0, subsub = 0, fig = 0, tab = 0, eq = 0, prefix = "";
  const figs = [], tabs = [];
  for (const b of blocks) {
    if (b.t === "chapter") { ch++; prefix = String(ch); sec = sub = subsub = fig = tab = eq = 0; b.num = ch; }
    else if (b.t === "appendix") { prefix = b.letter; sec = sub = subsub = fig = tab = eq = 0; }
    else if (b.t === "front" || b.t === "references") { prefix = ""; }
    else if (b.t === "h") {
      if (b.level === 2) { sec++; sub = subsub = 0; b.num = prefix && /^\d/.test(prefix) ? `${prefix}.${sec}` : ""; }
      if (b.level === 3) { sub++; subsub = 0; b.num = prefix && /^\d/.test(prefix) ? `${prefix}.${sec}.${sub}` : ""; }
      if (b.level === 4) { subsub++; b.num = prefix && /^\d/.test(prefix) ? `${prefix}.${sec}.${sub}.${subsub}` : ""; }
    } else if (b.t === "fig") { fig++; b.num = `${prefix}.${fig}`; if (b.label) labels[`fig:${b.label}`] = b.num; figs.push(b); }
    else if (b.t === "table") { tab++; b.num = `${prefix}.${tab}`; if (b.label) labels[`tab:${b.label}`] = b.num; tabs.push(b); }
    else if (b.t === "eq") { eq++; b.num = `${prefix}.${eq}`; if (b.label) labels[`eq:${b.label}`] = b.num; }
    for (const field of ["text", "caption"]) {
      const v = b[field];
      if (typeof v === "string") for (const mm of v.matchAll(/\[@([\w,\s]+)\]/g)) for (const k of mm[1].split(",").map((x) => x.trim())) if (!cites.includes(k)) cites.push(k);
    }
    if (b.rows) for (const r of b.rows) for (const c of r) for (const mm of c.matchAll(/\[@([\w,\s]+)\]/g)) for (const k of mm[1].split(",").map((x) => x.trim())) if (!cites.includes(k)) cites.push(k);
  }
  for (const k of cites) if (!BIB[k]) throw new Error(`unknown citation ${k}`);
  // Reference list in descending order of year (team preference); ties keep first-citation order.
  // Undated web resources (data portals) go last.
  const year = (k) => {
    const head = BIB[k].split("[Online]")[0];
    const ys = head.match(/(?<![\d-])(19|20)\d{2}(?![\d-])/g);  // skip page ranges such as 1907-1913
    return ys ? parseInt(ys[ys.length - 1], 10) : 0;
  };
  const firstUse = new Map(cites.map((k, i) => [k, i]));
  cites.sort((a, b) => year(b) - year(a) || firstUse.get(a) - firstUse.get(b));
  return { labels, cites, figs, tabs };
}

// ------------------------------------------------------------------ inline text -> runs
let LABELS = {}, CITES = [];
function runs(text, base = {}) {
  let t = text.replace(/\{(fig|tab|eq):([\w-]+)\}/g, (_, k, l) => {
    const n = LABELS[`${k}:${l}`];
    if (!n) throw new Error(`unknown ref ${k}:${l}`);
    return n;
  });
  t = t.replace(/\{m:([a-z0-9_]+)\.(\d+)\.(\w+)\}/g, (_, n, L, k) => {
    const v = VAL[n] && VAL[n][`${L}.${k}`];
    if (v === undefined || v === null) throw new Error(`no metric ${n}.${L}.${k}`);
    return (k === "r2" || k === "skill") ? v.toFixed(3) : v.toFixed(1);
  });
  t = t.replace(/\[@([\w,\s]+)\]/g, (_, ks) => "[" + ks.split(",").map((k) => CITES.indexOf(k.trim()) + 1).join("], [") + "]");
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(new TextRun({ text: t.slice(last, m.index), ...base }));
    const s = m[0];
    if (s.startsWith("**")) out.push(new TextRun({ text: s.slice(2, -2), bold: true, ...base }));
    else if (s.startsWith("`")) out.push(new TextRun({ text: s.slice(1, -1), font: "Consolas", size: 21, ...base }));
    else out.push(new TextRun({ text: s.slice(1, -1), italics: true, ...base }));
    last = m.index + s.length;
  }
  if (last < t.length) out.push(new TextRun({ text: t.slice(last), ...base }));
  return out;
}

// ------------------------------------------------------------------ element builders
const P = (children, opts = {}) => new Paragraph({ children, ...opts });
const center = (text, o = {}) => P([new TextRun({ text, font: FONT, ...o })], { alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 80, line: 276 } });

function imageSize(file) {
  const buf = fs.readFileSync(file);
  return { buf, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function figure(b) {
  const file = path.join(FIG, b.file);
  const { buf, w, h } = imageSize(file);
  let wIn = b.width || TEXT_W_IN;
  let hIn = (wIn * h) / w;
  const maxH = 7.6;
  if (hIn > maxH) { hIn = maxH; wIn = (hIn * w) / h; }
  return [
    P([new ImageRun({ type: "png", data: buf, transformation: { width: Math.round(wIn * 96), height: Math.round(hIn * 96) } })],
      { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60, line: 240 }, keepNext: true }),
    P([new TextRun({ text: `Figure ${b.num}: `, bold: true }), ...runs(b.caption)], { style: "FigCaption" }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
function table(b) {
  const nCols = Math.max(...b.rows.map((r) => r.length));
  let weights = b.widths;
  if (!weights) {
    weights = [];
    for (let c = 0; c < nCols; c++) weights.push(Math.min(40, Math.max(6, ...b.rows.map((r) => (r[c] || "").length))));
  }
  const sum = weights.reduce((a, x) => a + x, 0);
  const total = DXA(TEXT_W_IN);
  const cols = weights.map((x) => Math.floor((x / sum) * total));
  cols[cols.length - 1] += total - cols.reduce((a, x) => a + x, 0);
  const rows = b.rows.map((r, ri) => new TableRow({
    tableHeader: ri === 0,
    cantSplit: true,
    children: cols.map((w, ci) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [P(runs(r[ci] || "", { size: 21, bold: ri === 0 }), { spacing: { line: 252, before: 0, after: 0 }, alignment: AlignmentType.LEFT })],
    })),
  }));
  return [
    P([new TextRun({ text: `Table ${b.num}: `, bold: true }), ...runs(b.caption)], { style: "TabCaption" }),
    new Table({ rows, width: { size: total, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED }),
    P([], { spacing: { after: 120 } }),
  ];
}

function equation(b) {
  return P([...runs(b.text, { italics: true }), new TextRun({ text: `\t(${b.num})` })],
    { tabStops: [{ type: TabStopType.CENTER, position: DXA(TEXT_W_IN / 2) }, { type: TabStopType.RIGHT, position: DXA(TEXT_W_IN) }],
      spacing: { before: 120, after: 120 }, alignment: AlignmentType.LEFT, children: undefined });
}

function eqPara(b) {
  const kids = [new TextRun({ text: "\t" }), ...runs(b.text, { italics: true }), new TextRun({ text: `\t(${b.num})` })];
  return new Paragraph({ children: kids, tabStops: [{ type: TabStopType.CENTER, position: DXA(TEXT_W_IN / 2) }, { type: TabStopType.RIGHT, position: DXA(TEXT_W_IN) }],
    spacing: { before: 120, after: 120 }, keepLines: true });
}

// ------------------------------------------------------------------ body
let listCounter = 0;
function body(blocks) {
  const out = [];
  let firstAfterHeading = true;
  let prevLi = null;
  for (const b of blocks) {
    if (b.t !== "li") prevLi = null;
    if (b.t === "chapter") {
      out.push(P([new TextRun({ text: `Chapter ${b.num}  ${b.title}` })], { heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
      firstAfterHeading = true;
    } else if (b.t === "appendix") {
      out.push(P([new TextRun({ text: `Appendix ${b.letter}: ${b.title}` })], { heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
      firstAfterHeading = true;
    } else if (b.t === "references") {
      out.push(P([new TextRun({ text: "REFERENCES" })], { heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
      CITES.forEach((k, i) => out.push(P([new TextRun({ text: `[${i + 1}]\t` }), new TextRun({ text: BIB[k] })],
        { style: "RefItem" })));
    } else if (b.t === "front") {
      out.push(P([new TextRun({ text: b.title })], { style: "FrontTitle", pageBreakBefore: true }));
      firstAfterHeading = true;
    } else if (b.t === "pagebreak") {
      out.push(P([], { pageBreakBefore: true }));
    } else if (b.t === "h") {
      const lvl = { 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 }[b.level];
      out.push(P([new TextRun({ text: (b.num ? b.num + " " : "") + b.title })], { heading: lvl }));
      firstAfterHeading = true;
    } else if (b.t === "p") {
      out.push(P(runs(b.text), { indent: firstAfterHeading ? undefined : { firstLine: 720 } }));
      firstAfterHeading = false;
    } else if (b.t === "li") {
      if (!prevLi || prevLi !== b.kind) listCounter++;
      prevLi = b.kind;
      out.push(P(runs(b.text), b.kind === "bullet"
        ? { numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 } }
        : { numbering: { reference: "numbers", level: 0, instance: listCounter }, spacing: { after: 40 } }));
      firstAfterHeading = false;
    } else if (b.t === "fig") out.push(...figure(b));
    else if (b.t === "table") out.push(...table(b));
    else if (b.t === "eq") { out.push(eqPara(b)); firstAfterHeading = true; }
  }
  return out;
}

// ------------------------------------------------------------------ front matter
function logo(file, inch, after) {
  const { buf, w, h } = imageSize(path.join(ROOT, "assets", file));
  return P([new ImageRun({ type: "png", data: buf, transformation: { width: Math.round(inch * 96), height: Math.round((inch * 96 * h) / w) } })],
    { alignment: AlignmentType.CENTER, spacing: { before: 0, after, line: 240 } });
}
function titlePage() {
  const M = META;
  const kids = [
    P([], { spacing: { before: 600 } }),
    ...M.title_lines.map((l) => center(l, { bold: true, size: 40, after: 40 })),
    P([], { spacing: { after: 200 } }),
    logo("vtu_logo.png", 0.9, 240),
    center("PROJECT REPORT", { bold: true, size: 28, after: 60 }),
    center("Submitted by", { italics: true, size: 24, after: 60 }),
    center(`Group Number: ${M.group}`, { size: 24, after: 120 }),
  ];
  const nameRows = M.students.map((s) => new TableRow({ children: [
    new TableCell({ width: { size: 3600, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [P([new TextRun({ text: s.name, size: 24 })], { spacing: { after: 0, line: 276 } })] }),
    new TableCell({ width: { size: 2200, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [P([new TextRun({ text: `(${s.usn})`, size: 24 })], { spacing: { after: 0, line: 276 } })] }),
  ] }));
  kids.push(new Table({ rows: nameRows, columnWidths: [3600, 2200], width: { size: 5800, type: WidthType.DXA }, alignment: AlignmentType.CENTER,
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } } }));
  kids.push(
    P([], { spacing: { after: 160 } }),
    center("in partial fulfillment for the award of the degree of", { italics: true, size: 24 }),
    center("BACHELOR OF ENGINEERING", { bold: true, size: 30 }),
    center("in", { size: 24 }),
    center("COMPUTER SCIENCE AND ENGINEERING", { bold: true, size: 30, after: 200 }),
    center("Under the Guidance of", { size: 24 }),
    center(M.guide.name, { bold: true, size: 24, after: 20 }),
    center(M.guide.designation, { size: 24, after: 200 }),
    logo("bmsce_logo.png", 0.9, 200),
    center("B.M.S. COLLEGE OF ENGINEERING", { bold: true, size: 30, after: 20 }),
    center("(Autonomous Institution under VTU)", { size: 22, after: 20 }),
    center("BENGALURU - 560019", { size: 22, after: 20 }),
    center(`Academic Year - ${M.year}`, { size: 22 }),
  );
  return kids;
}

function signatureTable(cols) {
  const none = { style: BorderStyle.NONE };
  const w = Math.floor(DXA(TEXT_W_IN) / cols.length);
  return new Table({
    width: { size: w * cols.length, type: WidthType.DXA }, columnWidths: cols.map(() => w),
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: cols.map((lines) => new TableCell({ width: { size: w, type: WidthType.DXA },
      borders: { top: none, bottom: none, left: none, right: none },
      children: lines.map((l, i) => P([new TextRun({ text: l, bold: i === 0, size: 22 })], { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 264 } })) })) })],
  });
}

function certificate() {
  const M = META;
  const names = M.students.map((s) => `${s.name} (${s.usn})`).join(", ");
  return [
    P([new TextRun({ text: "Certificate" })], { style: "FrontTitle" }),
    P([new TextRun(`This is to certify that the project work entitled "${M.title}" is a bonafide work carried out by ${names}, who are bonafide students of B.M.S. College of Engineering. It is submitted in partial fulfillment for the award of the degree of Bachelor of Engineering in Computer Science and Engineering of the Visvesvaraya Technological University, Belagavi, during the academic year ${M.year}. The project report has been approved as it satisfies the academic requirements in respect of Major Project (${M.course_code}) prescribed for the said degree.`)]),
    P([], { spacing: { after: 600 } }),
    signatureTable([["Guide Signature", "", M.guide.name, M.guide.designation, "Department of CSE, BMSCE"],
      ["HOD Signature", "", M.hod.name, M.hod.designation, "Department of CSE, BMSCE"],
      ["Principal Signature", "", M.principal.name, M.principal.designation, "BMSCE, Bengaluru"]]),
    P([], { spacing: { after: 500 } }),
    P([new TextRun({ text: "External Viva", bold: true })]),
    P([new TextRun("Name and signature of examiners along with date")]),
    P([new TextRun("Examiner 1:")], { spacing: { before: 240 } }),
    P([new TextRun("Examiner 2:")], { spacing: { before: 240 } }),
  ];
}

function declaration() {
  const M = META;
  const cell = (t, w, bold) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: [P([new TextRun({ text: t, bold, size: 22 })], { spacing: { after: 0, line: 264 } })] });
  const ws = [900, 3500, 2000, DXA(TEXT_W_IN) - 6400];
  const rows = [new TableRow({ children: ["Sl. No.", "Student Name", "USN", "Student's Signature"].map((t, i) => cell(t, ws[i], true)) })];
  M.students.forEach((s, i) => rows.push(new TableRow({ children: [String(i + 1), s.name, s.usn, ""].map((t, j) => cell(t, ws[j], false)) })));
  return [
    P([new TextRun({ text: "DECLARATION" })], { style: "FrontTitle", pageBreakBefore: true }),
    P([new TextRun(`We hereby declare that the Major Project work entitled "${M.title}" is a bonafide work carried out by us under the guidance of ${M.guide.name}, ${M.guide.designation}, Department of Computer Science and Engineering, B.M.S. College of Engineering, Bengaluru, in partial fulfillment of the requirements of the degree of Bachelor of Engineering in Computer Science and Engineering of Visvesvaraya Technological University, Belagavi. We further declare that, to the best of our knowledge and belief, this project has not been submitted either in part or in full to any other university for the award of any degree.`)]),
    P([new TextRun({ text: "Candidate details:", bold: true })]),
    new Table({ rows, columnWidths: ws, width: { size: DXA(TEXT_W_IN), type: WidthType.DXA } }),
    P([new TextRun("Place: Bengaluru")], { spacing: { before: 240 } }),
    P([new TextRun("Date:")]),
    P([new TextRun(`Certified that these candidates are students of the Computer Science and Engineering Department of B.M.S. College of Engineering. They have carried out the project work titled "${M.title}" as Major Project work, in partial fulfillment of the requirement for the award of the B.E. degree by VTU. The work is original and duly certified.`)], { spacing: { before: 240 } }),
    P([new TextRun(`Guide Name: ${M.guide.name}`)]),
    P([new TextRun("Date:")]),
    P([new TextRun("Signature:")]),
  ];
}

function lists() {
  return [
    P([new TextRun({ text: "Contents" })], { style: "FrontTitle", pageBreakBefore: true }),
    new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    P([new TextRun({ text: "List of Figures" })], { style: "FrontTitle", pageBreakBefore: true }),
    new TableOfContents("List of Figures", { hyperlink: true, stylesWithLevels: [new StyleLevel("Figure Caption", 1)] }),
    P([new TextRun({ text: "List of Tables" })], { style: "FrontTitle", pageBreakBefore: true }),
    new TableOfContents("List of Tables", { hyperlink: true, stylesWithLevels: [new StyleLevel("Table Caption", 1)] }),
    ...abbreviations(),
  ];
}

function abbreviations() {
  const rows = fs.readFileSync(path.join(ROOT, "content", "abbreviations.txt"), "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("|").map((x) => x.trim()))
    .sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
  const ws = [Math.round(DXA(TEXT_W_IN) * 0.3)];
  ws.push(DXA(TEXT_W_IN) - ws[0]);
  const cell = (t, w, bold) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [P([new TextRun({ text: t, bold, size: 22 })], { spacing: { after: 0, line: 252 }, alignment: AlignmentType.LEFT })] });
  const trs = [new TableRow({ tableHeader: true, children: [cell("Abbreviation", ws[0], true), cell("Expansion", ws[1], true)] }),
    ...rows.map((r) => new TableRow({ cantSplit: true, children: [cell(r[0], ws[0], false), cell(r[1], ws[1], false)] }))];
  return [
    P([new TextRun({ text: "List of Abbreviations" })], { style: "FrontTitle", pageBreakBefore: true }),
    new Table({ rows: trs, columnWidths: ws, width: { size: DXA(TEXT_W_IN), type: WidthType.DXA } }),
  ];
}

// ------------------------------------------------------------------ header / footer
const rule = (pos) => ({ [pos]: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } });
function header() {
  return new Header({ children: [P([new TextRun({ text: META.header_title || META.title, italics: true, size: 20 })],
    { border: rule("bottom"), spacing: { after: 0, line: 240 } })] });
}
function footer() {
  return new Footer({ children: [P([new TextRun({ text: "Dept. of CSE, BMSCE", italics: true, size: 20 }),
    new TextRun({ text: "\tPage ", italics: true, size: 20 }), new TextRun({ children: [PageNumber.CURRENT], italics: true, size: 20 })],
    { border: rule("top"), tabStops: [{ type: TabStopType.RIGHT, position: DXA(TEXT_W_IN) }], spacing: { line: 240 } })] });
}

// ------------------------------------------------------------------ assemble
function build() {
  const blocks = parse(readContent());
  const { labels, cites } = number(blocks);
  LABELS = labels; CITES = cites;
  const frontBlocks = [], mainBlocks = [];
  let inMain = false;
  for (const b of blocks) { if (b.t === "chapter") inMain = true; (inMain ? mainBlocks : frontBlocks).push(b); }
  // front: abstract and acknowledgment come from content; certificate/declaration are generated
  const abstractIdx = frontBlocks.findIndex((b) => b.t === "front" && b.title === "Abstract");
  const ackIdx = frontBlocks.findIndex((b) => b.t === "front" && b.title === "Acknowledgment");
  const abstractBlocks = frontBlocks.slice(abstractIdx, ackIdx);
  const ackBlocks = frontBlocks.slice(ackIdx);

  const page = { size: { width: 11906, height: 16838 }, margin: { top: DXA(1), bottom: DXA(1), left: DXA(1.5), right: DXA(1), header: DXA(0.5), footer: DXA(0.5) } };
  const doc = new Document({
    creator: "Group 40", title: META.title, description: "Major Project report",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 360, after: 120 }, alignment: AlignmentType.JUSTIFIED } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: 36, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 360 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: 28, bold: true }, paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: 24, bold: true }, paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 3 } },
        { id: "FrontTitle", name: "Front Title", basedOn: "Normal", next: "Normal",
          run: { font: FONT, size: 32, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 360 }, keepNext: true } },
        { id: "FigCaption", name: "Figure Caption", basedOn: "Normal", next: "Normal",
          run: { font: FONT, size: 22 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240, line: 276 } } },
        { id: "TabCaption", name: "Table Caption", basedOn: "Normal", next: "Normal",
          run: { font: FONT, size: 22 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80, line: 276 }, keepNext: true } },
        { id: "RefItem", name: "Reference Item", basedOn: "Normal", next: "Normal",
          run: { font: FONT, size: 22 }, paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 100, line: 276 }, indent: { left: 600, hanging: 600 }, tabStops: [{ type: TabStopType.LEFT, position: 600 }] } },
      ],
    },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [
      { properties: { page, titlePage: true }, children: titlePage() },
      { properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } }, footers: { default: footer() },
        children: [...certificate(), ...body(abstractBlocks), ...declaration(), ...body(ackBlocks), ...lists()] },
      { properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } }, headers: { default: header() }, footers: { default: footer() },
        children: body(mainBlocks) },
    ],
  });
  return Packer.toBuffer(doc).then((buf) => {
    const out = path.join(ROOT, "output", `${META.file_name}.docx`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    console.log("wrote", out, "| citations:", CITES.length, "| figures/tables labelled:", Object.keys(LABELS).length);
  });
}

build().catch((e) => { console.error(e); process.exit(1); });
