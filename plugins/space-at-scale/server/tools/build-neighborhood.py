#!/usr/bin/env python3
"""Build the solar-neighborhood data for Space-at-Scale from two public catalogs.

Inputs (git clones):
  HYG Database v4.1 (CC BY-SA 4.0, astronexus)      hyg/CURRENT/hygdata_v41.csv
  Open Exoplanet Catalogue (MIT)                     systems.xml.gz
Outputs:
  <site>/neighborhood.json   app: the nearest stars (selectable, true positions in AU) and the real sky to mag 7
  <server>/exo_systems.json  server: every OEC system (stars, binaries, planets) for the system frame

Usage: build-neighborhood.py HYG_CSV OEC_XML_GZ SITE_DIR SERVER_DIR [N_NEAREST]
"""
import csv, gzip, json, math, sys, re, xml.etree.ElementTree as ET

HYG, OEC, SITE, SERVER = sys.argv[1:5]
N = int(sys.argv[5]) if len(sys.argv) > 5 else 250
PC_AU, PC_LY, EPS = 206264.806, 3.26156, math.radians(23.43928)

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None

# ---------- Open Exoplanet Catalogue ----------
root = ET.fromstring(gzip.open(OEC).read())
def sexa(s, hours):
    p = [float(v) for v in s.split()]
    sign = -1 if s.strip().startswith('-') else 1
    v = abs(p[0]) + (p[1] if len(p) > 1 else 0) / 60 + (p[2] if len(p) > 2 else 0) / 3600
    return sign * v * (15 if hours else 1)
def val(e, tag):
    c = e.find(tag)
    if c is None: return None
    if c.text and c.text.strip(): return num(c.text)
    for k in ('upperlimit', 'lowerlimit'):
        if k in c.attrib: return None
    return None
def node(e):
    t = e.tag
    names = [n.text for n in e.findall('name') if n.text]
    o = {'type': t, 'names': names[:4]}
    for k, tag in (('a', 'semimajoraxis'), ('e', 'eccentricity'), ('P', 'period'), ('i', 'inclination'), ('w', 'periastron'),
                   ('Om', 'ascendingnode'), ('tp', 'periastrontime'), ('tt', 'transittime'), ('mass', 'mass'), ('radius', 'radius'),
                   ('temp', 'temperature'), ('L', 'longitude')):
        v = val(e, tag)
        if v is not None: o[k] = v
    if t == 'star':
        sp = e.find('spectraltype')
        if sp is not None and sp.text: o['spect'] = sp.text.strip()
        v = val(e, 'magV')
        if v is not None: o['V'] = v
    if t == 'planet':
        lists = [l.text for l in e.findall('list') if l.text]
        o['status'] = 'confirmed' if 'Confirmed planets' in lists else 'retracted' if any('Retracted' in l for l in lists) else 'controversial' if any('Controversial' in l for l in lists) else 'candidate'
        m = e.find('discoverymethod'); y = e.find('discoveryyear')
        if m is not None and m.text: o['method'] = m.text
        if y is not None and y.text: o['year'] = int(float(y.text))
    kids = [node(c) for c in e if c.tag in ('binary', 'star', 'planet')]
    if kids: o['kids'] = kids
    return o
systems = []
for s in root.findall('system'):
    ra, de, d = s.find('rightascension'), s.find('declination'), val(s, 'distance')
    names = [n.text for n in s.findall('name') if n.text]
    entry = {'name': names[0], 'aliases': names[1:], 'ra': round(sexa(ra.text, True), 5) if ra is not None and ra.text else None,
             'dec': round(sexa(de.text, False), 5) if de is not None and de.text else None, 'dist_pc': d,
             'kids': [node(c) for c in s if c.tag in ('binary', 'star', 'planet')]}
    # every name of every star and planet, for lookup
    allnames = set(names)
    for el in s.iter():
        if el.tag in ('star', 'binary', 'planet'):
            allnames.update(n.text for n in el.findall('name') if n.text)
    entry['all_names'] = sorted(allnames)
    entry['planets'] = sum(1 for p in s.iter('planet'))
    entry['confirmed'] = sum(1 for p in s.iter('planet') if any(l.text == 'Confirmed planets' for l in p.findall('list')))
    systems.append(entry)
json.dump({'source': 'Open Exoplanet Catalogue (MIT), github.com/OpenExoplanetCatalogue/oec_gzip systems.xml.gz', 'systems': systems},
          open(SERVER + '/exo_systems.json', 'w'), separators=(',', ':'))

def key(s): return re.sub(r'[^a-z0-9]', '', s.lower())
name_to_sys = {}
for i, s in enumerate(systems):
    for n in s['all_names']: name_to_sys.setdefault(key(n), i)

# ---------- HYG ----------
rows = list(csv.DictReader(open(HYG, encoding='utf-8')))
def eq_to_ecl(x, y, z): return [x, y * math.cos(EPS) + z * math.sin(EPS), -y * math.sin(EPS) + z * math.cos(EPS)]
GREEK = {'Alp': 'Alpha', 'Bet': 'Beta', 'Gam': 'Gamma', 'Del': 'Delta', 'Eps': 'Epsilon', 'Zet': 'Zeta', 'Eta': 'Eta', 'The': 'Theta', 'Iot': 'Iota', 'Kap': 'Kappa',
         'Lam': 'Lambda', 'Mu': 'Mu', 'Nu': 'Nu', 'Xi': 'Xi', 'Omi': 'Omicron', 'Pi': 'Pi', 'Rho': 'Rho', 'Sig': 'Sigma', 'Tau': 'Tau', 'Ups': 'Upsilon', 'Phi': 'Phi',
         'Chi': 'Chi', 'Psi': 'Psi', 'Ome': 'Omega'}
CON = {'Cen': 'Centauri', 'Cet': 'Ceti', 'Eri': 'Eridani', 'CMa': 'Canis Majoris', 'CMi': 'Canis Minoris', 'Aql': 'Aquilae', 'Lyr': 'Lyrae', 'Cyg': 'Cygni', 'Ind': 'Indi',
       'Boo': 'Bootis', 'Aur': 'Aurigae', 'Ori': 'Orionis', 'Tau': 'Tauri', 'Gem': 'Geminorum', 'Leo': 'Leonis', 'Vir': 'Virginis', 'Sco': 'Scorpii', 'Sgr': 'Sagittarii',
       'UMa': 'Ursae Majoris', 'UMi': 'Ursae Minoris', 'Cas': 'Cassiopeiae', 'Dra': 'Draconis', 'Her': 'Herculis', 'Peg': 'Pegasi', 'And': 'Andromedae', 'Per': 'Persei',
       'PsA': 'Piscis Austrini', 'Oph': 'Ophiuchi', 'Pav': 'Pavonis', 'Hyi': 'Hydri', 'Tuc': 'Tucanae', 'Lep': 'Leporis', 'Col': 'Columbae', 'Pup': 'Puppis', 'Vel': 'Velorum',
       'Car': 'Carinae', 'Cru': 'Crucis', 'Ara': 'Arae', 'Lib': 'Librae', 'Ser': 'Serpentis', 'Aqr': 'Aquarii', 'Cap': 'Capricorni', 'Psc': 'Piscium', 'Ari': 'Arietis',
       'Tri': 'Trianguli', 'Lac': 'Lacertae', 'Cep': 'Cephei', 'CrB': 'Coronae Borealis', 'Crv': 'Corvi', 'Crt': 'Crateris', 'Hya': 'Hydrae', 'Mon': 'Monocerotis',
       'Lyn': 'Lyncis', 'LMi': 'Leonis Minoris', 'CVn': 'Canum Venaticorum', 'Com': 'Comae Berenices', 'Sex': 'Sextantis', 'Ant': 'Antliae', 'Pyx': 'Pyxidis', 'Gru': 'Gruis',
       'Phe': 'Phoenicis', 'Scl': 'Sculptoris', 'For': 'Fornacis', 'Hor': 'Horologii', 'Ret': 'Reticuli', 'Dor': 'Doradus', 'Men': 'Mensae', 'Oct': 'Octantis', 'Aps': 'Apodis',
       'TrA': 'Trianguli Australis', 'Nor': 'Normae', 'Lup': 'Lupi', 'Tel': 'Telescopii', 'Mic': 'Microscopii', 'Sct': 'Scuti', 'Vul': 'Vulpeculae', 'Sge': 'Sagittae',
       'Del': 'Delphini', 'Equ': 'Equulei', 'Cha': 'Chamaeleontis', 'Mus': 'Muscae', 'Cir': 'Circini', 'Vol': 'Volantis', 'Pic': 'Pictoris', 'Cae': 'Caeli', 'CrA': 'Coronae Australis'}
def names_for(r):
    out = []
    if r['proper']: out.append(r['proper'])
    if r['bayer'] and r['con']:
        g = re.match(r'([A-Za-z]+)(-?\d*)', r['bayer'])
        if g:
            gr = GREEK.get(g.group(1)[:3].capitalize(), g.group(1))
            out.append((gr + ' ' + CON.get(r['con'], r['con'])).strip() + (' ' + r['comp'] if False else ''))
            out.append(r['bayer'] + ' ' + r['con'])
    if r['flam'] and r['con']: out.append(r['flam'] + ' ' + r['con'])
    if r['gl']: out.append(r['gl'].replace('Gl ', 'GJ ').replace('NN ', 'GJ '))
    if r['hip']: out.append('HIP ' + r['hip'])
    if r['hd']: out.append('HD ' + r['hd'])
    seen, res = set(), []
    for n in out:
        if n and n not in seen: seen.add(n); res.append(n)
    return res
stars = [r for r in rows if num(r['dist']) and 0 < num(r['dist']) < 100000]
near = sorted(stars, key=lambda r: num(r['dist']))[:N]
nearby = []
for r in near:
    x, y, z = (num(r[k]) * PC_AU for k in ('x', 'y', 'z'))
    vx, vy, vz = ((num(r[k]) or 0) * PC_AU for k in ('vx', 'vy', 'vz'))  # pc/yr -> AU/yr
    names = names_for(r) or ['HYG ' + r['id']]
    sysi = next((name_to_sys[key(n)] for n in names if key(n) in name_to_sys), None)
    # multiple-star components share the HYG base / Gliese number; Alpha Cen A/B/C get system letters
    nearby.append({'name': names[0], 'aliases': names[1:], 'pos': [round(v, 1) for v in eq_to_ecl(x, y, z)], 'vel': [round(v, 4) for v in eq_to_ecl(vx, vy, vz)],
                   'mag': num(r['mag']), 'absmag': num(r['absmag']), 'spect': r['spect'], 'ci': num(r['ci']), 'dist_ly': round(num(r['dist']) * PC_LY, 3),
                   'system': systems[sysi]['name'] if sysi is not None else None})
# Alpha Centauri components: HYG lists A and B under one Gliese number; make the common names findable
for s in nearby:
    if s['name'] in ('Rigil Kentaurus',): s['aliases'] += ['Alpha Centauri A', 'Alpha Centauri', 'Alpha Cen A', 'Rigil Kent']
    if s['name'] in ('Toliman',): s['aliases'] = [a for a in s['aliases'] if a != 'Alpha Centauri'] + ['Alpha Centauri B', 'Alpha Cen B']
    if s['name'] in ('Proxima Centauri',): s['aliases'] += ['Alpha Centauri C', 'Proxima', 'Alpha Cen C']
near_ids = {r['id'] for r in near}
sky = [[round(num(r['ra']) * 15, 4), round(num(r['dec']), 4), num(r['mag']), num(r['ci']) if num(r['ci']) is not None else 0.6]
       for r in rows if r['id'] not in near_ids and r['id'] != '0' and num(r['mag']) is not None and num(r['mag']) <= 7.0]
json.dump({'source': {'stars': 'HYG Database v4.1 (CC BY-SA 4.0, astronexus)', 'planets': 'Open Exoplanet Catalogue (MIT)'},
           'frame': 'heliocentric ecliptic J2000, AU; velocity AU/yr', 'nearby': nearby, 'sky': sky},
          open(SITE + '/neighborhood.json', 'w'), separators=(',', ':'))
print('systems', len(systems), 'with planets', sum(1 for s in systems if s['planets']), '| nearby', len(nearby), 'max', nearby[-1]['dist_ly'], 'ly | with system', sum(1 for s in nearby if s['system']), '| sky', len(sky))
