import tempfile
import unittest
from pathlib import Path
from store import Store, normalize

class StoreTests(unittest.TestCase):
    def test_bookmark_and_like_merge_without_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=Store(Path(tmp)/'test.db')
            item={'url':'https://x.com/artist/status/321','source_types':['bookmark']}
            s.ingest([item]);s.edit(1,{'note':'保留','tags':['画师']})
            s.ingest([dict(item,source_types=['like'])])
            self.assertEqual(s.list()[0]['source_types'],['bookmark','like'])
            self.assertEqual(s.list()[0]['note'],'保留')
            self.assertEqual(len(s.list()),1)
            s.ingest([item])
            self.assertEqual(s.list()[0]['source_types'],['bookmark','like'])
            self.assertEqual(normalize({'url':item['url']})['source_types'],['bookmark'])
            with self.assertRaises(ValueError):normalize(dict(item,source_types=['invalid']))
    def test_normalization(self):
        self.assertEqual(normalize({'url':'https://twitter.com/alice/status/123?s=20'})['canonical_url'], 'https://x.com/alice/status/123')
        for url in ['https://x.com.evil.org/a/status/123','javascript:alert(1)','https://example.com/a/status/1']:
            with self.assertRaises(ValueError): normalize({'url':url})

    def test_import_preserves_edits(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=Store(Path(tmp)/'test.db')
            item={'url':'https://x.com/alice/status/123','excerpt':'hello'}
            self.assertEqual(s.ingest([item])['added'],1)
            s.edit(1,{'tags':['画师'],'note':'keep','is_read':True})
            self.assertEqual(s.ingest([dict(item,excerpt='new')])['updated'],1)
            row=s.list()[0]
            self.assertEqual((row['tags'],row['note'],row['is_read']),(['画师'],'keep',True))
            self.assertEqual(len(s.list()),1)
            self.assertEqual(s.ingest([item,{'url':'bad'}])['failed'],1)

if __name__=='__main__': unittest.main()
