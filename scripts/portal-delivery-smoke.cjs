'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const base = process.env.PORTAL_BASE_URL || 'http://127.0.0.1:4173';
const targets = [
  {name:'portal',path:'/portal/index.html',selector:'a[href="movement-mediapipe.html"]'},
  {name:'A01',path:'/portal/movement-mediapipe.html',selector:'main'},
  {name:'fortune-teller',path:'/portal/fortune-teller/index.html',selector:'#panel-bazi'},
  {name:'C01',path:'/portal/reader-integrated.html',selector:'#shelfScreen'},
  {name:'reader-v03',path:'/portal/reader-v03/index.html',selector:'#importButton'},
  {name:'watch-world',path:'/portal/watch-world.html',selector:'body'}
];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];let failed=false;
 try{
  for(const target of targets){
   const page=await browser.newPage({viewport:{width:1280,height:800}});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   const response=await page.goto(base+target.path,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator(target.selector).first().waitFor({timeout:10000});
   if(!response||response.status()>=400)errors.push('HTTP '+response?.status());
   if(target.name==='portal'){
    for(const href of ['movement-mediapipe.html','fortune-teller/index.html','reader-v03/index.html']){
     if(await page.locator('a[href="'+href+'"]').count()!==1)errors.push('missing/duplicate product link '+href);
    }
   }
   if(target.name==='watch-world'){
    const response=await page.request.get(base+'/portal/watch-world-sources.json');
    if(!response.ok())errors.push('catalog HTTP '+response.status());
    else {
     const data=await response.json();
     if(!Array.isArray(data.channels)||!data.channels.some(c=>c.streamUrl&&c.mediaCheckStatus==='passed'))errors.push('no verified stream in catalog');
    }
   }
   await page.screenshot({path:'artifacts/portal-delivery/'+target.name+'.png',fullPage:true});
   results.push({name:target.name,url:base+target.path,http:response?.status(),errors});
   if(errors.length)failed=true;
   await page.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync('artifacts/portal-delivery/results.json',JSON.stringify({testedAt:new Date().toISOString(),kind:'browser navigation and catalog smoke test; NOT end-to-end product acceptance',results},null,2));
 console.log(JSON.stringify(results,null,2));
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
