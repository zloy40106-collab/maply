const zlib = require('node:zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
const icons = new Map();
function makeIcon(size) {
  if (icons.has(size)) return icons.get(size);
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x / size, py = y / size;
      const legs = py > .28 && py < .72 && ((px > .27 && px < .36) || (px > .64 && px < .73));
      const middle = px >= .33 && px <= .67 && Math.abs(py - (.30 + (.50 - Math.abs(px - .50)) * .9)) < .045;
      const color = legs || middle ? [255,255,255] : [16,43,70];
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=2;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  icons.set(size,png);
  return png;
}
module.exports = function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  const size = String(req.query.size) === '512' ? 512 : 192;
  res.setHeader('Content-Type','image/png');
  res.setHeader('Cache-Control','public, max-age=86400');
  return res.status(200).send(makeIcon(size));
};
