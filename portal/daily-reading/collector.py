#!/usr/bin/env python3
"""Local-only article extractor and offline translator. See README."""
import argparse,datetime as dt,hashlib,json,pathlib,urllib.request,urllib.parse
ROOT=pathlib.Path.home()/".daily-world-reader"
def main():
 p=argparse.ArgumentParser();p.add_argument("url");p.add_argument("--translate",action="store_true");a=p.parse_args()
 u=urllib.parse.urlparse(a.url)
 if u.scheme not in ("http","https") or not u.hostname: p.error("http(s) URL required")
 try: import trafilatura
 except ImportError: p.error("pip install trafilatura")
 req=urllib.request.Request(a.url,headers={"User-Agent":"DailyWorldReader/0.3 personal use"})
 with urllib.request.urlopen(req,timeout=25) as r:
  url=r.geturl();raw=r.read(4000001)
  if len(raw)>4000000: p.error("page >4MB")
  html=raw.decode(r.headers.get_content_charset() or "utf-8",errors="replace")
 m=trafilatura.extract_metadata(html,default_url=url)
 body=trafilatura.extract(html,url=url,include_tables=True)
 if not body or len(body)<600: p.error("Possible incomplete text; not saved")
 folder=ROOT/hashlib.sha256(url.encode()).hexdigest()[:16];folder.mkdir(parents=True,exist_ok=True)
 (folder/"original.txt").write_text(body,encoding="utf-8")
 info={"source_url":a.url,"final_url":url,"title":getattr(m,"title",None),"author":getattr(m,"author",None),"publisher":getattr(m,"sitename",None),"published_at":getattr(m,"date",None),"collected_at":dt.datetime.now(dt.timezone.utc).isoformat(),"sha256":hashlib.sha256(body.encode()).hexdigest(),"characters":len(body),"completeness":"unverified; check original including notes, images, figures","access":"private local only"}
 if a.translate:
  try: from argostranslate import translate
  except ImportError: p.error("pip install argostranslate")
  ls=translate.get_installed_languages();en=next((x for x in ls if x.code=="en"),None);zh=next((x for x in ls if x.code=="zh"),None)
  if not en or not zh or not en.get_translation(zh): p.error("Install en->zh Argos model (see README)")
  engine=en.get_translation(zh)
  (folder/"zh.txt").write_text("\n\n".join(engine.translate(x) for x in body.split("\n\n") if x.strip()),encoding="utf-8")
  info["translation"]="Argos offline; not proofread"
 (folder/"metadata.json").write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps({"folder":str(folder),**info},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
