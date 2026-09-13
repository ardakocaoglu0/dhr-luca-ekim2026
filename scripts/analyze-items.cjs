/**
 * DHR recalc oncesi/sonrasi kalem bazli karsilastirma:
 * FM, prim, ikramiye, masraf, kesinti, avans, BES kaybi var mi?
 */
const fs = require("fs");
const path = require("path");

const cmp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "comparison.json"), "utf8"));
const dhrNew = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "dhr_ocak_full_data_v2.json"), "utf8"));

const norm = (s) =>
  String(s || "").toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

const byName = new Map(dhrNew.employees.map((e) => [norm(e.name), e]));
const tr = (n) => (n == null ? "-" : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const KEYS = ["salary", "meal", "transport", "overtime", "prim", "ikramiye", "masraf", "kesinti", "advance", "bes"];

console.log("=== Kalem kayiplari (DHR eski -> yeni) ===");
let lossRows = 0;
for (const r of cmp.rows) {
  const e = byName.get(norm(r.name));
  if (!e) continue;
  const diffs = [];
  for (const k of KEYS) {
    const o = r.dhr[k] ?? 0;
    const nv = e[k] ?? 0;
    if (Math.abs(o - nv) > 0.01) diffs.push(`${k}: ${tr(o)} -> ${tr(nv)}`);
  }
  if (diffs.length) {
    lossRows++;
    console.log(`${e.sicil} ${r.name.padEnd(20)} | ${diffs.join(" | ")}`);
    console.log(`      Luca: FM ${tr(r.luca.overtime)} prim ${tr(r.luca.prim)} ikr ${tr(r.luca.ikramiye)} masraf ${tr(r.luca.masraf)} kesinti ${tr(r.luca.kesinti)} avans ${tr(r.luca.advance)} bes ${tr(r.luca.bes)}`);
  }
}
console.log("degisen kisi sayisi:", lossRows);

console.log("\n=== Yeni DHR verisinde sifir olmayan ek kalemler ===");
for (const e of dhrNew.employees) {
  const extras = ["overtime", "prim", "ikramiye", "masraf", "kesinti", "advance", "bes"]
    .filter((k) => Math.abs(e[k] || 0) > 0.01)
    .map((k) => `${k}=${tr(e[k])}`);
  if (extras.length) console.log(`${e.sicil} ${e.name.padEnd(20)} ${extras.join(" ")}`);
}

console.log("\n=== Gun bilgileri (yeni) ===");
for (const e of dhrNew.employees)
  if ((e.sgkDays ?? 30) !== 30 || (e.workedDays ?? 30) !== 30 || (e.missingDays ?? 0) !== 0)
    console.log(`${e.sicil} ${e.name.padEnd(20)} sgkDays=${e.sgkDays} worked=${e.workedDays} missing=${e.missingDays} salary=${tr(e.salary)}`);
