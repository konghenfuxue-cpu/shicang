import argparse
import json
import secrets
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from store import Store

ROOT=Path(__file__).resolve().parent

def bind_server(store,token,preferred):
    candidates=list(dict.fromkeys([preferred,18765,28765,0]))
    for port in candidates:
        try:
            http=ThreadingHTTPServer(('127.0.0.1',port),make_handler(store,token,port))
            http.RequestHandlerClass=make_handler(store,token,http.server_port)
            return http
        except OSError as exc:
            if not isinstance(exc,PermissionError) and exc.errno not in (98,10048) and getattr(exc,'winerror',None) not in (10013,10048): raise
            print(f'端口 {port} 不可用，尝试其他本机端口。',flush=True)
    raise OSError('没有可用的本机端口，请检查安全软件对 Python 本机网络的限制。')

def make_handler(store,token,port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def reply(self,status,data):
            raw=json.dumps(data,ensure_ascii=False).encode('utf-8')
            self.send_response(status); self.headers_out('application/json; charset=utf-8'); self.end_headers(); self.wfile.write(raw)
        def headers_out(self,kind):
            self.send_header('Content-Type',kind); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            origin=self.headers.get('Origin','')
            if origin.startswith('chrome-extension://') or origin==f'http://127.0.0.1:{port}':
                self.send_header('Access-Control-Allow-Origin',origin); self.send_header('Vary','Origin')
                self.send_header('Access-Control-Allow-Headers','Content-Type, X-Collection-Token')
                self.send_header('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS')
        def allowed(self):
            if self.headers.get('Host')!=f'127.0.0.1:{port}': return False
            origin=self.headers.get('Origin','')
            if origin and origin!=f'http://127.0.0.1:{port}' and not origin.startswith('chrome-extension://'): return False
            return secrets.compare_digest(self.headers.get('X-Collection-Token',''),token)
        def do_OPTIONS(self):
            self.send_response(204); self.headers_out('text/plain'); self.end_headers()
        def do_GET(self):
            path=urlparse(self.path).path
            if self.headers.get('Host')!=f'127.0.0.1:{port}': return self.reply(403,{'error':'非法主机'})
            if path.startswith('/api/'):
                if not self.allowed(): return self.reply(401,{'error':'请检查本地连接密钥'})
                if path in ('/api/bookmarks','/api/export'): return self.reply(200,store.list())
                if path=='/api/history': return self.reply(200,store.history())
                return self.reply(404,{'error':'接口不存在'})
            files={'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8')}
            if path not in files: return self.reply(404,{'error':'页面不存在'})
            name,kind=files[path]; self.send_response(200); self.headers_out(kind)
            self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' https://pbs.twimg.com https://*.douyinpic.com https://*.douyinstatic.com https://*.byteimg.com https://*.zhimg.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
            self.end_headers(); self.wfile.write((ROOT/'web'/name).read_bytes())
        def mutate(self):
            if not self.allowed(): return self.reply(401,{'error':'请检查本地连接密钥或请求来源'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if length<=0 or length>8_000_000: raise ValueError('请求大小无效，最大 8MB')
                body=json.loads(self.rfile.read(length)); path=urlparse(self.path).path
                if path in ('/api/import','/api/preview'):
                    items=body.get('items')
                    if not isinstance(items,list) or len(items)>10000: raise ValueError('最多提交 10000 条记录')
                    result=store.preview(items) if path.endswith('preview') else store.ingest(items,body.get('mode','manual'))
                elif path.startswith('/api/bookmarks/'):
                    store.edit(int(path.rsplit('/',1)[1]),body); result={'ok':True}
                else: return self.reply(404,{'error':'接口不存在'})
                self.reply(200,result)
            except (ValueError,TypeError,AttributeError): self.reply(400,{'error':'数据格式无效，请检查链接和字段'})
        do_POST=mutate
        do_PATCH=mutate
    return Handler

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8765); parser.add_argument('--data-dir',type=Path,default=ROOT/'data'); parser.add_argument('--no-browser',action='store_true'); parser.add_argument('--test-exit-after',type=float,default=0,help=argparse.SUPPRESS); args=parser.parse_args()
    args.data_dir.mkdir(parents=True,exist_ok=True); keyfile=args.data_dir/'connection-key.txt'
    if not keyfile.exists(): keyfile.write_text(secrets.token_urlsafe(32),encoding='utf-8')
    token=keyfile.read_text(encoding='utf-8').strip(); store=Store(args.data_dir/'collection.sqlite3')
    http=bind_server(store,token,args.port)
    address=f'http://127.0.0.1:{http.server_port}'
    (args.data_dir/'server-address.txt').write_text(address,encoding='utf-8')
    print(f'收藏馆 {address} 连接密钥保存在 {keyfile}',flush=True)
    if not args.no_browser: webbrowser.open(f'{address}/#key={token}')
    if args.test_exit_after>0: threading.Timer(args.test_exit_after,http.shutdown).start()
    try: http.serve_forever()
    except KeyboardInterrupt: pass
    finally: http.server_close()

if __name__=='__main__': main()
