import fs from 'node:fs';
const model=JSON.parse(fs.readFileSync(new URL('./z05-question-router-v0.1.json',import.meta.url),'utf8'));
const suite=JSON.parse(fs.readFileSync(new URL('./z05-question-router-cases-v0.1.json',import.meta.url),'utf8'));
export function routeQuestion(raw){const text=String(raw??'').normalize('NFKC').replace(/\s+/gu,'');for(const route of model.routes){if(route.trigger_terms.some(term=>text.includes(term)))return{state:'ROUTED',route_id:route.id,domain:route.domain,candidate_methods:route.candidate_methods,required_inputs:route.required_inputs,execution_state:route.execution_state}}return{state:model.fallback.state,route_id:model.fallback.state,domain:null,candidate_methods:[],required_inputs:['对象','目的','时间','地点','希望比较的传统'],execution_state:'ROUTING_OPEN'}}
const results=suite.cases.map(c=>{const actual=routeQuestion(c.input);return{id:c.id,input:c.input,expected:c.expected,actual:actual.route_id,pass:actual.route_id===c.expected}});
const checks=[];const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
check('Z05 task retained',model.task_id==='Z05',model.task_id);
check('five non-universal routes',model.routes.length===5&&new Set(model.routes.map(x=>x.id)).size===5,model.routes.map(x=>x.id));
check('every route exposes required inputs',model.routes.every(x=>x.required_inputs.length>=3),model.routes);
check('routing never claims method completion',model.routes.every(x=>x.execution_state!=='COMPLETE')&&!model.acceptance.end_to_end_method_complete,model.acceptance);
check('safety boundaries explicit',Object.values(model.safety).every(Boolean),model.safety);
check('ten public routing cases pass',results.length===10&&results.every(x=>x.pass),results);
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'Z05-QUESTION-ROUTER-V0.1',passed,total:checks.length,checks,case_results:results},null,2));if(passed!==checks.length)process.exit(1);
