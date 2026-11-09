const ORIGIN='https://gaivota-regularizacao-obras.contato962298.chatgpt.site';
const escapeHTML=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export async function onRequestGet({request}){
  const q=new URL(request.url).searchParams;
  const route=q.get('doc')==='blog'?'/blog':'/';
  const part=q.get('part')||'summary';
  try{
    const response=await fetch(ORIGIN+route,{redirect:'manual',headers:{Accept:'text/html'}});
    if(!response.ok)return new Response('Original retornou HTTP '+response.status,{status:502});
    const html=await response.text();
    const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]);
    const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].map(x=>({attributes:x[1],code:x[2]}));
    const head=html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
    let value;
    if(part==='summary')value=JSON.stringify({source:ORIGIN+route,bytes:html.length,headLinks:[...head.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]),styles:styles.map(x=>x.length),scripts:scripts.map(s=>({attributes:s.attributes,length:s.code.length})),images:[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]),fetchCalls:[...html.matchAll(/fetch\s*\([^\n]{0,350}/g)].map(m=>m[0])},null,2);
    else if(part==='head')value=head;
    else if(part==='raw')value=html;
    else if(/^style\d+$/.test(part))value=styles[Number(part.slice(5))]||'';
    else if(/^script\d+$/.test(part))value=scripts[Number(part.slice(6))]?.code||'';
    else return new Response('Parte não suportada',{status:400});
    const offset=Math.max(0,Number(q.get('offset'))||0),limit=Math.min(100000,Math.max(1000,Number(q.get('limit'))||60000));
    value=value.slice(offset,offset+limit);
    return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Inspeção dos arquivos públicos originais</title><pre>'+escapeHTML(value)+'</pre></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  }catch(e){return new Response('Falha ao recuperar original: '+String(e),{status:502});}
}
