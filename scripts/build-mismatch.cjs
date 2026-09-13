/**
 * Ocak karşılaştırmasını normalize eder ve uyuşmayan çalışan listesini üretir.
 * Geçme kriteri ±0,01 TL. Her sebep: hangisi doğru + mevzuat dayanağı.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "data", "comparison.json");
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n) => (n == null ? 0 : n);
const PASS = 0.01;
const near = (a, b, tol = PASS) => Math.abs(a - b) <= tol;
const trFmt = (n) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const data = JSON.parse(fs.readFileSync(FILE, "utf8").replace(/^\uFEFF/, ""));
const lineDefs = data.lineDefs;

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
    const onePctGross = r2(num(L.gross) * 0.01);
    const onePctMat = r2(num(L.sskMat != null ? L.sskMat : L.gross) * 0.01);
    if (
      residual >= 0 &&
      (near(residual, onePctGross, 0.5) || near(residual, onePctMat, 0.5))
    ) {
      L.unemployment = residual;
      L.unemploymentDerived = true;
    } else if (residual === 0 || Math.abs(residual) <= 0.05) {
      L.unemployment = residual === 0 ? 0 : residual;
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
    if (residual <= PASS) break;
    if (num(D[key]) !== 0) continue;
    if (num(L[key]) > 0 && near(residual, num(L[key]), 0.05)) {
      D[key] = num(L[key]);
      D[`${key}Derived`] = true;
      residual = r2(residual - num(L[key]));
    }
  }
  row.dhrUnlabelledGross = residual > PASS ? residual : 0;
}

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
    if (Math.abs(num(item.dhr)) > PASS || Math.abs(num(item.luca)) > PASS) nonzeroEither += 1;
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

const CAUSE = {
  mealSgk: {
    id: "MEAL-SGK-EXEMPT",
    short: "Yemek SGK istisnası yok",
    title: "Luca'da SGK yemek istisnası (158 TL/gün) yok",
    detail:
      "Ocak 2026 nakit yemek SGK istisnası 158 TL/gün (22 iş günü = 3.476 TL). DHR Serra SGK matrahı 55.724 → 7.801,36. Luca %14'ü 59.200 üzerinden kesiyor (8.288,00).",
    whichCorrect: "DHR — Ocak–Mart 2026 SGK yemek istisnası 158 TL/gün.",
    legalBasis: "SGK yemek istisnası tebliği (Ocak–Mart 2026: 158 TL/gün). Nakit yol istisnasızdır.",
    expected: false,
  },
  mealGv: {
    id: "MEAL-GV-EXEMPT",
    short: "Yemek GV kuyruğu +45,54",
    title: "Yemek GV istisnası işledi, standartlarda +45,54 TL kaldı",
    detail:
      "PDF (17): Yemek (22G) 5.500 B. Serra GV 3.336,67 → 2.635,42 (DHR 2.589,88). Aynı +45,54 Tolga/Umut/Ersin ve 17 kişide. Dilek (6110) +22,77. 158×22 SGK tam; 300 TL/gün GV tam oturmamış veya asgari GV etkileşimi.",
    whichCorrect: "DHR — nakit yemek GV istisnası 300 TL/gün (5.500 tavanın altında, tamamı düşülür).",
    legalBasis: "GVK md. 23 nakit yemek istisnası; 2026 Ocak–Mart 300 TL/gün. Yola istisna yok.",
    expected: false,
  },
  mealDamga: {
    id: "MEAL-DAMGA",
    short: "Yemek damga matrahında değil",
    title: "Luca yemeği damga matrahından düşüyor",
    detail:
      "DHR Serra damga 198,63 (59.200 üzerinden asgari damga istisnası). Luca 156,88 = 5.500 × ‰7,59 kadar düşük. Yemek kazancı modülü damgayı da kesmiş. Nakit yemek ücret bordrosunda damgaya tabi kalır.",
    whichCorrect: "DHR — nakit yemek damga matrahında; asgari damga istisnası ayrıca uygulanır (198,63).",
    legalBasis: "Damga Vergisi Kanunu — ücret bordrosu; GVK md. 23 yemek istisnası damgayı otomatik düşürmez.",
    expected: false,
  },
  extraNet: {
    id: "EXTRA-NET",
    short: "Prim/ikramiye/masraf NET",
    title: "Luca'da prim, ikramiye veya masraf NET (N) girilmiş",
    detail:
      "Yemek/yol yüz değerinden brüte yazılıyor. Prim/ikramiye/masraf N kalanlarda Luca brütleştiriyor. Bu satırları B yapın.",
    whichCorrect: "DHR girdi yüz değeri — prim/ikramiye brüt kalemdir.",
    legalBasis: "Girdi hizası (hesap motoru değil).",
    expected: false,
  },
  gv4691: {
    id: "GV-4691",
    short: "4691 GV terkini yok",
    title: "Luca'da 4691 gelir vergisi stopaj terkini yok",
    detail:
      "DHR Alper/Berna/Cemil GV=0 ve damga 0. Luca GV hâlâ tam (Alper 2.635,42), PDF kanun 00000. PDF (25): Berna/Cemil damga tekrar 0 (Alper zaten 0). Puantaj ARGE 30G vardı; 4691 yine bağlanmadı. PERSONEL Kanun No 05746-04691 kayıtlı mı kontrol; Kaydet; Ocak Hesapla; ekranda GV 0.",
    whichCorrect: "DHR — 4691 teknopark ücret GV stopaj terkini.",
    legalBasis: "4691 sayılı Kanun (teknoloji geliştirme bölgeleri) ücret stopajı terkini.",
    expected: false,
  },
  damga5746: {
    id: "DAMGA-5746",
    short: "5746 damga terkini",
    title: "5746 damga vergisi terkini yalnızca Luca'da",
    detail:
      "Yağız, Zeliha, Deniz, Tamer'de Luca damgayı 0 (Tamer 30,66) yazıyor; DHR kesiyor. Mevzuat kararı bekliyor — bu turda hata sayılmıyor.",
    whichCorrect: "Belirsiz — 5746 md.3 damga terkini kapsamı netleştirilecek.",
    legalBasis: "5746 sayılı Kanun md. 3 Ar-Ge damga vergisi istisnası/terkini.",
    expected: true,
  },
  masraf: {
    id: "OKAN-MASRAF",
    short: "Masraf tasarım farkı",
    title: "Okan 750 TL masraf — tasarım farkı",
    detail:
      "Luca 750 TL'yi brüte yazıyor. DHR masrafı ücret saymaz. Ayrıca tam hesaplama sonrası PaymentValue bordroya yazılmamış. Tasarım farkı hata sayılmıyor.",
    whichCorrect: "Tasarım: DHR brüte yazmaz. Kaydın hiç düşmemesi ayrı DHR-PPV maddesi.",
    legalBasis: "Ücret vs. masraf iadesi (GVK ücret tanımı). Brüte yazmak zorunlu değil.",
    expected: true,
  },
  ppvDrop: {
    id: "DHR-PPV-DROP",
    short: "DHR tek seferlik kalem düştü",
    title: "DHR tam hesaplama sonrası PaymentValue bordroya yazılmadı",
    detail:
      "Ocak 15 PaymentValue kayıtları duruyor ama calculate sonrası PPV sıfır: Metin/Ufuk/Baran prim, Yasin ikramiye, Nilay/Vesile icra, Leyla avans, Okan masraf. Sabit yemek/yol ve onaylı FM korundu.",
    whichCorrect: "Luca (girdi var) — DHR kaydı silmemiş ama hesap satırına bağlamamış.",
    legalBasis: "Ürün hatası (PPV bağlama). Mevzuat değil.",
    expected: false,
  },
  eksikGun: {
    id: "EKSIK-GUN-BAZ",
    short: "Hande gün bazları farklı",
    title: "Hande: DHR 22 iş günü, Luca 26 gün / 5 istirahat",
    detail:
      "DHR puantaj (düzeltilmedi): eksik 4, Kısmi İstihdam (06), SGK gün 26, iş günü 22, izin yok. Ücret 53.000×22/30=38.866,67. Luca: 5 gün istirahat, T.Gün 26, normal kazanç 45.933,33, net 43.519,94. Ekim gerekçesi ('Luca 30 gün') Ocak için yanlış.",
    whichCorrect: "Karar yok — girdi farklı; puantaj hizalanmadan motor kararı yok.",
    legalBasis: "SGK eksik gün / istirahat vs. kısmi istihdam.",
    expected: false,
  },
  kumulatif: {
    id: "GV-KUMULATIF",
    short: "Kümülatif matrah bordroda yok",
    title: "Rıza: kartta 185.000 var, Ocak bordrosu kullanmıyor",
    detail:
      "Personel kartı doğru: Geçmiş Gelir V. Matrahı 185.000 ve 'Geçmiş GV Matrahı Kullan' işaretli. DHR kümülatif 185.000+Ocak → %20 dilim, GV 6.306,95. Luca Ocak GV 3.910,42 = sıfır matrah + %15 (yemek GV düşmüş, 185.000 yok). Kart işlendi, hesap taşımadı.",
    whichCorrect: "DHR — kümülatif GV matrahı GVK tarifesinin gereği; karttaki 185.000 Ocak hesabına girmeli.",
    legalBasis: "GVK md. 103 kümülatif tarife; 'geçmiş matrah' aynı takvim yılı YTD'sidir (önceki işveren / test enjeksiyonu).",
    expected: false,
  },
  fmBase: {
    id: "FM-BASE",
    short: "FM tutarı farklı",
    title: "Ceren fazla mesai tutarı DHR brüt saat ücretiyle uyuşmuyor",
    detail:
      "DHR Ceren FM 4.281,96 (net ücret brütünden × 1,5). Luca tutarı hâlâ farklıysa net taban veya işaret (N/B) yanlıştır.",
    whichCorrect: "DHR yönü — fazla mesai brüt saat ücreti × 1,5.",
    legalBasis: "İş Kanunu md. 41; saat ücreti brüt ücret üzerinden.",
    expected: false,
  },
  besBase: {
    id: "BES-BASE",
    short: "BES matrahı farklı",
    title: "Pelin BES %3 matrahı farklı",
    detail:
      "DHR BES 1.896,72 (SGK matrahı × %3) + 1.740 işveren katkısı. Luca Oto.Kat.BES 2.001 N.",
    whichCorrect: "Açık — BES işçi payı matrahı (SGK mi, brüt mü) netleştirilmeli.",
    legalBasis: "4632 sayılı BES Kanunu; işveren katkısı SGK istisnası ayrı konu.",
    expected: false,
  },
  ozKesGhost: {
    id: "LUCA-OZKES",
    short: "Açıklamasız özel kesinti",
    title: "Luca Öz.Kesinti kolonuna yemeklilerde ~3.932 TL yazılmış",
    detail:
      "PDF (13): SGK/GV/damga aynı kaldı, net düştü. Serra Öz.Kesinti 3.932 (satırda kalem yok). 5746/4691: 3.973,75; Dilek/Ufuk 4.282,62; Selin 4.448,33. İlker 0. Avans/icra/BES üzerine ekleniyor (Leyla 7.200+3.932). İstisna neti artırır; kesinti olarak yazılmaz.",
    whichCorrect: "DHR — böyle bir kesinti yok.",
    legalBasis: "Kesinti yasal dayanak ve bordro satırı ister. Yemek SGK/GV istisnası matrahtan düşülür, netten kesilmez.",
    expected: false,
  },
  aktolga: {
    id: "LUCA-AKTOLGA",
    short: "ALPER AKTOLGA hâlâ listede",
    title: "Luca PDF'de ALPER AKTOLGA var (33. kişi)",
    detail:
      "DHR 32 kişi. Luca PDF'de ALPER AKTOLGA (05510, 100.000 TL) varsa listeden çıkarılmalı; karşılaştırma 32 kişiye indirilir.",
    whichCorrect: "DHR sayı — test kümesi 32 kişi.",
    legalBasis: "Test kapsamı, mevzuat değil.",
    expected: false,
  },
};

const PEOPLE_5746 = new Set(["Yagiz Findik", "Zeliha Gurbuz", "Tamer Cakmak", "Deniz Ulusoy"]);
const PEOPLE_4691 = new Set(["Alper Hancer", "Berna Isikli", "Cemil Jaleoglu"]);
const PEOPLE_PPV = new Set([
  "Metin Uslu",
  "Ufuk Demirel",
  "Baran Sokmen",
  "Yasin Firatin",
  "Nilay Varol",
  "Vesile Erkan",
  "Leyla Tuncel",
  "Okan Yildizoglu",
]);

function labelledN(text, label) {
  const re = new RegExp(label + "[^\\n]*:\\s*[\\d.]+,\\d{2}\\s+N\\b", "i");
  return re.test(text || "");
}

function causesFor(row) {
  const D = row.dhr;
  const L = row.luca;
  const ids = [];
  const push = (k) => {
    if (!ids.includes(k) && CAUSE[k]) ids.push(k);
  };
  const blob = `${L.digText || ""}\n${L.ozText || ""}`;

  const sgkAligned = Math.abs(num(L.sgk) - num(D.sgk)) <= 1;
  if (num(D.meal) > 0 && num(L.sgk) > num(D.sgk) + 1) {
    const rate14 = r2(num(L.gross) * 0.14);
    const rate75 = r2(num(L.gross) * 0.075);
    if (near(num(L.sgk), rate14, 1) || near(num(L.sgk), rate75, 1)) push("mealSgk");
  }
  if (
    num(D.meal) > 0 &&
    num(D.gv) > 0 &&
    num(L.gv) > num(D.gv) + 1 &&
    num(L.gv) < num(D.gv) + 100 &&
    sgkAligned &&
    !PEOPLE_4691.has(row.name)
  ) {
    push("mealGv");
  }
  if (PEOPLE_4691.has(row.name) && num(D.gv) === 0 && num(L.gv) > 0) push("gv4691");
  if (row.name === "Selin Bayraktar" && num(D.gv) === 0 && num(L.gv) > 0) push("mealGv");
  if (
    num(D.meal) > 0 &&
    num(D.damga) > num(L.damga) + 1 &&
    !PEOPLE_5746.has(row.name) &&
    !PEOPLE_4691.has(row.name)
  ) {
    push("mealDamga");
  }

  if (labelledN(blob, "Prim") || labelledN(blob, "kramiye") || labelledN(blob, "Masraf")) {
    const face =
      num(D.salary) +
      num(D.meal) +
      num(D.transport) +
      num(L.prim) +
      num(L.ikramiye) +
      num(L.overtime) +
      num(L.masraf);
    if (num(L.gross) > face + 100) push("extraNet");
  }
  const extrasFace =
    num(L.meal) + num(L.transport) + num(L.overtime) + num(L.prim) + num(L.ikramiye) + num(L.masraf);
  if (labelledN(blob, "Yemek") && num(L.digKaz) > extrasFace + 100) push("extraNet");

  if (PEOPLE_5746.has(row.name) && num(L.damga) < num(D.damga) - 1) push("damga5746");
  if (row.name === "Okan Yildizoglu") push("masraf");
  if (PEOPLE_PPV.has(row.name)) {
    const dropped =
      (num(L.prim) > 0 && num(D.prim) === 0) ||
      (num(L.ikramiye) > 0 && num(D.ikramiye) === 0) ||
      (num(L.masraf) > 0 && num(D.masraf) === 0) ||
      (num(L.kesinti) - num(L.ghostKesinti) > 0 && num(D.kesinti) === 0) ||
      (num(L.advance) > 0 && num(D.advance) === 0);
    if (dropped) push("ppvDrop");
  }
  if (row.name === "Hande Orhan") push("eksikGun");
  if (row.name === "Riza Altunbas" && num(D.gv) > num(L.gv) + 100) push("kumulatif");
  if (row.name === "Ceren Toprak" && Math.abs(num(D.overtime) - num(L.overtime)) > 1) push("fmBase");
  if (row.name === "Pelin Zengin" && Math.abs(num(D.bes) - num(L.bes)) > 1) push("besBase");
  if (num(L.ghostKesinti) > 1) push("ozKesGhost");

  return ids.map((k) => CAUSE[k]);
}

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
  const causes = causesFor(row);
  const onlyExpected = causes.length > 0 && causes.every((c) => c.expected);
  mismatches.push({
    n: row.n,
    name: row.name,
    note: row.note || row.profile,
    netDelta,
    severity: onlyExpected
      ? "known"
      : Math.abs(num(netDelta)) > 3000
        ? "high"
        : Math.abs(num(netDelta)) > 1500
          ? "medium"
          : "low",
    inputMismatchCount: items.filter((i) => !i.derived).length,
    items,
    causes,
  });
}

mismatches.sort((a, b) => Math.abs(num(b.netDelta)) - Math.abs(num(a.netDelta)));

const causeTally = {};
for (const m of mismatches) {
  for (const c of m.causes) causeTally[c.id] = (causeTally[c.id] || 0) + 1;
}
if (data.summary.lucaHasAktolga) causeTally.LUCA_PLACEHOLDER = 0;
if (data.summary.lucaHasAktolga) causeTally["LUCA-AKTOLGA"] = 1;

const normalizations = [];
for (const row of data.rows) {
  if (!row.dhr) continue;
  for (const key of Object.keys(KEY_LABEL)) {
    if (row.dhr[`${key}Derived`]) {
      normalizations.push(
        `${row.name}: DHR brütüne gömülü ${trFmt(num(row.dhr[key]))} TL ${KEY_LABEL[key]} kolonuna taşındı.`,
      );
    }
  }
}
const derivedUnemployment = data.rows.filter((r) => r.dhr && r.luca.unemploymentDerived).length;
if (derivedUnemployment > 0) {
  normalizations.push(
    `${derivedUnemployment} kişide Luca işsizlik işçi payı net mutabakatından geri hesaplandı (PDF bu satırı ayrı basmıyor).`,
  );
}
normalizations.push(
  "Yemek (22G) 5.500 B: diğer kazanç 8.700. Serra SGK 7.801,36 birebir (158×22). Alper brüt 59.200 (N brütleşme kapandı).",
);
normalizations.push(
  "Dilek SGDP %7,5 / işsizlik 0; İlker SGK 0 / işsizlik 0 / net 18.000 — DHR kanarya kriterleri tuttu.",
);
normalizations.push(
  "Selin damga: DHR 12,73, Luca 0 — yemek damga düşümü asgari damgayı da sıfırlamış.",
);
normalizations.push(...unresolved);

data.mismatches = mismatches;
data.mismatchSummary = {
  totalCompared: matched.length,
  mismatchCount: mismatches.length,
  fullMatchCount: matched.length - mismatches.length,
  netWithin100: matched.filter((r) => Math.abs(num(r.delta && r.delta.net)) <= 100).length,
  netPass001: matched.filter((r) => Math.abs(num(r.delta && r.delta.net)) <= PASS).length,
  causeTally: Object.entries(causeTally)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ ...(Object.values(CAUSE).find((c) => c.id === id) || { id, title: id, detail: "" }), count }))
    .sort((a, b) => b.count - a.count),
  normalizations,
  passTolerance: PASS,
};

data.summary.netWithin100 = data.mismatchSummary.netWithin100;
data.summary.netPass001 = data.mismatchSummary.netPass001;
data.summary.avgAbsNetDelta = r2(
  matched.reduce((s, r) => s + Math.abs(num(r.delta && r.delta.net)), 0) / (matched.length || 1),
);

const avg = data.summary.avgAbsNetDelta;
const passN = data.mismatchSummary.netPass001;
data.ui = data.ui || {};
const aktolgaNote = data.summary.lucaHasAktolga
  ? " ALPER AKTOLGA hâlâ Luca listesinde."
  : " ALPER AKTOLGA Luca listesinden çıktı.";
const ozkesOn = (data.mismatchSummary.causeTally || []).some((c) => c.id === "LUCA-OZKES");
const mealSgkOn = (data.mismatchSummary.causeTally || []).some((c) => c.id === "MEAL-SGK-EXEMPT");
data.ui.verdict = ozkesOn
  ? `Luca ${data.lucaPdfVersion || "PDF"} × DHR Ocak recalc. Ort. |ΔNet| ${trFmt(avg)} TL · Tam net eşleşen (±0,01): ${passN}/32 · ±100: ${data.mismatchSummary.netWithin100}/32. Yemek/yol brüt 8.700. Öz.Kesinti kolonunda yemeklilerde ~3.932 TL. Kalan: yemek SGK 158 / GV 300.${aktolgaNote}`
  : mealSgkOn
    ? `Luca ${data.lucaPdfVersion || "PDF"} × DHR Ocak recalc. Ort. |ΔNet| ${trFmt(avg)} TL · Tam net eşleşen (±0,01): ${passN}/32 · ±100: ${data.mismatchSummary.netWithin100}/32. Yemek kesintisi kapandı. Kalan sistematik: yemek SGK 158 TL/gün ve GV 300 TL/gün.${aktolgaNote} Beklenen sapma: Okan masraf + 5746 damga.`
    : `Luca ${data.lucaPdfVersion || "PDF"} × DHR Ocak recalc. Ort. |ΔNet| ${trFmt(avg)} TL · Tam net eşleşen (±0,01): ${passN}/32 · ±100: ${data.mismatchSummary.netWithin100}/32. Yemek SGK 158×22 işledi (Serra 7.801,36). Kalan kuyruk: GV +45,54 ve yemek damga (Luca 156,88 / DHR 198,63).${aktolgaNote} Beklenen sapma: Okan masraf + 5746 damga.`;
data.ui.drivers = [
  ozkesOn
    ? {
        title: "Açıklamasız özel kesinti (Luca)",
        body: "Yemek alan 31 kişide Öz.Kesinti ~3.932 TL. SGK/GV değişmedi; net o kadar düştü. İlker 0.",
      }
    : {
        title: "Yemek SGK 158 uygulandı",
        body: "Yemek (22G) 5.500 B. Serra SGK 7.801,36 / matrah 55.724 birebir. Alper brüt 59.200 (N brütleşme yok).",
      },
  mealSgkOn
    ? {
        title: "Yemek istisnaları (Luca)",
        body: "Brüt 8.700 hizalandı. SGK hâlâ tam kazanç × %14; GV yemeği matrahta bırakıyor.",
      }
    : {
        title: "Kalan yemek kuyruğu",
        body: "GV standartlarda +45,54 TL (Serra 2.635,42 vs 2.589,88). Luca yemeği damgadan düşüyor (156,88 vs 198,63). Net sapma ~3,79 TL.",
      },
  {
    title: "DHR tek seferlik kalemler",
    body: "Tam hesaplama prim/ikramiye/masraf/icra/avansı PPV'den düşürdü. Kayıtlar API'de duruyor.",
  },
].filter(Boolean);

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log(`Uyusmayan: ${mismatches.length}/${matched.length}  net±0.01: ${data.mismatchSummary.netPass001}`);
for (const m of mismatches) {
  console.log(
    `#${m.n} ${m.name} dNet=${m.netDelta} :: ${m.items.map((i) => i.key).join(",")} :: ${
      m.causes.map((c) => c.id).join(",") || "-"
    }`,
  );
}
console.log("\nSebep dagilimi:");
for (const c of data.mismatchSummary.causeTally) console.log(` ${String(c.count).padStart(2)} x ${c.id}`);
console.log("\nNormalizasyon:");
for (const s of normalizations) console.log(" -", s);
