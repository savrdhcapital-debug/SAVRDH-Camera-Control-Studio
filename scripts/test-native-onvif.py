"""Run the real Swift ONVIF client against a controlled local protocol fixture.
Does not access physical cameras or use customer credentials.
"""
import base64
import hashlib
import http.server
import os
import subprocess
import threading
import xml.etree.ElementTree as ET

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run(['swiftc', '-swift-version', '5', '-parse-as-library', '-D', 'ONVIF_INTEGRATION_TEST', '-module-cache-path', 'build/apple/modules', 'apple/Sources/CameraStudioApp.swift', 'apple/Sources/CCTV.swift', 'tests/native/ONVIFIntegration.swift', '-o', '/tmp/savrdh-onvif-integration', '-framework', 'SwiftUI', '-framework', 'WebKit', '-framework', 'Security', '-framework', 'Network'], cwd=root, check=True)
ip = subprocess.check_output(['ipconfig', 'getifaddr', 'en0'], text=True).strip()
clock = '2024-01-02T03:04:05Z'
def envelope(body):
    return f'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>{body}</s:Body></s:Envelope>'.encode()
class Camera(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_POST(self):
        doc = ET.fromstring(self.rfile.read(int(self.headers['Content-Length'])))
        operation = list(doc.find('{http://www.w3.org/2003/05/soap-envelope}Body'))[0].tag.split('}')[-1]
        if operation == 'GetSystemDateAndTime':
            data = envelope('<SystemDateAndTime><UTCDateTime><Date><Year>2024</Year><Month>1</Month><Day>2</Day></Date><Time><Hour>3</Hour><Minute>4</Minute><Second>5</Second></Time></UTCDateTime></SystemDateAndTime>')
            self.reply(200, data); return
        fields = {n.tag.split('}')[-1]: n.text for n in doc.iter() if n.text}
        digest = base64.b64encode(hashlib.sha1(base64.b64decode(fields.get('Nonce','')) + fields.get('Created','').encode() + b'fixture-password').digest()).decode()
        # A deliberately skewed camera clock makes use of the Mac clock fail.
        if fields.get('Username') != 'fixture-user' or fields.get('Created') != clock or fields.get('Password') != digest:
            self.reply(401, envelope('<Denied/>')); return
        if self.path == '/denied': self.reply(401, envelope('<Denied/>')); return
        if self.path == '/fault':
            self.reply(200, envelope('<s:Fault xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Reason><s:Text>Not Authorized</s:Text></s:Reason></s:Fault>')); return
        base = f'http://{ip}:{self.server.server_port}'
        if operation == 'GetCapabilities':
            media = 'http://8.8.8.8/media' if self.path == '/external' else base + '/media'
            data = envelope(f'<Capabilities><Media><XAddr>{media}</XAddr></Media></Capabilities>')
        elif operation == 'GetProfiles': data = envelope('<GetProfilesResponse><Profiles token="main"/></GetProfilesResponse>')
        elif operation == 'GetStreamUri': data = envelope(f'<GetStreamUriResponse><MediaUri><Uri>{base.replace("http:","rtsp:")}/live</Uri></MediaUri></GetStreamUriResponse>')
        else: self.reply(400, b''); return
        self.reply(200, data)
    def reply(self, status, data):
        self.send_response(status); self.send_header('Content-Type', 'application/soap+xml'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
server = http.server.ThreadingHTTPServer((ip, 0), Camera)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    subprocess.run(['/tmp/savrdh-onvif-integration'], env={**os.environ, 'ONVIF_FIXTURE_URL': f'http://{ip}:{server.server_port}'}, check=True, timeout=30)
finally:
    server.shutdown(); server.server_close()
