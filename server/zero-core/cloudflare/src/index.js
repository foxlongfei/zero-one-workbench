const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if (url.pathname==="/api/health") {
      let db=false;
      try { const row=await env.DB.prepare("SELECT 1 AS ok").first(); db=row?.ok===1; } catch {}
      return json({service:"zero-core-api",ok:db,db,provider_api:false,auth:false});
    }
    if (url.pathname==="/api/chat" && request.method==="POST") {
      return json({error:"NOT_READY",message:"真实 Provider 与 OWNER gate 尚未部署；禁止模拟回答。"},503);
    }
    return json({error:"NOT_FOUND"},404);
  }
};
