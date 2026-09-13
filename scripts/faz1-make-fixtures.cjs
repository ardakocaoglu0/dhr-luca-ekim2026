const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "faz1-fixtures");
fs.mkdirSync(dir, { recursive: true });

function pdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const xref = [0];
  for (let i = 0; i < objects.length; i++) {
    xref.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const startxref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i++) out += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, "binary");
}

function crc32(buf) {
  let c = ~0;
  const t = [];
  for (let n = 0; n < 256; n++) {
    let k = n;
    for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
    t[n] = k;
  }
  for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8);
  return (~c) >>> 0;
}

function zip(files) {
  const chunks = [];
  let offset = 0;
  const cds = [];
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(20, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    chunks.push(local, data);
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(20, 8);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);
    cds.push(cd);
    offset += local.length + data.length;
  }
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

fs.writeFileSync(path.join(dir, "gecerli.pdf"), pdf("Faz1 PAY-BRD-010 gecerli bordro arsiv PDF 2026"));
fs.writeFileSync(
  path.join(dir, "ornek.png"),
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
);

const docXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Faz1 PAY-BRD-011 ornek DOCX</w:t></w:r></w:p></w:body></w:document>';
const ctypes =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const rels =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
fs.writeFileSync(
  path.join(dir, "ornek.docx"),
  zip([
    ["[Content_Types].xml", Buffer.from(ctypes)],
    ["_rels/.rels", Buffer.from(rels)],
    ["word/document.xml", Buffer.from(docXml)],
  ])
);

const big = Buffer.concat([pdf("Faz1 PAY-BRD-012 limit-ustu PDF"), Buffer.alloc(12 * 1024 * 1024, 32)]);
fs.writeFileSync(path.join(dir, "limit-ustu.pdf"), big);
fs.writeFileSync(
  path.join(dir, "README.txt"),
  [
    "Faz 1 arsiv fixture (PAY-BRD-010..013 / EDGE-050)",
    "- gecerli.pdf: gecerli PDF",
    "- ornek.png / ornek.docx: alternatif tur",
    "- limit-ustu.pdf: ~12MB limit-ustu",
    "Laboratuvar calisani + 2026 ay. Naci Eren ornegi yerine.",
    "",
  ].join("\n")
);

for (const f of fs.readdirSync(dir)) {
  console.log(f, fs.statSync(path.join(dir, f)).size);
}
