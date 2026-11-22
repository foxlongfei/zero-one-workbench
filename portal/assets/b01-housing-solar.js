/* B01 residential sunlight approximation: NOAA solar equations, no predictive fengshui claims. */
(function(root){'use strict';
const rad=Math.PI/180,deg=180/Math.PI;
function num(v,label,min,max){if(v===''||v===null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+'超出范围');return Number(v);}
function dayOfYear(y,m,d){return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(y,0,1))/86400000)+1;}
function position(lat,lon,year,n,minutes,tz){
  const gamma=2*Math.PI/365*(n-1+(minutes/60-12)/24);
  const eq=229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
  const decl=0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
  const ha=((minutes+eq+4*lon-60*tz)/4-180)*rad,phi=lat*rad;
  const zenith=Math.acos(Math.max(-1,Math.min(1,Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.cos(ha))));
  const alt=90-zenith*deg;
  const az=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(phi)-Math.tan(decl)*Math.cos(phi))*deg+180+360)%360;
  return {altitude:alt,azimuth:az};
}
function calculate(raw){
  const lat=num(raw.lat,'纬度',-89,89),lon=num(raw.lon,'经度',-180,180),tz=num(raw.tz,'时区',-12,14),face=num(raw.face,'窗户朝向',0,360),obstruction=num(raw.obstruction,'遮挡角',0,89),step=num(raw.step,'采样间隔',5,60);
  if(step%5!==0)throw Error('采样间隔必须为5分钟的倍数');
  const day=String(raw.day||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('请输入有效日期');
  const [y,m,d]=day.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));if(y<1900||y>2100||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)throw Error('日期不存在或超出1900–2100');
  const name=String(raw.name||'').trim();if(!name)throw Error('请填写案例名称');
  const input={name,lat,lon,day,tz,face,obstruction,step},n=dayOfYear(y,m,d),samples=[];let directMinutes=0,daylightMinutes=0,first=null,last=null,maxAltitude=-90;
  for(let minute=0;minute<1440;minute+=step){
    const p=position(lat,lon,y,n,minute+step/2,tz);
    const incidence=Math.cos((p.azimuth-face)*rad);
    const direct=p.altitude>obstruction&&incidence>0;
    const time=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
    samples.push({time,altitude:p.altitude,azimuth:p.azimuth,direct});
    if(p.altitude>0)daylightMinutes+=step;
    if(direct){directMinutes+=step;if(first===null)first=time;last=time;}
    maxAltitude=Math.max(maxAltitude,p.altitude);
  }
  const summary='当地日期 '+day+'；估计地平线上日照 '+(daylightMinutes/60).toFixed(1)+' 小时；窗口可直射约 '+(directMinutes/60).toFixed(1)+' 小时'+(first?'（采样时段约 '+first+' 至 '+last+'）':'')+'；最高太阳高度约 '+maxAltitude.toFixed(1)+'°。';
  const method='NOAA 太阳赤纬和时间方程近似公式；当地太阳时 = 钟表分钟 + 时间方程 + 4×经度 − 60×UTC偏移；由纬度、赤纬、时角计算太阳高度与方位。窗口直射判定：太阳高度 > 遮挡角，且太阳与窗户朝向夹角 < 90°。每个采样段用中点估算，结果存在约一个采样间隔的边界误差。日期按用户输入的当地固定 UTC 偏移计算，请自行考虑夏令时。未计算玻璃、窗洞、屋檐、邻楼、地形与天气。';
  return {input,summary,samples,method,metrics:{directMinutes,daylightMinutes,maxAltitude,first,last}};
}
root.B01HousingSolar={calculate,position};
if(typeof module!=='undefined'&&module.exports)module.exports=root.B01HousingSolar;
})(typeof globalThis!=='undefined'?globalThis:this);
