const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http');

(async()=>{
  const portalRoot=path.resolve(__dirname,'../../portal');
  const contentTypes={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.task':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
  const server=http.createServer((request,response)=>{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const filePath=path.resolve(portalRoot,'.'+pathname);
    if(!filePath.startsWith(portalRoot+path.sep))return response.writeHead(403).end('forbidden');
    fs.readFile(filePath,(error,data)=>{
      if(error)return response.writeHead(error.code==='ENOENT'?404:500).end(error.code||'error');
      response.writeHead(200,{'content-type':contentTypes[path.extname(filePath)]||'application/octet-stream','cache-control':'no-store'}).end(data);
    });
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(120000);
  const externalRequests=[];
  page.on('request',request=>{if(new URL(request.url()).origin!==origin)externalRequests.push(request.url())});
  const target=origin+'/movement-mediapipe.html';
  try{
    await page.goto(target);
    if(await page.locator('#startPractice').isEnabled())throw Error('practice enabled before camera');
    if(!(await page.locator('#historySummary').innerText()).includes('暂无记录'))throw Error('empty history state missing');

    const runtime=await page.evaluate(async()=>{
      const urls=A01Practice.getRuntimeUrls();
      const model=await A01Practice.loadMediaPipe();
      const result={urls,hasVideoDetector:typeof model.detectForVideo==='function'};
      model.close?.();
      return result;
    });
    if(!runtime.hasVideoDetector)throw Error('same-origin MediaPipe model did not initialize');
    if(Object.values(runtime.urls).some(url=>!url.startsWith(origin+'/vendor/mediapipe/')))throw Error('MediaPipe runtime escaped same-origin vendor path');
    if(externalRequests.length)throw Error('unexpected external runtime request: '+externalRequests.join(', '));

    const assessments=await page.evaluate(()=>[
      A01Practice.assessCoverage(9,10),
      A01Practice.assessCoverage(6,10),
      A01Practice.assessCoverage(2,10),
      A01Practice.assessCoverage(0,0)
    ]);
    if(assessments.map(x=>x.coverage).join(',')!=='90,60,20,0')throw Error('coverage calculation failed');
    if(!assessments[0].feedback.includes('稳定')||!assessments[2].feedback.includes('较低'))throw Error('coverage feedback bands failed');
    const readiness=await page.evaluate(()=>[
      A01Practice.canStartPractice(false,1,2000),
      A01Practice.canStartPractice(true,0,2000),
      A01Practice.canStartPractice(true,1,1999),
      A01Practice.canStartPractice(true,1,2000)
    ]);
    if(readiness.join(',')!=='false,false,false,true')throw Error('stable pose readiness gate failed');
    const saveability=await page.evaluate(()=>[
      A01Practice.hasUsablePracticeFrames(0),
      A01Practice.hasUsablePracticeFrames('0'),
      A01Practice.hasUsablePracticeFrames(1)
    ]);
    if(saveability.join(',')!=='false,false,true')throw Error('zero-frame practice record gate failed');
    const poseLossCancellation=await page.evaluate(()=>[
      A01Practice.shouldCancelPracticeForPoseLoss(1,5000),
      A01Practice.shouldCancelPracticeForPoseLoss(0,4999),
      A01Practice.shouldCancelPracticeForPoseLoss(0,5000)
    ]);
    if(poseLossCancellation.join(',')!=='false,false,true')throw Error('sustained pose loss cancellation gate failed');
    const cameraTrackEndIsolation=await page.evaluate(()=>{
      const activeTrack={},staleTrack={};
      return [
        A01Practice.shouldHandleCameraTrackEnd(false,2,2,activeTrack,activeTrack),
        A01Practice.shouldHandleCameraTrackEnd(true,2,1,activeTrack,activeTrack),
        A01Practice.shouldHandleCameraTrackEnd(true,2,2,activeTrack,staleTrack),
        A01Practice.shouldHandleCameraTrackEnd(true,2,2,activeTrack,activeTrack)
      ];
    });
    if(cameraTrackEndIsolation.join(',')!=='false,false,false,true')throw Error('stale camera track end could interrupt active session');
    const cameraTrackEndController=await page.evaluate(()=>{
      const activeTrack={},staleTrack={},calls=[];
      const run=(cameraActive,activeAttempt,endedAttempt,activeTrackValue,endedTrack)=>A01Practice.handleCameraTrackEnd({
        cameraActive,activeAttempt,endedAttempt,activeTrack:activeTrackValue,endedTrack,
        onDisconnect:()=>calls.push('discard-active-practice')
      });
      const handled=[
        run(false,2,2,activeTrack,activeTrack),
        run(true,2,1,activeTrack,activeTrack),
        run(true,2,2,activeTrack,staleTrack),
        run(true,2,2,activeTrack,activeTrack)
      ];
      return {handled,calls};
    });
    if(cameraTrackEndController.handled.join(',')!=='false,false,false,true'||cameraTrackEndController.calls.join(',')!=='discard-active-practice')throw Error('current camera track end did not invoke exactly one discard controller');
    const countdownResult=await page.evaluate(async()=>{
      let allowed=true,started=false,cancelled=false,ticks=[];
      A01Practice.createPracticeCountdown({
        isAllowed:()=>allowed,
        onTick:seconds=>ticks.push(seconds),
        onStart:()=>{started=true},
        onCancel:()=>{cancelled=true},
        durationMs:80,
        tickMs:5
      });
      await new Promise(resolve=>setTimeout(resolve,20));
      allowed=false;
      await new Promise(resolve=>setTimeout(resolve,90));
      return {started,cancelled,ticks};
    });
    if(countdownResult.started||!countdownResult.cancelled||!countdownResult.ticks.length)throw Error('pose loss did not cancel pending practice start');

    const timeoutResult=await page.evaluate(async()=>{try{await A01Practice.withTimeout(new Promise(()=>{}),10,'请求摄像头权限超时');return 'resolved'}catch(error){return error.name+':'+error.message}});
    if(timeoutResult!=='TimeoutError:请求摄像头权限超时')throw Error('camera timeout guard failed');
    const firstFrameResult=await page.evaluate(async()=>{
      let callback;
      const fakeVideo={requestVideoFrameCallback:fn=>(callback=fn,1),cancelVideoFrameCallback:()=>{}};
      const waiting=A01Practice.waitForVideoFrame(fakeVideo,100);
      callback();
      return waiting;
    });
    if(firstFrameResult!==true)throw Error('first video frame did not unlock camera flow');
    const firstFrameTimeout=await page.evaluate(async()=>{try{await A01Practice.waitForVideoFrame({requestVideoFrameCallback:()=>1,cancelVideoFrameCallback:()=>{}},10);return 'resolved'}catch(error){return error.name+':'+error.message}});
    if(firstFrameTimeout!=='TimeoutError:摄像头首帧等待超时')throw Error('first video frame timeout guard failed');

    await page.evaluate(()=>Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(()=>{})}}));
    await page.locator('#startCamera').click();
    if((await page.locator('#stopCamera').innerText())!=='取消启动'||!(await page.locator('#stopCamera').isEnabled()))throw Error('cancel camera startup control missing');
    await page.locator('#stopCamera').click();
    if(!(await page.locator('#cameraStatus').innerText()).includes('已取消摄像头启动'))throw Error('camera startup cancellation feedback missing');
    if(!(await page.locator('#startCamera').isEnabled())||await page.locator('#startPractice').isEnabled())throw Error('camera cancellation did not restore safe controls');

    await page.evaluate(()=>{
      window.__cameraError='NotAllowedError';window.__cameraRequests=0;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__cameraRequests+=1;throw new DOMException('denied',window.__cameraError)}}});
    });
    await page.locator('#startCamera').click();
    if(!(await page.locator('#cameraStatus').innerText()).includes('摄像头权限'))throw Error('permission denial recovery guidance missing');
    if(!(await page.locator('#startCamera').isEnabled())||(await page.locator('#startCamera').innerText())!=='重新启动摄像头')throw Error('camera retry control missing after denial');
    if(await page.locator('#startPractice').isEnabled())throw Error('practice enabled after camera denial');
    await page.evaluate(()=>{window.__cameraError='NotFoundError'});
    await page.locator('#startCamera').click();
    if(!(await page.locator('#cameraStatus').innerText()).includes('未检测到摄像头'))throw Error('missing-device recovery guidance missing');
    if(await page.evaluate(()=>window.__cameraRequests)!==2)throw Error('camera retry did not issue a second request');

    await page.selectOption('#exercise','俯卧撑');
    if(!(await page.locator('#instruction').innerText()).includes('头、肩、髋'))throw Error('exercise instruction did not update');

    await page.evaluate(()=>{
      localStorage.setItem('a01-mediapipe-practice-v2',JSON.stringify([{
        date:'2026-10-15T16:30:00.000Z',exercise:'俯卧撑',reps:5,durationSec:30,
        trackedFrames:55,totalFrames:60,coverage:92,feedback:'保留记录'
      },{
        date:'2026-10-15T17:30:00.000Z',exercise:'深蹲',reps:8,durationSec:42,
        trackedFrames:80,totalFrames:100,coverage:80,feedback:'测试记录'
      }]));
      A01Practice.renderHistory();
    });
    const history=await page.locator('#historyList').innerText();
    if(!history.includes('深蹲 8 次')||!history.includes('42 秒')||!history.includes('80%'))throw Error('history summary missing');
    await page.locator('#historyList details').first().click();
    const details=await page.locator('.recordDetails').first().innerText();
    if(!details.includes('80 / 100')||!details.includes('人工确认次数')||!details.includes('测试记录'))throw Error('record evidence details missing');
    const csv=await page.evaluate(()=>A01Practice.buildHistoryCsv());
    if(!csv.includes('人体跟踪覆盖率（%）')||!csv.includes('"深蹲"')||!csv.includes('"80"'))throw Error('CSV export data missing');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#exportHistory').click();
    const download=await downloadPromise;
    if(!(await download.suggestedFilename()).endsWith('.csv'))throw Error('CSV download filename missing');

    page.once('dialog',dialog=>dialog.dismiss());
    await page.locator('button[data-record-index="1"]').click();
    if(!(await page.locator('#historyNotice').innerText()).includes('已取消删除'))throw Error('delete cancel feedback missing');
    if((await page.locator('#historyList details').count())!==2)throw Error('cancelled delete changed history');

    page.once('dialog',dialog=>dialog.accept());
    await page.locator('button[data-record-index="1"]').click();
    if(!(await page.locator('#historyNotice').innerText()).includes('已删除'))throw Error('delete success feedback missing');
    if((await page.locator('#historyList details').count())!==1)throw Error('confirmed delete did not remove one record');
    const csvAfterDelete=await page.evaluate(()=>A01Practice.buildHistoryCsv());
    if(csvAfterDelete.includes('测试记录')||!csvAfterDelete.includes('保留记录'))throw Error('CSV still includes deleted record');
    await page.reload();
    const persistedHistory=await page.locator('#historyList').innerText();
    if(persistedHistory.includes('深蹲 8 次')||!persistedHistory.includes('俯卧撑 5 次'))throw Error('confirmed delete did not persist after reload');

    fs.mkdirSync('reports/v02/screenshots',{recursive:true});
    await page.screenshot({path:'reports/v02/screenshots/A01-mediapipe-history-mobile.png',fullPage:true});
    fs.mkdirSync('reports/v02',{recursive:true});
    fs.writeFileSync('reports/v02/a01-mediapipe-smoke.json',JSON.stringify({
      status:'PASS',
      test_type:'browser_logic_smoke_not_camera_hardware_not_double_blind',
      checks:['same-origin runtime URL gate','no external runtime requests','MediaPipe WASM and pose model initialization','pre-camera gate','coverage feedback bands','two-second stable pose readiness gate','zero-frame practice record gate','sustained pose loss cancels active practice','stale camera track end isolation','current camera track end invokes discard controller','pose-loss cancels practice countdown','startup timeout guard','first video frame gate','first video frame timeout','cancel pending startup','permission denial guidance','camera retry','missing-device guidance','exercise teaching switch','history evidence detail','CSV export','delete cancel protection','confirmed record deletion','CSV excludes deleted record','reload persistence']
    },null,2));
    console.log('A01 MediaPipe browser logic: PASS');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
