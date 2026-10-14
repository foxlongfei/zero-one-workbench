import fs from 'node:fs';
import crypto from 'node:crypto';

const input = process.argv[2] || 'research/depthmap/habs-dc-97-first-floor-trace.json';
const output = process.argv[3] || 'research/depthmap/habs-dc-97-first-floor.dxf';
const trace = JSON.parse(fs.readFileSync(input, 'utf8'));
const { originPixel, x, y } = trace.calibration;
const local = ([px, py]) => [
  Number(((px - originPixel[0]) * x.metresPerPixel).toFixed(4)),
  Number(((originPixel[1] - py) * y.metresPerPixel).toFixed(4)),
];
const lines = [];
for (let index = 1; index < trace.exteriorPolylinePixels.length; index += 1) {
  lines.push({ id: `EXT-${index}`, a: local(trace.exteriorPolylinePixels[index - 1]), b: local(trace.exteriorPolylinePixels[index]) });
}
for (const segment of trace.wallSegmentsPixels) lines.push({ id: segment.id, a: local(segment.a), b: local(segment.b) });

const dxf = ['0','SECTION','2','HEADER','0','ENDSEC','0','SECTION','2','ENTITIES'];
for (const line of lines) dxf.push('0','LINE','8','WALLS','10',String(line.a[0]),'20',String(line.a[1]),'30','0','11',String(line.b[0]),'21',String(line.b[1]),'31','0');
dxf.push('0','ENDSEC','0','EOF');
fs.writeFileSync(output, `${dxf.join('\n')}\n`);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
const report = {
  schema: 'zero-one.habs-depthmap-input-build.v0.1',
  caseId: trace.caseId,
  sourceTrace: input,
  sourceImageSha256: trace.source.sha256,
  output,
  outputSha256: sha256,
  lineCount: lines.length,
  calibration: trace.calibration,
  validationPointCount: trace.manualValidationPoints.length,
  qualityBoundary: trace.qualityBoundary,
};
fs.writeFileSync('research/depthmap/habs-dc-97-first-floor-input-build.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
