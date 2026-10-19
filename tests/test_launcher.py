import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

class LauncherTests(unittest.TestCase):
    def test_cmd_in_chinese_space_path(self):
        if os.name!='nt': self.skipTest('Windows launcher')
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='拾藏 启动 ') as tmp:
            target=Path(tmp)/'收藏馆 测试';target.mkdir()
            for name in ['Start.cmd','server.py','store.py']:shutil.copy2(root/name,target/name)
            shutil.copytree(root/'web',target/'web')
            with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            proc=subprocess.Popen(['cmd.exe','/d','/c','Start.cmd','--no-browser','--port',str(port),'--test-exit-after','2'],cwd=target,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            try:
                for _ in range(40):
                    try:
                        with urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=1) as response:self.assertIn('拾藏',response.read().decode())
                        break
                    except OSError:time.sleep(.1)
                else: self.fail('启动入口未提供网页')
                self.assertTrue((target/'data'/'connection-key.txt').exists())
            finally:
                proc.communicate(timeout=10)
                self.assertEqual(proc.returncode,0)
