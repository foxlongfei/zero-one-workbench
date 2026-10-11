import fs from 'node:fs';
import zlib from 'node:zlib';

for (const path of process.argv.slice(2)) {
  const bytes = fs.readFileSync(path);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`${path}: invalid PNG signature`);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const next = dataStart + length + 4;
    if (next > bytes.length) throw new Error(`${path}: truncated ${type} chunk`);
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
    } else if (type === 'IDAT') idat.push(bytes.subarray(dataStart, dataStart + length));
    else if (type === 'IEND') { ended = true; break; }
    offset = next;
  }
  if (!ended || !width || !height || idat.length === 0) throw new Error(`${path}: incomplete PNG chunk stream`);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  if (!inflated.length) throw new Error(`${path}: empty decoded image stream`);
  console.log(JSON.stringify({path,bytes:bytes.length,width,height,decodedBytes:inflated.length,status:'PASS'}));
}
