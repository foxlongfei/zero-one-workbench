#!/usr/bin/env python3
"""Curate playable public IPTV streams. Fail closed: never publish unchecked streams."""
import json, subprocess, urllib.request, datetime, re, os
from concurrent.futures import ThreadPoolExecutor, as_completed
BASE="https://raw.githubusercontent.com/iptv-org/database/master/data/"
OUT="portal/watch-world-sources.json"
KEYWORDS=("nasa","earth","nature","wildlife","fashion","music","mtv","arte","france 24","dw english","nhk world","euronews","al jazeera english","sky news","bloomberg","red bull")
BAN=("shop","shopping","teleshop","home shopping","qvc","hsn","adult","xxx","casino","gambling")
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"WatchWorldQualityBot/0.1"})
    with urllib.request.urlopen(req,timeout=22) as r:return json.load(r)
def category(name):
    t=name.lower()
    if any(x in t for x in ("nasa","space","earth")):return "space"
    if any(x in t for x in ("wildlife","nature")):return "nature"
    if any(x in t for x in ("fashion",)):return "fashion"
    if any(x in t for x in ("music","mtv","arte","red bull")):return "music"
    return "scenery"
def probe(item):
    url=item["url"]
    try:
        p=subprocess.run(["ffprobe","-v","error","-rw_timeout","9000000","-analyzeduration","2500000","-probesize","1500000","-show_entries","stream=codec_type,width,height,codec_name","-of","json",url],capture_output=True,text=True,timeout=18)
        if p.returncode:return None
        vids=[s for s in json.loads(p.stdout).get("streams",[]) if s.get("codec_type")=="video" and int(s.get("height") or 0)>=720]
        if not vids:return None
        h=max(vids,key=lambda x:int(x["height"]))
        return item,int(h["height"])
    except (Exception):return None
def main():
    streams=get(BASE+"streams.json")
    channels={c["id"]:c for c in get(BASE+"channels.json")}
    candidates=[];seen=set()
    for s in streams:
        url=s.get("url","");cid=s.get("channel");c=channels.get(cid,{})
        title=c.get("name") or cid or ""
        if not url.startswith("https://") or not re.search(r"\.m3u8(?:\?|$)|\.mpd(?:\?|$)",url,re.I):continue
        if any(x in (title+" "+str(cid)).lower() for x in BAN):continue
        if not any(x in title.lower() for x in KEYWORDS):continue
        if s.get("status") in ("offline","error") or url in seen:continue
        seen.add(url);candidates.append({"url":url,"id":cid,"title":title,"country":c.get("country") or "国际","logo":c.get("logo"),"category":category(title)})
        if len(candidates)>=65:break
    valid=[]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for future in as_completed([pool.submit(probe,x) for x in candidates]):
            result=future.result()
            if result:valid.append(result)
    now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    out=[];used=set()
    for c,h in sorted(valid,key=lambda x:(-x[1],x[0]["title"])):
        if c["id"] in used:continue
        used.add(c["id"])
        out.append({"id":c["id"],"title":c["title"],"category":c["category"],"country":c["country"],"logo":c["logo"],"officialUrl":c["url"],"streamUrl":c["url"],"height":h,"lastMediaCheck":now,"mediaCheckStatus":"passed","verified":True,"shopping":False,"checkedAt":now[:10]})
        if len(out)>=24:break
    doc={"version":2,"updated":now,"policy":"Automated FFprobe >=720p validation of iptv-org public stream index; playback and legal restrictions vary by location; no rebroadcast.","channels":out}
    if not out:
        print("No streams passed. Preserve last known good catalog and fail run.")
        raise SystemExit(1)
    with open(OUT,"w",encoding="utf8") as f:json.dump(doc,f,ensure_ascii=False,indent=2);f.write("\n")
    print("Passed:",len(out),"of",len(candidates),"candidate streams")
if __name__=="__main__":main()
