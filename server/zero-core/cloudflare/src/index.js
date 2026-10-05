const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}});
const SYSTEM=`你是 ZERO-CORE 中的研究协作成员，不是项目本身。ZERO-CORE 保存长期认知，模型只是可替换的研究能力。
工作原则：
1. 区分事实/来源、他人解释、用户原创判断、AI假设、待验证发现；不得冒充用户原创。
2. 知行合一：任务只有实际执行、形成实物、公开页面发布并读回认证后才能称完成；没有实质推进就明确说“无实质推进”。
3. 项目管理使用 MAIN/SUB/TEMP；MAIN 不被临时任务覆盖。状态必须反映真实执行，不以新编号掩盖未闭环任务。
4. 当前V0.1永久双主线：A运动达人=完整人体/解剖→真实动作输入/识别→OpenSim真实肌骨/生物力学→训练反馈闭环；B堪舆先生=depthmapX真实空间分析→成熟环境/地理引擎→传统体系证据分层→先生反馈闭环。不得用局部Demo替代整机。
5. D博士职责：独立反证审计，优先寻找假运行、假完成、技术路线错误、许可风险、测试漏洞和证据缺口；不因C博士结论而默认通过。
6. Q博士职责：独立复现验收，依据可核验输入、SHA、产物、部署URL和运行回执复跑/复核；证据不足必须拒绝验收。
7. C博士职责：施工、修复和整链集成；不得自行替D/Q宣布通过。
8. 状态升级以可核验证据为准，不投票。没有产物ID/SHA/模型运行结果/部署读回时不得称产品进展。`;
const actors={c:"C博士",q:"Q博士",d:"D博士"};
const uid=()=>crypto.randomUUID();
const enc=s=>new TextEncoder().encode(s);
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function sign(secret,payload){const key=await crypto.subtle.importKey("raw",enc(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(await crypto.subtle.sign("HMAC",key,enc(payload)))}
async function issueSession(secret){const body=b64(enc(JSON.stringify({sub:"owner",exp:Math.floor(Date.now()/1000)+8*3600,nonce:uid()})));return body+"."+await sign(secret,body)}
async function validSession(secret,token){if(!secret||!token)return false;const [body,sig]=token.split(".");if(!body||!sig||await sign(secret,body)!==sig)return false;try{const j=JSON.parse(atob(body.replace(/-/g,"+").replace(/_/g,"/")));return j.sub==="owner"&&j.exp>Math.floor(Date.now()/1000)}catch{return false}}
async function responses(base,key,model,input){const r=await fetch(base.replace(/\/$/,"")+"/responses",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify({model,instructions:SYSTEM,input})});if(!r.ok)throw new Error("provider_http_"+r.status);const j=await r.json();const text=j.output_text||(j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");return {text,model:j.model||model,response_id:j.id||null,usage:j.usage||null}}
async function chat(base,key,model,message){const r=await fetch(base.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify({model,messages:[{role:"system",content:SYSTEM},{role:"user",content:message}]})});if(!r.ok)throw new Error("provider_http_"+r.status);const j=await r.json();return {text:j.choices?.[0]?.message?.content||"",model:j.model||model,response_id:j.id||null,usage:j.usage||null}}
async function recentContext(env,thread){const rows=await env.DB.prepare("SELECT actor,provider,text,created_at FROM messages WHERE thread_id=? ORDER BY created_at DESC LIMIT 16").bind(thread).all();return (rows.results||[]).reverse().map(x=>x.actor+"："+x.text).join("\n");}
async function call(env,p,message){
 if(p==="c"){if(!env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_missing");return responses("https://api.openai.com/v1",env.OPENAI_API_KEY,env.OPENAI_MODEL||"gpt-5.6",message)}
 if(p==="d"){if(!env.DEEPSEEK_API_KEY)throw new Error("DEEPSEEK_API_KEY_missing");return responses("https://api.deepseek.com",env.DEEPSEEK_API_KEY,env.DEEPSEEK_MODEL||"deepseek-flash",message)}
 if(p==="q"){if(!env.QWEN_API_KEY||!env.QWEN_BASE_URL)throw new Error("QWEN_secret_or_base_missing");return chat(env.QWEN_BASE_URL,env.QWEN_API_KEY,env.QWEN_MODEL||"qwen3-max",message)}
 throw new Error("unknown_provider");
}
async function persist(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run()}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=env.PORTAL_ORIGIN||"https://foxlongfei.github.io";
 const cors={"access-control-allow-origin":origin,"access-control-allow-headers":"content-type,x-zero-owner,authorization","access-control-allow-methods":"GET,POST,OPTIONS","vary":"Origin"};
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(url.pathname==="/api/health"){let db=false;try{const row=await env.DB.prepare("SELECT 1 AS ok").first();db=row?.ok===1}catch{}return json({service:"zero-core-api",ok:db,db,provider_api:true,auth:"OWNER_SESSION_V1",providers:{c:{configured:!!env.OPENAI_API_KEY,model:env.OPENAI_MODEL||"gpt-5.6"},d:{configured:!!env.DEEPSEEK_API_KEY,model:env.DEEPSEEK_MODEL||"deepseek-flash",transport:"responses"},q:{configured:!!(env.QWEN_API_KEY&&env.QWEN_BASE_URL),model:env.QWEN_MODEL||"qwen3-max",transport:"chat-completions"}}},db?200:503,cors)}
 if(url.pathname==="/api/session"&&request.method==="POST"){let b;try{b=await request.json()}catch{return json({error:"BAD_JSON"},400,cors)};if(!env.OWNER_TOKEN||b?.owner_token!==env.OWNER_TOKEN)return json({error:"UNAUTHORIZED"},401,cors);return json({session_token:await issueSession(env.OWNER_TOKEN),expires_in:28800},200,cors)}
 if(url.pathname==="/api/chat"&&request.method==="POST"){
   const bearer=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");const legacy=request.headers.get("x-zero-owner")===env.OWNER_TOKEN;if(!(legacy||await validSession(env.OWNER_TOKEN,bearer)))return json({error:"UNAUTHORIZED"},401,cors);
   let b;try{b=await request.json()}catch{return json({error:"BAD_JSON"},400,cors)}if(!b?.message||!["c","q","d","all"].includes(b.provider))return json({error:"BAD_REQUEST"},400,cors);
   const project=String(b.project||"core"),thread=b.thread_id||uid(),owner="owner",workspace="ws-"+project;
   try{await persist(env,"INSERT OR IGNORE INTO owners(id) VALUES(?)",owner);await persist(env,"INSERT OR IGNORE INTO workspaces(id,owner_id,name) VALUES(?,?,?)",workspace,owner,project);await persist(env,"INSERT OR IGNORE INTO threads(id,workspace_id,project) VALUES(?,?,?)",thread,workspace,project);await persist(env,"INSERT INTO messages(id,thread_id,actor,provider,text) VALUES(?,?,?,?,?)",uid(),thread,"USER",null,b.message);
    const ps=b.provider==="all"?["c","q","d"]:[b.provider];const history=await recentContext(env,thread);const grounded="当前项目："+project+"\n以下是本线程最近真实对话（只作上下文，不自动提升为核心知识）：\n"+history+"\n\n请回答用户最新消息。";
    const settled=await Promise.all(ps.map(async p=>{const callId=uid();try{const x=await call(env,p,grounded);await persist(env,"INSERT INTO provider_calls(id,thread_id,provider,model,status) VALUES(?,?,?,?,?)",callId,thread,p,x.model,"SUCCESS");await persist(env,"INSERT INTO messages(id,thread_id,actor,provider,text) VALUES(?,?,?,?,?)",uid(),thread,actors[p],p,x.text);return {provider:p,actor:actors[p],text:x.text,model:x.model,response_id:x.response_id,usage:x.usage}}catch(e){await persist(env,"INSERT INTO provider_calls(id,thread_id,provider,model,status) VALUES(?,?,?,?,?)",callId,thread,p,null,"FAILED:"+String(e.message).slice(0,80));return {provider:p,actor:actors[p],error:String(e.message)}}}));return json({thread_id:thread,responses:settled},200,cors)
   }catch(e){return json({error:"GATEWAY_FAILURE",message:String(e.message)},500,cors)}
 }
 return json({error:"NOT_FOUND"},404,cors)
}};
// provider-audit-sync: 2026-10-06 D=DeepSeek Responses, Q=Qwen ChatCompletions