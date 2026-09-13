/**
 * Rewrite the Ekim matrix verdicts/findings after the 13.09.2026 recalculation,
 * and record the Ocak re-verification result. Only touches judgement text and
 * statuses; the numeric columns come from refresh-ik-oct-jan.cjs.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const RUN = "13.09.2026 tam yeniden hesaplama";
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

const PPV = {
  "Metin Uslu": "Prim 5.000",
  "Ufuk Demirel": "Prim 3.500",
  "Baran Sokmen": "Prim 4.500",
  "Yasin Firatin": "İkramiye 10.000",
  "Nilay Varol": "Genel kesinti 1.200",
  "Vesile Erkan": "Genel kesinti 800",
  "Okan Yildizoglu": "Masraf 750",
  "Leyla Tuncel": "Avans 7.200",
};

const SCENARIO_PATCH = {
  "Serra Bindal": { dhr: "pass", verdict: "Baz satır: GV istisnası 5.615,10 uygulanıyor, BES yok. Kalan fark Luca’nın 4.211 bandı ve yemek SGK matrahı." },
  "Alper Hancer": { dhr: "pass", verdict: "4691 GV + damga terkini işliyor (GV 0, damga 0). Ocak döneminde de aynı." },
  "Berna Isikli": { dhr: "pass", verdict: "Ar-Ge 4691 terkini işliyor (GV 0, damga 0)." },
  "Cemil Jaleoglu": { dhr: "pass", verdict: "Destek personeli 4691 terkini işliyor (GV 0, damga 0)." },
  "Dilek Kartal": { dhr: "pass", verdict: "SGDP %7,5 (PEK 45.200 → SGK 3.390) ve işsizlik muafiyeti uygulanıyor." },
  "Ilker Pamuk": { dhr: "pass", verdict: "Stajyer kesintisiz: SGK 0, işsizlik 0, GV 0, net = brüt 18.000." },
  "Selin Bayraktar": { dhr: "pass", verdict: "Asgari ücret istisnası GV’yi sıfırlıyor; damga 12,73 kalıyor." },
  "Ersin Lale": { dhr: "pass", verdict: "Engellilik 1. derece indirimi uygulanıyor: GV 2.506,65 → 706,65 (matrah −12.000)." },
  "Fulya Mercan": { dhr: "pass", verdict: "Engellilik 2. derece indirimi GV’yi sıfırlıyor (912,90 → 0)." },
  "Gokhan Narin": { dhr: "pass", verdict: "Engellilik 3. derece indirimi uygulanıyor: GV 1.231,65 → 781,65 (matrah −3.000)." },
  "Riza Altunbas": { dhr: "pass", verdict: "Geçmiş GV matrahı 185.000 üst dilime taşıyor (GV 5.213,90, kümülatif 292.986)." },
  "Pelin Zengin": { dhr: "partial", verdict: "BES yalnız Pelin’den kesiliyor (PEK 61.200 × %3 = 1.836; hedef 1.740). İşveren katkısı 1.740 brütte ama damga matrahında değil." },
  "Vildan Ertem": { dhr: "partial", verdict: "Brütleştirme artık yalnız maaşa uygulanıyor, yemek/yol yüz değerinden geçiyor: toplam net 50.700 → 50.220 (−480)." },
  "Ceren Toprak": { dhr: "partial", verdict: "Net+FM: brütleştirme kapsamı daraldı, toplam net 54.060 → 53.580 (−480). FM 4.141,23 (Luca 4.200,58)." },
  "Hande Orhan": { dhr: "fail", verdict: "Ekim puantajında kısmi 15 gün yok: 30 gün / 53.000 hesaplanıyor (Luca kısmi yansıtıyor). Ocak döneminde 26 gün doğru işliyor." },
  "Yagiz Findik": { dhr: "partial", verdict: "5746 GV terkini uygulanmıyor (GV 2.506,65) ve damga kesiliyor; Luca damga 0. İstisna 5.615,10 doğru." },
  "Zeliha Gurbuz": { dhr: "partial", verdict: "5746 YL: GV terkini yok (912,90), damga 179,65 kesiliyor; Luca damga 0." },
  "Deniz Ulusoy": { dhr: "partial", verdict: "5746 GV stopaj terkini DHR’de uygulanmıyor (GV 2.187,90); istisna ve damga standart." },
  "Tamer Cakmak": { dhr: "partial", verdict: "FM 4.040 doğru; 5746 damga terkini yok (229,29 kesiliyor, Luca 30,66)." },
};

// ---- Ekim ------------------------------------------------------------------
const mtx = readJson(path.join(DATA, "ekim_matrix.json"));
for (const s of mtx.scenarios) {
  if (PPV[s.name]) {
    s.dhr = "fail";
    s.verdict = `${PPV[s.name]} kaydı PaymentValue’da duruyor (status 1) ama tam hesaplama bordroya yazmadı → DHR satırı 0, Luca’da var.`;
    continue;
  }
  const patch = SCENARIO_PATCH[s.name];
  if (patch) Object.assign(s, patch);
}

const KEEP = new Set([
  "Personel aktarımı (TC, ücret, giriş tarihi)",
  "Ekim 2026 puantaj N/H/T gün kodları",
  "05510 kanun (Tolga, Umut, Baran, Emre)",
  "Fazla mesai 12 saat (Kemal, Tamer, Ceren, Emre)",
  "Luca GV istisnası Ekim güncelliği",
  "Yemek 5.500 + yol 3.200 (Luca)",
  "Rıza geçmiş GV matrahı 185.000",
]);
const CHECK_PATCH = {
  "DHR GV istisnası (yasal Ekim 5.615,10)": { result: "pass", note: `Düzeldi (${RUN}): 32/32 kişide 5.615,10 uygulanıyor; Ocak dönemi 4.211,33 — aylık ayrım da çalışıyor.` },
  "DHR otomatik BES %3 (çoğu kişi)": { result: "pass", note: `Düzeldi (${RUN}): yalnız OKS kaydı olan Pelin Zengin (1.836 TL). Diğer 31 kişide BES 0.` },
  "Emekli SGDP / stajyer / yabancı / engelli derecesi": { result: "pass", note: "SGDP %7,5 (Dilek, Ufuk), stajyer kesintisiz (İlker), engellilik indirimi 1/2/3. derece (Ersin, Fulya, Gökhan, Vesile) uygulanıyor." },
  "Kanun 05746 / 15746 / 4691 kartları": { result: "partial", note: "4691 GV+damga terkini işliyor (Alper, Berna, Cemil). 5746 GV/damga terkini hâlâ uygulanmıyor (Yağız, Zeliha, Deniz, Tamer)." },
  "Metin/Ufuk/Baran prim + Yasin ikramiye": { result: "fail", note: "Tam hesaplama sonrası dördü de bordroda 0; PaymentValue kayıtları 2026-10-15 tarihli ve status 1." },
  "Nilay icra 1.200 / Vesile icra 800": { result: "fail", note: "Kesinti kayıtları duruyor, bordroda 0 (DHR-PPV-DROP)." },
  "Leyla avans 7.200": { result: "fail", note: "Avans mahsubu bordroya yazılmadı (DHR 0, Luca 7.200)." },
  "Okan masraf 750": { result: "fail", note: "Masraf DHR bordrosunda 0 (PPV drop); Luca PDF’de de masraf satırı yok." },
  "Hande kısmi 15 iş günü": { result: "fail", note: "Ekim döneminde 30 gün / 53.000 hesaplanıyor; kısmi gün yansımıyor. Ocak döneminde 26 gün doğru." },
  "Net ücret (Vildan, Ceren) → net ödenen 42.000": { result: "partial", note: "Maaş brütleştirmesi çalışıyor ama yemek/yol artık brütleştirilmiyor; toplam net iki kişide de 480 TL düştü." },
  "Pelin Oto.Kat.BES 1.740": { result: "partial", note: "DHR 1.836 (PEK 61.200 × %3); hedef 1.740 (maaş bazlı). Luca PDF 2.001." },
};
mtx.checkedItems = mtx.checkedItems.map((c) => (CHECK_PATCH[c.item] ? { ...c, ...CHECK_PATCH[c.item] } : c)).filter((c) => KEEP.has(c.item) || CHECK_PATCH[c.item]);
mtx.checkedItems.unshift(
  { item: `Ekim dönemi ${RUN} (32 kişi)`, result: "pass", note: "onlyStaleEmployees:false ile 32/32 hesaplandı, failedCount 0. Brüt−kesinti=net tutarlılığı 32/32 (Pelin’de fark = işveren BES katkısı 1.740)." },
  { item: "Ocak dönemi yeniden hesaplama tekrarlanabilirliği", result: "pass", note: "32 kişinin 31’i birebir aynı. Tek fark: Pelin damga 268,76 → 255,55 (işveren BES katkısı damga matrahından çıktı)." },
  { item: "Yemek SGK istisnası dönemler arası tutarlılık", result: "fail", note: "Aynı çalışanda Ekim PEK 53.700 (yemek tamamen istisna), Ocak PEK 55.724 (158 TL/gün × 22 = 3.476 istisna). Ocak Luca ile uyumlu olan doğru uygulama." }
);

mtx.correctFindings = [
  ...mtx.correctFindings.filter((f) => !/BES|istisna fiilen|GV istisnası/i.test(f)),
  `DHR (${RUN}): GV istisnası dönem ayında doğru bantla uygulanıyor (Ekim 5.615,10 / Ocak 4.211,33).`,
  "DHR: BES yalnız OKS kaydı olan çalışandan kesiliyor; oran alanı boş olsa da %3 doğru uygulanıyor.",
  "DHR: 4691 GV + damga terkini, emekli SGDP %7,5, stajyer kesintisizliği ve engellilik indirimi (1/2/3. derece) doğru işliyor.",
  "DHR: brüt − (SGK + işsizlik + GV + damga + BES) = net tutarlılığı 32/32 satırda sağlanıyor.",
];

mtx.dhrBugs = [
  {
    id: "GV-0",
    title: "ÇÖZÜLDÜ — GV istisnası fiilen 0",
    severity: "Kapandı",
    detail: `${RUN} sonrası 32/32 satırda Ekim istisnası 5.615,10 TL uygulanıyor. Kişi başı net etkisi ~842 TL.`,
  },
  {
    id: "GV-MONTH",
    title: "ÇÖZÜLDÜ — Aylık istisna ayrımı yok",
    severity: "Kapandı",
    detail: "Ekim dönemi 5.615,10, Ocak dönemi 4.211,33 uyguluyor; aylık bant ayrımı çalışıyor.",
  },
  {
    id: "BES-AUTO",
    title: "ÇÖZÜLDÜ — BES otomatik herkese",
    severity: "Kapandı",
    detail: "Önce 32/32 kişide BES kesiliyordu; şimdi yalnız OKS kaydı olan Pelin Zengin’den 1.836 TL.",
  },
  {
    id: "STAJ-GV",
    title: "ÇÖZÜLDÜ — Stajyer GV/BES kesintisi",
    severity: "Kapandı",
    detail: "İlker Pamuk: SGK 0, işsizlik 0, GV 0, damga 0, net = brüt 18.000.",
  },
  {
    id: "DHR-PPV-DROP",
    title: "Tam hesaplama tek seferlik PaymentValue kalemlerini bordroya yazmıyor",
    severity: "Yüksek",
    detail:
      `Ekim döneminde tazelendi (${RUN}): 2026-10-15 tarihli Prim/İkramiye/Masraf/Genel Kesinti kayıtları /api/PaymentValue/all’da status 1 duruyor, ` +
      "hesaplama öncesi bordroda görünüyorlardı; calculate(onlyStaleEmployees:false) sonrası hepsi 0. Baran 4.500, Metin 5.000, Ufuk 3.500, Yasin 10.000, Nilay 1.200, Vesile 800, Okan 750, Leyla avans 7.200. " +
      "Sabit yemek/yol korunuyor. Aynı hata Ocak döneminde de açık.",
  },
  {
    id: "DHR-YEMEK-SGK",
    title: "Yemek yardımının SGK matrahı dönemler arasında tutarsız",
    severity: "Yüksek",
    detail:
      "Aynı çalışan, aynı 5.500 TL yemek: Ekim döneminde tamamı prime esas kazançtan çıkarılıyor (PEK 53.700), Ocak döneminde 158 TL/gün × 22 = 3.476 TL istisna uygulanıyor (PEK 55.724). " +
      "5510 md. 80 kapsamında ikisi birlikte doğru olamaz; Luca ile uyumlu olan Ocak uygulaması. Ekim’de kişi başı ~283 TL işçi SGK farkı doğuyor.",
  },
  {
    id: "DHR-KISMI-EKIM",
    title: "Kısmi ay puantajı Ekim döneminde yansımıyor",
    severity: "Orta",
    detail: "Hande Orhan Ekim döneminde 30 gün / 53.000 TL hesaplanıyor; kısmi 15 iş günü senaryosu bordroya girmiyor. Ocak döneminde aynı kişi 26 gün / 38.866,67 TL ile doğru hesaplanıyor.",
  },
  {
    id: "DHR-NET-GROSSUP",
    title: "Net ücret brütleştirmesi yemek/yol kalemlerini kapsamıyor",
    severity: "Orta",
    detail:
      "Vildan Ertem ve Ceren Toprak (net hedef 42.000): brütleştirme yalnız maaşa uygulanıyor, yemek 5.500 ve yol 3.200 yüz değerinden bordroya giriyor. " +
      "Toplam net iki kişide de 480 TL düşüyor (50.700 → 50.220 ve 54.060 → 53.580).",
  },
  {
    id: "DHR-5746-TERKIN",
    title: "5746 GV/damga terkini uygulanmıyor",
    severity: "Orta",
    detail: "4691 profillerinde (Alper, Berna, Cemil) terkin işlerken 5746 profillerinde (Yağız, Zeliha, Deniz, Tamer) GV ve damga standart kesiliyor; Luca damga 0 yazıyor.",
  },
];
mtx.sourceOfTruth = `${mtx.sourceOfTruth} · DHR kolonu ${RUN} API dump’ı ile tazelendi.`;
writeJson(path.join(DATA, "ekim_matrix.json"), mtx);

// ---- Ocak ------------------------------------------------------------------
const ocak = readJson(path.join(DATA, "matrix.json"));
ocak.checkedItems.unshift({
  item: `Ocak dönemi ${RUN} ile yeniden doğrulama`,
  result: "pass",
  note: "32 kişinin 31’i birebir aynı çıktı; tek fark Pelin Zengin damga 268,76 → 255,55 (işveren BES katkısı damga matrahından çıktı). Hesap tekrarlanabilir.",
});
const ppvOcak = ocak.dhrBugs.find((b) => b.id === "DHR-PPV-DROP");
if (ppvOcak) ppvOcak.detail += ` Ekim döneminde de tazelendi (${RUN}): 2026-10-15 tarihli kayıtlar status 1 duruyor, hesaplama sonrası bordroda 0.`;
ocak.dhrBugs.push({
  id: "DHR-YEMEK-SGK",
  title: "Yemek SGK istisnası Ekim döneminde farklı uygulanıyor",
  severity: "Yüksek",
  detail: "Ocak’ta 158 TL/gün × 22 = 3.476 TL istisna (Luca ile uyumlu, PEK 55.724). Aynı çalışan Ekim döneminde yemeğin tamamı istisna sayılıyor (PEK 53.700).",
});
writeJson(path.join(DATA, "matrix.json"), ocak);

console.log("ekim scenarios:", mtx.scenarios.length, "dhr fail:", mtx.scenarios.filter((s) => s.dhr === "fail").length, "partial:", mtx.scenarios.filter((s) => s.dhr === "partial").length, "pass:", mtx.scenarios.filter((s) => s.dhr === "pass").length);
console.log("ekim checked:", mtx.checkedItems.length, "bugs:", mtx.dhrBugs.length);
console.log("ocak checked:", ocak.checkedItems.length, "bugs:", ocak.dhrBugs.length);
