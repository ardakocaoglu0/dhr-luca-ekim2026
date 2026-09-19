# Bordro karşılaştırması — sohbet arşivi

Bu dosya Cursor’daki ham sohbet dökümü değildir. Public GitHub’a **şifre, TC, e-Devlet/SGK işyeri, admin hesabı** konmaz. Aşağıdaki metin, bu repo klasöründeki kayıtların bordro karşılaştırmasına ait kısmından derlendi (istek + ne yapıldı).

Ham JSONL yerelde durur (`agent-transcripts`). Aynı klasöre düşmüş **ilgisiz** sohbetler bu arşive alınmadı: DHR demo seed, genel UI/API changelog testleri, ek mesai rapor düzeltmesi.

Ana iplik (yerel Cursor id): `083e5093-b8ed-4093-844b-96201248fb31` — 27 Ağustos 2026’da “DHR’yi Luca ile doğrula” kararıyla bu siteye bağlandı.

Geçme kuralı (13 Eylül’den beri): **±0,01 TL**. Luca doğru kabul edilmez; referanstır. **Durum** kolonu 15 Eylül’den beri DHR−Luca’ya bakar (DHR−YZ değil).

---

## 1. Neden bu iş (27 Ağustos 2026)

**İstek:** İnsan Kaynakları birimine, Luca’daki her hesaplama şeklini (kanun no, mesai, avans, ek kazanç, kesinti) deneyecek kadar çalışan ekle. DHR’de bordroyu hesapla, Luca ile doğrula. Önce plan.

**Yapılan:** 32 kişilik İK matrisi (6101–6132), DHR seed + Luca personel içe aktarma. İlk karşılaştırma Ekim 2026.

Aynı gün:

- Luca’ya tek tek mi yoksa içe aktarma mı → hem DHR’ye hem Luca XLS.
- Puantaj Luca’da içe aktarılabilir mi diye bakıldı.
- İlk DHR × Luca fark listesi.

## 2. Sitenin doğuşu (27 Ağustos 2026)

**İstek:** Detaylı web sitesi, `ardakocaoglu0` GitHub’a push, grafik, DHR’deki yasal yanlışlar resmi kaynakla, mobil/web, iki bordro dosyası siteden indirilsin.

Kaynaklar o gün: Luca `bordro_d1_tech (1).pdf`, DHR `Payroll_Ekim 2026_….xlsx`.

**Yapılan:** Bu repo + GitHub Pages  
https://ardakocaoglu0.github.io/dhr-luca-ekim2026/

Aynı akşam:

- Yeni Luca PDF `(5)` → kalem kalem DHR × Luca tablo.
- PDF parse sorunları.
- 05746 / 4691 / SGDP / engelli / stajyer için Luca’da kimin kartına ne yazılacağı.
- Uyuşmazlık listesi ve “Luca’da düzeltebileceklerimiz”.

İlk `main` commit: `c732d4f` — Ekim karşılaştırması, grafik, indirilebilir kaynak.

## 3. Matris ve kalem tablosu (sonraki günler)

Siteye tam test matrisi, “doğru bulunanlar”, 32 senaryo, kişi bazlı kalem satırları eklendi. Luca PDF sürümleri `(10)` vb. ile yenilendi.

31 Ağustos: “son durum ne?” — Ekim farklarının özeti.

## 4. Ocak 2026 İK (3–8 Eylül 2026)

**İstek:** Aynı 32’liği Ocak için izin / kesinti / ek kazanç ile seed et, Ocak bordrosunu hesapla. **Birim bordro ayarlarına dokunma.**

**Yapılan:** Ocak DHR koşumu. Sitede Ocak sekmesi.

Sonra:

- Canlı URL Ocak’ı gösteriyor mu, çözülen bug silindi mi?
- Ocak tasarımı Ekim ile aynı olsun. Ocak Luca gelene kadar **Ocak DHR × Ekim Luca** (geçici).
- Luca’ya Ocak’ta girilecekler listesi.
- `bordro_d1_tech (11).pdf` = Ocak Luca → gerçek Ocak × Ocak.
- Uyuşmayan çalışan / kalem listesi (`build-mismatch`).

8 Eylül notu (girdi hizası): Ocak’taki ~50 bin TL’lik farkın çoğu motor değil konfig. Luca tarafında yemek/yol **B (brüt)** olmalıydı (N iken Luca 8.700’ü brütleştiriyordu). SGK yemek istisnası 158 TL/gün; yola istisna yok. Net ücretlilerde (Vildan/Ceren) ücret N, yemek/yol/FM B.

## 5. Faz 1 laboratuvar (11–13 Eylül 2026)

**İstek:** İK 32’liği dondur. Yeni birim + yeni siciller. Demo şifre ortak. Girişler sekmesi. Ekim/Ocak İK olarak kalsın. En ince plan.

Kapsam (kısaltılmış):

- Ana Kadro 15 + Operasyon 3 (07.09 tatili yalnız Op).
- Kenar durumlar, Blokaj (profilsiz), Yuvarlama 100 (kuruş HSP-021).
- İkinci şirket / ikinci işyeri maddeleri açıklandı; ürün kısıtı yüzünden bir kısmı “test edilmedi”de kaldı.
- Kanun kataloguna dokunulmadan yeni ek kazanç (masraf) ve Ar-Ge merkezi kartı.

**Yapılan:** `faz1_*` JSON, Faz 1 sekmesi, Girişler, seed scriptleri. İK 6101–6132 / BT / Sude’ye dokunulmadı.

13 Eylül öğleden sonra:

- Üçüncü kolon **YZ** (2026 TR mevzuatı). Faz 1 Luca **BEKLİYOR**.
- Fark kolonları yalnız **DHR−Luca** ve **DHR−YZ** (Luca−YZ yok).
- Faz 1 dönemi **Eylül 2026** (Ocak değil) — laboratuvar Eylül’de koşuldu.
- Faz 1 DHR hesaplandı, Ana 15 siteye yazıldı.

## 6. Tek Değişken (13 Eylül 2026)

**İstek:** İK’de çapraz girdi (Baran 05510+prim, Emre 05510+FM, Ceren net+FM) hangisinin bozduğunu ayıramıyor. Yeni birim, **bir kişi = bir değişken**, yine Ocak, demo login. ±0,01. “Kısmen geçti” yok. Luca hakem değil.

**Yapılan:** Birim Tek Değişken, 6200 yönetici + 6201–6227, `izole_*` JSON, site sekmesi, Luca personel XLS (`izole-luca-personel-xls.cjs`).

Luca tarafı: ayrı bölüm (İK şablonuyla aynı XLS yapı), ayrı iş yeri değil — DHR biriminin karşılığı Luca’da **bölüm**.

## 7. Site sadeleştirme ve yayın (13–15 Eylül 2026)

**İstekler:**

- `gh-pages` dalından canlıya al (`main` ayrı kalsın).
- Tek Değişken’den gereksiz kartları kaldır; sonra **tüm karşılaştırma sayfalarında** aynı sade düzen (Durum panosu ve Faz 1’in diğer alt sekmeleri hariç).
- Açılır-kapanır olmasın, kart içi kaydırma olmasın.
- Faz 1 YZ sekmesinin adı: **Luca YZ DHR karşılaştırma**.
- **Durum** rozeti DHR−YZ değil **DHR−Luca**.

**Yapılan:** Lean `AppView`, `Section collapsible={false}`, `.table-scroll.flow`, Durum = `item.match`. Yayın:

```powershell
$env:GITHUB_PAGES="true"
npx tsc --noEmit
npx vite build
npx --yes gh-pages -d dist
```

`npm run build` kullanılmaz (`build:mismatch` Ocak İK JSON’unu ezer).

## 8. Faz 1 DHR koşum durumu (14 Eylül 2026)

**İstek:** Yalnız 15 kişilik Ana mı koşuldu? Yuvarlama 100 ne? Sonra Op 3 + Blokaj + Ana 15 kontrol.

**Sonuç (dhrtest, Eylül):**

- Ana 15 — hesaplı (status 4). 8009 avans slip’te yok (F1-AVANS). 8008 FM 10,00 TL (saat değil). 8010 BES artık %3 / 1.896 (eski %300 koşumu bu run’da yok).
- Operasyon 3 — hesaplı. 8020 ücretsiz 8–10.09 → 27 gün. 8021 rapor ve 8022 yıllık izin tam 30 gün (ödenir izin / istirahat).
- Blokaj 8078 — hesaplandı; beklenen “SGK profili yok” blokajı olmadı.
- Yuvarlama 100 — dönem açık, hesaplanmadı. Plan: Kaydet(100) → Hesapla, netleri Ekin 56.506,37 kuruş kovasına göre grupla; sonra 8101 profil sil, 8102 SGDP.

Luca sırası: önce Ana 15 PDF, sonra Op 3, Blokaj 1. Yuvarlama’dan Luca’ya yalnız 8101–8105.

## 9. Tek Değişken Luca artıkları (Eylül ortası)

Kart + Ocak Hesapla + yeni PDF beklenenler (özet):

- Hakan 6208 — 4691 Ar-Ge Personeli, proje 111111 (139), kanun yalnız 4691. DHR GV 0 / net 50.841,40; Luca hâlâ Ada GV.
- Işık 6209 — aynı, tanım Destek Personeli.
- Cemil 6226 — Geçmiş GV 185.000 + Kullan (yalnız Cemil). Luca Ada.

Dokunulmayan (zaten ölçülen) örnekler: Ada baseline, Berk/Canan 05510, Efe/Feride/Gökçe damga 0, Tolga FM, Umay avans, Volkan prim, Yelda ikramiye, Zafer kesinti, Asya masraf, Bora BES, Nazlı, Oya, Defne, Seda, Jale, Kaan/Leman/Mert.

Masraf EK KAZANÇ: GV/Damga/SGK/İşsizlik boş, AYLIK, puantaj ÜCRET, Net, Diğer, Son Bordro.

## 10. Bordro Paket + dhrtest2 (18–19 Eylül 2026)

**İstek:** Mevcut plandaki düzeltilen hataları doğrula; sonra her çalışanda tek değişkenle yeni özellikleri test etmek için yeni birim. Hepsi **dhrtest2**. İK 6101–6132 / BT / Sude’ye dokunma. Faz1 Bordro A.Ş. yok. Luca referans, hakem değil. ±0,01. Canlı site + Girişler (Paket sekmesine login tablosu koyma).

**Yapılan:**

- Birim Bordro Paket, yönetici 6300 Yaman, karşılaştırma 6301–6330. `paket_*` JSON, site sekmesi, Girişler grubu.
- Seed / dump / apply: `paket-dhr-seed.cjs`, `paket-apply-dhr.cjs`, `generate-paket-site.cjs`.
- Kurulum düzeltmeleri: Ocak puantaj **21 iş günü** (önce 22 kalmıştı); çırak/intörn **Stajyer** profili; Gizem yol tutarı 0 (`validTo` API yazılmıyor).
- ~861 TL’lik yığın sapma YZ formülüydü, Paket yemek bayrağı değil. YZ: PEK 21×158, GV/damga 21×300 (GVK 23/8). Mine PEK 55.882, damga 156,88 = Serra/Ada.
- DHR−YZ net **21/30** geçti. Kalan ürün: avans (Onur onaylı 7200 bordroda 0), icra/alacak 1/4, engellilik PUT, 5746 terkin, kıdem `reason` zorunlu, Pınar tavan.
- Luca personel XLS: `paket-luca-personel-xls.cjs` → `personel_giris_excel_BordroPaket.xls`. Aktarım 30/30 Bordro Paket / TEKNOPARK doğrulandı. PDF yok → Durum BEKLİYOR.
- Canlı `gh-pages` güncellendi. `main` bu turda commit + push.

LT_Offboard / LT_Offboard2 bu işin parçası değil (15–17 Eylül changelog QA artığı).

## 11. Bu arşivin sınırı

Alınan:

- Bu repoyu doğuran ve geliştiren kullanıcı istekleri
- Git `main` commit omurgası (`c732d4f` … ve sonrası, Bordro Paket dahil)
- Canlı sitede görülen kararlar (YZ kolonları, Durum = DHR−Luca, Bordro Paket DHR−YZ, sade kart listesi)

Alınmayan:

- Cursor JSONL’in tamamı (yüzlerce araç çağrısı, başka DHR işleri)
- Şifreler, TC, işyeri SGK şifresi
- Demo seed / changelog UI test sohbetleri (ayrı iş)

Yeni bir tur sohbet birikir ve “arşivi güncelle” dersen aynı kuralla bu dosyaya eklenir: istek + sonuç, sır yok.
