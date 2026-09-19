# DHR × Luca × YZ — Bordro karşılaştırması

`dhrtest2` ortamındaki DHR bordro motorunu **Luca PDF** ve **2026 Türkiye mevzuatı (YZ)** ile yan yana gösteren statik sitedir. Amaç DHR’nin doğru hesapladığı yerleri, Luca’dan sapmaları ve mevzuat kararı bekleyen farkları tek ekranda görmektir.

Luca **referanstır, hakem değildir**. Damga matrahında Luca’nın haklı çıktığı satırlar olduğu gibi 4691 terkiminde DHR’nin haklı çıktığı satırlar da vardır. Geçme eşiği **±0,01 TL**.

## Canlı site

https://ardakocaoglu0.github.io/dhr-luca-ekim2026/

Kaynak dal: `main`. Yayın: `gh-pages` (aşağıda).

## Üç kaynak

| Kolon | Kaynak | Not |
| --- | --- | --- |
| **DHR** | `https://dhrtest2.d1-tech.com.tr` bordro API’si | `/api/PayrollPeriod/{id}`, puantaj, `/api/PaymentValue/all`. Excel export kullanılmıyor. |
| **Luca** | Bordro PDF | İK Ekim/Ocak: `public/downloads/bordro_d1_tech.pdf`. Tek Değişken: `public/downloads/bordro_tek_degisken.pdf`. Bordro Paket PDF henüz yok. |
| **YZ** | `src/data/mevzuat.json` | 2026 GVK dilimleri, asgari GV istisna bandı (aylık), SGK %14 / işsizlik %1 / SGDP %7,5, damga ‰7,59, yemek PEK 21×158 / GV-damga 21×300. Aylık izole hesap; kümülatif dilim yok. |

Tablolarda gösterilen farklar:

- **Δ DHR−Luca** — ürün vs Luca PDF
- **Δ DHR−YZ** — ürün vs mevzuat motoru

**Durum (OK / FARK)** yalnız Δ DHR−Luca’ya bakılır. Luca bekliyorsa rozet **BEKLİYOR** olur.

## Site sekmeleri

| Sekme | Ne var |
| --- | --- |
| **Durum panosu** | Çalışan özellikler, açık buglar, test edilmeyenler, mevzuat ihtilafları, dönem özeti |
| **Ekim 2026** | İK 32 kişi · DHR × Luca × YZ |
| **Ocak 2026** | Aynı İK 32’liği, Ocak girdileri · DHR × Luca × YZ |
| **Ocak 2026 — Tek Değişken** | Yeni birim, 27 kişi, satırda tek sapma · DHR × Luca × YZ |
| **Ocak 2026 — Bordro Paket** | Paket motor düzeltmeleri + tek sapma 30 kişi (6301–6330) · DHR × YZ (Luca BEKLİYOR) |
| **Eylül 2026 — Faz 1** | Laboratuvar kadrosu. Karşılaştırma alt sekmesi Ana 15 (Luca PDF henüz yok) |
| **Girişler** | Yalnız `@demo.com` hesapları. Arda / Sude / BT yok |

Karşılaştırma sayfalarında (Durum panosu hariç) açık kartlar:

1. Test edilen senaryolar  
2. Kişi bazlı kalem tablosu  
3. Kalem kalem DHR × Luca × YZ  
4. DHR’de tespit edilen sorunlar  
5. Tüm çalışanlar  

Faz 1 ek alt sekmeler: **Luca YZ DHR karşılaştırma**, Manuel dene, Kadro, Eşlemeler, Koşum.

## Dönemler ve birimler

Ortam: `https://dhrtest2.d1-tech.com.tr` (eski `dhrtest` kullanılmaz).

### İnsan Kaynakları (6101–6132) — dokunulmaz

Ekim ve Ocak sekmeleri bu 32’liktir. Çapraz senaryolar var (ör. 05510+prim aynı kişide). Tarihsel kayıt; Tek Değişken bu yüzden açıldı.

### Tek Değişken — Ocak 2026

Birim **Tek Değişken**. Yönetici (test dışı): **6200 Ege Bayrak**. Karşılaştırma: **6201–6227**. Zemin: Serra brüt 50.500 + yemek 5.500 + yol 3.200, işe giriş `2025-06-02`. Kısmi ay yalnız **6214 Nazli Er** (`2026-01-05`).

| Sicil | Kişi | Tek sapma |
| --- | --- | --- |
| 6201 | Ada Korkmaz | Baseline |
| 6202 | Berk Yalcin | 05510 %2 |
| 6203 | Canan Demir | 05510 %5 |
| 6204 | Defne Koc | Net ücret |
| 6205 | Efe Sahin | 5746 lisans |
| 6206 | Feride Aksoy | 5746 yüksek lisans |
| 6207 | Gokce Yilmaz | 5746 doktora |
| 6208 | Hakan Boz | 4691 Ar-Ge |
| 6209 | Isik Demirci | 4691 destek |
| 6210 | Jale Kaya | SGDP |
| 6211 | Kaan Oz | Engelli 1 |
| 6212 | Leman Su | Engelli 2 |
| 6213 | Mert Acar | Engelli 3 |
| 6214 | Nazli Er | Kısmi ay |
| 6215 | Oya Polat | Stajyer |
| 6216 | Pinar Celik | Yabancı |
| 6217 | Ruya Tan | Yönetici profili |
| 6218 | Seda Nur | Asgari civarı |
| 6219 | Tolga Ergin | 12 saat FM |
| 6220 | Umay Gunes | Avans 7.200 |
| 6221 | Volkan Ates | Prim 5.000 |
| 6222 | Yelda Kurt | İkramiye 10.000 |
| 6223 | Zafer Ince | Genel kesinti 1.200 |
| 6224 | Asya Duru | Masraf 750 |
| 6225 | Bora Elci | BES %3 |
| 6226 | Cemil Ucar | Geçmiş GV 185.000 |
| 6227 | Derya Unal | 5746 GV terkin kartı |

Son Luca PDF: `bordro_d1_tech (27).pdf` → `public/downloads/bordro_tek_degisken.pdf` (`scripts/merge-izole-pdf.cjs`). DHR 27/27 · Luca 27/27.

Luca’da hâlâ Ada zemininde kalan (kart düzeltmesi + Ocak Hesapla + yeni PDF beklenir): **Hakan 6208**, **Işık 6209**, **Cemil 6226**. Derya 6227 damga 0 (5746 damga terkin); GV hâlâ Ada.

### Bordro Paket — Ocak 2026

İK ve Tek Değişken kartlarına dokunulmaz. Faz1 Bordro A.Ş. kullanılmaz. Birim **Bordro Paket**. Yönetici (test dışı): **6300 Yaman Efe**. Karşılaştırma: **6301–6330**. Zemin: Mine/Ada/Serra 50.500 + yemek 5.500 + yol 3.200, işe giriş `2025-06-02`, Ocak **21 iş günü**.

DHR 30/30 hesaplı. Hakem YZ ±0,01 **21/30**. Luca personel XLS aktarıldı; Luca PDF yok → Durum **BEKLİYOR**.

| Sicil | Kişi | Tek sapma |
| --- | --- | --- |
| 6301 | Mine Aras | Baseline |
| 6302 | Nuri Bal | Yemek 0 |
| 6303 | Oya Can | Yemek 12.000 |
| 6304 | Poyraz Dal | Stajyer 12.000 |
| 6305 | Rana El | Stajyer 40.000 |
| 6306 | Sarp Firat | Çırak |
| 6307 | Tuna Genc | İntörn |
| 6308 | Ufuk Han | Emekli SGDP |
| 6309 | Veda Il | BES Dahil Değil |
| 6310 | Yagmur Koc | OKS %3 |
| 6311 | Zeki Lal | Asgari altı |
| 6312 | Ahu Mor | 5746 stopaj terkin |
| 6313 | Baris Nur | Engelli 1 |
| 6314 | Cemre Oz | Çocuk yardımı |
| 6315 | Dicle Pal | Eş yardımı |
| 6316 | Ekin Re | Özel sağlık çalışanda |
| 6317 | Firat Su | Özel sağlık işveren |
| 6318 | Gizem Tan | Yol bitiş 2025-12 |
| 6319 | Hale Ulu | Yinelenen ek 2.500 |
| 6320 | Ilker Var | İzin harçlığı |
| 6321 | Jale Yurt | Nafaka 8.000 |
| 6322 | Koray Zan | İcra 20.000 |
| 6323 | Lale Ada | Nafaka + icra |
| 6324 | Mert Bey | Sendika 450 |
| 6325 | Nehir Can | İşveren alacağı |
| 6326 | Onur Dem | Avans 7.200 |
| 6327 | Pinar Er | SGK tavan + prim |
| 6328 | Ruya Fen | Kıdem/ihbar çıkış |
| 6329 | Sena Gol | Masraf yeri %60/%40 |
| 6330 | Tamer Han | Ücret kesme 2 gün |

Luca içe aktarma: `scripts/paket-luca-personel-xls.cjs` → `personel_giris_excel_BordroPaket.xls` (Masaüstü / İndirilenler). Aynı işyeri, bölüm **Bordro Paket**.

YZ yemek: PEK `21×158` (SGK); GV ve damga `21×300` (GVK 23/8). Mine PEK 55.882, damga 156,88.

Kalan DHR ürün sapması (kurulum değil): avans mahsubu (Onur onaylı 7200 bordroda 0), icra/alacak 1/4 yok, engellilik PUT yazılmıyor, 5746 terkin yok, kıdem API `reason` zorunlu.

### Faz 1 — Eylül 2026

İK ve BT’ye dokunulmaz. Yeni birimler: Bordro Laboratuvarı, Ana Kadro, Operasyon, Kenar, Yuvarlama, Takvim, Blokaj, Faz1 Bordro A.Ş.

| Birim | Durum (Eylül 2026) |
| --- | --- |
| Ana Kadro 15 (8003–…) | Hesaplandı 15/15. Site karşılaştırması bu 15’lik |
| Operasyon 3 | Hesaplandı. 07.09 tatili yalnız burada |
| Blokaj 8078 | Hesaplandı (profilsiz SGK beklenen blokaj olmadı) |
| Yuvarlama 100 (8101–8200) | Dönem açık, henüz hesaplanmadı |
| Kenar 53 | Dönem açık, hesaplanmadı |

Koşum sırası: Ana 15 → Op 3 → Blokaj → Yuvarlama 100 → Luca 5 (8101–8105) → kenar EDGE. Luca PDF Faz 1 için henüz yok; karşılaştırma sekmesinde Luca **BEKLİYOR**.

## Ortam kuralları

- İK **6101–6132**, BT, Sude hesabına dokunma.
- Sude şifresi asla sıfırlanmaz / değiştirilmez.
- Demo girişler: `*@demo.com` (Girişler sekmesi). Admin ve gerçek İK hesapları bu repoya yazılmaz.
- Birim bordro ayarlarını (kanun / PEK / GV) İK dönemini bozmamak için rastgele PUT etme.
- Yuvarlama 100, Ana/İK ile karıştırılmaz.

## Repo yapısı

```
src/
  AppRoot.tsx          sekmeler
  App.tsx              Ekim / Ocak / Tek Değişken / Faz 1 karşılaştırma
  DashboardView.tsx    durum panosu
  Faz1View.tsx         laboratuvar
  LoginsView.tsx       demo girişler
  data/
    dashboard.json
    ekim_comparison.json + ekim_matrix.json
    comparison.json + matrix.json          ← Ocak İK
    izole_comparison.json + izole_matrix.json + izole_roster.json
    paket_comparison.json + paket_matrix.json + paket_roster.json
    faz1_*.json
    mevzuat.json
    logins.json
public/downloads/      Luca PDF + (varsa) DHR Excel
scripts/               seed, PDF birleştirme, site JSON üretimi
docs/sohbet-gecmisi.md bu işin Cursor sohbet özeti
```

## Sık kullanılan scriptler

| Script | İş |
| --- | --- |
| `scripts/build-data.cjs` | Luca PDF + DHR Excel → `comparison.json` (İK şablonu) |
| `scripts/build-mismatch.cjs` | Ocak uyuşmazlık raporu — **`npm run build` bunu çalıştırır** |
| `scripts/add-ai-compare.cjs` | YZ kolonunu JSON’a basar |
| `scripts/merge-izole-pdf.cjs` | Tek Değişken Luca PDF’ini `public/downloads/` altına kopyalar |
| `scripts/izole-luca-personel-xls.cjs` | Luca İK personel içe aktarma XLS (Tek Değişken kadrosu) |
| `scripts/paket-luca-personel-xls.cjs` | Luca personel içe aktarma XLS (Bordro Paket 6301–6330) |
| `scripts/generate-paket-site.cjs` | `paket_comparison.json` + `paket_matrix.json` (YZ) |
| `scripts/paket-apply-dhr.cjs` | `%TEMP%/paket_ocak_period.json` → DHR kolonları, Δ DHR−YZ |
| `scripts/paket-dhr-seed.cjs` | dhrtest2 Bordro Paket seed (İK kartına dokunmaz) |
| `scripts/izole-dhr-seed.cjs` / `izole-run-full.cjs` | Tek Değişken DHR seed + hesap |
| `scripts/faz1-dhr-seed.cjs` / `faz1-run-full.cjs` | Faz 1 seed / koşum |
| `scripts/faz1-op-blokaj-ana-check.cjs` | Ana / Op / Blokaj dönem durumu (Playwright + CSRF) |
| `scripts/generate-izole-site.cjs` / `generate-faz1-data.cjs` | Site JSON yenileme |

Ham DHR sayısı için Excel değil API kullanılır. Seed scriptleri `dhrtest2`’ye yazar; rastgele çalıştırma.

## Yerel çalıştırma

```powershell
npm install
npx vite
```

`vite.config.ts` yerelde `base: "./"`. Açılan adres genelde `http://localhost:5173/`.

Veri JSON’ları `src/data/` içinde hazırdır. PDF/Excel’den İK karşılaştırmasını baştan üretmek için `npm run build:data` (varsayılan PDF yolu script içinde).

## Canlıya alma (GitHub Pages)

**`npm run build` kullanma.** O komut `build:mismatch` çalıştırır ve Ocak İK karşılaştırmasını yeniden yazar.

PowerShell:

```powershell
$env:GITHUB_PAGES="true"
npx tsc --noEmit
npx vite build
npx --yes gh-pages -d dist -m "site guncellemesi"
```

`GITHUB_PAGES=true` iken Vite `base` `/dhr-luca-ekim2026/` olur. `gh-pages` yalnızca `gh-pages` dalını günceller; `main` ayrı commit ister.

## Karar bekleyen mevzuat / tasarım farkları

Durum panosundaki güncel metin esas alınır. Özet:

- Ocak yemek damga: DHR Serra/Ada/Mine 156,88 = Luca; Ekim Luca PDF hâlâ eski basabiliyor
- 5746 damga / stopaj terkini (Paket Ahu kutusu açık, tutar Mine)
- Masraf iadesi ücret midir?
- Luca Ekim’de hâlâ Ocak GV istisna bandı (~4.211) uyguluyor; yasal Ağustos–Aralık 2026 bandı 5.615,10 TL

Açık DHR bug özeti de durum panosundadır (ör. tek seferlik kalemlerin hesap sonrası 0 olması, avansın bordroya yazılmaması, Ekim/Ocak yemek SGK istisnasının tutarsızlığı).

## Sohbet geçmişi

Cursor ham JSONL’i GitHub’a konmaz (şifre, TC, ilgisiz DHR QA sohbetleri). Bu işe ait istekler ve sonuçlar:

**[docs/sohbet-gecmisi.md](docs/sohbet-gecmisi.md)**

## Lisans / gizlilik

Repo public. Demo sicil ve `@demo.com` girişleri kasıtlı olarak sitededir. Gerçek admin şifresi, Sude hesabı ve e-Devlet/SGK işyeri bilgisi buraya yazılmaz.
