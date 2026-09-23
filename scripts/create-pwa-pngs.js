import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makePng(width, height) {
  const bytesPerPixel = 4;
  const rawScanlineLength = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(height * rawScanlineLength);

  // Background color: Burgundy #8B1E2E -> R:139, G:30, B:46
  // Cross Gold: #FFD54F -> R:255, G:213, B:79
  const bgR = 139, bgG = 30, bgB = 46, bgA = 255;
  const goldR = 255, goldG = 213, goldB = 79, goldA = 255;

  const cx = width / 2;
  const cy = height / 2;
  const vBarW = Math.max(4, Math.floor(width * 0.08));
  const hBarH = Math.max(4, Math.floor(height * 0.08));
  const vBarH = Math.floor(height * 0.7);
  const hBarW = Math.floor(width * 0.55);
  const ringR = Math.floor(width * 0.12);
  const ringThick = Math.max(2, Math.floor(width * 0.03));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawScanlineLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      
      // Check if inside cross
      const inVBar = Math.abs(x - cx) <= vBarW / 2 && Math.abs(y - cy) <= vBarH / 2;
      const inHBar = Math.abs(x - cx) <= hBarW / 2 && Math.abs(y - (cy - height * 0.05)) <= hBarH / 2;
      
      const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - (cy - height * 0.05)) ** 2);
      const inRing = Math.abs(distFromCenter - ringR) <= ringThick;
      const inDot = distFromCenter <= ringThick * 1.5;

      if (inVBar || inHBar || inRing || inDot) {
        rawData[pixelOffset] = goldR;
        rawData[pixelOffset + 1] = goldG;
        rawData[pixelOffset + 2] = goldB;
        rawData[pixelOffset + 3] = goldA;
      } else {
        rawData[pixelOffset] = bgR;
        rawData[pixelOffset + 1] = bgG;
        rawData[pixelOffset + 2] = bgB;
        rawData[pixelOffset + 3] = bgA;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Compression deflate
  ihdr.writeUInt8(0, 11); // Filter standard
  ihdr.writeUInt8(0, 12); // Non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

const pubDir = path.join(process.cwd(), 'public');
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), makePng(192, 192));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), makePng(512, 512));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), makePng(512, 512));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), makePng(180, 180));
console.log('Successfully generated PWA compliant icons!');
