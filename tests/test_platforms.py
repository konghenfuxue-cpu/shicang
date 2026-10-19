import tempfile
import unittest
from pathlib import Path
from store import Store,normalize

class PlatformTests(unittest.TestCase):
    def test_douyin_and_zhihu_links(self):
        cases=[('https://www.douyin.com/video/123?x=1','douyin','123'),('https://www.douyin.com/note/234','douyin','234'),('https://www.zhihu.com/question/9/answer/123','zhihu','answer:123'),('https://zhuanlan.zhihu.com/p/456?utm=1','zhihu','article:456'),('https://www.zhihu.com/pin/777','zhihu','pin:777')]
        for url,platform,sid in cases:
            row=normalize({'url':url})
            self.assertEqual((row['platform'],row['source_id']),(platform,sid))
            self.assertNotIn('?',row['canonical_url'])
        for url in ['https://www.douyin.com.evil.org/video/123','https://www.zhihu.com/people/test','https://www.zhihu.com/collection/123']:
            with self.assertRaises(ValueError):normalize({'url':url})
        with self.assertRaises(ValueError):normalize({'url':cases[0][0],'platform':'x'})

    def test_platform_collision_and_legacy_compatibility(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=Store(Path(tmp)/'test.db')
            s.ingest([{'url':'https://x.com/a/status/123'}]);s.edit(1,{'note':'X备注','tags':['保留']})
            self.assertEqual(s.ingest([{'url':'https://www.douyin.com/video/123'},{'url':'https://www.zhihu.com/question/9/answer/123'}])['added'],2)
            self.assertEqual(len(s.list()),3)
            self.assertEqual(s.preview([{'url':'https://www.douyin.com/video/123'}])['existing'],1)
            s.ingest([{'url':'https://x.com/a/status/123','source_types':['like']}])
            x=next(r for r in s.list() if r['platform']=='x')
            self.assertEqual(x['note'],'X备注');self.assertEqual(x['source_types'],['bookmark','like'])

    def test_thumbnail_platform_allowlist(self):
        row=normalize({'url':'https://www.douyin.com/video/123','thumbnail_url':'https://p3-pc-sign.douyinpic.com/demo.jpg'})
        self.assertTrue(row['thumbnail_url'])
        row=normalize({'url':'https://www.zhihu.com/question/1/answer/2','thumbnail_url':'https://picx.zhimg.com/demo.jpg'})
        self.assertTrue(row['thumbnail_url'])
        row=normalize({'url':row['canonical_url'],'thumbnail_url':'https://zhimg.com.evil.org/demo.jpg'})
        self.assertEqual(row['thumbnail_url'],'')
