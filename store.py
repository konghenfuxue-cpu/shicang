import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import urlparse

def now(): return datetime.now(timezone.utc).isoformat()

def normalize(item):
    if not isinstance(item,dict): raise ValueError('记录必须是对象')
    p=urlparse(str(item.get('canonical_url') or item.get('url') or ''))
    host=p.netloc; result=None
    if p.scheme!='https': raise ValueError('只接受 HTTPS 内容链接')
    if host in ('x.com','www.x.com','twitter.com','www.twitter.com'):
        m=re.fullmatch(r'/([A-Za-z0-9_]{1,15})/status/(\d+)(?:/.*)?',p.path)
        if m: result={'platform':'x','source_id':m[2],'canonical_url':f'https://x.com/{m[1]}/status/{m[2]}','author_handle':m[1]}
    elif host in ('www.douyin.com','douyin.com'):
        m=re.fullmatch(r'/(video|note)/(\d+)/?',p.path)
        if m: result={'platform':'douyin','source_id':m[2],'canonical_url':f'https://www.douyin.com/{m[1]}/{m[2]}','author_handle':str(item.get('author_handle') or '')[:200]}
    elif host in ('www.zhihu.com','zhihu.com','zhuanlan.zhihu.com'):
        patterns=[(r'/question/\d+/answer/(\d+)/?','answer'),(r'/pin/(\d+)/?','pin'),(r'/zvideo/(\d+)/?','video')] if host!='zhuanlan.zhihu.com' else [(r'/p/(\d+)/?','article')]
        for pattern,kind in patterns:
            m=re.fullmatch(pattern,p.path)
            if m:
                result={'platform':'zhihu','source_id':f'{kind}:{m[1]}','canonical_url':f'https://{"zhuanlan.zhihu.com" if kind=="article" else "www.zhihu.com"}{p.path.rstrip("/")}','author_handle':str(item.get('author_handle') or '')[:200]};break
    if result is None: raise ValueError('不是支持的 X、抖音或知乎内容链接')
    if item.get('platform',result['platform'])!=result['platform']: raise ValueError('平台与链接不匹配')
    types=item.get('source_types',['bookmark' if result['platform']=='x' else 'favorite'])
    allowed=('bookmark','like') if result['platform']=='x' else ('favorite','like') if result['platform']=='douyin' else ('favorite',)
    if not isinstance(types,list) or not types or any(t not in allowed for t in types): raise ValueError('来源分类无效')
    result['source_types']=sorted(set(types))
    for key,limit in [('author_name',200),('title',500),('excerpt',10000),('source_collection',200)]:
        result[key]=str(item.get(key) or ('未分类' if key=='source_collection' else ''))[:limit]
    image=str(item.get('thumbnail_url') or '')
    domains={'x':('pbs.twimg.com',),'douyin':('douyinpic.com','douyinstatic.com','byteimg.com'),'zhihu':('zhimg.com',)}[result['platform']]
    ihost=urlparse(image).hostname or ''
    result['thumbnail_url']=image if urlparse(image).scheme=='https' and any(ihost==d or ihost.endswith('.'+d) for d in domains) else ''
    return result

def record_key(record):
    return record['source_id'] if record['platform']=='x' else record['platform']+':'+record['source_id']

class Store:
    def __init__(self,path):
        self.path=str(path)
        with self.connect() as db:
            db.executescript('CREATE TABLE IF NOT EXISTS bookmarks(id INTEGER PRIMARY KEY, source_id TEXT UNIQUE NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS imports(id INTEGER PRIMARY KEY, data TEXT NOT NULL);')
    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path)
        try:
            with db: yield db
        finally: db.close()
    def list(self):
        with self.connect() as db:
            rows=[dict(json.loads(data),id=rid) for rid,data in db.execute('SELECT id,data FROM bookmarks ORDER BY id DESC')]
            for row in rows: row.setdefault('source_types',['bookmark'])
            return rows
    def preview(self,items):
        existing={record_key(r) for r in self.list()}; seen=set(); result={'added':0,'existing':0,'failed':0}
        for item in items:
            try:
                sid=record_key(normalize(item))
                result['existing' if sid in existing or sid in seen else 'added']+=1; seen.add(sid)
            except (ValueError,TypeError): result['failed']+=1
        return result
    def ingest(self,items,mode='manual'):
        result={'time':now(),'added':0,'updated':0,'unchanged':0,'failed':0,'total':len(items),'mode':str(mode)[:100]}
        with self.connect() as db:
            for item in items:
                try: record=normalize(item)
                except (ValueError,TypeError): result['failed']+=1; continue
                identity=record_key(record)
                old=db.execute('SELECT id,data FROM bookmarks WHERE source_id=?',(identity,)).fetchone()
                if old:
                    saved=json.loads(old[1]); changed=False
                    record['source_types']=sorted(set(saved.get('source_types',['bookmark'])) | set(record['source_types']))
                    for key,value in record.items():
                        if value and value!=saved.get(key): saved[key]=value; changed=True
                    saved['last_seen_at']=now()
                    if changed: saved['updated_at']=now()
                    db.execute('UPDATE bookmarks SET data=? WHERE id=?',(json.dumps(saved,ensure_ascii=False),old[0]))
                    result['updated' if changed else 'unchanged']+=1
                else:
                    record.update(first_imported_at=now(),last_seen_at=now(),updated_at=now(),tags=[],note='',is_read=False)
                    db.execute('INSERT INTO bookmarks(source_id,data) VALUES(?,?)',(identity,json.dumps(record,ensure_ascii=False)))
                    result['added']+=1
            db.execute('INSERT INTO imports(data) VALUES(?)',(json.dumps(result,ensure_ascii=False),))
        return result
    def edit(self,rid,patch):
        with self.connect() as db:
            row=db.execute('SELECT data FROM bookmarks WHERE id=?',(rid,)).fetchone()
            if not row: raise ValueError('记录不存在')
            data=json.loads(row[0])
            if 'tags' in patch:
                if not isinstance(patch['tags'],list) or any(not isinstance(t,str) for t in patch['tags']): raise ValueError('标签格式错误')
                data['tags']=list(dict.fromkeys(t.strip()[:80] for t in patch['tags'][:30] if t.strip()))
            if 'note' in patch: data['note']=str(patch['note'])[:10000]
            if 'is_read' in patch:
                if not isinstance(patch['is_read'],bool): raise ValueError('状态格式错误')
                data['is_read']=patch['is_read']
            data['updated_at']=now()
            db.execute('UPDATE bookmarks SET data=? WHERE id=?',(json.dumps(data,ensure_ascii=False),rid))
    def history(self):
        with self.connect() as db: return [json.loads(r[0]) for r in db.execute('SELECT data FROM imports ORDER BY id DESC LIMIT 100')]
