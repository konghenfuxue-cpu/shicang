import unittest
from unittest.mock import patch
from server import bind_server

class PortTests(unittest.TestCase):
    def test_denied_default_uses_next_candidate(self):
        from types import SimpleNamespace
        sentinel=SimpleNamespace(server_port=18765)
        with patch('server.ThreadingHTTPServer',side_effect=[PermissionError(13,'blocked'),sentinel]) as factory:
            self.assertIs(bind_server(None,'key',8765),sentinel)
            self.assertEqual(factory.call_args_list[1].args[0],('127.0.0.1',18765))

    def test_unrelated_error_not_silenced(self):
        with patch('server.ThreadingHTTPServer',side_effect=OSError(22,'invalid')):
            with self.assertRaises(OSError):bind_server(None,'key',8765)
