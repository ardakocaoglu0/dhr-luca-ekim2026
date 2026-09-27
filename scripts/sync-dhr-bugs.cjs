/**
 * Align dashboard + tab "DHR sorunları" + senaryo metinleri with comparison dumps.
 * Does not re-fetch DHR. Call after apply-testplan-site.cjs.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const PASS = 0.01;
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round((Number(n) + Number.EPSILON) * 100) / 100);
const nz = (v) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
const tr = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fold = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v, space = 2) => fs.writeFileSync(p, JSON.stringify(v, null, space) + (space === 2 || space === 1 ? "\n" : ""));

function findRow(data, ...names) {
  if (!data?.rows) return null;
  for (const n of names) {
    const f = fold(n);
    const r = data.rows.find((x) => x.name === n || x.sicil === n || x.tc === n || fold(x.name) === f);
    if (r) return r;
  }
  return null;
}

function upsert(list, item, prepend = false) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else if (prepend) list.unshift(item);
  else list.push(item);
}

function drop(list, ids) {
  const set = new Set(ids);
  return (list || []).filter((x) => !set.has(x.id));
}

function setChecked(mtx, re, patch) {
  for (const c of mtx.checkedItems || []) {
    if (re.test(c.item)) Object.assign(c, patch);
  }
}

function patchScenario(mtx, name, fields) {
  const s = (mtx.scenarios || []).find((x) => fold(x.name) === fold(name));
  if (!s) return;
  Object.assign(s, fields);
}

function liveVerdict(row, extra) {
  if (!row?.dhr?.net && row?.dhr?.net !== 0) return extra || "";
  const bits = [`DHR ${tr(row.dhr.net)}`];
  if (row.luca?.net != null) bits.push(`Luca ${tr(row.luca.net)}`);
  if (row.ai?.net != null) bits.push(`YZ ${tr(row.ai.net)}`);
  const delta = row.delta?.net;
  let s = bits.join(" / ");
  if (delta != null) s += ` (ΔDHR−Luca ${tr(delta)})`;
  if (extra) s += `. ${extra}`;
  else s += ".";
  return s;
}

function sync() {
  const ekim = readJson(path.join(DATA, "ekim_comparison.json"));
  const ocak = readJson(path.join(DATA, "comparison.json"));
  const izole = readJson(path.join(DATA, "izole_comparison.json"));
  const paket = readJson(path.join(DATA, "paket_comparison.json"));
  const faz1 = readJson(path.join(DATA, "faz1_comparison.json"));
  const takvim = readJson(path.join(DATA, "takvim_comparison.json"));
  const dash = readJson(path.join(DATA, "dashboard.json"));

  const serraEkim = findRow(ekim, "Serra Bindal");
  const serraOcak = findRow(ocak, "Serra Bindal");
  const handeEkim = findRow(ekim, "Hande Orhan");
  const handeOcak = findRow(ocak, "Hande Orhan");
  const yagiz = findRow(ekim, "Yagiz Findik");
  const zeliha = findRow(ekim, "Zeliha Gurbuz");
  const deniz = findRow(ekim, "Deniz Ulusoy");
  const tamer = findRow(ekim, "Tamer Cakmak");
  const vildan = findRow(ekim, "Vildan Ertem");
  const ceren = findRow(ekim, "Ceren Toprak");
  const leyla = findRow(ekim, "Leyla Tuncel");
  const leylaOcak = findRow(ocak, "Leyla Tuncel");
  const metin = findRow(ekim, "Metin Uslu");
  const baran = findRow(ekim, "Baran Sokmen");
  const ufuk = findRow(ekim, "Ufuk Demirel");
  const yasin = findRow(ekim, "Yasin Firatin");
  const nilay = findRow(ekim, "Nilay Varol");
  const vesile = findRow(ekim, "Vesile Erkan");
  const okan = findRow(ekim, "Okan Yildizoglu");
  const ada = findRow(izole, "Ada Korkmaz");
  const leman = findRow(izole, "Leman Su");
  const mert = findRow(izole, "Mert Acar");
  const umay = findRow(izole, "Umay Gunes");
  const derya = findRow(izole, "Derya Unal");
  const hakanIz = findRow(izole, "Hakan Boz");
  const isik = findRow(izole, "Isik Demirci");
  const mine = findRow(paket, "Mine Aras");
  const baris = findRow(paket, "Baris Nur");
  const ahu = findRow(paket, "Ahu Mor");
  const koray = findRow(paket, "Koray Zan");
  const lale = findRow(paket, "Lale Ada");
  const nehir = findRow(paket, "Nehir Can");
  const onur = findRow(paket, "Onur Dem");
  const ruya = findRow(paket, "Ruya Fen");
  const gulce = findRow(faz1, "Gulce Han", "Gülce Han");
  const firat = findRow(faz1, "Firat Deniz", "Fırat Deniz", "8008");
  const cemre = takvim.rows?.[0];
  const nihan = findRow(faz1, "Nihan Yıldız", "Nihan Yildiz", "8016");

  const kismiEkimOk = nz(handeEkim?.dhr?.sgkDays) <= 16 && nz(handeEkim?.dhr?.salary) < 40000;
  const terkin5746 =
    nz(yagiz?.dhr?.damga) < 1 &&
    Math.abs(nz(derya?.dhr?.gv) - nz(ada?.dhr?.gv)) > 1 &&
    Math.abs(nz(ahu?.dhr?.gv) - nz(mine?.dhr?.gv)) > 1;
  const engelOk = Math.abs(nz(baris?.dhr?.gv) - nz(mine?.dhr?.gv)) > 1 && Math.abs(nz(leman?.dhr?.gv) - nz(ada?.dhr?.gv)) > 1;
  const icraCap = nz(koray?.dhr?.icra) > 1 && nz(koray?.dhr?.icra) + 1 < nz(koray?.luca?.icra);
  const ppvPrimOk =
    nz(metin?.dhr?.prim) > 1 && nz(baran?.dhr?.prim) > 1 && nz(ufuk?.dhr?.prim) > 1 && nz(yasin?.dhr?.ikramiye) > 1;
  const avansOpen =
    nz(umay?.dhr?.advance) < 1 &&
    nz(onur?.dhr?.advance) < 1 &&
    nz(gulce?.dhr?.advance) < 1 &&
    nz(leyla?.dhr?.advance) < 1;
  const yemekSgk = Math.abs(nz(serraEkim?.dhr?.sgkBase) - nz(serraOcak?.dhr?.sgkBase)) > 50;
  const ruyaNetSisi = nz(ruya?.dhr?.net) > nz(ruya?.dhr?.gross) * 2;
  const netGrossup = nz(vildan?.dhr?.meal) > 1000 && nz(vildan?.dhr?.transport) > 1000 && nz(vildan?.dhr?.salary) > 1000;

  const CLOSED = [
    "IZ-LUCA-4691",
    "IZ-ENGEL-PUT",
    "PK-ENGEL",
    "PK-5746",
    "PK-ICRA",
    "DHR-KISMI-EKIM",
    "DHR-5746-TERKIN",
    "F1-FM-TUTAR",
    "F1-FM-BIRIM",
    "F1-BES-ORAN",
    "IZ-FM-SAAT",
  ];
  if (ppvPrimOk) CLOSED.push("DHR-PPV-DROP");

  dash.bugs = drop(dash.bugs, CLOSED);

  if (avansOpen) {
    upsert(dash.bugs, {
      id: "IZ-AVANS",
      title: "Avans mahsubu bordroya yazılmıyor",
      severity: "Yüksek",
      detail: `Umay (6220) DHR avans ${tr(umay?.dhr?.advance)} (Luca ${tr(umay?.luca?.advance)}); Onur (6326) DHR ${tr(onur?.dhr?.advance)} (Luca ${tr(onur?.luca?.advance)}); Leyla Ekim DHR ${tr(leyla?.dhr?.advance)} (Luca ${tr(leyla?.luca?.advance)}). Ocak Leyla avans kalemi 0, aynı tutar genel kesinti ${tr(leylaOcak?.dhr?.kesinti)}.`,
      periods: ["Tek Değişken", "Bordro Paket", "Ekim", "Ocak"],
      impact: "Maaş avansı netten düşülmüyor; çalışana fazla ödeme.",
      area: "Puantaj",
    });
    upsert(dash.bugs, {
      id: "F1-AVANS",
      title: "Tanımlı avans Eylül bordrosunda kesilmiyor",
      severity: "Orta",
      detail: `Gülce Han (8009) Luca avans ${tr(gulce?.luca?.advance)}, DHR ${tr(gulce?.dhr?.advance)}, net ${tr(gulce?.dhr?.net)}. Aynı DHR sınıfı: IZ-AVANS.`,
      periods: ["Eylül"],
      impact: "Avans mahsubu yapılmıyor.",
      area: "Puantaj",
    });
  }

  if (yemekSgk) {
    upsert(dash.bugs, {
      id: "DHR-YEMEK-SGK",
      title: "Yemek yardımının SGK matrahı dönemler arasında tutarsız",
      severity: "Yüksek",
      detail: `Serra PEK Ocak ${tr(serraOcak?.dhr?.sgkBase)} vs Ekim ${tr(serraEkim?.dhr?.sgkBase)} (yemek Ekim’de tamamen hariç). Paket Ocak Mine PEK ${tr(mine?.dhr?.sgkBase)}.`,
      periods: ["Ekim", "Ocak", "Bordro Paket"],
      impact: "İşçi SGK / GV / net sapması.",
      area: "SGK",
    });
  } else {
    dash.bugs = drop(dash.bugs, ["DHR-YEMEK-SGK"]);
  }

  if (netGrossup) {
    upsert(dash.bugs, {
      id: "DHR-NET-GROSSUP",
      title: "Net ücret brütleştirmesi yemek/yol kalemlerini kapsamıyor",
      severity: "Orta",
      detail: `Vildan Ertem net hedef 42.000: maaş ${tr(vildan?.dhr?.salary)}, yemek ${tr(vildan?.dhr?.meal)} ve yol ${tr(vildan?.dhr?.transport)} yüz değerinden, net ${tr(vildan?.dhr?.net)}. Ceren Toprak net ${tr(ceren?.dhr?.net)} (maaş ${tr(ceren?.dhr?.salary)} + FM ${tr(ceren?.dhr?.overtime)}).`,
      periods: ["Ekim"],
      impact: "Net sözleşmede yemek/yol brütleştirmeye girmediği için hedef net sapıyor.",
      area: "Motor",
    });
  }

  if (ruyaNetSisi) {
    upsert(dash.bugs, {
      id: "PK-KIDEM",
      title: "Çıkış bordrosu neti şişiyor, kıdem kalemi eşlenmiyor",
      severity: "Yüksek",
      detail: `Rüya Fen (6328) brüt ${tr(ruya?.dhr?.gross)} ama net ${tr(ruya?.dhr?.net)}; izin/kıdem/ihbar satırları 0. GV ${tr(ruya?.dhr?.gv)}, damga ${tr(ruya?.dhr?.damga)}. Luca net ${tr(ruya?.luca?.net)} (çıkış yok).`,
      periods: ["Bordro Paket"],
      impact: "İşten çıkış ödemesi kalemlere yazılmadan nete yığılıyor.",
      area: "Kapsam",
    });
  }

  dash.bugs = dash.bugs.filter((b) => b.severity !== "Kapandı");

  if (engelOk) {
    upsert(
      dash.works,
      {
        id: "W-ENGEL",
        title: "Engellilik derecesi 1–3 GV indirimi uygulandı",
        detail: `Leman 2. derece GV ${tr(leman?.dhr?.gv)} / net ${tr(leman?.dhr?.net)}; Mert 3. derece GV ${tr(mert?.dhr?.gv)}. Barış (Paket) GV ${tr(baris?.dhr?.gv)} vs Mine ${tr(mine?.dhr?.gv)}. Nihan GV ${tr(nihan?.dhr?.gv)}.`,
        periods: ["Tek Değişken", "Eylül", "Bordro Paket", "Kenar Durumlar"],
        area: "Gelir vergisi",
      },
      true
    );
  }
  if (kismiEkimOk) {
    const wKismi = dash.works.find((w) => w.id === "W-KISMI");
    if (wKismi) {
      wKismi.detail = `Ekim Hande ${handeEkim?.dhr?.sgkDays} gün / ücret ${tr(handeEkim?.dhr?.salary)} (kısmi senaryo işliyor; Luca PDF tam ay ${tr(handeEkim?.luca?.net)}). Ocak Hande ${handeOcak?.dhr?.sgkDays} gün.`;
      if (!wKismi.periods.includes("Ekim")) wKismi.periods = ["Ekim", ...wKismi.periods];
    }
    upsert(dash.works, {
      id: "W-KISMI-EKIM",
      title: "Kısmi ay puantajı Ekim’de 15 güne iniyor",
      detail: `Hande Orhan DHR sgkDays ${handeEkim?.dhr?.sgkDays}, maaş ${tr(handeEkim?.dhr?.salary)}, net ${tr(handeEkim?.dhr?.net)}. Eski “30 gün / 53.000” kartı kapandı.`,
      periods: ["Ekim"],
      area: "Puantaj",
    });
  }
  if (terkin5746) {
    upsert(dash.works, {
      id: "W-5746",
      title: "5746 GV / damga terkini bordroya işliyor",
      detail: `Yağız damga ${tr(yagiz?.dhr?.damga)} GV ${tr(yagiz?.dhr?.gv)}; Zeliha damga ${tr(zeliha?.dhr?.damga)}; Derya GV ${tr(derya?.dhr?.gv)} vs Ada ${tr(ada?.dhr?.gv)}; Ahu GV ${tr(ahu?.dhr?.gv)} damga ${tr(ahu?.dhr?.damga)}.`,
      periods: ["Ekim", "Tek Değişken", "Bordro Paket"],
      area: "Teşvik",
    });
  }
  if (ppvPrimOk) {
    upsert(dash.works, {
      id: "W-PPV",
      title: "Tek seferlik prim / ikramiye / kesinti bordroda duruyor",
      detail: `Ekim Metin prim ${tr(metin?.dhr?.prim)}, Baran ${tr(baran?.dhr?.prim)}, Ufuk ${tr(ufuk?.dhr?.prim)}, Yasin ikramiye ${tr(yasin?.dhr?.ikramiye)}, Nilay kesinti ${tr(nilay?.dhr?.kesinti)}, Vesile ${tr(vesile?.dhr?.kesinti)}, Okan masraf ${tr(okan?.dhr?.masraf)}. DHR-PPV-DROP bu kalemler için kapandı; avans hâlâ IZ-AVANS.`,
      periods: ["Ekim", "Ocak"],
      area: "Puantaj",
    });
  }
  if (icraCap) {
    upsert(dash.works, {
      id: "W-ICRA-14",
      title: "İcra 1/4 tavanı uygulanıyor",
      detail: `Koray DHR icra ${tr(koray?.dhr?.icra)} (Luca ${tr(koray?.luca?.icra)} tam kesti). Lale icra ${tr(lale?.dhr?.icra)} + nafaka ${tr(lale?.dhr?.nafaka)}. Nehir tavan ${tr(nehir?.dhr?.kesinti)} genel kesinti satırında (icra alanı 0).`,
      periods: ["Bordro Paket"],
      area: "Puantaj",
    });
  }

  dash.disputes = drop(dash.disputes, ["D-5746-DAMGA"]);
  upsert(dash.disputes, {
    id: "D-LUCA-4691",
    title: "Tek Değişken: Luca 4691 terkin uygulamıyor",
    detail: `Hakan/Işık DHR GV ${tr(hakanIz?.dhr?.gv)} / net ${tr(hakanIz?.dhr?.net)}. Luca GV ${tr(hakanIz?.luca?.gv)} (Ada zemini). Bu bir DHR hatası değil.`,
  });
  if (terkin5746) {
    upsert(dash.disputes, {
      id: "D-5746-DAMGA",
      title: "5746 damga terkini — DHR ve Luca Ekim’de hizalı",
      detail: `DHR Yağız/Zeliha/Tamer damga 0. Luca Yağız/Zeliha 0, Tamer ${tr(tamer?.luca?.damga)}, Deniz ${tr(deniz?.luca?.damga)} (DHR ${tr(deniz?.dhr?.damga)}). Eski “DHR tam kesiyor” notu dump ile kapandı.`,
    });
  }

  const diger = (dash.untested || []).find((u) => u.id === "U-DIGER-BIRIMLER");
  if (diger) {
    diger.detail =
      "Şirket B (2) kapsam dışı. Operasyon 3/3, Kenar 53/53 + Luca PDF, Yuvarlama 100/100, Blokaj 1/1, Takvim Cemre hesaplı. Takvim/Operasyon/Blokaj Luca bilgisi bekleniyor; hakem YZ.";
    diger.blocker = `Bordro A.Ş. bu koşumda yok. Takvim Eylül Cemre net ${tr(cemre?.dhr?.net)}.`;
  }
  const cikis = (dash.untested || []).find((u) => u.id === "U-CIKIS");
  if (cikis && ruyaNetSisi) {
    cikis.detail = `Rüya Fen net ${tr(ruya?.dhr?.net)} (brüt ${tr(ruya?.dhr?.gross)}); kıdem/ihbar/izin satırları 0. Senaryo denendi, kalem eşlemesi bozuk — bkz. PK-KIDEM.`;
    cikis.blocker = "Çıkış ödemesi nete yığılıyor, kalem kırılımı yok.";
  }
  upsert(dash.untested, {
    id: "U-FM-NET",
    title: "Net fazla mesai tipi yok",
    detail: `Fırat (8008) DHR FM ${tr(firat?.dhr?.overtime)}, Luca ${tr(firat?.luca?.overtime)} (10s). Net FM PaymentValue tutarı saat okunuyor; 5s net senaryosu kurulamadı. Birim hatası (10 TL) kapandı.`,
    blocker: "Üründe isNet fazla mesai tipi yok.",
    area: "Puantaj",
  });

  dash.generatedAt = new Date().toISOString();
  writeJson(path.join(DATA, "dashboard.json"), dash, 2);

  const ekimMtx = readJson(path.join(DATA, "ekim_matrix.json"));
  ekimMtx.dhrBugs = [];
  if (avansOpen) {
    ekimMtx.dhrBugs.push({
      id: "IZ-AVANS",
      title: "Avans mahsubu Ekim bordrosuna yazılmıyor",
      severity: "Yüksek",
      detail: `Leyla Tuncel DHR avans ${tr(leyla?.dhr?.advance)}, Luca ${tr(leyla?.luca?.advance)}. Prim/ikramiye/kesinti aynı dump’ta duruyor.`,
    });
  }
  if (yemekSgk) {
    ekimMtx.dhrBugs.push({
      id: "DHR-YEMEK-SGK",
      title: "Yemek yardımının SGK matrahı dönemler arasında tutarsız",
      severity: "Yüksek",
      detail: `Aynı 5.500 TL yemek: Ekim PEK ${tr(serraEkim?.dhr?.sgkBase)}, Ocak PEK ${tr(serraOcak?.dhr?.sgkBase)}. 5510 md. 80 kapsamında ikisi birlikte doğru olamaz.`,
    });
  }
  if (netGrossup) {
    ekimMtx.dhrBugs.push({
      id: "DHR-NET-GROSSUP",
      title: "Net ücret brütleştirmesi yemek/yol kalemlerini kapsamıyor",
      severity: "Orta",
      detail: `Vildan net ${tr(vildan?.dhr?.net)} (maaş ${tr(vildan?.dhr?.salary)} + yemek/yol yüz değer). Ceren net ${tr(ceren?.dhr?.net)}. Hedef 42.000.`,
    });
  }
  setChecked(ekimMtx, /Leyla avans/, {
    result: "fail",
    note: `Avans mahsubu yazılmadı (DHR ${tr(leyla?.dhr?.advance)}, Luca ${tr(leyla?.luca?.advance)}).`,
  });
  setChecked(ekimMtx, /Nilay icra/, {
    result: nz(nilay?.dhr?.kesinti) > 1 ? "pass" : "fail",
    note: `Nilay kesinti ${tr(nilay?.dhr?.kesinti)}, Vesile ${tr(vesile?.dhr?.kesinti)}. PPV-DROP bu kalemlerde kapandı.`,
  });
  setChecked(ekimMtx, /Metin\/Ufuk\/Baran prim/, {
    result: ppvPrimOk ? "pass" : "fail",
    note: `Metin prim ${tr(metin?.dhr?.prim)}, Baran ${tr(baran?.dhr?.prim)}, Ufuk ${tr(ufuk?.dhr?.prim)}, Yasin ikramiye ${tr(yasin?.dhr?.ikramiye)}.`,
  });
  setChecked(ekimMtx, /Hande kısmi/, {
    result: kismiEkimOk ? "pass" : "fail",
    note: kismiEkimOk
      ? `DHR ${handeEkim?.dhr?.sgkDays} gün / ${tr(handeEkim?.dhr?.salary)}. Luca PDF tam ay net ${tr(handeEkim?.luca?.net)}.`
      : `Ekim ${handeEkim?.dhr?.sgkDays} gün / ${tr(handeEkim?.dhr?.salary)}.`,
  });
  setChecked(ekimMtx, /Kanun 05746/, {
    result: terkin5746 ? "pass" : "fail",
    note: terkin5746
      ? `5746 terkin işliyor: Yağız damga ${tr(yagiz?.dhr?.damga)} GV ${tr(yagiz?.dhr?.gv)}; 4691 Alper GV 0 / damga 0.`
      : "5746 terkini hâlâ yok.",
  });
  setChecked(ekimMtx, /Net ücret \(Vildan/, {
    result: "fail",
    note: `Yemek/yol yüz değerinden. Vildan net ${tr(vildan?.dhr?.net)}, Ceren ${tr(ceren?.dhr?.net)} (hedef 42.000).`,
  });
  setChecked(ekimMtx, /Okan masraf/, {
    result: nz(okan?.dhr?.masraf) > 1 ? "pass" : "fail",
    note: `Okan masraf DHR ${tr(okan?.dhr?.masraf)} (Ekim Luca 0 — tasarım farkı).`,
  });

  patchScenario(ekimMtx, "Hande Orhan", {
    verdict: liveVerdict(handeEkim, `DHR ${handeEkim?.dhr?.sgkDays} gün / ücret ${tr(handeEkim?.dhr?.salary)}; Luca PDF tam ay.`),
    whichCorrect: "DHR kısmi 15 gün senaryoyu uyguluyor. Luca PDF tam ay basmış.",
    legalBasis: "Kısmi ay gün orantısı; Luca referans, doğru kabul edilmez.",
  });
  patchScenario(ekimMtx, "Yagiz Findik", {
    verdict: liveVerdict(yagiz, `DHR GV ${tr(yagiz?.dhr?.gv)} damga ${tr(yagiz?.dhr?.damga)} (5746 terkin).`),
    whichCorrect: "DHR 5746 GV/damga terkin. Luca damga 0, GV hâlâ yüksek.",
    legalBasis: "5746 sayılı kanun stopaj/damga terkini.",
  });
  patchScenario(ekimMtx, "Zeliha Gurbuz", {
    verdict: liveVerdict(zeliha, `DHR GV ${tr(zeliha?.dhr?.gv)} damga ${tr(zeliha?.dhr?.damga)}.`),
    whichCorrect: "DHR 5746 terkin.",
    legalBasis: "5746 sayılı kanun.",
  });
  patchScenario(ekimMtx, "Tamer Cakmak", {
    verdict: liveVerdict(tamer, `FM ${tr(tamer?.dhr?.overtime)}; DHR damga ${tr(tamer?.dhr?.damga)}.`),
    whichCorrect: "DHR 5746 damga terkin + FM.",
    legalBasis: "5746 sayılı kanun; İşK md. 41.",
  });
  patchScenario(ekimMtx, "Deniz Ulusoy", {
    verdict: liveVerdict(deniz, `DHR GV ${tr(deniz?.dhr?.gv)} damga ${tr(deniz?.dhr?.damga)}.`),
    whichCorrect: "DHR 5746 GV stopaj terkin.",
    legalBasis: "5746 sayılı kanun.",
  });
  patchScenario(ekimMtx, "Vildan Ertem", {
    verdict: liveVerdict(vildan, `Maaş ${tr(vildan?.dhr?.salary)}; yemek/yol yüz değer.`),
    whichCorrect: "YZ hakem; Luca referans. Net brütleştirme yemek/yolu kapsamıyor.",
    legalBasis: "Net sözleşme brütleştirmesi.",
  });
  patchScenario(ekimMtx, "Ceren Toprak", {
    verdict: liveVerdict(ceren, `Maaş ${tr(ceren?.dhr?.salary)} + FM ${tr(ceren?.dhr?.overtime)}.`),
    whichCorrect: "YZ hakem; Luca referans.",
    legalBasis: "Net sözleşme + fazla mesai.",
  });
  patchScenario(ekimMtx, "Metin Uslu", {
    verdict: liveVerdict(metin, `Prim DHR ${tr(metin?.dhr?.prim)} = Luca. PPV-DROP bu kalemde kapandı.`),
    whichCorrect: "Prim bordroda duruyor. Kalan net Luca GV bandı.",
    legalBasis: "Tek seferlik prim bordroya yansımalı.",
  });
  patchScenario(ekimMtx, "Baran Sokmen", {
    verdict: liveVerdict(baran, `Prim DHR ${tr(baran?.dhr?.prim)}.`),
    whichCorrect: "Prim bordroda duruyor.",
    legalBasis: "Tek seferlik prim.",
  });
  patchScenario(ekimMtx, "Ufuk Demirel", {
    verdict: liveVerdict(ufuk, `Prim DHR ${tr(ufuk?.dhr?.prim)}.`),
    whichCorrect: "Prim bordroda duruyor.",
    legalBasis: "Tek seferlik prim.",
  });
  patchScenario(ekimMtx, "Yasin Firatin", {
    verdict: liveVerdict(yasin, `İkramiye DHR ${tr(yasin?.dhr?.ikramiye)}.`),
    whichCorrect: "İkramiye bordroda duruyor.",
    legalBasis: "Tek seferlik ikramiye.",
  });
  patchScenario(ekimMtx, "Nilay Varol", {
    verdict: liveVerdict(nilay, `Kesinti DHR ${tr(nilay?.dhr?.kesinti)}.`),
    whichCorrect: "Kesinti bordroda duruyor.",
    legalBasis: "Genel kesinti.",
  });
  patchScenario(ekimMtx, "Vesile Erkan", {
    verdict: liveVerdict(vesile, `Kesinti DHR ${tr(vesile?.dhr?.kesinti)}.`),
    whichCorrect: "Kesinti bordroda duruyor.",
    legalBasis: "Genel kesinti.",
  });
  patchScenario(ekimMtx, "Okan Yildizoglu", {
    verdict: liveVerdict(okan, `Masraf DHR ${tr(okan?.dhr?.masraf)}; Ekim Luca 0.`),
    whichCorrect: "DHR masrafı yazdı. Luca Ekim’de yok — tasarım farkı.",
    legalBasis: "Masraf iadesi ücret sayılmak zorunda değil.",
  });
  patchScenario(ekimMtx, "Leyla Tuncel", {
    verdict: liveVerdict(leyla, `DHR avans ${tr(leyla?.dhr?.advance)}, Luca ${tr(leyla?.luca?.advance)}.`),
    whichCorrect: "Luca avansı kesti; DHR yazmadı (PPV primleri duruyor).",
    legalBasis: "Maaş avansı mahsubu netten düşülmeli.",
  });
  writeJson(path.join(DATA, "ekim_matrix.json"), ekimMtx, 2);

  const ocakMtx = readJson(path.join(DATA, "matrix.json"));
  ocakMtx.dhrBugs = [];
  if (yemekSgk) {
    ocakMtx.dhrBugs.push({
      id: "DHR-YEMEK-SGK",
      title: "Yemek SGK istisnası Ekim döneminde farklı uygulanıyor",
      severity: "Yüksek",
      detail: `Ocak Serra PEK ${tr(serraOcak?.dhr?.sgkBase)}; aynı çalışan Ekim ${tr(serraEkim?.dhr?.sgkBase)}.`,
    });
  }
  if (avansOpen) {
    ocakMtx.dhrBugs.push({
      id: "IZ-AVANS",
      title: "Leyla avansı Ocak’ta avans kalemine yazılmıyor",
      severity: "Orta",
      detail: `Leyla Ocak DHR avans ${tr(leylaOcak?.dhr?.advance)}, genel kesinti ${tr(leylaOcak?.dhr?.kesinti)}; Luca avans ${tr(leylaOcak?.luca?.advance)}. Ekim’de kesinti de 0.`,
    });
  }
  const okanWarn = (ocakMtx.warnings || []).find((w) => w.id === "OKAN-MASRAF");
  if (okanWarn) {
    okanWarn.detail = `DHR masrafı ücret saymaz; Ocak DHR masraf ${tr(findRow(ocak, "Okan Yildizoglu")?.dhr?.masraf)}. Ekim DHR ${tr(okan?.dhr?.masraf)}, Luca 0. PPV-DROP bu kalemde kapandı.`;
  }
  const damgaWarn = (ocakMtx.warnings || []).find((w) => w.id === "DAMGA-5746");
  if (damgaWarn && terkin5746) {
    damgaWarn.title = "5746 damga terkini DHR Ekim’de 0";
    damgaWarn.detail = `Yağız/Zeliha DHR ve Luca damga 0. Tamer DHR ${tr(tamer?.dhr?.damga)} / Luca ${tr(tamer?.luca?.damga)}.`;
    damgaWarn.severity = "info";
  }
  writeJson(path.join(DATA, "matrix.json"), ocakMtx, 2);

  const izoleMtx = readJson(path.join(DATA, "izole_matrix.json"));
  izoleMtx.dhrBugs = drop(izoleMtx.dhrBugs, CLOSED);
  izoleMtx.dhrBugs = (izoleMtx.dhrBugs || []).filter((b) => b.id !== "IZ-ENGEL-PUT");
  if (avansOpen) {
    upsert(izoleMtx.dhrBugs, {
      id: "IZ-AVANS",
      title: "Avans mahsubu bordroya yazılmıyor",
      severity: "Yüksek",
      detail: `Umay 6220 Luca avans ${tr(umay?.luca?.advance)}, DHR ${tr(umay?.dhr?.advance)}, net ${tr(umay?.dhr?.net)} (F1-AVANS ile aynı sınıf).`,
    });
  }
  for (const name of ["Efe Sahin", "Feride Aksoy", "Gokce Yilmaz", "Derya Unal"]) {
    const row = findRow(izole, name);
    patchScenario(izoleMtx, name, {
      verdict: liveVerdict(row, `DHR GV ${tr(row?.dhr?.gv)} damga ${tr(row?.dhr?.damga)}.`),
      whichCorrect: "DHR 5746 GV/damga terkin. Luca damga 0, GV hâlâ Ada zemini.",
      legalBasis: "5746 sayılı kanun stopaj/damga terkini.",
    });
  }
  for (const name of ["Kaan Oz", "Leman Su", "Mert Acar"]) {
    const row = findRow(izole, name);
    patchScenario(izoleMtx, name, {
      verdict: liveVerdict(row, "Engellilik indirimi karttan işliyor."),
      whichCorrect: "DHR GVK md. 31. YZ bu birimde Ada zeminini kullanıyor.",
      legalBasis: "GVK md. 31 sakatlık indirimi.",
    });
  }
  patchScenario(izoleMtx, "Hakan Boz", {
    verdict: liveVerdict(hakanIz, "DHR 4691 GV/damga 0."),
    whichCorrect: "DHR 4691 terkin. Luca Ada zemini — Luca kartı eksik.",
    legalBasis: "4691 sayılı Teknoloji Geliştirme Bölgeleri Kanunu.",
  });
  patchScenario(izoleMtx, "Isik Demirci", {
    verdict: liveVerdict(isik, "DHR 4691 GV/damga 0."),
    whichCorrect: "DHR 4691 terkin. Luca Ada zemini — Luca kartı eksik.",
    legalBasis: "4691 sayılı Teknoloji Geliştirme Bölgeleri Kanunu.",
  });
  patchScenario(izoleMtx, "Umay Gunes", {
    verdict: liveVerdict(umay, `DHR avans ${tr(umay?.dhr?.advance)}, Luca ${tr(umay?.luca?.advance)}.`),
    whichCorrect: "Luca avansı kesti; DHR yazmadı.",
    legalBasis: "Maaş avansı mahsubu netten düşülmeli.",
  });
  writeJson(path.join(DATA, "izole_matrix.json"), izoleMtx, 2);

  const paketMtx = readJson(path.join(DATA, "paket_matrix.json"));
  paketMtx.dhrBugs = [];
  if (avansOpen) {
    paketMtx.dhrBugs.push({
      id: "PK-AVANS",
      title: "Avans mahsubu bordroya yazılmıyor",
      severity: "Yüksek",
      detail: `Onur 6326 Luca avans ${tr(onur?.luca?.advance)}, DHR ${tr(onur?.dhr?.advance)}. IZ-AVANS.`,
    });
  }
  if (ruyaNetSisi) {
    paketMtx.dhrBugs.push({
      id: "PK-KIDEM",
      title: "Çıkış bordrosu neti şişiyor, kıdem kalemi eşlenmiyor",
      severity: "Yüksek",
      detail: `Rüya 6328 brüt ${tr(ruya?.dhr?.gross)}, net ${tr(ruya?.dhr?.net)}; kıdem/ihbar/izin 0.`,
    });
  }
  paketMtx.warnings = (paketMtx.warnings || []).filter((w) => w.id !== "PK-ICRA");
  if (icraCap) {
    upsert(paketMtx.warnings, {
      id: "PK-ICRA-MAP",
      title: "İcra 1/4 tavanı var; Nehir kesinti satırında",
      detail: `Koray icra ${tr(koray?.dhr?.icra)}. Nehir aynı tavan ${tr(nehir?.dhr?.kesinti)} genel kesintide, icra alanı 0. Luca tam tutar kesiyor.`,
      severity: "info",
    });
  }
  const ruyaWarn = (paketMtx.warnings || []).find((w) => w.id === "PK-RUYA-CIKIS");
  if (ruyaWarn && ruyaNetSisi) {
    ruyaWarn.detail = `Çıkış 31.01 Luca’da yok. DHR net ${tr(ruya?.dhr?.net)} (brüt ${tr(ruya?.dhr?.gross)}).`;
    ruyaWarn.severity = "error";
  }
  patchScenario(paketMtx, "Ahu Mor", {
    verdict: liveVerdict(ahu, `GV ${tr(ahu?.dhr?.gv)} damga ${tr(ahu?.dhr?.damga)} (5746 terkin).`),
    whichCorrect: "DHR 5746 stopaj/damga terkin.",
    legalBasis: "5746 sayılı kanun.",
  });
  patchScenario(paketMtx, "Baris Nur", {
    verdict: liveVerdict(baris, `GV ${tr(baris?.dhr?.gv)} vs Mine ${tr(mine?.dhr?.gv)}.`),
    whichCorrect: "DHR 1. derece engellilik indirimi.",
    legalBasis: "GVK md. 31.",
  });
  patchScenario(paketMtx, "Koray Zan", {
    verdict: liveVerdict(koray, `DHR icra ${tr(koray?.dhr?.icra)} (1/4); Luca ${tr(koray?.luca?.icra)}.`),
    whichCorrect: "DHR 1/4 tavanı. Luca tam kesti.",
    legalBasis: "İİK md. 83 icra kesintisi tavanı.",
  });
  patchScenario(paketMtx, "Lale Ada", {
    verdict: liveVerdict(lale, `Nafaka ${tr(lale?.dhr?.nafaka)} + icra ${tr(lale?.dhr?.icra)}.`),
    whichCorrect: "DHR nafaka sonra icra tavanı.",
    legalBasis: "Nafaka önceliği + İİK md. 83.",
  });
  patchScenario(paketMtx, "Nehir Can", {
    verdict: liveVerdict(nehir, `İşveren alacağı tavanı kesinti ${tr(nehir?.dhr?.kesinti)}; icra alanı 0.`),
    whichCorrect: "DHR 1/4’ü genel kesintiye yazdı. Luca 25.000 tam kesti.",
    legalBasis: "İşveren alacağı tavanı.",
  });
  patchScenario(paketMtx, "Onur Dem", {
    verdict: liveVerdict(onur, `DHR avans ${tr(onur?.dhr?.advance)}, Luca ${tr(onur?.luca?.advance)}.`),
    whichCorrect: "Luca avansı kesti; DHR yazmadı.",
    legalBasis: "Maaş avansı mahsubu.",
  });
  patchScenario(paketMtx, "Ruya Fen", {
    verdict: liveVerdict(ruya, "Kıdem/ihbar/izin satırı 0; net brütün çok üzerinde."),
    whichCorrect: "DHR çıkış neti hatalı. Luca çıkış basmamış.",
    legalBasis: "1475/4857 kıdem-ihbar; kalem kırılımı gerekir.",
  });
  paketMtx.correctFindings = (paketMtx.correctFindings || []).map((x) =>
    /Koray icra/.test(x) ? `Koray DHR icra ${tr(koray?.dhr?.icra)} (1/4 tavanı); Luca ${tr(koray?.luca?.icra)}.` : x
  );
  writeJson(path.join(DATA, "paket_matrix.json"), paketMtx, 2);

  const faz1Mtx = readJson(path.join(DATA, "faz1_matrix.json"));
  faz1Mtx.dhrBugs = drop(faz1Mtx.dhrBugs, CLOSED);
  if (nz(gulce?.dhr?.advance) < 1 && nz(gulce?.luca?.advance) > 1) {
    upsert(faz1Mtx.dhrBugs, {
      id: "F1-AVANS",
      title: "Tanımlı avans bordroda kesilmedi",
      severity: "Orta",
      detail: `8009 Gülce Han Luca avans ${tr(gulce?.luca?.advance)}; DHR ${tr(gulce?.dhr?.advance)}.`,
    });
  }
  writeJson(path.join(DATA, "faz1_matrix.json"), faz1Mtx, 1);

  console.log(
    JSON.stringify(
      {
        bugs: dash.bugs.map((b) => b.id),
        closed: CLOSED,
        flags: { kismiEkimOk, terkin5746, engelOk, icraCap, ppvPrimOk, avansOpen, yemekSgk, ruyaNetSisi, netGrossup },
        generatedAt: dash.generatedAt,
      },
      null,
      2
    )
  );
}

if (require.main === module) sync();
module.exports = { sync };
