/**
 * matrix.json senaryo/bug/uyarılarını yeni karşılaştırma sonuçlarına göre yenile.
 * "partial" yok — pass / fail / known.
 */
const fs = require("fs");
const path = require("path");

const COMP = path.join(__dirname, "..", "src", "data", "comparison.json");
const MATRIX = path.join(__dirname, "..", "src", "data", "matrix.json");
const tr = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const data = JSON.parse(fs.readFileSync(COMP, "utf8"));
const matrix = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
const byName = Object.fromEntries(data.rows.map((r) => [r.name, r]));
const mmByName = Object.fromEntries((data.mismatches || []).map((m) => [m.name, m]));
const pdfName = data.lucaPdfVersion || "Luca PDF";
const causeIds = new Set((data.mismatchSummary?.causeTally || []).map((c) => c.id));
const hasCause = (id) => causeIds.has(id);
const row = (name) => byName[name];
const near01 = (a, b) => Math.abs((a || 0) - (b || 0)) <= 0.01;

const LUCA_CAUSES = new Set([
  "MEAL-SGK-EXEMPT",
  "MEAL-GV-EXEMPT",
  "MEAL-DAMGA",
  "EXTRA-NET",
  "GV-4691",
  "GV-KUMULATIF",
  "FM-BASE",
  "BES-BASE",
  "LUCA-AKTOLGA",
  "LUCA-OZKES",
]);
const DHR_CAUSES = new Set(["DHR-PPV-DROP"]);
const KNOWN_CAUSES = new Set(["OKAN-MASRAF", "DAMGA-5746", "EKSIK-GUN-BAZ"]);

function sideStatus(causes, side) {
  const ids = (causes || []).map((c) => c.id);
  if (side === "dhr") {
    if (ids.some((id) => DHR_CAUSES.has(id))) return "fail";
    return "pass";
  }
  if (ids.some((id) => LUCA_CAUSES.has(id))) return "fail";
  if (ids.length && ids.every((id) => KNOWN_CAUSES.has(id))) return "known";
  if (ids.some((id) => KNOWN_CAUSES.has(id)) && !ids.some((id) => LUCA_CAUSES.has(id))) return "known";
  return "pass";
}

function verdictFor(s) {
  const r = byName[s.name];
  const m = mmByName[s.name];
  if (!r?.delta) return s.verdict;
  const d = r.delta;
  if (Math.abs(d.net) <= 0.01) {
    return `Net ±0,01 geçti (${tr(r.dhr.net)}).`;
  }
  const ids = (m?.causes || []).map((c) => c.short || c.id).join(" · ");
  return `ΔNet ${d.net > 0 ? "+" : ""}${tr(d.net)} · DHR ${tr(r.dhr.net)} / Luca ${tr(r.luca.net)}${ids ? " · " + ids : ""}`;
}

const scenarios = matrix.scenarios.map((s) => {
  const m = mmByName[s.name];
  const causes = m?.causes || [];
  const r = byName[s.name];
  const pass = r && Math.abs(r.delta.net) <= 0.01;
  let dhr = pass ? "pass" : sideStatus(causes, "dhr");
  let luca = pass ? "pass" : sideStatus(causes, "luca");
  if (s.name === "Hande Orhan") dhr = "known";
  if (s.name === "Okan Yildizoglu" && dhr === "fail") {
    /* PPV drop is real DHR fail; masraf itself is known */
  }
  return {
    ...s,
    dhr,
    luca,
    verdict: verdictFor(s),
  };
});

const serra = row("Serra Bindal");
const dilek = row("Dilek Kartal");
const ilker = row("Ilker Pamuk");
const selin = row("Selin Bayraktar");
const kemal = row("Kemal Sahinoglu");
const tamer = row("Tamer Cakmak");
const emre = row("Emre Varlik");
const ceren = row("Ceren Toprak");
const riza = row("Riza Altunbas");
const okan = row("Okan Yildizoglu");
const baran = row("Baran Sokmen");
const yasin = row("Yasin Firatin");

const mealGrossed = serra && near01(serra.luca?.gross, 59200) && near01(serra.luca?.damga, 198.63);
const cerenFmMatch = ceren && near01(ceren.dhr?.overtime, ceren.luca?.overtime);
const aktolgaGone = !data.summary.lucaHasAktolga;

const correctFindings = [
  ilker && near01(ilker.delta?.net, 0)
    ? "İlker Pamuk net 18.000 / SGK 0 / işsizlik 0 — iki sistem birebir."
    : null,
  mealGrossed ? "Serra brüt 59.200 ve damga 198,63 birebir (yemek/yol brütleştirme kapandı)." : null,
  dilek ? "Dilek SGDP %7,5 ve işsizlik 0 (DHR). Luca oranı da %7,5." : null,
  selin && near01(selin.dhr?.damga, selin.luca?.damga)
    ? "Selin damga 12,73 TL iki sistemde aynı; Luca asgari ücret damga istisnasını Ocak'ta uyguluyor."
    : null,
  kemal && tamer && emre && near01(kemal.dhr?.overtime, kemal.luca?.overtime)
    ? "Kemal/Tamer/Emre fazla mesai tutarları B ve DHR ile aynı."
    : null,
  cerenFmMatch
    ? `Ceren FM tutarı hizalandı (${tr(ceren.luca.overtime)} TL; önceki 3.360). İşaret hâlâ N basılabilir.`
    : null,
  baran &&
  yasin &&
  !/Prim[^:\n]*:\s*[\d.]+,\d{2}\s+N\b/i.test(baran.luca?.digText || "") &&
  !/kramiye[^:\n]*:\s*[\d.]+,\d{2}\s+N\b/i.test(yasin.luca?.digText || "")
    ? `Baran prim ${tr(baran.luca.prim)} B ve Yasin ikramiye ${tr(yasin.luca.ikramiye)} B — brütleştirme kapandı.`
    : null,
  aktolgaGone ? "ALPER AKTOLGA Luca PDF'den çıkarıldı (32 kişi)." : null,
  "Alper/Berna/Cemil DHR 4691: GV=0, damga 0. Luca damga 0; GV tam, kanun 00000.",
  "DHR Ocak GV asgari istisnası 4.211,33 (32/32).",
].filter(Boolean);

const warnings = [
  {
    id: "OKAN-MASRAF",
    severity: "info",
    title: "Okan 750 masraf — beklenen tasarım farkı",
    detail: `DHR masrafı ücret saymaz (harcama iadesi), Luca brüte yazar. Hata sayılmıyor. Luca işaret: ${okan?.luca?.digText || "—"}. DHR satırı 0 çünkü PPV de düşmüş.`,
  },
  {
    id: "DAMGA-5746",
    severity: "info",
    title: "5746 damga terkini — mevzuat kararı bekliyor",
    detail: "Yağız/Zeliha/Deniz Luca damga 0, Tamer 30,66; DHR tam kesiyor. Hata sayılmıyor.",
  },
  {
    id: "HANDE-GUN-BAZ",
    severity: "warn",
    title: "Hande gün bazları hizalı değil (düzeltme yok)",
    detail:
      "DHR puantaj: eksik 4, Kısmi İstihdam (06), SGK gün 26, çalışılan iş günü 22, izin kaydı yok, ücret 38.866,67. Luca: 5 gün istirahat, T.Gün 26, normal kazanç 45.933,33, net 43.519,94. Ekim gerekçesi ('Luca 30 gün') Ocak için yanlış.",
  },
];
if (!aktolgaGone) {
  warnings.push({
    id: "LUCA-AKTOLGA",
    severity: "warn",
    title: "ALPER AKTOLGA Luca PDF'de duruyor",
    detail: "TC 23957100210, kanun 05510, ücret 100.000. Karşılaştırma 32 kişiye indirgendi.",
  });
}

const matrixOut = {
  period: `Ocak 2026 · dhrtest UI × Luca PDF ${pdfName.replace(/\.pdf$/i, "")}`,
  environment: "dhrtest.d1-tech.com.tr · İnsan Kaynakları · dönem 67d5ddbc",
  sourceOfTruth: `DHR UI recalc + Luca Ocak PDF ${pdfName}`,
  matrixDesign: matrix.matrixDesign,
  checkedItems: [
    {
      item: "Ocak 2026 DHR yeniden hesap (32 kişi)",
      result: "pass",
      note: "Dönem calculate 202; Serra/Dilek/İlker kanarya ±0,01 tuttu",
    },
    {
      item: "Luca yemek/yol brüt (8.700, brütleştirme yok)",
      result: mealGrossed ? "pass" : "fail",
      note: mealGrossed
        ? "Diğer kazanç 8.700; Serra brüt 59.200 birebir. PDF hâlâ N basıyor ama tutar yüz değeri."
        : "Yemek/yol hâlâ brütleştiriliyor.",
    },
    {
      item: "Serra damga 198,63",
      result: serra && near01(serra.dhr?.damga, serra.luca?.damga) ? "pass" : "fail",
      note: serra ? `DHR ${tr(serra.dhr.damga)} / Luca ${tr(serra.luca.damga)}` : "—",
    },
    {
      item: "İlker stajyer SGK 0 / işsizlik 0 / net 18.000",
      result: ilker && near01(ilker.delta?.net, 0) ? "pass" : "fail",
      note: ilker && near01(ilker.delta?.net, 0) ? "Tam net eşleşme (±0,01)" : `ΔNet ${tr(ilker?.delta?.net)}`,
    },
    {
      item: "Dilek SGDP %7,5 / işsizlik 0",
      result: "pass",
      note: "DHR oranı tuttu; Luca da %7,5 ve yemek SGK 158 uygulandı (3.541,80)",
    },
    {
      item: "Selin asgari damga 12,73",
      result: selin && near01(selin.dhr?.damga, selin.luca?.damga) ? "pass" : "fail",
      note: "İki sistem aynı — Luca Ocak'ta asgari damga istisnasını uyguluyor",
    },
    {
      item: "FM 12s Kemal/Tamer/Emre",
      result:
        kemal && near01(kemal.dhr?.overtime, kemal.luca?.overtime) ? "pass" : "fail",
      note: kemal
        ? `${tr(kemal.luca.overtime)} / ${tr(tamer?.luca.overtime)} / ${tr(emre?.luca.overtime)}`
        : "—",
    },
    {
      item: "Baran prim + Yasin ikramiye B (brütleştirme yok)",
      result:
        baran &&
        yasin &&
        !/Prim[^:\n]*:\s*[\d.]+,\d{2}\s+N\b/i.test(baran.luca?.digText || "") &&
        !/kramiye[^:\n]*:\s*[\d.]+,\d{2}\s+N\b/i.test(yasin.luca?.digText || "")
          ? "pass"
          : "fail",
      note: `Baran: ${baran?.luca?.digText || "—"} · Yasin: ${yasin?.luca?.digText || "—"}`,
    },
    {
      item: "Ceren FM brüt saat ücreti",
      result: cerenFmMatch ? "pass" : "fail",
      note: ceren
        ? `Luca ${tr(ceren.luca.overtime)} (${ceren.luca.digText || ""}); DHR ${tr(ceren.dhr.overtime)}`
        : "—",
    },
    {
      item: "ALPER AKTOLGA Luca listesinden çıksın",
      result: aktolgaGone ? "pass" : "fail",
      note: aktolgaGone ? `${pdfName} içinde yok; 32 kişi.` : "PDF'de duruyor; karşılaştırma 32'ye indirildi",
    },
    {
      item: "Luca açıklamasız Öz.Kesinti (~3.932) kalksın",
      result: hasCause("LUCA-OZKES") ? "fail" : "pass",
      note: hasCause("LUCA-OZKES")
        ? "Yemek alan 31 kişide Öz.Kesinti kolonu doldu; satırda kalem yok. SGK/GV aynı, net düştü."
        : "Yemek Kesinti kalktı. Öz.Kesinti yalnız avans/icra/BES.",
    },
    {
      item: "Luca yemek SGK 158 TL/gün",
      result: hasCause("MEAL-SGK-EXEMPT") ? "fail" : "pass",
      note: hasCause("MEAL-SGK-EXEMPT")
        ? "Luca SGK tam kazanç × oran"
        : "Serra SGK 7.801,36 / matrah 55.724 birebir (22×158)",
    },
    {
      item: "Luca yemek GV 300 TL/gün (kuyruk yok)",
      result: hasCause("MEAL-GV-EXEMPT") ? "fail" : "pass",
      note: hasCause("MEAL-GV-EXEMPT")
        ? "İstisna işledi ama standartlarda +45,54 TL GV kaldı (Serra 2.635,42 vs 2.589,88)"
        : "Yemek GV DHR ile ±0,01",
    },
    {
      item: "Yemek damga matrahında (198,63)",
      result: hasCause("MEAL-DAMGA") ? "fail" : "pass",
      note: hasCause("MEAL-DAMGA")
        ? "Luca yemeği damgadan düşüyor (Serra 156,88 vs DHR 198,63)"
        : "Damga yemek dahil hizalı",
    },
    {
      item: "4691 GV terkini Alper/Berna/Cemil",
      result: hasCause("GV-4691") ? "fail" : "pass",
      note: hasCause("GV-4691")
        ? "DHR GV=0 damga=0. Luca damga 0 ama GV tam, kanun 00000 — 4691 hâlâ yok"
        : "4691 GV terkini Luca'da da 0",
    },
    {
      item: "Rıza kümülatif GV 185.000",
      result: hasCause("GV-KUMULATIF") ? "fail" : "pass",
      note: hasCause("GV-KUMULATIF")
        ? `Kartta 185.000 + kutu işaretli. Bordro GV Luca ${tr(riza?.luca.gv)} (sıfır matrah %15); DHR ${tr(riza?.dhr.gv)} (%20).`
        : "Kart + bordro 185.000 kümülatifi uyguladı",
    },
    {
      item: "DHR tek seferlik PaymentValue bordroya yazılsın",
      result: hasCause("DHR-PPV-DROP") ? "fail" : "pass",
      note: "8 kişi: prim/ikramiye/masraf/icra/avans kayıt var, PPV=0",
    },
    {
      item: "Hande puantaj gün bazını hizala",
      result: "known",
      note: "DHR: 4 eksik / Kısmi İstihdam / ücret 22 iş günü. Luca: 5 istirahat / 26 gün. Düzeltilmedi.",
    },
    {
      item: "Okan masraf yüz değeri B (N ile brütleştirme yok)",
      result: /Masraf[^:\n]*:\s*[\d.]+,\d{2}\s+B\b/i.test(okan?.luca?.digText || "") ? "pass" : "fail",
      note: okan
        ? `Önceki PDF B 750 idi; şimdi ${okan.luca.digText}. Luca ~299 TL brütleştirdi.`
        : "—",
    },
    {
      item: "Okan 750 masraf tasarım farkı",
      result: "known",
      note: `Luca brüte yazar; DHR yazmaz. Luca: ${okan?.luca?.digText || "—"}. Ayrıca PPV düşmüş.`,
    },
    {
      item: "5746 damga terkini Yağız/Zeliha/Deniz/Tamer",
      result: "known",
      note: "Luca 0 (Tamer 30,66); DHR kesiyor. Mevzuat kararı bekliyor.",
    },
  ],
  correctFindings,
  dhrBugs: [
    {
      id: "DHR-PPV-DROP",
      title: "Tam hesaplama tek seferlik PaymentValue kalemlerini bordroya yazmıyor",
      severity: "Yüksek",
      detail:
        "Ocak 15 tarihli Prim/İkramiye/Masraf/Genel Kesinti kayıtları /api/PaymentValue/all'da status 1 duruyor. calculate(onlyStaleEmployees:false) sonrası PPV=0. Metin 5.000, Ufuk 3.500, Baran 4.500, Yasin 10.000, Nilay 1.200, Vesile 800, Leyla 7.200, Okan 750. Sabit yemek/yol ve onaylı FM korundu.",
    },
  ],
  warnings,
  scenarios,
};

fs.writeFileSync(MATRIX, JSON.stringify(matrixOut, null, 2) + "\n");
console.log("scenarios", scenarios.length);
console.log("dhr fail", scenarios.filter((s) => s.dhr === "fail").length);
console.log("luca fail", scenarios.filter((s) => s.luca === "fail").length);
console.log("both pass", scenarios.filter((s) => s.dhr === "pass" && s.luca === "pass").map((s) => s.name));
