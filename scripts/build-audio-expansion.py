#!/usr/bin/env python3
"""Build the tension/horror audio expansion described in public/audio/expansion-plan.json.

Usage: python3 scripts/build-audio-expansion.py [download-dir]

The download dir must contain the raw files named after the basename of each
``downloadUrl`` (zips are extracted here). Sources are copied under
``audio-source/<category>/``, exports (OGG Vorbis q5 + MP3 VBR q2, 48 kHz) are
written under ``public/audio/<category>/`` and appended to ``manifest.json``.
Existing manifest entries and files are never touched.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'public', 'audio')
SRC_ROOT = os.path.join(ROOT, 'audio-source')
DL = sys.argv[1] if len(sys.argv) > 1 else '/tmp/aud'
ACCESS_DATE = '2026-09-26'

plan = json.load(open(os.path.join(AUDIO, 'expansion-plan.json')))
manifest_path = os.path.join(AUDIO, 'manifest.json')
manifest = json.load(open(manifest_path))
existing = {s['id'] for s in manifest['sounds']}
exports = plan['processing']['exports']

INTENDED = {
    'scream_horror_01': 'Cri humain brut — matière première pour la détresse du sujet',
    'scream_performance_01': 'Cri court — réaction à une décharge de sonde',
    'screech_performance_01': 'Hurlement strident — glitch vocal du robot',
    'horror_texture_01': 'Nappe horreur — montée de tension avant verdict',
    'horror_texture_02': 'Nappe horreur — fond sonore du couloir Enfer',
    'horror_ambience_01': 'Ambiance inquiétante — cellule en veille',
    'space_dread_01': 'Boucle de dread longue — écran trailer / prologue',
    'air_whoosh_01': 'Souffle d\'air — transition de caméra',
    'heartbeat_fast_01': 'Battement rapide — stress du sujet sous contrainte',
    'metal_strain_01': 'Métal qui grince — contention forcée',
    'metal_door_creak_01': 'Porte métallique — ouverture de la cellule',
    'breath_sigh_01': 'Soupir — relâchement après une épreuve',
    'breathing_slow_01': 'Respiration lente — sujet immobilisé',
    'robot_distress_low_01': 'Cri robotisé grave — sujet robot en détresse',
    'robot_distress_grain_01': 'Cri robotisé pulsé — court-circuit vocal',
    'robot_screech_modulated_01': 'Hurlement synthétique — panique du robot',
    'metal_strain_low_01': 'Structure métallique sous contrainte — grave',
    'metal_door_low_01': 'Grincement grave — porte lourde',
    'whoosh_reverse_01': 'Souffle inversé — annonce d\'un impact',
    'heartbeat_distant_01': 'Battement étouffé — perte de conscience',
    'horror_ambience_muffled_01': 'Tension sourde — derrière la vitre d\'observation',
    'metal_impact_low_01': 'Impact grave cinématique — chute de verdict',
    'alarm_pulse_high_01': 'Alerte aiguë pulsée — surcharge électrique',
    'alarm_pulse_low_01': 'Alerte grave pulsée — verrouillage de la cellule',
}

SOURCE_NAME = {'opengameart.org': 'OpenGameArt', 'bigsoundbank.com': 'BigSoundBank'}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    out = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', path])
    d = json.loads(out)
    return {
        'programs': [],
        'streams': [{k: s[k] for k in ('codec_name', 'sample_rate', 'channels')} for s in d['streams']],
        'format': {'duration': d['format']['duration']},
    }


def export(wav, category, sid):
    outdir = os.path.join(AUDIO, category)
    os.makedirs(outdir, exist_ok=True)
    files, meta = {}, {}
    for ext, args in exports.items():
        out = os.path.join(outdir, f'{sid}.{ext}')
        run(['ffmpeg', '-y', '-i', wav, *args, out])
        files[ext] = f'{category}/{sid}.{ext}'
        meta[ext] = probe(out)
    return files, meta


def raw_path(src):
    fn = os.path.basename(src['downloadUrl'])
    path = os.path.join(DL, fn)
    if 'archiveMember' in src:
        with zipfile.ZipFile(path) as z:
            z.extract(src['archiveMember'], DL)
        path = os.path.join(DL, src['archiveMember'])
    return path


def host(url):
    return url.split('/')[2].removeprefix('www.')


added = []
tmp = tempfile.mkdtemp()
source_paths = {}

for src in plan['sources']:
    raw = raw_path(src)
    ext = os.path.splitext(raw)[1].lower()
    dst_dir = os.path.join(SRC_ROOT, src['category'])
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, src['id'] + ext)
    if not os.path.exists(dst):
        shutil.copyfile(raw, dst)
    source_paths[src['id']] = dst
    if src['id'] in existing:
        continue
    wav = os.path.join(tmp, src['id'] + '.wav')
    run(['ffmpeg', '-y', '-i', dst, '-ar', '48000', '-c:a', 'pcm_s16le', wav])
    files, meta = export(wav, src['category'], src['id'])
    added.append({
        'id': src['id'], 'category': src['category'], 'title': src['title'],
        'intendedUse': INTENDED[src['id']], 'kind': 'source',
        'sourceName': SOURCE_NAME[host(src['sourcePage'])], 'author': src['author'],
        'sourcePage': src['sourcePage'], 'downloadUrl': src['downloadUrl'],
        'archiveMember': src.get('archiveMember'),
        'license': src['license'], 'licenseUrl': src['licenseUrl'],
        'attributionRequired': False, 'contentWarning': src.get('contentWarning', ''),
        'reviewStatus': 'candidate_not_auditioned',
        'loopCandidate': src['category'] == 'tension',
        'seamlessLoopVerified': False,
        'originalPath': os.path.relpath(dst, ROOT), 'files': files,
        'sourceSha256': sha256(dst),
        'modifications': 'Transcodage 48 kHz OGG Vorbis q5 + MP3 VBR q2 ; canaux et gain conservés ; aucun montage',
        'metadata': meta,
    })

src_by_id = {s['id']: s for s in plan['sources']}
for s in manifest['sounds']:
    src_by_id.setdefault(s['id'], s)
    source_paths.setdefault(s['id'], os.path.join(ROOT, s['originalPath']))
for d in plan['derived']:
    if d['id'] in existing:
        continue
    src = src_by_id[d['sourceId']]
    origin = source_paths[d['sourceId']]
    wav = os.path.join(tmp, d['id'] + '.wav')
    run(['ffmpeg', '-y', '-i', origin, '-af', d['filter'], '-ar', '48000', '-c:a', 'pcm_s16le', wav])
    files, meta = export(wav, d['category'], d['id'])
    added.append({
        'id': d['id'], 'category': d['category'], 'title': d['title'],
        'intendedUse': INTENDED[d['id']], 'kind': 'derived', 'derivedFrom': d['sourceId'],
        'sourceName': SOURCE_NAME[host(src['sourcePage'])], 'author': src['author'],
        'sourcePage': src['sourcePage'], 'downloadUrl': src['downloadUrl'],
        'license': src['license'], 'licenseUrl': src['licenseUrl'],
        'attributionRequired': False, 'contentWarning': d.get('contentWarning', ''),
        'reviewStatus': 'candidate_not_auditioned', 'loopCandidate': False,
        'seamlessLoopVerified': False,
        'originalPath': os.path.relpath(origin, ROOT), 'files': files,
        'sourceSha256': sha256(origin),
        'modifications': 'Dérivé de ' + d['sourceId'] + ' via ffmpeg -af "' + d['filter'] + '" puis exports 48 kHz',
        'metadata': meta,
    })

for s in plan['synthesis']:
    if s['id'] in existing:
        continue
    wav = os.path.join(tmp, s['id'] + '.wav')
    run(['ffmpeg', '-y', '-f', 'lavfi', '-i', s['lavfi'], '-af', s['filter'], '-c:a', 'pcm_s16le', wav])
    files, meta = export(wav, s['category'], s['id'])
    added.append({
        'id': s['id'], 'category': s['category'], 'title': s['title'],
        'intendedUse': INTENDED[s['id']], 'kind': 'synthesis',
        'sourceName': 'Synthèse ffmpeg', 'author': 'protocole.h',
        'sourcePage': 'https://ffmpeg.org/ffmpeg-filters.html#sine', 'downloadUrl': None,
        'license': 'CC0-1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'attributionRequired': False, 'contentWarning': '',
        'reviewStatus': 'candidate_not_auditioned', 'loopCandidate': True,
        'seamlessLoopVerified': False,
        'originalPath': None, 'files': files, 'sourceSha256': None,
        'modifications': 'ffmpeg -f lavfi -i "' + s['lavfi'] + '" -af "' + s['filter'] + '"',
        'metadata': meta,
    })

manifest['sounds'].extend(added)
manifest['version'] = 2
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write('\n')

# Append provenance blocks to SOURCES.txt
blocks = []
seen_pages = {}
for e in added:
    if e['kind'] == 'synthesis':
        continue
    seen_pages.setdefault(e['sourcePage'], (e, []))[1].append(e['id'])
for page, (e, ids) in seen_pages.items():
    blocks.append(
        f"== {e['sourceName']} — {e['author']}\n"
        f"Page : {page}\n"
        f"Licence : CC0 1.0 — {e['licenseUrl']}\n"
        f"Date d'accès : {ACCESS_DATE}\n"
        f"Attribution : non requise (crédit de courtoisie)\n"
        f"Candidats : {', '.join(ids)}\n")
synth = [e['id'] for e in added if e['kind'] == 'synthesis']
if synth:
    blocks.append(
        "== Synthèse ffmpeg — protocole.h\n"
        "Générés localement (filtre sine), aucune source externe.\n"
        f"Candidats : {', '.join(synth)}\n")
with open(os.path.join(AUDIO, 'licenses', 'SOURCES.txt'), 'a', encoding='utf-8') as f:
    f.write('\n\n== EXTENSION TENSION / HORREUR (' + ACCESS_DATE + ')\n')
    f.write("Les entrées 'dérivé' sont des traitements ffmpeg d'un enregistrement CC0 crédité ci-dessous ;\n")
    f.write("aucune n'est un nouvel enregistrement brut.\n\n")
    f.write('\n'.join(blocks))

shutil.rmtree(tmp)
print(f'added {len(added)} sounds, manifest now {len(manifest["sounds"])}')
