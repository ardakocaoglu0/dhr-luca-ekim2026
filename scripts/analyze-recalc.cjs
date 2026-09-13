/**
 * Yeni DHR verisi (recalc sonrasi) ile mevcut Luca PDF verisini karsilastir.
 * Sadece analiz; dosya yazmaz.
 */
const fs = require("fs");
const path = require("path");

const cmp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "comparison.json"), "utf8"));
const dhrNew = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "dhr_ocak_full_data_v2.json"), "utf8"));

const norm = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

const byName = new Map(dhrNew.employees.map((e) => [norm(e.name), e]));

const tr = (n) => (n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

let unmatched = [];
let totalAbsNet = 0;
let totalAbsNetOld = 0;
const rows = [];

for (const r of cmp.rows) {
  const e = byName.get(norm(r.name));
  if (!e) {
    unmatched.push(r.name);
    continue;
  }
  const oldNet = r.dhr.net;
  const dNetOld = (r.luca.net ?? 0) - (oldNet ?? 0);
  const dNetNew = (r.luca.net ?? 0) - (e.net ?? 0);
  totalAbsNetOld += Math.abs(dNetOld);
  totalAbsNet += Math.abs(dNetNew);
  rows.push({
    n: r.n,
    name: r.name,
    sicil: e.sicil,
    dhrOldNet: oldNet,
    dhrNewNet: e.net,
    lucaNet: r.luca.net,
    dNetOld,
    dNetNew,
    dGross: (r.luca.gross ?? 0) - (e.gross ?? 0),
    dGv: (r.luca.gv ?? 0) - (e.gv ?? 0),
    dSgk: (r.luca.sgk ?? 0) - (e.sgk ?? 0),
    dUns: (r.luca.unemployment ?? 0) - (e.unemployment ?? 0),
    dDamga: (r.luca.damga ?? 0) - (e.damga ?? 0),
    dhrChanged: Math.abs((oldNet ?? 0) - (e.net ?? 0)) > 0.01,
  });
}

console.log("unmatched rows:", unmatched);
console.log("dhr count:", dhrNew.employees.length, "cmp rows:", cmp.rows.length);
console.log("\n=== DHR recalc ile degisen kisiler ===");
for (const r of rows.filter((x) => x.dhrChanged))
  console.log(`${r.sicil} ${r.name.padEnd(20)} net ${tr(r.dhrOldNet)} -> ${tr(r.dhrNewNet)}  (fark ${tr(r.dhrNewNet - r.dhrOldNet)})`);

console.log("\n=== Luca - DHR net farklari (yeni) ===");
for (const r of [...rows].sort((a, b) => Math.abs(b.dNetNew) - Math.abs(a.dNetNew)))
  console.log(
    `${r.sicil} ${r.name.padEnd(20)} dNet ${tr(r.dNetNew).padStart(12)}  dGross ${tr(r.dGross).padStart(11)}  dGV ${tr(r.dGv).padStart(10)}  dSGK ${tr(r.dSgk).padStart(10)}  dIssiz ${tr(r.dUns).padStart(8)}  dDamga ${tr(r.dDamga).padStart(8)}`,
  );

console.log("\ntoplam |dNet| eski:", tr(totalAbsNetOld));
console.log("toplam |dNet| yeni:", tr(totalAbsNet));
console.log("±0,01 gecen kisi:", rows.filter((r) => Math.abs(r.dNetNew) <= 0.01).length, "/", rows.length);

// Yemek brutlestirme artefakti: Luca digKaz 12169.35 olanlar
const artefact = rows.filter((r) => Math.abs(r.dGross - 3469.35) < 0.02);
console.log("\nyemek/yol brutlestirme artefakti (dGross=3.469,35):", artefact.length, "kisi");
console.log("bu kisilerde toplam |dNet|:", tr(artefact.reduce((s, r) => s + Math.abs(r.dNetNew), 0)));
const rest = rows.filter((r) => Math.abs(r.dGross - 3469.35) >= 0.02 && Math.abs(r.dNetNew) > 0.01);
console.log("\n=== Artefakt disinda kalan sapmalar ===");
for (const r of rest)
  console.log(`${r.sicil} ${r.name.padEnd(20)} dNet ${tr(r.dNetNew).padStart(12)} dGross ${tr(r.dGross).padStart(11)}`);
