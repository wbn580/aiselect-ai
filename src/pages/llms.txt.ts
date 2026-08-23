import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
const SITE_TITLE = 'aiselect.ai';
export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('articles');
  const get = (e: any) => (e.data || {}) as Record<string, any>;
  entries.sort((a: any,b: any)=>String(get(b).pubDatetime||get(b).publishDate||"").localeCompare(String(get(a).pubDatetime||get(a).publishDate||"")));
  const base=(site?site.toString():"").replace(/\/$/,"");
  const L=[`# ${SITE_TITLE}`,"","AI Select publishes independent AI-tool reviews under the Selector Labs editorial label. SecureFlow is a separately disclosed area operated by Arrivau Pty Ltd. Its public release contains only a free Snapshot and self-serve definition kit; paid pilots are planned but not open for order, and any future purchase could not influence editorial coverage.","",`- Site home: ${base}/`,`- SecureFlow free Snapshot and planned catalogue: ${base}/services/secureflow/`,`- SecureFlow advance terms: ${base}/services/secureflow/terms/`,`- Privacy policy: ${base}/privacy/`,`- XML sitemap: ${base}/sitemap-index.xml`,"","## All articles",""];
  for (const e of entries) { const d=get(e); const url=`${base}/${(e as any).id}/`; const desc=(d.description||"").toString().replace(/\s+/g," ").trim(); L.push(`- [${d.title||(e as any).id}](${url})${desc?": "+desc:""}`); }
  return new Response(L.join("\n"),{headers:{"Content-Type":"text/plain; charset=utf-8"}});
};
