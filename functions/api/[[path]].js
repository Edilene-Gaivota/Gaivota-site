export async function onRequest({request,env}) {
 const path=new URL(request.url).pathname,headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Gaivota-Data-Mode':'migration-snapshot'};
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({ok:false,error:'Prévia: armazenamento de avaliações ainda não configurado. Nada foi enviado ou salvo.'}),{status:503,headers});
 if(path==='/api/feedback/session')return new Response(JSON.stringify({owner:false}),{headers});
 const routes={'/api/journal':'/data/journal.json','/api/news':'/data/news.json','/api/feedback':'/data/feedback.json'};
 if(!routes[path])return new Response(JSON.stringify({error:'Área ainda não migrada'}),{status:404,headers});
 const r=await env.ASSETS.fetch(new Request(new URL(routes[path],request.url),{method:'GET'}));
 if(!r.ok||!(r.headers.get('Content-Type')||'').includes('json'))return new Response(JSON.stringify({error:'Cópia pública indisponível'}),{status:503,headers});
 return new Response(request.method==='HEAD'?null:await r.text(),{headers});
}
