#!/usr/bin/env python3
"""Build assets/mahjong.html = src/ui.html with src/engine.js inlined (and optional logo).
Usage: python3 build.py [--logo path/to/human0-logo.png]
Writes assets/PARITY.json with sha256 of the engine source and of the engine bytes embedded in the build."""
import base64, hashlib, json, mimetypes, pathlib, sys
root = pathlib.Path(__file__).resolve().parent
eng = (root/'src/engine.js').read_text()
ui = (root/'src/ui.html').read_text()
assert ui.count('/*ENGINE*/') == 1 and ui.count("/*LOGO*/''") == 1
logo = ''
if '--logo' in sys.argv:
    lp = pathlib.Path(sys.argv[sys.argv.index('--logo')+1])
    logo = 'data:%s;base64,%s' % (mimetypes.guess_type(lp.name)[0] or 'image/png', base64.b64encode(lp.read_bytes()).decode())
out = ui.replace('/*ENGINE*/', eng).replace("/*LOGO*/''", json.dumps(logo))
(root/'assets/mahjong.html').write_text(out)
start = out.index(eng); emb = out[start:start+len(eng)]
h = lambda s: hashlib.sha256(s.encode()).hexdigest()
par = {'engine_src_sha256': h(eng), 'engine_embedded_sha256': h(emb), 'parity': h(eng) == h(emb),
       'build_sha256': h(out), 'bytes': len(out.encode()), 'logo_embedded': bool(logo)}
(root/'assets/PARITY.json').write_text(json.dumps(par, indent=2))
print(json.dumps(par, indent=2))
assert par['parity']
