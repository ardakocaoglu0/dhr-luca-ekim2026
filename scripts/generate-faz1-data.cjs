const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PASSWORD = "Bordro123!";
const DEFAULT_HIRE = "2026-01-06";
const DEFAULT_MAAS = 60000;
const DEFAULT_YEMEK = 5500;
const DEFAULT_YOL = 3200;

function fold(s) {
  return String(s)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function person(p) {
  const email = p.email || `${fold(p.firstName)}${fold(p.lastName)}@demo.com`;
  const maas = p.maas ?? DEFAULT_MAAS;
  const yemek = p.yemek === undefined ? DEFAULT_YEMEK : p.yemek;
  const yol = p.yol === undefined ? DEFAULT_YOL : p.yol;
  return {
    sicil: String(p.sicil),
    firstName: p.firstName,
    lastName: p.lastName,
    name: `${p.firstName} ${p.lastName}`,
    email,
    password: PASSWORD,
    gender: p.gender,
    title: p.title,
    unit: p.unit,
    group: p.group,
    profile: p.profile || "Standart",
    law: p.law || null,
    tax: p.tax || null,
    salaryType: p.salaryType ?? 0,
    hire: p.hire || DEFAULT_HIRE,
    exit: p.exit || null,
    exitReason: p.exitReason || null,
    rehire: p.rehire || null,
    companyBHire: p.companyBHire || null,
    maas,
    yemek,
    yol,
    saglik: p.saglik || 0,
    besEmployer: p.besEmployer || 0,
    besEmployeePct: p.besEmployeePct || 0,
    besExit: p.besExit || null,
    prim: p.prim || 0,
    masraf: p.masraf || 0,
    kesinti: p.kesinti || 0,
    avans: p.avans || 0,
    icra: p.icra || 0,
    overtimeGrossHours: p.overtimeGrossHours || 0,
    overtimeNetHours: p.overtimeNetHours || 0,
    overtimeNetTl: p.overtimeNetTl || 0,
    roundingAddon: p.roundingAddon || 0,
    leaves: p.leaves || [],
    overtimeAttempts: p.overtimeAttempts || [],
    skipSgk: !!p.skipSgk,
    skipAnaPeriod: !!p.skipAnaPeriod,
    pnt035: p.pnt035 || null,
    tv: p.tv || [],
    pay: p.pay || [],
    edge: p.edge || [],
    note: p.note,
    seedFlags: p.seedFlags || {},
  };
}

const PEOPLE = [
  person({
    sicil: 8001, firstName: "Berk", lastName: "Yüce", gender: "Male", title: "Bordro Müdürü",
    unit: "lab", group: "managers", profile: "Yönetici / İdari Personel",
    tv: [], pay: ["PAY-ONAY-001"], edge: [],
    note: "1. adım onay. Ana/Op/Kenar/Yuvarlama/Takvim/Blokaj directManager ve hrManager.",
    seedFlags: { isManager: true, managerForAllFaz1: true },
  }),
  person({
    sicil: 8002, firstName: "Nilay", lastName: "Koç", gender: "Female", title: "Üst Onay",
    unit: "lab", group: "managers", profile: "Yönetici / İdari Personel",
    pay: ["PAY-ONAY-004"],
    note: "2. adım yalnız Kenar kopya akışında. D1-Tech UnitPayrollFlowStep silinmez.",
    seedFlags: { isManager: true, kenarStep2: true },
  }),

  person({
    sicil: 8003, firstName: "Ekin", lastName: "Sarı", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    tv: ["TV-01"], pay: ["PAY-HSP-001", "PAY-E2E-001", "PAY-E2E-014", "PAY-HSP-021", "PAY-HSP-024", "PAY-BRD-008"],
    pnt035: "kanitli",
    note: "Altın referans. Zam/ikramiye/BES yok. Ağustos taslak kalır.",
    seedFlags: { golden: true, noRaise: true, noIkramiye: true, noBes: true },
  }),
  person({
    sicil: 8004, firstName: "Baran", lastName: "Ünal", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", hire: "2026-09-19",
    saglik: 2500, besEmployer: 1800,
    tv: ["TV-02"], pay: ["PAY-DON-006", "PAY-PNT-002", "PAY-HSP-003", "PAY-E2E-002", "PAY-PNT-021", "PAY-PNT-010"],
    pnt035: "kontrol",
    overtimeAttempts: [{ date: "2026-09-18", hours: 2, expect: "reject", code: "PAY-PNT-010" }],
    note: "İşe giriş 19.09.2026 Cumartesi (Excel). 5 sabit kalem. 18.09 mesai denemesi red.",
  }),
  person({
    sicil: 8005, firstName: "Cansu", lastName: "Kılıç", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", exit: "2026-09-14", exitReason: "İş sözleşmesi feshi",
    tv: ["TV-03"], pay: ["PAY-DON-007", "PAY-PNT-003", "PAY-HSP-004", "PAY-E2E-003", "PAY-PNT-011"],
    pnt035: "kontrol",
    overtimeAttempts: [{ date: "2026-09-16", hours: 2, expect: "reject", code: "PAY-PNT-011" }],
    note: "Çıkış 14.09.2026. 16.09 izin/mesai red.",
  }),
  person({
    sicil: 8006, firstName: "Doruk", lastName: "Aslan", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    leaves: [
      { type: "unpaid", start: "2026-09-01", end: "2026-09-02" },
      { type: "report", start: "2026-09-08", end: "2026-09-10" },
      { type: "annual", start: "2026-09-15", end: "2026-09-16" },
    ],
    tv: ["TV-04"], pay: ["PAY-E2E-004"],
    pnt035: "kanitli",
    note: "Ücretsiz 1–2.09, rapor 8–10.09, yıllık 15–16.09. 07.09 Ana’da iş günü.",
  }),
  person({
    sicil: 8007, firstName: "Elif", lastName: "Meriç", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    leaves: [{ type: "annual", start: "2026-09-17", end: "2026-09-17", sameDayWork: true }],
    overtimeAttempts: [{ date: "2026-09-17", hours: 3, code: "PAY-PNT-020" }],
    tv: ["TV-05"], pay: ["PAY-PNT-009", "PAY-PNT-034", "PAY-PNT-036", "PAY-PNT-020", "PAY-BRD-005"],
    pnt035: "engel",
    note: "17.09 aynı gün izin+çalışma. PNT-035’ten sonra çelişki düzeltilir.",
    seedFlags: { dirtyUntilPnt035: true },
  }),
  person({
    sicil: 8008, firstName: "Fırat", lastName: "Deniz", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    overtimeGrossHours: 10, overtimeNetHours: 5,
    tv: ["TV-06"], pay: ["PAY-PNT-017", "PAY-PNT-018", "PAY-HSP-007"],
    pnt035: "kanitli",
    note: "TV-06 birebir: 10 saat brüt + 5 saat net mesai. HSP-007 brüt 10 saat kalemini doğrular.",
  }),
  person({
    sicil: 8009, firstName: "Gülce", lastName: "Han", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    prim: 7500, masraf: 4368, kesinti: 1500, avans: 2000,
    tv: ["TV-07", "TV-08"], pay: ["PAY-E2E-005", "PAY-HSP-010", "PAY-HSP-011", "PAY-HSP-009"],
    pnt035: "kanitli",
    note: "Prim+masraf+kesinti+avans seed. İkramiye 5.000 koşumda (E2E-005 ve Luca 8009’dan sonra). DHR-PAYROLL-001.",
    seedFlags: { noIkramiyeAtSeed: true, dhrPayroll001: true },
  }),
  person({
    sicil: 8010, firstName: "Hakan", lastName: "Işık", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", besEmployeePct: 0.03,
    tv: ["TV-09"], pay: ["PAY-HSP-012", "PAY-E2E-007"],
    pnt035: "kanitli",
    note: "Yalnız BES %3 çalışan. İşveren BES yok.",
  }),
  person({
    sicil: 8011, firstName: "İrem", lastName: "Palaz", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", law: "05510_2",
    tv: ["TV-10"], pay: ["PAY-PNT-025", "PAY-PNT-026", "PAY-HSP-013", "PAY-HSP-014"],
    pnt035: "kontrol",
    note: "05510 %2 varsayıldı (HSP-014). Onay PNT-035’ten sonra.",
    seedFlags: { incentiveAssumed: true },
  }),
  person({
    sicil: 8012, firstName: "Jale", lastName: "Öztürk", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", profile: "Emekli",
    tv: ["TV-11"], pay: ["PAY-HSP-015", "PAY-E2E-008"],
    pnt035: "kanitli",
    note: "Emekli / SGDP.",
    seedFlags: { emekli: true },
  }),
  person({
    sicil: 8013, firstName: "Korhan", lastName: "Seçkin", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", profile: "Kısmi Süreli",
    tv: ["TV-12"], pay: ["PAY-HSP-016", "PAY-E2E-009", "PAY-PNT-016"],
    pnt035: "kanitli",
    note: "Kısmi; 80 saat / 10 prim günü.",
    seedFlags: { partTime: true, partTimeHours: 80, primDays: 10 },
  }),
  person({
    sicil: 8014, firstName: "Lale", lastName: "Tuna", gender: "Female", title: "Stajyer",
    unit: "ana", group: "ana-aktif", profile: "Stajyer", maas: 18000, yemek: 0, yol: 0,
    tv: ["TV-13"], pay: ["PAY-HSP-017"],
    pnt035: "kanitli",
    note: "Stajyer; okul/belge.",
    seedFlags: { stajyer: true },
  }),
  person({
    sicil: 8015, firstName: "Mert", lastName: "Vural", gender: "Male", title: "Ar-Ge Uzmanı",
    unit: "ana", group: "ana-aktif", profile: "5746 Lisans / Diğer Personel", law: "5746_05746",
    tv: ["TV-15"], pay: ["PAY-HSP-019", "PAY-E2E-010"],
    pnt035: "kanitli",
    note: "Ar-Ge 5746 Lisans. Teşvik seed’de onaylı.",
    seedFlags: { incentiveApproved: true, arge: true },
  }),
  person({
    sicil: 8016, firstName: "Nihan", lastName: "Yıldız", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif", profile: "Engelli 1. Derece",
    tv: ["TV-17A"], pay: ["PAY-HSP-018", "PAY-E2E-011"],
    pnt035: "kanitli",
    note: "Engelli 1. derece.",
    seedFlags: { disability: 1 },
  }),
  person({
    sicil: 8017, firstName: "Onur", lastName: "Zengin", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-aktif",
    tv: ["TV-22"], pay: ["PAY-E2E-013"], edge: ["EDGE-049"],
    pnt035: "kanitli",
    note: "Standart hesaplanabilir. +1 eksik gün reopen Luca Ana 15’ten sonra.",
    seedFlags: { reopenMissingDayAfterLuca: true },
  }),
  person({
    sicil: 8018, firstName: "Pınar", lastName: "Adalı", gender: "Female", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-pasif", exit: "2026-08-31", exitReason: "İstifa",
    pay: ["PAY-DON-008"],
    note: "Pasif. Çıkış 31.08.2026. Eylül listesine düşmemeli.",
    seedFlags: { terminated: true },
  }),
  person({
    sicil: 8019, firstName: "Rıza", lastName: "Balcı", gender: "Male", title: "Bordro Uzmanı",
    unit: "ana", group: "ana-pasif", exit: "2026-08-31", exitReason: "İstifa",
    pay: ["PAY-DON-008"],
    note: "Pasif. Çıkış 31.08.2026 (ikinci pasif).",
    seedFlags: { terminated: true },
  }),

  person({
    sicil: 8020, firstName: "Seda", lastName: "Can", gender: "Female", title: "Operasyon Uzmanı",
    unit: "operasyon", group: "operasyon",
    leaves: [{ type: "unpaid", start: "2026-09-08", end: "2026-09-10" }],
    pay: ["PAY-PNT-004", "PAY-HSP-005", "PAY-BRD-005"],
    note: "3 gün ücretsiz 8–10.09 Operasyon Eylül. DHR-PAYROLL-002.",
    seedFlags: { dhrPayroll002: true },
  }),
  person({
    sicil: 8021, firstName: "Tolga", lastName: "Dede", gender: "Male", title: "Operasyon Uzmanı",
    unit: "operasyon", group: "operasyon",
    leaves: [{ type: "report", start: "2026-09-14", end: "2026-09-18" }],
    pay: ["PAY-PNT-007"],
    note: "5 gün rapor 14–18.09.",
  }),
  person({
    sicil: 8022, firstName: "Ufuk", lastName: "Eren", gender: "Male", title: "Operasyon Uzmanı",
    unit: "operasyon", group: "operasyon",
    leaves: [{ type: "annual", start: "2026-09-04", end: "2026-09-08" }],
    pay: ["PAY-PNT-006"], edge: ["EDGE-025"],
    note: "04.09 Cuma–08.09 Salı yıllık. 07.09 Pazartesi yalnız Operasyon tatili.",
  }),

  person({
    sicil: 8023, firstName: "Vildan", lastName: "Ferhat", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-profil", profile: "Engelli 2. Derece",
    tv: ["TV-17B"], pay: ["PAY-HSP-018"], edge: ["EDGE-027"],
    note: "Engelli 2. EDGE-027: Kenar hesabı sonrası +1 eksik gün.",
    seedFlags: { disability: 2 },
  }),
  person({
    sicil: 8024, firstName: "Yasin", lastName: "Güneş", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-profil", profile: "Engelli 3. Derece",
    tv: ["TV-17C"], pay: ["PAY-HSP-018"],
    note: "Engelli 3.",
    seedFlags: { disability: 3 },
  }),
  person({
    sicil: 8025, firstName: "Zeynep", lastName: "Hacı", gender: "Female", title: "Destek Personeli",
    unit: "kenar", group: "kenar-profil", profile: "Destek Personeli",
    tv: ["TV-16"], pay: ["PAY-HSP-020"],
    note: "Destek kota içi. Merkez destek kotası 1.",
    seedFlags: { destekKotaIci: true },
  }),
  person({
    sicil: 8026, firstName: "Alper", lastName: "İnan", gender: "Male", title: "Destek Personeli",
    unit: "kenar", group: "kenar-profil", profile: "Destek Personeli",
    tv: ["TV-16"], pay: ["PAY-HSP-020"],
    note: "Destek kota dışı (aynı dönem, kota dolu).",
    seedFlags: { destekKotaDisi: true },
  }),
  person({
    sicil: 8027, firstName: "Banu", lastName: "Jülide", gender: "Female", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-profil", profile: "5746 Yüksek Lisans / Temel Bilimler Lisans", law: "5746_15746",
    note: "5746 Yüksek Lisans.",
    seedFlags: { arge: true },
  }),
  person({
    sicil: 8028, firstName: "Cemal", lastName: "Kartal", gender: "Male", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-profil", profile: "5746 Doktora / Temel Bilimler Yüksek Lisans", law: "5746_05746",
    note: "5746 Doktora.",
    seedFlags: { arge: true },
  }),
  person({
    sicil: 8029, firstName: "Dilek", lastName: "Lale", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-profil", law: "05510_5",
    note: "05510 %5.",
    seedFlags: { incentiveApproved: true },
  }),
  person({
    sicil: 8030, firstName: "Emre", lastName: "Nalçacı", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-profil", salaryType: 1, maas: 45000, overtimeNetTl: 5000,
    tv: ["TV-20"], pay: ["PAY-HSP-002", "PAY-HSP-008"],
    note: "Net 45.000. HSP-008 5.000 TL net mesai kalemi (saat değil).",
  }),
  person({
    sicil: 8031, firstName: "Funda", lastName: "Okay", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-profil", profile: "Yabancı Uyruklu",
    tv: ["TV-14"],
    note: "Yabancı, izin geçerli.",
    seedFlags: { foreign: true },
  }),
  person({
    sicil: 8032, firstName: "Gökalp", lastName: "Peker", gender: "Male", title: "İdari Yönetici",
    unit: "kenar", group: "kenar-profil", profile: "Yönetici / İdari Personel",
    note: "Yönetici / İdari, Ar-Ge dışı. Zam 8079’da.",
    seedFlags: { isManagerProfile: true },
  }),

  person({
    sicil: 8033, firstName: "Hale", lastName: "Rüzgar", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", edge: ["EDGE-030"],
    note: "PEK tavan −0,01. Seed’de tavan API’den okunur.",
    seedFlags: { pekOffset: -0.01 },
  }),
  person({
    sicil: 8034, firstName: "İlker", lastName: "Sönmez", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", edge: ["EDGE-030"],
    note: "PEK tavan.",
    seedFlags: { pekOffset: 0 },
  }),
  person({
    sicil: 8035, firstName: "Jülide", lastName: "Tan", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", edge: ["EDGE-030"],
    note: "PEK tavan +0,01.",
    seedFlags: { pekOffset: 0.01 },
  }),
  person({
    sicil: 8036, firstName: "Kaan", lastName: "Uslu", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", maas: 180000, prim: 40000, edge: ["EDGE-031"],
    note: "Yüksek ücret + prim tavan üstü.",
  }),
  person({
    sicil: 8037, firstName: "Leyla", lastName: "Varlı", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", salaryType: 1, maas: 48000, prim: 8000, overtimeNetTl: 1500,
    edge: ["EDGE-035"],
    note: "Net maaş + brüt prim + net mesai.",
  }),
  person({
    sicil: 8038, firstName: "Murat", lastName: "Yaman", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-matrah", besEmployeePct: 0.03, avans: 2500, kesinti: 1200, icra: 1800,
    edge: ["EDGE-045"],
    note: "İcra + BES + avans + genel kesinti.",
  }),

  person({
    sicil: 8039, firstName: "Nazan", lastName: "Aksoy", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-001"],
    note: "1–14 teşvik A, 15–30 B.",
    seedFlags: { incentiveSplit: { aUntil: 14, bFrom: 15 } },
  }),
  person({
    sicil: 8040, firstName: "Okan", lastName: "Bilgin", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", law: "05510_2", edge: ["EDGE-002"],
    note: "Teşvik 16’sında başlar.",
    seedFlags: { incentiveStartDay: 16 },
  }),
  person({
    sicil: 8041, firstName: "Pelin", lastName: "Çetin", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", law: "05510_2", edge: ["EDGE-003"],
    note: "Teşvik 15’inde biter.",
    seedFlags: { incentiveEndDay: 15 },
  }),
  person({
    sicil: 8042, firstName: "Rüzgar", lastName: "Demir", gender: "Male", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-tesvik", profile: "5746 Lisans / Diğer Personel", law: "5746_05746",
    edge: ["EDGE-007"],
    note: "12 Ar-Ge + 18 normal gün.",
    seedFlags: { argeDays: 12, normalDays: 18 },
  }),
  person({
    sicil: 8043, firstName: "Selin", lastName: "Efe", gender: "Female", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-tesvik", profile: "5746 Lisans / Diğer Personel", law: "5746_05746",
    edge: ["EDGE-008"],
    note: "16.09 Ar-Ge → Standart.",
    seedFlags: { profileSwitch: { to: "Standart", date: "2026-09-16" } },
  }),
  person({
    sicil: 8044, firstName: "Tamer", lastName: "Gül", gender: "Male", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-tesvik", profile: "5746 Lisans / Diğer Personel", law: "5746_05746",
    edge: ["EDGE-009"],
    note: "5746 + Engelli 2.",
    seedFlags: { disability: 2, arge: true },
  }),
  person({
    sicil: 8045, firstName: "Ümit", lastName: "Hız", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-011"],
    note: "16.09 Standart → SGDP.",
    seedFlags: { profileSwitch: { to: "Emekli", date: "2026-09-16" } },
  }),
  person({
    sicil: 8046, firstName: "Veli", lastName: "İnce", gender: "Male", title: "Stajyer",
    unit: "kenar", group: "kenar-tesvik", profile: "Stajyer", maas: 18000, yemek: 0, yol: 0,
    edge: ["EDGE-012"],
    note: "1–15 stajyer, 16–30 standart.",
    seedFlags: { stajyer: true, profileSwitch: { to: "Standart", date: "2026-09-16" } },
  }),
  person({
    sicil: 8047, firstName: "Yağmur", lastName: "Kaya", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-013"],
    note: "Tam → kısmi 20 saat.",
    seedFlags: { switchPartTimeHours: 20, switchDate: "2026-09-16" },
  }),
  person({
    sicil: 8048, firstName: "Zeki", lastName: "Limon", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", profile: "Engelli 3. Derece", edge: ["EDGE-014"],
    note: "Engelli 3 → 1, 16.09.",
    seedFlags: { disability: 3, profileSwitch: { to: "Engelli 1. Derece", date: "2026-09-16" } },
  }),
  person({
    sicil: 8049, firstName: "Asya", lastName: "Mutlu", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", profile: "Yabancı Uyruklu", edge: ["EDGE-015"],
    note: "Yabancı izin bitiş 20.09.",
    seedFlags: { foreign: true, foreignPermitEnd: "2026-09-20" },
  }),
  person({
    sicil: 8050, firstName: "Burak", lastName: "Naz", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-016"],
    note: "Seed tek profil Standart. İkinci profil koşumda denenir (red).",
    seedFlags: { singleProfileAtSeed: true },
  }),
  person({
    sicil: 8051, firstName: "Ceren", lastName: "Oral", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-017"],
    note: "SGK işyeri A 1–10 / B 11–30. D1 şube yoksa Şirket B iki işyeri.",
    seedFlags: { workplaceSplit: { aUntil: 10, bFrom: 11 } },
  }),
  person({
    sicil: 8052, firstName: "Deniz", lastName: "Poyraz", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", exit: "2026-09-10", rehire: "2026-09-20",
    edge: ["EDGE-022"],
    note: "Çıkış 10.09, yeniden giriş 20.09.",
  }),
  person({
    sicil: 8053, firstName: "Ece", lastName: "Rana", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", besEmployeePct: 0.03,
    leaves: [{ type: "unpaid", start: "2026-08-29", end: "2026-09-30" }],
    edge: ["EDGE-023", "EDGE-028", "EDGE-039"],
    note: "Ücretsiz 29.08.2026–30.09.2026. DHR-PAYROLL-002.",
    seedFlags: { dhrPayroll002: true },
  }),
  person({
    sicil: 8054, firstName: "Fatih", lastName: "Savaş", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", besEmployeePct: 0.03, edge: ["EDGE-038"],
    note: "BES %3 → %5, 16.09.",
    seedFlags: { besSwitch: { from: 3, to: 5, date: "2026-09-16" } },
  }),
  person({
    sicil: 8055, firstName: "Gizem", lastName: "Tuna", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", besEmployeePct: 0.03, besExit: "2026-08-31",
    pay: ["PAY-PNT-031"],
    note: "BES çıkış 31.08.",
  }),
  person({
    sicil: 8056, firstName: "Harun", lastName: "Uçar", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", pay: ["PAY-PNT-024"],
    note: "Yol yardımı bitiş 31.08.",
    seedFlags: { yolEnd: "2026-08-31" },
  }),
  person({
    sicil: 8057, firstName: "İpek", lastName: "Vural", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", edge: ["EDGE-026"],
    note: "Gece vardiyası 31.08 23:00–01.09 07:00 + 2 saat fazla mesai.",
    seedFlags: { nightShift: { start: "2026-08-31T23:00:00", end: "2026-09-01T07:00:00", otHours: 2 } },
  }),
  person({
    sicil: 8058, firstName: "Kamil", lastName: "Yurt", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", avans: 55000, edge: ["EDGE-041"],
    note: "Avans taksiti neti aşıyor.",
  }),
  person({
    sicil: 8059, firstName: "Lara", lastName: "Zorlu", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", pay: ["PAY-DON-021"],
    note: "Çalışan rolü; yeniden açma/tamamlama yetkisi yok.",
    seedFlags: { limitedEmployeeRole: true },
  }),
  person({
    sicil: 8060, firstName: "Mine", lastName: "Acar", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tesvik", avans: 1500, kesinti: 750, edge: ["EDGE-040"],
    note: "Eski taksit 2.000 + yeni avans 1.500 + kesinti 750.",
    seedFlags: { oldInstallment: 2000 },
  }),

  person({
    sicil: 8061, firstName: "Ozan", lastName: "Şeker", gender: "Male", title: "Kenar Uzmanı",
    unit: "sirket-b", group: "sirket-b", exit: "2026-09-10", companyBHire: "2026-09-11",
    edge: ["EDGE-018"],
    note: "Kenar çıkış 10.09, Şirket B giriş 11.09. Kümülatif matrah B’ye bir kez.",
    seedFlags: { dualEmployer: true },
  }),
  person({
    sicil: 8062, firstName: "Eda", lastName: "Mert", gender: "Female", title: "Şirket B Müdürü",
    unit: "sirket-b", group: "sirket-b", profile: "Yönetici / İdari Personel",
    note: "Şirket B müdürü / bordro onay.",
    seedFlags: { isManager: true, companyBManager: true },
  }),

  person({
    sicil: 8063, firstName: "Cemre", lastName: "Ay", gender: "Female", title: "Takvim Uzmanı",
    unit: "takvim", group: "takvim", edge: ["EDGE-019"],
    note: "Yalnız Takvim. Ücret 2026–2028. Şubat 2027 (28) ve Şubat 2028 (29).",
    seedFlags: { wageThrough: { year: 2028, month: 2 } },
  }),
  person({
    sicil: 8064, firstName: "Demir", lastName: "Boz", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", hire: "2026-08-31", edge: ["EDGE-021"],
    note: "İşe giriş 31.08.2026. Eylül’de tam ay Kenar.",
  }),
  person({
    sicil: 8065, firstName: "Eda", lastName: "Canan", gender: "Female", title: "Ar-Ge Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", profile: "5746 Lisans / Diğer Personel",
    law: "5746_05746", edge: ["EDGE-004"],
    note: "Aynı 1–30 gün için iki teşvik (05510 + 5746); çifte indirim yok / sistem bloke.",
    seedFlags: { dualIncentiveSameDays: ["05510_2", "5746_05746"] },
  }),
  person({
    sicil: 8066, firstName: "Feriha", lastName: "Dal", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-024"],
    leaves: [
      { type: "report", start: "2026-09-22", end: "2026-09-24" },
      { type: "unpaid", start: "2026-09-23", end: "2026-09-24" },
    ],
    note: "Rapor 22–24.09, ücretsiz örtüşme 23–24.09.",
  }),
  person({
    sicil: 8067, firstName: "Genco", lastName: "Er", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", hire: "2026-09-21", exit: "2026-09-30",
    edge: ["EDGE-029"],
    note: "Giriş 21.09 çıkış 30.09 (10 gün); kıst brüt asgari aylık tabanın altında.",
  }),
  person({
    sicil: 8068, firstName: "Hicran", lastName: "Feza", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-032"],
    note: "Dönem başı kümülatif GV matrahı tarife eşiğinin 0,01 TL altında.",
    seedFlags: { cumTaxBandMinus: 0.01 },
  }),
  person({
    sicil: 8069, firstName: "İlhan", lastName: "Gök", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", hire: "2026-07-01", edge: ["EDGE-033"],
    note: "Giriş 01.07.2026; önceki işveren kümülatif matrah dolu.",
    seedFlags: { priorTaxFilled: true },
  }),
  person({
    sicil: 8070, firstName: "Yekta", lastName: "Han", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", hire: "2026-07-01", edge: ["EDGE-033"],
    note: "Giriş 01.07.2026; önceki matrah boş.",
    seedFlags: { priorTaxEmpty: true },
  }),
  person({
    sicil: 8071, firstName: "Koray", lastName: "Işık", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", prim: 25000, edge: ["EDGE-034"],
    leaves: [{ type: "unpaid", start: "2026-09-11", end: "2026-09-20" }],
    note: "Ücretsiz 11–20.09 + yüksek prim + asgari ücret GV/damga istisnası.",
  }),
  person({
    sicil: 8072, firstName: "Leman", lastName: "Can", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-036"],
    note: "Net −0,01 sınır.",
    seedFlags: { netEpsilon: -0.01 },
  }),
  person({
    sicil: 8073, firstName: "Melis", lastName: "Nur", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-036"],
    note: "Net 0,00 sınır.",
    seedFlags: { netEpsilon: 0 },
  }),
  person({
    sicil: 8074, firstName: "Naci", lastName: "Oruç", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-036"],
    note: "Net +0,01 sınır.",
    seedFlags: { netEpsilon: 0.01 },
  }),
  person({
    sicil: 8075, firstName: "Oya", lastName: "Pınar", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-043"],
    note: "Sabit ödeme bitiş 15.09, yeni kayıt 16.09 + aynı gün varyantı.",
    seedFlags: { paymentEnd: "2026-09-15", paymentStart: "2026-09-16" },
  }),
  person({
    sicil: 8076, firstName: "Poyraz", lastName: "Su", gender: "Male", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", edge: ["EDGE-052"],
    note: "0 gün / 0 kazanç; geçersiz eksik gün nedeni 07 vs geçerli neden.",
    seedFlags: { zeroDays: true },
  }),
  person({
    sicil: 8077, firstName: "Sera", lastName: "Ünal", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici", law: "05510_2", pay: ["PAY-PNT-027"],
    note: "Teşvik bitiş 31.08.2026.",
    seedFlags: { incentiveEnd: "2026-08-31" },
  }),
  person({
    sicil: 8078, firstName: "Taner", lastName: "Uslu", gender: "Male", title: "Blokaj Uzmanı",
    unit: "blokaj", group: "blokaj",
    tv: ["TV-18"], pay: ["PAY-HSP-023", "PAY-E2E-012"],
    skipSgk: true,
    note: "Blokaj birimi. SGK profili yok. Kenar toplu hesabına girmez.",
    seedFlags: { noSgkProfile: true },
  }),
  person({
    sicil: 8079, firstName: "Umay", lastName: "Yurt", gender: "Female", title: "Kenar Uzmanı",
    unit: "kenar", group: "kenar-tamamlayici",
    tv: ["TV-19"], pay: ["PAY-E2E-006"], edge: ["EDGE-044"],
    note: "Ağustos onaylı 60.000; Eylül %10 temel maaş. 8003’e zam yok.",
    seedFlags: { raisePct: 10, raiseFrom: "2026-09-01", augustApproved: true },
  }),
];

for (let i = 1; i <= 100; i++) {
  const n = String(i).padStart(2, "0");
  const sicil = 8100 + i;
  const addon = Number((0.05 + ((i - 1) % 5) * 0.01).toFixed(2));
  PEOPLE.push(
    person({
      sicil,
      firstName: "Yuvarlama",
      lastName: n,
      email: `yuvarlama${n}@demo.com`,
      gender: i % 2 === 0 ? "Female" : "Male",
      title: "Yuvarlama Uzmanı",
      unit: "yuvarlama",
      group: "yuvarlama",
      roundingAddon: addon,
      edge: i === 1 ? ["EDGE-037", "EDGE-048"] : i === 2 ? ["EDGE-037", "EDGE-047"] : ["EDGE-037"],
      pay: i <= 5 ? ["PAY-HSP-021"] : [],
      note: `Aynı brüt + ${addon.toFixed(2)} TL (Luca 2 hane). Luca 5 örnek + HSP-021.`,
      seedFlags: {
        roundingSample: i <= 5,
        bulkSwitchSgdp: i === 2,
        bulkDeleteProfile: i === 1,
      },
    })
  );
}

const UNITS = [
  { id: "lab", name: "Bordro Laboratuvarı", parent: "d1-tech", periodRole: "DON-011 sayaç (15’lik hesap değil)" },
  { id: "ana", name: "Ana Kadro", parent: "lab", periodRole: "Eylül 15+2; Ağustos taslak" },
  { id: "operasyon", name: "Operasyon", parent: "lab", periodRole: "Eylül; 07.09 tatili yalnız burada" },
  { id: "kenar", name: "Kenar Durumlar", parent: "d1-tech", periodRole: "Ağustos + Eylül" },
  { id: "yuvarlama", name: "Yuvarlama", parent: "d1-tech", periodRole: "Eylül 100 kişi" },
  { id: "takvim", name: "Takvim", parent: "d1-tech", periodRole: "Şubat 2027 + Şubat 2028" },
  { id: "blokaj", name: "Blokaj", parent: "d1-tech", periodRole: "Eylül; 8078 profilsiz" },
  { id: "sirket-b", name: "Faz1 Bordro A.Ş.", parent: null, periodRole: "Eylül; EDGE-018" },
];

const TV_MAP = {};
const PAY_MAP = {};
const EDGE_MAP = {};
for (const p of PEOPLE) {
  for (const t of p.tv) (TV_MAP[t] ||= []).push(p.sicil);
  for (const t of p.pay) (PAY_MAP[t] ||= []).push(p.sicil);
  for (const t of p.edge) (EDGE_MAP[t] ||= []).push(p.sicil);
}

const roster = {
  period: "Eylül 2026",
  environment: "https://dhrtest.d1-tech.com.tr",
  password: PASSWORD,
  isolation: {
    ik: "6101–6132 dokunulmaz",
    bt: "7001–7016 + Serkan kapsam dışı; Girişler’de yok",
    laws: "Mevcut D1-Tech kanun/PEK/GV PUT/DELETE yok",
  },
  units: UNITS,
  counts: {
    labManagers: PEOPLE.filter((p) => p.group === "managers").length,
    anaAktif: PEOPLE.filter((p) => p.group === "ana-aktif").length,
    anaPasif: PEOPLE.filter((p) => p.group === "ana-pasif").length,
    operasyon: PEOPLE.filter((p) => p.unit === "operasyon").length,
    kenar: PEOPLE.filter((p) => p.unit === "kenar").length,
    takvim: PEOPLE.filter((p) => p.unit === "takvim").length,
    blokaj: PEOPLE.filter((p) => p.unit === "blokaj").length,
    sirketB: PEOPLE.filter((p) => p.unit === "sirket-b").length,
    yuvarlama: PEOPLE.filter((p) => p.unit === "yuvarlama").length,
    totalLogins: PEOPLE.length,
  },
  people: PEOPLE,
  tvMap: TV_MAP,
  payMap: PAY_MAP,
  edgeMap: EDGE_MAP,
  kosumOrder: [
    "PNT-009/034/035/036 + HSP-014 (8007 çelişki, 8011 varsayıldı) → 11+4",
    "8007 düzelt, 8011 teşvik onayla → DON-015/016/018 + P0 HSP-011 Ana",
    "P0 PNT-004/HSP-005 Operasyon Eylül",
    "HSP-023 / E2E-012 Blokaj 8078",
    "EDGE-037 Yuvarlama 100 → Luca 5 → EDGE-046/047/048",
    "HSP-009 ikramiye 8009 (E2E-005 ve Luca 8009’dan sonra)",
    "Runtime EDGE 005/006/010/016/027/042/044 + PNT-010/011 + arşiv",
    "E2E-013 / EDGE-049 8017 Luca Ana 15’ten sonra",
  ],
};

const ikSeed = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "dhr_ik_seed_32.json"), "utf8"));
const ikPeople = (ikSeed.created || []).map((c) => ({
  sicil: String(c.employeeNumber),
  name: c.name,
  email: c.email,
  password: PASSWORD,
  profile: c.profile,
  note: c.note,
  unit: "İnsan Kaynakları",
  group: "ik",
}));

function loginRow(p) {
  return {
    sicil: p.sicil,
    name: p.name,
    email: p.email,
    password: PASSWORD,
    profile: p.profile,
    note: p.note,
    unit: UNITS.find((u) => u.id === p.unit)?.name || p.unit,
    group: p.group,
  };
}

const logins = {
  environment: "https://dhrtest.d1-tech.com.tr",
  note: "Public demo. Yalnız @demo.com. Arda/Sude/BT yok.",
  groups: [
    { id: "ik", title: "İnsan Kaynakları (6101–6132)", people: ikPeople },
    {
      id: "lab",
      title: "Bordro Laboratuvarı (yöneticiler + Ana + Operasyon)",
      people: PEOPLE.filter((p) => ["lab", "ana", "operasyon"].includes(p.unit)).map(loginRow),
    },
    {
      id: "kenar",
      title: "Kenar Durumlar",
      people: PEOPLE.filter((p) => p.unit === "kenar").map(loginRow),
    },
    {
      id: "takvim",
      title: "Takvim",
      people: PEOPLE.filter((p) => p.unit === "takvim").map(loginRow),
    },
    {
      id: "blokaj",
      title: "Blokaj",
      people: PEOPLE.filter((p) => p.unit === "blokaj").map(loginRow),
    },
    {
      id: "yuvarlama",
      title: "Yuvarlama (8101–8200)",
      people: PEOPLE.filter((p) => p.unit === "yuvarlama").map(loginRow),
    },
    {
      id: "sirket-b",
      title: "Şirket B — Faz1 Bordro A.Ş.",
      people: PEOPLE.filter((p) => p.unit === "sirket-b").map(loginRow),
    },
  ],
};

const faz1Comparison = {
  generatedAt: new Date().toISOString(),
  period: "Eylül 2026",
  unit: "Bordro Laboratuvarı — Ana Kadro",
  lucaPdfVersion: null,
  ui: {
    title: "Eylül 2026 — Faz 1 Bordro Laboratuvarı",
    lead: "Kadro ve TV/PAY/EDGE eşlemesi hazır. Luca/DHR export gelince bu sekme İK verisine karışmadan aynı karşılaştırma görünümüne geçer.",
    verdict: "Karşılaştırma placeholder — export bekleniyor.",
    footer: "İK Ekim/Ocak verisi bu sekmeye karışmaz. BT kapsam dışı.",
  },
  sources: { lucaPdf: "", dhrExcel: "" },
  summary: {
    lucaCount: 0,
    dhrCount: 0,
    matched: 0,
    netWithin100: 0,
    avgAbsNetDelta: null,
    fmHoursTotalLuca: null,
  },
  rows: [],
  legal: {
    gvMonthly2026: [],
    dhrObserved: { exemptApplied: 0, paramFormulaValue: 0, allMonthsSame: true },
    lucaObserved: { exemptApplied: 0, octoberLegal: 0 },
  },
};

const faz1Matrix = {
  period: "Eylül 2026",
  environment: "dhrtest.d1-tech.com.tr",
  sourceOfTruth: "Excel Faz 1 + DHR seed (Luca export sonra)",
  matrixDesign: {
    layers: [
      { id: "tv", title: "TV-01…22", desc: "Tipik vakalar" },
      { id: "pay", title: "PAY 127", desc: "Excel senaryoları kadroya çevrildi" },
      { id: "edge", title: "EDGE-001…052", desc: "Kenar / Takvim / Blokaj / Yuvarlama / Şirket B" },
    ],
    notFullCombinatorial: "15’lik dönem yalnız Ana Kadro. Kenar/Yuvarlama Lab çocuğu değil.",
  },
  checkedItems: [],
  correctFindings: [],
  dhrBugs: [],
  scenarios: [],
};

fs.writeFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), JSON.stringify(roster, null, 2));
fs.writeFileSync(path.join(ROOT, "src", "data", "logins.json"), JSON.stringify(logins, null, 2));
fs.writeFileSync(path.join(ROOT, "src", "data", "faz1_comparison.json"), JSON.stringify(faz1Comparison, null, 2));
fs.writeFileSync(path.join(ROOT, "src", "data", "faz1_matrix.json"), JSON.stringify(faz1Matrix, null, 2));

const loginCount = logins.groups.reduce((n, g) => n + g.people.length, 0);
console.log("people", PEOPLE.length, "logins", loginCount, "ik", ikPeople.length, "yuv", PEOPLE.filter((p) => p.unit === "yuvarlama").length);
console.log("ana aktif", roster.counts.anaAktif, "pasif", roster.counts.anaPasif);
