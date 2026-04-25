#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote, parse_qs
from pathlib import Path
import html
import os

ROOT = Path(os.environ.get("UPLOAD_ROOT", "/data/data/com.termux/files/home/projects/pixi-vue-ts-template/uploads")).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("UPLOAD_PORT", "8008"))

class Handler(BaseHTTPRequestHandler):
    def _send(self, code=200, content_type="text/html; charset=utf-8", body=b""):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _page(self):
        files = []
        for p in sorted(ROOT.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file():
                files.append(f'<li><a href="/files/{html.escape(p.name)}">{html.escape(p.name)}</a> ({p.stat().st_size} bytes)</li>')
        body = f"""<!doctype html>
<html><head><meta charset='utf-8'><title>Upload</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 16px;line-height:1.5}}
.box{{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0;background:#fafafa}}
small{{color:#666}}
code{{background:#eee;padding:2px 4px;border-radius:4px}}
</style></head><body>
<h1>File Upload Server</h1>
<div class='box'>
  <p>Choose a file, then click upload. The filename will be preserved.</p>
  <input id='file' type='file' />
  <button onclick='upload()'>Upload</button>
  <p id='status'></p>
  <script>
    async function upload() {{
      const input = document.getElementById('file');
      const f = input.files && input.files[0];
      const status = document.getElementById('status');
      if (!f) {{ status.textContent = 'Please choose a file first.'; return; }}
      status.textContent = 'Uploading...';
      const res = await fetch('/upload?filename=' + encodeURIComponent(f.name), {{
        method: 'PUT',
        headers: {{ 'X-Filename': f.name }},
        body: f
      }});
      status.textContent = res.ok ? 'Uploaded: ' + f.name : 'Upload failed: ' + res.status;
      if (res.ok) location.reload();
    }}
  </script>
  <p><small>Upload root: {html.escape(str(ROOT))}</small></p>
</div>
<div class='box'><h3>Files</h3><ul>{''.join(files) if files else '<li>No files yet</li>'}</ul></div>
<p><small>Download path example: <code>/files/your.mp3</code></small></p>
</body></html>"""
        return body.encode('utf-8')

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send(body=self._page())
            return
        if parsed.path.startswith("/files/"):
            name = unquote(parsed.path[len("/files/"):])
            path = (ROOT / name).resolve()
            if ROOT not in path.parents and path != ROOT:
                self._send(403, body=b"Forbidden")
                return
            if not path.exists() or not path.is_file():
                self._send(404, body=b"Not found")
                return
            data = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self._send(404, body=b"Not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != "/upload":
            self._send(404, body=b"Not found")
            return
        qs = parse_qs(parsed.query)
        name = (qs.get('filename', [None])[0] or self.headers.get('X-Filename') or 'upload.bin')
        filename = Path(name).name
        length = int(self.headers.get('Content-Length', '0'))
        data = self.rfile.read(length) if length else self.rfile.read()
        (ROOT / filename).write_bytes(data)
        self._send(200, content_type='text/plain; charset=utf-8', body=f'uploaded {filename}'.encode('utf-8'))

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}", flush=True)

if __name__ == '__main__':
    print(f'Serving on 0.0.0.0:{PORT}, upload root: {ROOT}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
