from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import html
import json
import socket

ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

HTML = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Upload file</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 560px; padding: 20px; border-radius: 16px; background: #111827; box-shadow: 0 8px 30px rgba(0,0,0,.3); }
    button { padding: 10px 16px; border: 0; border-radius: 10px; background: #38bdf8; color: #082f49; font-weight: 700; }
    input { margin: 12px 0; }
    a { color: #7dd3fc; }
    li { margin: 8px 0; }
    .muted { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Upload a file</h2>
    <p class="muted">Choose your image and upload it to this device.</p>
    <input id="file" type="file" />
    <div><button onclick="upload()">Upload</button></div>
    <p id="status"></p>
    <h3>Uploaded files</h3>
    <ul id="files"></ul>
  </div>
  <script>
    async function refreshFiles() {
      const res = await fetch('/list');
      const files = await res.json();
      const ul = document.getElementById('files');
      ul.innerHTML = files.map(name => `<li><a href="/files/${encodeURIComponent(name)}" target="_blank">${name}</a></li>`).join('');
    }
    async function upload() {
      const input = document.getElementById('file');
      const status = document.getElementById('status');
      const file = input.files[0];
      if (!file) {
        status.textContent = 'Please choose a file first.';
        return;
      }
      status.textContent = 'Uploading...';
      const res = await fetch('/upload?filename=' + encodeURIComponent(file.name), {
        method: 'PUT',
        body: file,
      });
      status.textContent = await res.text();
      await refreshFiles();
    }
    refreshFiles();
  </script>
</body>
</html>
'''

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, content_type='text/plain; charset=utf-8'):
        data = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/':
            self._send(200, HTML, 'text/html; charset=utf-8')
            return
        if parsed.path == '/list':
            files = sorted([p.name for p in UPLOAD_DIR.iterdir() if p.is_file() and p.name != Path(__file__).name])
            self._send(200, json.dumps(files), 'application/json; charset=utf-8')
            return
        if parsed.path.startswith('/files/'):
            name = Path(unquote(parsed.path.split('/files/', 1)[1])).name
            target = UPLOAD_DIR / name
            if not target.exists() or not target.is_file():
                self._send(404, 'Not found')
                return
            data = target.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Content-Disposition', f'inline; filename="{name}"')
            self.end_headers()
            self.wfile.write(data)
            return
        self._send(404, 'Not found')

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != '/upload':
            self._send(404, 'Not found')
            return
        params = parse_qs(parsed.query)
        raw_name = params.get('filename', ['upload.bin'])[0]
        name = Path(raw_name).name
        target = UPLOAD_DIR / name
        length = int(self.headers.get('Content-Length', '0'))
        data = self.rfile.read(length)
        target.write_bytes(data)
        self._send(200, f'Uploaded: {name}')

    def log_message(self, format, *args):
        return


def get_lan_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(('8.8.8.8', 80))
        return sock.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        sock.close()


if __name__ == '__main__':
    host = '0.0.0.0'
    port = 8008
    print(f'UPLOAD_DIR={UPLOAD_DIR}')
    print(f'LOCAL_URL=http://127.0.0.1:{port}')
    print(f'LAN_URL=http://{get_lan_ip()}:{port}')
    ThreadingHTTPServer((host, port), Handler).serve_forever()
