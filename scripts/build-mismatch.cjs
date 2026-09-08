/**
 * Ocak karşılaştırmasını normalize eder ve uyuşmayan çalışan listesini üretir.
 *
 * Normalizasyon iki kaynak artefaktını kapatır:
 *  1) Luca PDF'inde işsizlik işçi payı ayrı satır olarak basılmıyor (nete yansıyor).
 *     Net mutabakat bakiyesinden geri hesaplanır.
 *  2) DHR Excel'inde prim/ikramiye ayrı kolona yazılmıyor, brüte gömülü geliyor.
 *     Brüt bakiyesi Luca'nın prim/ikramiye tutarıyla birebir eşleşiyorsa kolona taşınır.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "data", "comparison.json");
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n) => (n == null ? 0 : n);
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const trFmt = (n) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const data = JSON.parse(fs.readFileSync(FILE, "utf8").replace(/^\uFEFF/, ""));
const lineDefs = data.lineDefs;

// ---------------------------------------------------------------- normalize
const KEY_LABEL = { prim: "prim", ikramiye: "ikramiye", masraf: "masraf" };
const unresolved = [];

for (const row of data.rows) {
  if (!row.dhr) continue;
  const D = row.dhr;
  const L = row.luca;

  if (L.unemployment == null) {
    const residual = r2(
      num(L.gross) -
        num(L.sgk) -
        num(L.gv) -
        num(L.damga) -
        num(L.bes) -
        num(L.kesinti) -
        num(L.advance) -
        num(L.net),
    );
    const onePct = r2(num(L.gross) * 0.01);
    if (residual >= 0 && near(residual, onePct, 0.5)) {
      L.unemployment = residual;
      L.unemploymentDerived = true;
    } else if (residual === 0) {
      L.unemployment = 0;
      L.unemploymentDerived = true;
    } else {
      unresolved.push(`${row.name}: Luca net mutabakat bakiyesi ${trFmt(residual)} TL çözümlenemedi`);
    }
  }

  const labelled =
    num(D.salary) +
    num(D.meal) +
    num(D.transport) +
    num(D.overtime) +
    num(D.prim) +
    num(D.ikramiye) +
    num(D.masraf);
  let residual = r2(num(D.gross) - labelled);
  for (const key of ["prim", "ikramiye", "masraf"]) {
    if (residual <= 0.05) break;
    if (num(D[key]) !== 0) continue;
    if (num(L[key]) > 0 && near(residual, num(L[key]))) {
      D[key] = num(L[key]);
      D[`${key}Derived`] = true;
      residual = r2(residual - num(L[key]));
    }
  }
  row.dhrUnlabelledGross = residual > 0.05 ? residual : 0;
}

// ------------------------------------------------------- rebuild derivatives
function buildLineItems(D, L) {
  return lineDefs.map((def) => {
    const dhr = D && D[def.key] != null ? r2(D[def.key]) : null;
    const luca = L && L[def.key] != null ? r2(L[def.key]) : null;
    const bothNull = dhr == null && luca == null;
    const delta = bothNull ? null : r2(num(dhr) - num(luca));
    const match =
      bothNull ||
      (dhr != null && luca != null && near(dhr, luca)) ||
      (dhr == null && luca === 0) ||
      (luca == null && dhr === 0);
    return { key: def.key, label: def.label, group: def.group, dhr, luca, delta, match: !!match };
  });
}

for (const row of data.rows) {
  if (!row.dhr) continue;
  row.lineItems = buildLineItems(row.dhr, row.luca);
}

const matched = data.rows.filter((r) => r.dhr && r.delta);
data.kalemler = lineDefs.map((def) => {
  let dhrSum = 0;
  let lucaSum = 0;
  let bothPresent = 0;
  let matchCount = 0;
  let nonzeroEither = 0;
  for (const r of matched) {
    const item = r.lineItems.find((i) => i.key === def.key);
    if (!item) continue;
    dhrSum += num(item.dhr);
    lucaSum += num(item.luca);
    if (item.dhr != null && item.luca != null) {
      bothPresent += 1;
      if (item.match) matchCount += 1;
    }
    if (Math.abs(num(item.dhr)) > 0.05 || Math.abs(num(item.luca)) > 0.05) nonzeroEither += 1;
  }
  return {
    key: def.key,
    label: def.label,
    group: def.group,
    dhrSum: r2(dhrSum),
    lucaSum: r2(lucaSum),
    deltaSum: r2(dhrSum - lucaSum),
    peopleWithValue: nonzeroEither,
    compared: bothPresent,
    matchCount,
  };
});

// ------------------------------------------------------------------- causes
const CAUSE = {
  mealNet: {
    id: "MEAL-NET",
    short: "Yemek/yol NET girilmiş",
    title: "Yemek/yol Luca'da NET (N) girilmiş",
    detail:
      "Luca puantajında Yemek ve Yol satırları N (net) işaretli. Luca bu tutarları brütleştirip toplam kazanca ekliyor, DHR ise brüt olarak işliyor. Düzeltme: Luca'da bu iki satırı B (brüt) yapın.",
  },
  sgkBase: {
    id: "SGK-BASE",
    short: "SGK istisnası yok",
    title: "Luca'da yemek/yol SGK istisnası tanımsız",
    detail:
      "Luca SGK işçi payını toplam kazancın tamamı üzerinden %14 hesaplıyor. DHR yemek/yol istisnasını SGK matrahından düşüyor. Düzeltme: Luca'da yemek/yol kalemlerine SGK istisna tanımı verin.",
  },
  gv4691: {
    id: "GV-4691",
    short: "4691 GV istisnası yok",
    title: "Luca'da 4691 gelir vergisi istisnası yok",
    detail:
      "DHR teknokent (4691) istisnasıyla gelir vergisini 0 hesaplıyor, Luca tam gelir vergisi kesiyor. Düzeltme: Luca'da ilgili personele 4691 GV stopaj terkini tanımlayın.",
  },
  gvAsgari: {
    id: "GV-ASGARI",
    short: "Asgari ücret istisnası yok",
    title: "Luca'da asgari ücret GV/damga istisnası uygulanmamış",
    detail:
      "DHR GVK 23/18 istisnasıyla gelir ve damga vergisini 0'a indiriyor, Luca kesiyor. Düzeltme: Luca'da asgari ücret istisnasını aktive edin.",
  },
  damga5746: {
    id: "DAMGA-5746",
    short: "Damga terkini farkı",
    title: "Damga vergisi terkini yalnızca Luca'da",
    detail:
      "Luca 5746 kapsamında damga vergisini terkin ediyor (0 veya kısmi), DHR damgayı tam kesiyor. Hangisinin doğru olduğu 5746 md.3 kapsamına göre netleştirilmeli.",
  },
  sgdp: {
    id: "SGDP",
    short: "SGDP oranı farklı",
    title: "Emekli SGDP oranı farklı",
    detail:
      "Luca emekli için SGDP %7,5 uyguluyor ve işsizlik kesmiyor. DHR %14 SGK + %1 işsizlik kesiyor. Emekli çalışanda doğru olan SGDP'dir; DHR tarafı hatalı.",
  },
  stajyer: {
    id: "STAJYER",
    short: "Stajyer SGK farkı",
    title: "Stajyerde SGK kesintisi farkı",
    detail:
      "Luca stajyerde SGK ve işsizlik kesmiyor (yalnızca iş kazası işveren primi). DHR %14 + %1 kesiyor. DHR tarafı hatalı.",
  },
  engelli: {
    id: "ENGELLI",
    short: "Engelli indirimi farkı",
    title: "Engelli indirimi yalnızca Luca'da",
    detail:
      "Luca engellilik indirimini gelir vergisi matrahından düşüyor, DHR düşmüyor. GVK md.31 gereği indirim uygulanmalı; DHR tarafı eksik.",
  },
  netGrossUp: {
    id: "NET-GROSSUP",
    short: "Net→brüt yapılmamış",
    title: "Net ücret Luca'da brütleştirilmemiş",
    detail:
      "Net ücretli çalışanda DHR net→brüt gross-up yapıyor, Luca net tutarı brüt ücret alanına yazılmış. Düzeltme: Luca'da ücreti net olarak işaretleyin.",
  },
  eksikGun: {
    id: "EKSIK-GUN",
    short: "Eksik gün girilmemiş",
    title: "Kısmi istihdam eksik günü Luca'da girilmemiş",
    detail:
      "DHR 26 gün çalışma / 4 gün eksik (kısmi istihdam) ile hesaplıyor, Luca 30 gün tam ücret veriyor. Düzeltme: Luca puantajında eksik gün ve nedenini girin.",
  },
  masraf: {
    id: "OKAN-MASRAF",
    short: "Masraf brüte girmiyor (DHR bug)",
    title: "DHR hatası: masraf brüte yansımıyor",
    detail:
      "Onaylı 750 TL masraf ödeme talebi DHR bordrosunda brüte eklenmemiş (ödeme kaydı paymentId=null olarak bordroya bağlanmamış). Luca'da 750 TL brüte dahil. DHR tarafı hatalı.",
  },
  kumulatif: {
    id: "GV-KUMULATIF",
    short: "Kümülatif matrah yok",
    title: "Geçmiş GV kümülatif matrahı Luca'da yok",
    detail:
      "DHR devreden kümülatif matrahla üst vergi diliminden kesiyor, Luca sıfır matrahtan başlıyor. Düzeltme: Luca'da devreden GV matrahını girin.",
  },
  fmBase: {
    id: "FM-BASE",
    short: "FM tabanı farklı",
    title: "Fazla mesai saat ücreti tabanı farklı",
    detail:
      "Luca fazla mesaiyi net ücret üzerinden hesapladığı için 3.360 TL çıkıyor, DHR brüt ücret tabanıyla 4.183,02 TL hesaplıyor. Düzeltme: Luca'da FM tutarını brüt tabana göre elle girin.",
  },
  besBase: {
    id: "BES-BASE",
    short: "BES matrahı farklı",
    title: "BES %3 matrahı farklı",
    detail:
      "DHR BES'i SGK matrahı üzerinden (1.896,72), Luca toplam kazanç üzerinden (2.105) hesaplıyor. Ayrıca DHR 1.740 TL BES katkısını brüte ekleyip aynı tutarı kesinti olarak düşüyor (net-nötr); Luca'da böyle bir kalem yok.",
  },
  unlabelled: {
    id: "UNLABELLED-GROSS",
    short: "Etiketsiz kazanç",
    title: "DHR brütünde etiketsiz kazanç",
    detail: "DHR brütü kalem toplamından fazla; fark bir kaleme etiketlenmemiş.",
  },
};

const MANUAL = {
  "Hande Orhan": ["eksikGun"],
  "Okan Yildizoglu": ["masraf"],
  "Riza Altunbas": ["kumulatif"],
  "Ceren Toprak": ["fmBase"],
  "Pelin Zengin": ["besBase"],
};

function causesFor(row) {
  const D = row.dhr;
  const L = row.luca;
  const ids = [];
  const push = (k) => {
    if (!ids.includes(k)) ids.push(k);
  };

  if (/Yemek:[^|]*\sN\b/.test(L.digText || "") || /Yol:[^|]*\sN\b/.test(L.digText || "")) {
    if (num(D.gross) < num(L.gross) - 1) push("mealNet");
  }
  if (near(num(L.sgk), r2(num(L.gross) * 0.14), 1) && num(D.sgk) < num(L.sgk) - 1) push("sgkBase");
  if (near(num(L.sgk), r2(num(L.gross) * 0.075), 1)) push("sgdp");
  if (num(L.sgk) === 0 && num(D.sgk) > 0) push("stajyer");
  if (num(D.gv) === 0 && num(L.gv) > 0) push(/4691/.test(row.note || "") ? "gv4691" : "gvAsgari");
  if (num(L.damga) < num(D.damga) - 1) push("damga5746");
  if (/Engelli/i.test(row.note || "") && num(L.gv) < num(D.gv) + 1100) push("engelli");
  if (/Net/i.test(row.note || "") && num(D.salary) > num(L.salary) + 1) push("netGrossUp");
  if (num(row.dhrUnlabelledGross) > 0.05 && !MANUAL[row.name]) push("unlabelled");

  for (const k of MANUAL[row.name] || []) push(k);
  return ids.map((k) => CAUSE[k]);
}

// ---------------------------------------------------------------- mismatches
// Girdi kalemleri elle/puantajdan gelir; türev kalemler bunlardan hesaplanır.
const DERIVED_KEYS = new Set(["gross", "sgk", "unemployment", "gv", "damga", "net"]);
const mismatches = [];

for (const row of data.rows) {
  if (!row.dhr) continue;
  const bad = row.lineItems.filter((i) => !i.match);
  if (!bad.length) continue;
  const netDelta = row.delta ? row.delta.net : null;
  const items = bad.map((i) => ({
    key: i.key,
    label: i.label,
    group: i.group,
    dhr: i.dhr,
    luca: i.luca,
    delta: i.delta,
    derived: DERIVED_KEYS.has(i.key),
  }));
  mismatches.push({
    n: row.n,
    name: row.name,
    note: row.note || row.profile,
    netDelta,
    severity:
      Math.abs(num(netDelta)) > 3000 ? "high" : Math.abs(num(netDelta)) > 1500 ? "medium" : "low",
    inputMismatchCount: items.filter((i) => !i.derived).length,
    items,
    causes: causesFor(row),
  });
}

mismatches.sort((a, b) => Math.abs(num(b.netDelta)) - Math.abs(num(a.netDelta)));

const causeTally = {};
for (const m of mismatches) {
  for (const c of m.causes) causeTally[c.id] = (causeTally[c.id] || 0) + 1;
}

// Notlar kalıcı bayraklardan üretilir; script tekrar çalıştığında da aynı kalır.
const normalizations = [];
for (const row of data.rows) {
  if (!row.dhr) continue;
  for (const key of Object.keys(KEY_LABEL)) {
    if (row.dhr[`${key}Derived`]) {
      normalizations.push(
        `${row.name}: DHR brütüne gömülü ${trFmt(num(row.dhr[key]))} TL ${KEY_LABEL[key]} kolonuna taşındı (DHR Excel'inde ayrı kolon yok) — tutar Luca ile birebir aynı.`,
      );
    }
  }
}
const derivedUnemployment = data.rows.filter((r) => r.dhr && r.luca.unemploymentDerived).length;
if (derivedUnemployment > 0) {
  normalizations.push(
    `${derivedUnemployment} kişide Luca işsizlik işçi payı net mutabakatından geri hesaplandı: Luca PDF'i bu satırı ayrı basmıyor, tutar nete yansıyor (normal profilde brütün %1'i, emekli/stajyerde 0).`,
  );
}
normalizations.push(...unresolved);

data.mismatches = mismatches;
data.mismatchSummary = {
  totalCompared: matched.length,
  mismatchCount: mismatches.length,
  fullMatchCount: matched.length - mismatches.length,
  netWithin100: matched.filter((r) => Math.abs(num(r.delta && r.delta.net)) <= 100).length,
  causeTally: Object.entries(causeTally)
    .map(([id, count]) => ({ ...(Object.values(CAUSE).find((c) => c.id === id) || { id }), count }))
    .sort((a, b) => b.count - a.count),
  normalizations,
};

data.summary.netWithin100 = data.mismatchSummary.netWithin100;
data.summary.avgAbsNetDelta = r2(
  matched.reduce((s, r) => s + Math.abs(num(r.delta && r.delta.net)), 0) / (matched.length || 1),
);

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log(`Uyusmayan: ${mismatches.length}/${matched.length}`);
for (const m of mismatches) {
  console.log(
    `#${m.n} ${m.name} (${m.note}) dNet=${m.netDelta} :: ${m.items.map((i) => i.key).join(",")} :: ${m.causes
      .map((c) => c.id)
      .join(",")}`,
  );
}
console.log("\nSebep dagilimi:");
for (const c of data.mismatchSummary.causeTally) console.log(` ${c.count.toString().padStart(2)} x ${c.id}`);
console.log("\nNormalizasyon:");
for (const s of normalizations) console.log(" -", s);
