import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = 'https://api.gradium.ai/api/post/speech/tts'
VOICE_ENVS = {'unit_h': 'GRADIUM_ROBOT_VOICE_ID', 'system': 'GRADIUM_SYSTEM_VOICE_ID'}
ALLOWED_ENV = {'GRADIUM_API_KEY', *VOICE_ENVS.values()}
ID_PATTERN = re.compile(r'^[a-z][a-z0-9_]{0,79}$')
TAKE_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,40}$')
MAX_RESPONSE_BYTES = 32 * 1024 * 1024


class GenerationError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_environment(path=None):
    values = {}
    if path:
        for line in Path(path).read_text(encoding='utf-8').splitlines():
            match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=(.*)$', line)
            if not match or match[1] not in ALLOWED_ENV:
                continue
            parts = shlex.split(match[2], comments=True)
            if len(parts) > 1:
                raise GenerationError(f'Invalid quoted value for {match[1]}.')
            values[match[1]] = parts[0] if parts else ''
    values.update({key: os.environ[key] for key in ALLOWED_ENV if key in os.environ})
    return values


def load_catalog(path):
    catalog = json.loads(Path(path).read_text(encoding='utf-8'))
    if catalog.get('version') != 1 or catalog.get('language') != 'en':
        raise GenerationError('Expected an English version-1 dialogue catalog.')
    seen = set()
    for line in catalog['lines']:
        line_id = line.get('id', '')
        if not ID_PATTERN.fullmatch(line_id) or line_id in seen:
            raise GenerationError('Invalid or duplicate dialogue ID.')
        if line.get('speaker') not in VOICE_ENVS:
            raise GenerationError(f'Unknown speaker on {line_id}.')
        if not isinstance(line.get('text'), str) or not line['text'].strip() or len(line['text']) > 1000:
            raise GenerationError(f'Invalid spoken text on {line_id}.')
        if '<' in line['text'] or '>' in line['text']:
            raise GenerationError(f'Acting or control markup is not allowed in spoken text: {line_id}.')
        seen.add(line_id)
    if not catalog.get('auditionIds') or not set(catalog['auditionIds']).issubset(seen):
        raise GenerationError('Audition IDs must reference existing dialogue lines.')
    return catalog


def select_lines(catalog, scope, ids=None, speaker=None):
    selected = set(ids.split(',')) if ids else set(catalog['auditionIds']) if scope == 'audition' else None
    known = {line['id'] for line in catalog['lines']}
    if selected is not None and not selected.issubset(known):
        raise GenerationError('Unknown ID in --ids.')
    lines = [line for line in catalog['lines']
             if (selected is None or line['id'] in selected) and (speaker is None or line['speaker'] == speaker)]
    if not lines:
        raise GenerationError('The selection contains no lines.')
    return lines


def build_request(line, voice_id):
    return {
        'text': line['text'], 'voice_id': voice_id, 'model_name': 'default',
        'output_format': 'wav', 'only_audio': True,
        'json_config': {'rewrite_rules': 'en'},
    }


def request_fingerprint(payload, take):
    encoded = json.dumps({'request': payload, 'take': take}, sort_keys=True, ensure_ascii=False).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def request_audio(payload, api_key):
    request = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-api-key': api_key}, method='POST',
    )
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=60) as response:
            data = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as error:
        raise GenerationError(f'Gradium HTTP {error.code}; no automatic retry was made.') from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise GenerationError('Gradium network request failed; no automatic retry was made.') from None
    if len(data) > MAX_RESPONSE_BYTES:
        raise GenerationError('Gradium response exceeded the audio size limit.')
    if len(data) < 44 or data[:4] not in (b'RIFF', b'RF64') or data[8:12] != b'WAVE':
        raise GenerationError('Gradium did not return WAV audio; no audio file was saved.')
    return data


def run_media(command):
    try:
        return subprocess.run(command, check=True, capture_output=True, timeout=60).stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        raise GenerationError('Audio validation/export failed; existing files were preserved.') from None


def probe_audio(path):
    raw = run_media(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                     '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration',
                     '-of', 'json', str(path)])
    try:
        result = json.loads(raw)
        duration = float(result['format']['duration'])
        stream = result['streams'][0]
        valid = math.isfinite(duration) and 0 < duration < 120 and int(stream['channels']) > 0
    except (ValueError, KeyError, IndexError, TypeError):
        valid = False
    if not valid:
        raise GenerationError('Audio is empty, invalid, or longer than a short dialogue cue.')
    return {'durationSeconds': duration, 'sampleRate': int(stream['sample_rate']), 'channels': int(stream['channels'])}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, data):
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                     prefix='.dialogue-', suffix='.tmp', delete=False) as file:
        tmp = Path(file.name)
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write('\n')
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def generate_line(root, line, payload, take, api_key):
    fingerprint = request_fingerprint(payload, take)
    stem = f'{line["id"]}-{fingerprint}'
    raw_dir = root / 'audio-source' / 'dialogue'
    out_dir = root / 'public' / 'dialogue' / 'clips'
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    original = raw_dir / f'{stem}.wav'
    if not original.exists():
        data = request_audio(payload, api_key)
        with tempfile.TemporaryDirectory(dir=raw_dir, prefix='.incoming-') as directory:
            tmp = Path(directory) / 'clip.wav'
            tmp.write_bytes(data)
            probe_audio(tmp)
            run_media(['ffmpeg', '-v', 'error', '-i', str(tmp), '-f', 'null', '-'])
            os.link(tmp, original)
    metadata = probe_audio(original)
    files = {}
    hashes = {}
    for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '5']), ('mp3', ['-c:a', 'libmp3lame', '-q:a', '2'])]:
        output = out_dir / f'{stem}.{ext}'
        if not output.exists():
            with tempfile.TemporaryDirectory(dir=out_dir, prefix='.encode-') as directory:
                tmp = Path(directory) / f'clip.{ext}'
                run_media(['ffmpeg', '-v', 'error', '-n', '-i', str(original), '-map', '0:a:0', '-ar', '48000', *codec, str(tmp)])
                probe_audio(tmp)
                run_media(['ffmpeg', '-v', 'error', '-i', str(tmp), '-f', 'null', '-'])
                os.link(tmp, output)
        probe_audio(output)
        files[ext] = f'clips/{output.name}'
        hashes[ext] = sha256(output)
    return {
        'speaker': line['speaker'], 'text': line['text'], 'voiceId': payload['voice_id'],
        'provider': 'Gradium', 'model': payload['model_name'], 'requestHash': fingerprint,
        'take': take, 'files': files, 'sha256': hashes, 'audio': metadata,
        'originalPath': original.relative_to(root).as_posix(), 'sourceSha256': sha256(original),
        'reviewStatus': 'generated_not_auditioned', 'directionApplied': False,
        'rightsStatus': 'provider_terms_apply_not_a_cc0_source',
    }


def main(argv=None, root=ROOT):
    parser = argparse.ArgumentParser(description='Prepare or generate Unit H dialogue. Dry run by default; --execute makes paid Gradium requests.')
    parser.add_argument('--scope', choices=['audition', 'all'], default='audition')
    parser.add_argument('--speaker', choices=list(VOICE_ENVS))
    parser.add_argument('--ids', help='Comma-separated cue IDs; overrides --scope.')
    parser.add_argument('--take', default='take-01', help='Use a new take name to request another performance without overwriting audio.')
    parser.add_argument('--env-file', help='Optional private dotenv file. Only GRADIUM_* key/voice settings are read; shell environment wins.')
    parser.add_argument('--execute', action='store_true', help='Allow paid synthesis. Requests are sequential, never automatically retried.')
    args = parser.parse_args(argv)
    try:
        if not TAKE_PATTERN.fullmatch(args.take):
            raise GenerationError('Invalid take name; use letters, digits, underscores or hyphens.')
        catalog = load_catalog(root / 'public' / 'dialogue' / 'manifest.json')
        lines = select_lines(catalog, args.scope, args.ids, args.speaker)
        env = read_environment(args.env_file)
        print(f'{len(lines)} cues selected; {sum(len(line["text"]) for line in lines)} spoken-text characters.')
        for line in lines:
            print(f'{line["id"]}\t{line["speaker"]}\t{line["text"]}')
        if not args.execute:
            print('Dry run: zero network requests. Add --execute only when you approve synthesis charges.')
            print('Acting notes are not sent to TTS. Listen to the six audition clips before generating all cues.')
            missing = sorted({VOICE_ENVS[line['speaker']] for line in lines if not env.get(VOICE_ENVS[line['speaker']])})
            if missing:
                print('Voice settings still needed: ' + ', '.join(missing))
            return 0
        api_key = env.get('GRADIUM_API_KEY', '').strip()
        if not api_key:
            raise GenerationError('Set GRADIUM_API_KEY privately in the environment or --env-file.')
        for line in lines:
            voice = env.get(VOICE_ENVS[line['speaker']], '').strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', voice) or voice == api_key:
                raise GenerationError(f'Set a valid {VOICE_ENVS[line["speaker"]]} voice ID, not an API key.')
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise GenerationError('ffmpeg and ffprobe are required before synthesis; no requests were made.')
        index_path = root / 'public' / 'dialogue' / 'generated.json'
        index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {'version': 1, 'clips': {}}
        if index.get('version') != 1 or not isinstance(index.get('clips'), dict):
            raise GenerationError('Invalid generated.json; refusing to replace its contents.')
        lock_dir = root / 'audio-source' / 'dialogue'
        lock_dir.mkdir(parents=True, exist_ok=True)
        lock = lock_dir / '.generation.lock'
        try:
            with lock.open('x') as handle:
                handle.write(str(os.getpid()))
        except FileExistsError:
            raise GenerationError('A generation lock exists. Check whether another batch is running before retrying.') from None
        try:
            for line in lines:
                payload = build_request(line, env[VOICE_ENVS[line['speaker']]].strip())
                record = generate_line(root, line, payload, args.take, api_key)
                index['clips'][line['id']] = record
                save_json(index_path, index)
                print(f'Ready: {line["id"]} (generated or reused; not auditioned).')
        finally:
            lock.unlink(missing_ok=True)
        return 0
    except (GenerationError, OSError, ValueError, KeyError, TypeError) as error:
        if isinstance(error, GenerationError):
            print(str(error), file=sys.stderr)
        else:
            print('Local input or file operation failed. No secrets or provider error bodies are logged.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
