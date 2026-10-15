const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const target='file://'+path.resolve(__dirname,'../../portal/movement-mediapipe.html');
  try{
    await page.goto(target);
    if(await page.locator('#startPractice').isEnabled())throw Error('practice enabled before camera');
    if(!(await page.locator('#historySummary').innerText()).includes('暂无记录'))throw Error('empty history state missing');

    const assessments=await page.evaluate(()=>[
      A01Practice.assessCoverage(9,10),
      A01Practice.assessCoverage(6,10),
      A01Practice.assessCoverage(2,10),
      A01Practice.assessCoverage(0,0)
    ]);
    if(assessments.map(x=>x.coverage).join(',')!=='90,60,20,0')throw Error('coverage calculation failed');
    if(!assessments[0].feedback.includes('稳定')||!assessments[2].feedback.includes('较低'))throw Error('coverage feedback bands failed');

    await page.selectOption('#exercise','俯卧撑');
    if(!(await page.locator('#instruction').innerText()).includes('头、肩、髋'))throw Error('exercise instruction did not update');

    await page.evaluate(()=>{
      localStorage.setItem('a01-mediapipe-practice-v2',JSON.stringify([{
        date:'2026-10-15T17:30:00.000Z',exercise:'深蹲',reps:8,durationSec:42,
        trackedFrames:80,totalFrames:100,coverage:80,feedback:'测试记录'
      }]));
      A01Practice.renderHistory();
    });
    const history=await page.locator('#historyList').innerText();
    if(!history.includes('深蹲 8 次')||!history.includes('42 秒')||!history.includes('80%'))throw Error('history summary missing');
    await page.locator('#historyList details').click();
    const details=await page.locator('.recordDetails').innerText();
    if(!details.includes('80 / 100')||!details.includes('人工确认次数')||!details.includes('测试记录'))throw Error('record evidence details missing');
    const csv=await page.evaluate(()=>A01Practice.buildHistoryCsv());
    if(!csv.includes('人体跟踪覆盖率（%）')||!csv.includes('"深蹲"')||!csv.includes('"80"'))throw Error('CSV export data missing');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#exportHistory').click();
    const download=await downloadPromise;
    if(!(await download.suggestedFilename()).endsWith('.csv'))throw Error('CSV download filename missing');
    await page.reload();
    if(!(await page.locator('#historyList').innerText()).includes('深蹲 8 次'))throw Error('history did not persist after reload');

    fs.mkdirSync('reports/v02/screenshots',{recursive:true});
    await page.screenshot({path:'reports/v02/screenshots/A01-mediapipe-history-mobile.png',fullPage:true});
    fs.mkdirSync('reports/v02',{recursive:true});
    fs.writeFileSync('reports/v02/a01-mediapipe-smoke.json',JSON.stringify({
      status:'PASS',
      test_type:'browser_logic_smoke_not_camera_hardware_not_double_blind',
      checks:['pre-camera gate','coverage feedback bands','exercise teaching switch','history evidence detail','CSV export','reload persistence']
    },null,2));
    console.log('A01 MediaPipe browser logic: PASS');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
