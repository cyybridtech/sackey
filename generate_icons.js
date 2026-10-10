import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([lenBuf, body, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;
  const innerRadius = width * 0.38;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded rectangle for icon background
      const rx = Math.abs(dx);
      const ry = Math.abs(dy);
      const cornerRadius = size * 0.22;
      const halfW = size * 0.44;
      const halfH = size * 0.44;

      let insideRoundedRect = false;
      if (rx <= halfW - cornerRadius && ry <= halfH) {
        insideRoundedRect = true;
      } else if (rx <= halfW && ry <= halfH - cornerRadius) {
        insideRoundedRect = true;
      } else {
        const cdx = rx - (halfW - cornerRadius);
        const cdy = ry - (halfH - cornerRadius);
        if (cdx > 0 && cdy > 0 && Math.sqrt(cdx * cdx + cdy * cdy) <= cornerRadius) {
          insideRoundedRect = true;
        }
      }

      if (insideRoundedRect) {
        // Gradient from blue-600 (#2563eb) to indigo-700 (#4338ca)
        const factor = (x + y) / (width + height);
        const r = Math.round(37 * (1 - factor) + 67 * factor);
        const g = Math.round(99 * (1 - factor) + 56 * factor);
        const b = Math.round(235 * (1 - factor) + 202 * factor);

        // Draw a shopping cart / store symbol in white
        // Simple store building roof & door
        let isSymbol = false;
        
        // Roof triangle
        const roofY = cy - size * 0.15;
        const roofH = size * 0.16;
        if (y >= roofY && y <= roofY + roofH) {
          const roofWidthAtY = ((y - roofY) / roofH) * (size * 0.28);
          if (Math.abs(dx) <= roofWidthAtY) {
            isSymbol = true;
          }
        }
        
        // Pillars / body
        const bodyTop = roofY + roofH + size * 0.03;
        const bodyBottom = cy + size * 0.22;
        if (y >= bodyTop && y <= bodyBottom) {
          if (Math.abs(dx) <= size * 0.26) {
            // Door cutout
            const isDoor = Math.abs(dx) <= size * 0.08 && y >= bodyBottom - size * 0.14;
            // Window cutouts
            const isWindowLeft = dx >= -size * 0.22 && dx <= -size * 0.12 && y <= bodyTop + size * 0.10;
            const isWindowRight = dx >= size * 0.12 && dx <= size * 0.22 && y <= bodyTop + size * 0.10;

            if (!isDoor && !isWindowLeft && !isWindowRight) {
              isSymbol = true;
            }
          }
        }

        // Base line
        if (y >= bodyBottom && y <= bodyBottom + size * 0.04 && Math.abs(dx) <= size * 0.30) {
          isSymbol = true;
        }

        if (isSymbol) {
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent or solid dark background
        rawData[pxOffset] = 15;
        rawData[pxOffset + 1] = 23;
        rawData[pxOffset + 2] = 42;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Non-interlaced

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('client', 'public');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180));
console.log('PNG icons successfully generated!');
