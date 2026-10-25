import json, pathlib
base = pathlib.Path('/home/runner/work/zero-one-workbench/zero-one-workbench/.qwen/tmp')
out = {}
for i in range(1, 5):
    data = json.loads((base / f'ex-slice-{i}.json').read_text())
    for k, v in data.items():
        if k in out:
            raise SystemExit(f'duplicate {k}')
        out[k] = v
body = json.dumps(out, ensure_ascii=False, indent=2)
body = '\n'.join('    ' + line for line in body.splitlines())
target = pathlib.Path('/home/runner/work/zero-one-workbench/zero-one-workbench/portal/data/movement-exercises-v1.json')
text = target.read_text()
marker = '  "exercises": []\n}\n'
assert text.endswith(marker), 'marker missing'
new = text[: -len(marker)] + '  "exercises": ' + body[len('    '):] + '\n}\n'
json.loads(new)
target.write_text(new)
print('exercises', len(out), 'bytes', len(new))
