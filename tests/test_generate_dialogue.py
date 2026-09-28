"""Unit tests for scripts/generate-dialogue.py.

No real HTTP, no secrets: request_audio / urllib are mocked, audio is
synthetic WAV produced with the wave module. Run with:
    python3 -m unittest discover -s tests -p 'test_generate_dialogue.py'
"""
import contextlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error
import wave

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts' / 'generate-dialogue.py'
MANIFEST = ROOT / 'public' / 'dialogue' / 'manifest.json'

FAKE_KEY = 'FAKEKEY-sentinel-not-a-real-secret-0000'
FAKE_ROBOT = 'fake-robot-voice-id'
FAKE_SYSTEM = 'fake-system-voice-id'
FAKE_ENV = {'GRADIUM_API_KEY': FAKE_KEY, 'GRADIUM_ROBOT_VOICE_ID': FAKE_ROBOT,
            'GRADIUM_SYSTEM_VOICE_ID': FAKE_SYSTEM}

spec = importlib.util.spec_from_file_location('generate_dialogue', SCRIPT)
gd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gd)

HAVE_FFMPEG = bool(shutil.which('ffmpeg') and shutil.which('ffprobe'))


def wav_bytes(seconds=0.5, rate=16000, freq=440.0):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b''.join(
            struct.pack('<h', int(9000 * math.sin(2 * math.pi * freq * i / rate)))
            for i in range(int(rate * seconds))))
    return buf.getvalue()


def make_root():
    tmp = Path(tempfile.mkdtemp(prefix='dialogue-test-'))
    (tmp / 'public' / 'dialogue').mkdir(parents=True)
    shutil.copy(MANIFEST, tmp / 'public' / 'dialogue' / 'manifest.json')
    return tmp


def run_main(argv, root, env=None):
    out, err = io.StringIO(), io.StringIO()
    with mock.patch.dict(os.environ, env or {}, clear=True), \
            contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = gd.main(argv, root=root)
    return code, out.getvalue(), err.getvalue()


def audio_files(root):
    return sorted(p.relative_to(root).as_posix() for p in root.rglob('*')
                  if p.suffix in ('.wav', '.ogg', '.mp3'))


class DryRunTests(unittest.TestCase):
    def setUp(self):
        self.root = make_root()
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))

    def selected_ids(self, out):
        return [line.split('\t')[0] for line in out.splitlines() if '\t' in line]

    def test_default_dry_run_is_audition_only_without_key(self):
        with mock.patch.object(gd, 'request_audio', side_effect=AssertionError('no HTTP')), \
                mock.patch.object(gd.urllib.request, 'build_opener', side_effect=AssertionError('no HTTP')):
            code, out, err = run_main([], self.root)
        self.assertEqual(code, 0, err)
        self.assertEqual(sorted(self.selected_ids(out)), sorted(self.manifest['auditionIds']))
        self.assertEqual(len(self.selected_ids(out)), 6)
        self.assertIn('Dry run: zero network requests', out)
        self.assertIn('Voice settings still needed', out)
        self.assertEqual(audio_files(self.root), [])
        self.assertFalse((self.root / 'public' / 'dialogue' / 'generated.json').exists())
        self.assertFalse((self.root / 'audio-source').exists())

    def test_scope_and_speaker_counts(self):
        code, out, _ = run_main(['--scope', 'all'], self.root)
        self.assertEqual(code, 0)
        self.assertEqual(len(self.selected_ids(out)), 60)
        code, out, _ = run_main(['--scope', 'all', '--speaker', 'unit_h'], self.root)
        self.assertEqual(len(self.selected_ids(out)), 55)
        code, out, _ = run_main(['--scope', 'all', '--speaker', 'system'], self.root)
        self.assertEqual(len(self.selected_ids(out)), 5)

    def test_unknown_ids_rejected(self):
        code, out, err = run_main(['--ids', 'h_arrival,does_not_exist'], self.root)
        self.assertEqual(code, 1)
        self.assertIn('Unknown ID', err)
        self.assertNotIn('\t', out)

    def test_invalid_take_rejected(self):
        code, _, err = run_main(['--take', 'take 01/../x'], self.root)
        self.assertEqual(code, 1)
        self.assertIn('Invalid take name', err)


class BuildRequestTests(unittest.TestCase):
    def setUp(self):
        self.line = json.loads(MANIFEST.read_text(encoding='utf-8'))['lines'][0]

    def test_payload_contains_only_documented_fields(self):
        payload = gd.build_request(self.line, FAKE_ROBOT)
        self.assertEqual(set(payload), {'text', 'voice_id', 'model_name', 'output_format', 'only_audio', 'json_config'})
        self.assertEqual(payload['text'], self.line['text'])
        self.assertEqual(payload['voice_id'], FAKE_ROBOT)
        self.assertEqual(payload['model_name'], 'default')
        self.assertEqual(payload['output_format'], 'wav')
        self.assertIs(payload['only_audio'], True)
        self.assertEqual(payload['json_config'], {'rewrite_rules': 'en'})
        dumped = json.dumps(payload)
        for forbidden in (self.line['direction'], self.line['bodyCue'], self.line['emotion'], FAKE_KEY):
            self.assertNotIn(forbidden, dumped)
        self.assertNotIn('direction', payload)
        self.assertNotIn('emotion', payload)

    def test_fingerprint_stability_and_sensitivity(self):
        payload = gd.build_request(self.line, FAKE_ROBOT)
        base = gd.request_fingerprint(payload, 'take-01')
        self.assertEqual(base, gd.request_fingerprint(gd.build_request(dict(self.line), FAKE_ROBOT), 'take-01'))
        self.assertNotEqual(base, gd.request_fingerprint(payload, 'take-02'))
        self.assertNotEqual(base, gd.request_fingerprint(gd.build_request(self.line, 'other-voice'), 'take-01'))
        changed = dict(self.line, text=self.line['text'] + ' ')
        self.assertNotEqual(base, gd.request_fingerprint(gd.build_request(changed, FAKE_ROBOT), 'take-01'))
        self.assertRegex(base, r'^[0-9a-f]{64}$')


class DotenvTests(unittest.TestCase):
    def write(self, text):
        f = tempfile.NamedTemporaryFile('w', suffix='.env', delete=False, encoding='utf-8')
        f.write(text)
        f.close()
        self.addCleanup(os.unlink, f.name)
        return f.name

    def test_reads_only_three_gradium_vars_quoted_and_export(self):
        path = self.write(
            'export GRADIUM_API_KEY="' + FAKE_KEY + '"\n'
            "GRADIUM_ROBOT_VOICE_ID='" + FAKE_ROBOT + "' # trailing comment\n"
            'GRADIUM_SYSTEM_VOICE_ID=' + FAKE_SYSTEM + '\n'
            'GRADIUM_OTHER=nope\n'
            'OPENAI_API_KEY=should-be-ignored\n'
            'PATH=$(touch /tmp/should-never-run)\n'
            'GRADIUM_EXTRA=`whoami`\n'
            '# GRADIUM_API_KEY=commented\n')
        with mock.patch.dict(os.environ, {}, clear=True):
            values = gd.read_environment(path)
        self.assertEqual(values, FAKE_ENV)

    def test_environment_wins_over_file(self):
        path = self.write('GRADIUM_API_KEY=from-file\nGRADIUM_ROBOT_VOICE_ID=file-voice\n')
        with mock.patch.dict(os.environ, {'GRADIUM_API_KEY': 'from-env'}, clear=True):
            values = gd.read_environment(path)
        self.assertEqual(values['GRADIUM_API_KEY'], 'from-env')
        self.assertEqual(values['GRADIUM_ROBOT_VOICE_ID'], 'file-voice')

    def test_shell_syntax_is_never_executed(self):
        marker = Path(tempfile.gettempdir()) / f'dialogue-dotenv-marker-{os.getpid()}'
        path = self.write(f'GRADIUM_ROBOT_VOICE_ID="$(touch {marker})"\nGRADIUM_SYSTEM_VOICE_ID=`touch,{marker}`\n'
                          f'GRADIUM_API_KEY=$HOME;touch,{marker}\n')
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(gd.subprocess, 'run', side_effect=AssertionError):
            values = gd.read_environment(path)
        self.assertFalse(marker.exists())
        self.assertEqual(values['GRADIUM_ROBOT_VOICE_ID'], f'$(touch {marker})')
        self.assertEqual(values['GRADIUM_SYSTEM_VOICE_ID'], f'`touch,{marker}`')
        self.assertEqual(values['GRADIUM_API_KEY'], f'$HOME;touch,{marker}')

    def test_errors_do_not_leak_values(self):
        root = make_root()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        path = self.write(f'GRADIUM_API_KEY={FAKE_KEY} trailing\n')
        code, out, err = run_main(['--env-file', path], root)
        self.assertEqual(code, 1)
        self.assertNotIn(FAKE_KEY, out + err)
        self.assertIn('Invalid quoted value for GRADIUM_API_KEY', err)
        path = self.write(f'GRADIUM_API_KEY="{FAKE_KEY}\n')  # unbalanced quote -> ValueError
        code, out, err = run_main(['--env-file', path], root)
        self.assertEqual(code, 1)
        self.assertNotIn(FAKE_KEY, out + err)
        code, out, err = run_main(['--env-file', '/nonexistent/dialogue.env'], root)
        self.assertEqual(code, 1)


class ExecutePreflightTests(unittest.TestCase):
    def setUp(self):
        self.root = make_root()
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        patcher = mock.patch.object(gd, 'request_audio', side_effect=AssertionError('request must not happen'))
        self.request = patcher.start()
        self.addCleanup(patcher.stop)
        opener = mock.patch.object(gd.urllib.request, 'build_opener', side_effect=AssertionError('no HTTP'))
        opener.start()
        self.addCleanup(opener.stop)

    def assert_nothing_started(self):
        self.request.assert_not_called()
        self.assertFalse((self.root / 'audio-source' / 'dialogue' / '.generation.lock').exists())
        self.assertEqual(audio_files(self.root), [])
        self.assertFalse((self.root / 'public' / 'dialogue' / 'generated.json').exists())

    def test_missing_key_stops_before_request(self):
        env = dict(FAKE_ENV)
        del env['GRADIUM_API_KEY']
        code, _, err = run_main(['--execute'], self.root, env)
        self.assertEqual(code, 1)
        self.assertIn('GRADIUM_API_KEY', err)
        self.assert_nothing_started()

    def test_missing_robot_voice_stops_before_request(self):
        env = dict(FAKE_ENV, GRADIUM_ROBOT_VOICE_ID='')
        code, _, err = run_main(['--execute'], self.root, env)
        self.assertEqual(code, 1)
        self.assertIn('GRADIUM_ROBOT_VOICE_ID', err)
        self.assertNotIn(FAKE_KEY, err)
        self.assert_nothing_started()

    def test_missing_system_voice_stops_before_request_for_all(self):
        env = dict(FAKE_ENV)
        del env['GRADIUM_SYSTEM_VOICE_ID']
        code, _, err = run_main(['--scope', 'all', '--execute'], self.root, env)
        self.assertEqual(code, 1)
        self.assertIn('GRADIUM_SYSTEM_VOICE_ID', err)
        self.assert_nothing_started()

    def test_voice_equal_to_key_rejected(self):
        env = dict(FAKE_ENV, GRADIUM_ROBOT_VOICE_ID=FAKE_KEY)
        code, _, err = run_main(['--execute'], self.root, env)
        self.assertEqual(code, 1)
        self.assertNotIn(FAKE_KEY, err)
        self.assert_nothing_started()

    def test_missing_ffmpeg_stops_before_request(self):
        with mock.patch.object(gd.shutil, 'which', return_value=None):
            code, _, err = run_main(['--execute'], self.root, FAKE_ENV)
        self.assertEqual(code, 1)
        self.assertIn('ffmpeg', err)
        self.assert_nothing_started()


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def read(self, n=-1):
        return self.data if n < 0 else self.data[:n]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeOpener:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def open(self, request, timeout=None):
        self.calls.append(request)
        if isinstance(self.result, Exception):
            raise self.result
        return FakeResponse(self.result)


class RequestAudioTests(unittest.TestCase):
    def setUp(self):
        self.payload = gd.build_request({'text': 'Can you hear me?'}, FAKE_ROBOT)

    def call(self, result):
        opener = FakeOpener(result)
        with mock.patch.object(gd.urllib.request, 'build_opener', return_value=opener) as build:
            try:
                data = gd.request_audio(self.payload, FAKE_KEY)
                error = None
            except gd.GenerationError as e:
                data, error = None, str(e)
        self.assertEqual(len(opener.calls), 1, 'exactly one attempt, never retried')
        handlers = build.call_args[0]
        self.assertTrue(any(isinstance(h, gd.NoRedirect) for h in handlers))
        return data, error, opener.calls[0]

    def http_error(self, code, body=b'{"error":"BODY-SENTINEL"}'):
        return urllib.error.HTTPError(gd.ENDPOINT, code, 'msg', {}, io.BytesIO(body))

    def test_valid_wav_accepted_and_request_shape(self):
        wav = wav_bytes(0.2)
        data, error, request = self.call(wav)
        self.assertIsNone(error)
        self.assertEqual(data, wav)
        self.assertEqual(request.full_url, gd.ENDPOINT)
        self.assertTrue(request.full_url.startswith('https://'))
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('X-api-key'), FAKE_KEY)
        self.assertEqual(json.loads(request.data.decode('utf-8')), self.payload)
        self.assertNotIn(FAKE_KEY.encode(), request.data)

    def test_non_wav_payload_rejected(self):
        for body in (b'{"detail":"BODY-SENTINEL"}', b'', b'ID3' + b'\0' * 100, b'RIFF' + b'\0' * 100):
            data, error, _ = self.call(body)
            self.assertIsNone(data)
            self.assertIn('did not return WAV', error)
            self.assertNotIn('BODY-SENTINEL', error)

    def test_oversized_response_rejected(self):
        big = b'RIFF' + b'\0' * 4 + b'WAVE' + b'\0' * gd.MAX_RESPONSE_BYTES
        data, error, _ = self.call(big)
        self.assertIsNone(data)
        self.assertIn('size limit', error)

    def test_401_and_429_no_retry_no_echo(self):
        for code in (401, 429, 500):
            data, error, _ = self.call(self.http_error(code))
            self.assertIsNone(data)
            self.assertIn(f'HTTP {code}', error)
            self.assertIn('no automatic retry', error)
            self.assertNotIn('BODY-SENTINEL', error)
            self.assertNotIn(FAKE_KEY, error)

    def test_network_error_no_echo(self):
        data, error, _ = self.call(urllib.error.URLError(f'reason {FAKE_KEY}'))
        self.assertIsNone(data)
        self.assertNotIn(FAKE_KEY, error)
        self.assertIn('network request failed', error)

    def test_redirects_not_followed(self):
        handler = gd.NoRedirect()
        request = gd.urllib.request.Request(gd.ENDPOINT, headers={'x-api-key': FAKE_KEY})
        self.assertIsNone(handler.redirect_request(request, None, 302, 'Found', {}, 'https://evil.example/collect'))
        data, error, _ = self.call(self.http_error(302))
        self.assertIsNone(data)
        self.assertIn('HTTP 302', error)


@unittest.skipUnless(HAVE_FFMPEG, 'ffmpeg/ffprobe required for export tests')
class EndToEndMockSynthesisTests(unittest.TestCase):
    def setUp(self):
        self.root = make_root()
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.calls = []
        self.wav = wav_bytes(0.5)

        def fake_request(payload, api_key):
            self.calls.append((payload, api_key))
            return self.wav

        patcher = mock.patch.object(gd, 'request_audio', side_effect=fake_request)
        patcher.start()
        self.addCleanup(patcher.stop)
        opener = mock.patch.object(gd.urllib.request, 'build_opener', side_effect=AssertionError('no HTTP'))
        opener.start()
        self.addCleanup(opener.stop)
        self.index_path = self.root / 'public' / 'dialogue' / 'generated.json'
        self.manifest_path = self.root / 'public' / 'dialogue' / 'manifest.json'

    def index(self):
        return json.loads(self.index_path.read_text(encoding='utf-8'))

    def run_execute(self, *extra):
        return run_main(['--ids', 'h_arrival', '--execute', *extra], self.root, FAKE_ENV)

    def test_one_cue_generates_valid_files_and_index(self):
        code, out, err = self.run_execute()
        self.assertEqual(code, 0, err)
        self.assertEqual(len(self.calls), 1)
        payload, key = self.calls[0]
        self.assertEqual(key, FAKE_KEY)
        self.assertEqual(payload['voice_id'], FAKE_ROBOT)
        record = self.index()['clips']['h_arrival']
        self.assertEqual(record['reviewStatus'], 'generated_not_auditioned')
        self.assertIs(record['directionApplied'], False)
        self.assertEqual(record['rightsStatus'], 'provider_terms_apply_not_a_cc0_source')
        self.assertEqual(record['take'], 'take-01')
        self.assertEqual(record['requestHash'], gd.request_fingerprint(payload, 'take-01'))
        original = self.root / record['originalPath']
        self.assertTrue(original.is_file())
        self.assertTrue(original.as_posix().startswith((self.root / 'audio-source' / 'dialogue').as_posix()))
        self.assertEqual(original.read_bytes(), self.wav)
        self.assertEqual(record['sourceSha256'], gd.sha256(original))
        for ext in ('ogg', 'mp3'):
            rel = record['files'][ext]
            self.assertRegex(rel, r'^clips/[A-Za-z0-9_-]+\.(ogg|mp3)$')
            path = self.root / 'public' / 'dialogue' / rel
            self.assertTrue(path.is_file())
            self.assertEqual(record['sha256'][ext], gd.sha256(path))
            meta = gd.probe_audio(path)
            self.assertAlmostEqual(meta['durationSeconds'], 0.5, delta=0.2)
        self.assertNotIn(FAKE_KEY, self.index_path.read_text(encoding='utf-8'))
        self.assertNotIn(FAKE_KEY, out + err)
        self.assertFalse((self.root / 'audio-source' / 'dialogue' / '.generation.lock').exists())
        # Original WAV never lands in the public folder.
        self.assertFalse(list((self.root / 'public').rglob('*.wav')))

    def test_rerun_same_request_makes_zero_synthesis_calls(self):
        self.assertEqual(self.run_execute()[0], 0)
        before = audio_files(self.root)
        first = self.index()
        self.assertEqual(self.run_execute()[0], 0)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(audio_files(self.root), before)
        self.assertEqual(self.index(), first)

    def test_changed_text_or_take_creates_new_files_without_overwrite(self):
        self.assertEqual(self.run_execute()[0], 0)
        first = self.index()['clips']['h_arrival']
        first_bytes = {p: (self.root / p).read_bytes() for p in audio_files(self.root)}

        self.assertEqual(self.run_execute('--take', 'take-02')[0], 0)
        second = self.index()['clips']['h_arrival']
        self.assertEqual(len(self.calls), 2)
        self.assertNotEqual(first['requestHash'], second['requestHash'])
        self.assertNotEqual(first['files'], second['files'])

        manifest = json.loads(self.manifest_path.read_text(encoding='utf-8'))
        for line in manifest['lines']:
            if line['id'] == 'h_arrival':
                line['text'] = line['text'] + ' Please.'
        self.manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
        self.assertEqual(self.run_execute()[0], 0)
        third = self.index()['clips']['h_arrival']
        self.assertEqual(len(self.calls), 3)
        self.assertNotIn(third['requestHash'], (first['requestHash'], second['requestHash']))
        self.assertEqual(len({first['files']['ogg'], second['files']['ogg'], third['files']['ogg']}), 3)
        for path, data in first_bytes.items():
            self.assertEqual((self.root / path).read_bytes(), data, f'{path} must not be overwritten')

    def test_missing_export_restored_without_new_request(self):
        self.assertEqual(self.run_execute()[0], 0)
        record = self.index()['clips']['h_arrival']
        ogg = self.root / 'public' / 'dialogue' / record['files']['ogg']
        ogg.unlink()
        self.assertEqual(self.run_execute()[0], 0)
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(ogg.is_file())
        self.assertEqual(self.index()['clips']['h_arrival']['sha256']['ogg'], gd.sha256(ogg))

    def test_error_keeps_earlier_index_entries(self):
        outcomes = [self.wav, gd.GenerationError('Gradium HTTP 429; no automatic retry was made.')]

        def flaky(payload, api_key):
            self.calls.append(payload)
            result = outcomes.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch.object(gd, 'request_audio', side_effect=flaky):
            code, _, err = run_main(['--ids', 'h_arrival,h_probe_warning', '--execute'], self.root, FAKE_ENV)
        self.assertEqual(code, 1)
        self.assertIn('HTTP 429', err)
        self.assertEqual(len(self.calls), 2)
        clips = self.index()['clips']
        self.assertIn('h_arrival', clips)
        self.assertNotIn('h_probe_warning', clips)
        self.assertFalse((self.root / 'audio-source' / 'dialogue' / '.generation.lock').exists())

    def test_existing_lock_refuses_and_is_not_deleted(self):
        lock_dir = self.root / 'audio-source' / 'dialogue'
        lock_dir.mkdir(parents=True)
        lock = lock_dir / '.generation.lock'
        lock.write_text('999999')
        code, _, err = self.run_execute()
        self.assertEqual(code, 1)
        self.assertIn('generation lock', err)
        self.assertEqual(self.calls, [])
        self.assertTrue(lock.exists())
        self.assertEqual(lock.read_text(), '999999')
        self.assertFalse(self.index_path.exists())

    def test_invalid_wav_from_provider_saves_nothing(self):
        with mock.patch.object(gd, 'request_audio', return_value=b'RIFF' + b'\0' * 4 + b'WAVE' + b'\0' * 100):
            code, _, err = self.run_execute()
        self.assertEqual(code, 1)
        self.assertEqual(audio_files(self.root), [])
        self.assertFalse(self.index_path.exists())


if __name__ == '__main__':
    unittest.main()
