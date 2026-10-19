import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
from server import make_handler
from store import Store

class ApiTests(unittest.TestCase):
    def test_authenticated_roundtrip_and_origin(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=Store(Path(tmp)/'db.sqlite')
            http=ThreadingHTTPServer(('127.0.0.1',0),make_handler(store,'test-key',0))
            port=http.server_port;http.RequestHandlerClass=make_handler(store,'test-key',port)
            thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
            def request(path,body=None,key='test-key',origin=None,method=None):
                headers={'X-Collection-Token':key,'Content-Type':'application/json'}
                if origin: headers['Origin']=origin
                req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
                with urllib.request.urlopen(req) as response:return json.load(response)
            try:
                for kwargs in [{'key':'wrong'},{'origin':'https://evil.example'}]:
                    with self.assertRaises(urllib.error.HTTPError):request('/api/bookmarks',**kwargs)
                result=request('/api/import',{'items':[{'url':'https://x.com/test/status/42','excerpt':'<script>alert(1)</script>'}]})
                self.assertEqual(result['added'],1)
                request('/api/bookmarks/1',{'tags':['艺术'],'note':'私人备注','is_read':True},method='PATCH')
                self.assertEqual(request('/api/bookmarks')[0]['note'],'私人备注')
                self.assertEqual(request('/api/preview',{'items':[{'url':'https://x.com/test/status/42'}]})['existing'],1)
                self.assertEqual(len(request('/api/history')),1)
                self.assertEqual(len(Store(Path(tmp)/'db.sqlite').list()),1)
                multi=request('/api/import',{'items':[{'url':'https://www.douyin.com/video/42'},{'url':'https://www.zhihu.com/question/1/answer/42'}]})
                self.assertEqual(multi['added'],2)
                self.assertEqual({r['platform'] for r in request('/api/bookmarks')},{'x','douyin','zhihu'})
            finally:http.shutdown();http.server_close();thread.join()
