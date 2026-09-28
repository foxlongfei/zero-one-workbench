// ZERO-CORE provider gateway core. Deploy only in a server runtime.
// Secrets are read from process.env and never returned to the browser.

const SYSTEM = `You are a participant in ZERO-CORE, a long-running project workspace. Preserve project boundaries, distinguish facts from hypotheses, and do not claim work was executed unless a verifiable artifact exists.`;

async function callResponses(baseURL, apiKey, model, input) {
  const r = await fetch(baseURL + "/responses", {
    method: "POST",
    headers: {"content-type":"application/json","authorization":"Bearer "+apiKey},
    body: JSON.stringify({model, instructions:SYSTEM, input})
  });
  if (!r.ok) throw new Error("provider_http_"+r.status);
  const j = await r.json();
  const text = j.output_text || (j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
  return {text, model:j.model||model, provider_response_id:j.id||null};
}

export async function callProvider(provider, history) {
  if (provider === "c") return callResponses("https://api.openai.com/v1", process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || "gpt-5.6", history);
  if (provider === "d") return callResponses("https://api.deepseek.com", process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_MODEL || "deepseek-flash", history);
  if (provider === "q") {
    if (!process.env.QWEN_BASE_URL) throw new Error("QWEN_BASE_URL_missing");
    return callResponses(process.env.QWEN_BASE_URL.replace(/\/$/,""), process.env.QWEN_API_KEY, process.env.QWEN_MODEL || "qwen3-max", history);
  }
  throw new Error("unknown_provider");
}
