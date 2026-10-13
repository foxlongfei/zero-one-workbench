#!/usr/bin/env python3
"""V0.2 minimal source contract checks. Not a substitute for independent acceptance."""
import argparse, json, pathlib, re, sys
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[2]
PAGES={'A01':('movement-v02-experience.html',['program','routine','start','upload','save']), 'B01':('traditional-case-v02.html',['categories','title','question','method','save','export']), 'C01':('read-with-you-v01.html',[])}
class Parse(HTMLParser):
 def __init__(self): super().__init__();self.ids=set();self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='a' and 'href' in a:self.links.append(a['href'])
def check(project):
 name,required=PAGES[project];path=ROOT/'portal'/name;fail=[];data=path.read_text(encoding='utf-8') if path.exists() else ''
 parser=Parse()
 try:parser.feed(data)
 except Exception as e:fail.append('HTML parser: '+str(e))
 for key in required:
  if key not in parser.ids:fail.append('missing element id '+key)
 if len(data)<500:fail.append('page missing or too short')
 if project=='B01':
  for word in ['失物','住宅','婚姻','求子','择日','localStorage']:
   if word not in data:fail.append('missing case capability '+word)
 if project=='A01':
  for word in ['setInterval','localStorage','video']:
   if word not in data:fail.append('missing training capability '+word)
 if project=='C01' and 'speechSynthesis' not in data:fail.append('missing speech engine')
 report={'project':project,'source_page':name,'status':'PASS' if not fail else 'FAIL','failures':fail,'test_type':'static_contract_not_double_blind'}
 out=ROOT/'reports'/'v02';out.mkdir(parents=True,exist_ok=True);(out/(project+'-contract.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False));return bool(fail)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--project',choices=list(PAGES),required=True);args=p.parse_args();sys.exit(check(args.project))
