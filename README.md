# DHR × Luca — Ekim 2026 Bordro Karşılaştırması

İnsan Kaynakları test matrisi (32 kişi) için **dhrtest** ve **Luca** bordro sonuçlarının görsel karşılaştırması.

## Canlı site

GitHub Pages: `https://ardakocaoglu0.github.io/dhr-luca-ekim2026/`

## Kaynak dosyalar

- `public/downloads/bordro_d1_tech.pdf` — Luca Ekim 2026 bordrosu
- `public/downloads/Payroll_Ekim_2026.xlsx` — DHR export

## Geliştirme

```bash
npm install
npm run build:data   # PDF + Excel → src/data/comparison.json
npm run dev
npm run build        # production build → dist/
```

## İçerik

- Kişi bazında net / GV / brüt farkları
- GV istisnası: yasal 2026 aylık tablo vs DHR (0) vs Luca (~4211 TL)
- Resmi mevzuat referansları (GVK, GİB, Resmi Gazete)
