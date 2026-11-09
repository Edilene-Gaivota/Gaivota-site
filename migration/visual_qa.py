"""Read-only visual QA of the original and the recovered static preview."""
import asyncio, functools, http.server, json, os, pathlib, threading
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
ROOT=pathlib.Path.cwd()
OUT=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'gaivota-qa'
OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path
        routes={'/api/journal':'/data/journal.json','/api/news':'/data/news.json','/api/feedback':'/data/feedback.json'}
        if path=='/api/feedback/session':
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"owner":false}');return
        if path in routes:self.path=routes[path]
        return super().do_GET()
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
    report={'tested_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'production_modified':False,'pages':[]}
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for label,base in [('original','https://gaivota-regularizacao-obras.contato962298.chatgpt.site'),('preview','http://127.0.0.1:8765')]:
            for size,viewport in [('desktop',{'width':1440,'height':1000}),('mobile',{'width':390,'height':844})]:
                for name,route in [('home','/'),('blog','/blog')]:
                    page=await browser.new_page(viewport=viewport,device_scale_factor=1,reduced_motion='reduce')
                    # Freeze automatic carousels/polling equally for the two screenshots.
                    await page.add_init_script('window.setInterval=()=>0;')
                    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                    result={'site':label,'page':name,'viewport':size}
                    try:
                        response=await page.goto(base+route,wait_until='networkidle',timeout=45000)
                        await page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
                        await page.wait_for_function("Array.from(document.images).every(i=>i.complete)",timeout=30000)
                        await page.evaluate('document.fonts.ready')
                        height=await page.evaluate('document.documentElement.scrollHeight')
                        for y in range(0,min(height,18000),600):
                            await page.evaluate('(y)=>window.scrollTo(0,y)',y);await page.wait_for_timeout(90)
                        await page.evaluate('window.scrollTo(0,0)');await page.wait_for_timeout(300)
                        result.update(await page.evaluate("""()=>({title:document.title,width:innerWidth,documentWidth:document.documentElement.scrollWidth,brokenImages:Array.from(document.images).filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')),images:Array.from(document.images).map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight})),headings:Array.from(document.querySelectorAll('h1,h2')).map(e=>({text:e.textContent.trim(),font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color})),newsCards:document.querySelectorAll('.portal-news-card').length})"""))
                        result['http_status']=response.status
                        result['js_errors']=errors
                        result['horizontalOverflow']=result['documentWidth']>result['width']+2
                        await page.screenshot(path=str(OUT/f'{label}-{name}-{size}.png'),full_page=True,animations='disabled')
                        if label=='preview' and name=='home':
                            # Inspect navigation controls without sending any real messages or data.
                            result['reviewFormPresent']=await page.locator('#feedback-form').count()>0
                            result['menuButtonPresent']=await page.get_by_role('button',name='Menu',exact=False).count()>0
                        report['pages'].append(result)
                    except Exception as e:
                        result['error']=str(e);report['pages'].append(result)
                        await page.screenshot(path=str(OUT/f'{label}-{name}-{size}-error.png'),full_page=True)
                    await page.close()
        await browser.close()
    comparisons=[]
    for name in ['home','blog']:
        for viewport in ['desktop','mobile']:
            ref=next(x for x in report['pages'] if x['site']=='original' and x['page']==name and x['viewport']==viewport)
            copy=next(x for x in report['pages'] if x['site']=='preview' and x['page']==name and x['viewport']==viewport)
            comparisons.append({'page':name,'viewport':viewport,'sameTitle':ref.get('title')==copy.get('title'),'sameHeadingTextAndStyles':ref.get('headings')==copy.get('headings'),'sameImageDimensions':[(x['width'],x['height']) for x in ref.get('images',[])]==[(x['width'],x['height']) for x in copy.get('images',[])],'previewBrokenImages':copy.get('brokenImages'),'previewJSerrors':copy.get('js_errors'),'previewHorizontalOverflow':copy.get('horizontalOverflow')})
    report['comparisons']=comparisons
    (OUT/'visual-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'comparisons':comparisons,'artifact_directory':str(OUT)},ensure_ascii=False,indent=2))
asyncio.run(main())
server.shutdown()
