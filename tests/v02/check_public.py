#!/usr/bin/env python3
"""HTTP readback checks; not proof of functional acceptance or deployment freshness."""
import json, pathlib, time, urllib.request, urllib.error, sys
BASE='https://foxlongfei.github.io/zero-one-workbench/portal/'
pages=['index.html','v02-control.html','movement-v02-experience.html','traditional-case-v02.html','read-with-you-v01.html']
results=[]
for page in pages:
 result={'page':page,'status':'FAIL','http':None}
 for attempt in range(4):
  try:
   req=urllib.request.Request(BASE+page+'?ci='+str(int(time.time())),headers={'User-Agent':'v02-readback/1.0'})
   with urllib.request.urlopen(req,timeout=20) as r:
    data=r.read().decode('utf-8','replace');result['http']=r.status
    if r.status==200 and '<html' in data.lower() and len(data)>400:
     result['status']='PASS';break
  except Exception as e:result['error']=str(e)
  if attempt<3:time.sleep(20)
 results.append(result)
out=pathlib.Path('reports/v02');out.mkdir(parents=True,exist_ok=True);(out/'public-readback.json').write_text(json.dumps({'type':'http_only_not_acceptance','results':results},ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False));sys.exit(1 if any(x['status']!='PASS' for x in results) else 0)
