import fs from 'node:fs';
const path='portal/watch-world-sources.json';
const doc=JSON.parse(fs.readFileSync(path,'utf8'));
const seenIds=new Set(),seenUrls=new Set();let errors=[];
for(const c of doc.channels||[]){
  if(!c.id||!c.title||!c.officialUrl?.startsWith('https://'))errors.push('invalid entry: '+c.id);
  if(c.shopping||/shopping|teleshopping|电视购物|购物频道/i.test(c.title))errors.push('shopping: '+c.id);
  if(seenIds.has(c.id))errors.push('duplicate id: '+c.id);seenIds.add(c.id);
  const url=(c.streamUrl||c.officialUrl||'').trim().replace(/\/$/,'').toLowerCase();
  if(seenUrls.has(url))errors.push('duplicate url: '+c.id);seenUrls.add(url);
  if(c.streamUrl){
    if(!c.streamUrl.startsWith('https://'))errors.push('non-https stream: '+c.id);
    if(!Number.isFinite(c.height)||c.height<720)errors.push('unverified 720p quality: '+c.id);
    if(!c.lastMediaCheck||c.mediaCheckStatus!=='passed')errors.push('missing real media check: '+c.id);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log('Catalog validation passed: '+seenIds.size+' unique entries; '+(doc.channels||[]).filter(c=>c.streamUrl).length+' playback-verified streams');
