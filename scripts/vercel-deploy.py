#!/usr/bin/env python3
"""Deploy do Mac Banca para a Vercel via API REST (funciona com token de team).
Uso: python3 scripts/vercel-deploy.py [--skip-env]
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = '/home/z/my-project'
TEAM = os.environ['VERCEL_TEAM']
TOKEN = os.environ['VERCEL_TOKEN']
PROJECT = 'mac-banca'
API = f'https://api.vercel.com'

PROJECT_DB_URL = os.environ['VERCEL_DATABASE_URL']
PROJECT_DIRECT_URL = os.environ['VERCEL_DIRECT_URL']


def api(method: str, path: str, body: dict | None = None, raw: bytes | None = None,
        content_type: str | None = None, timeout: int = 120):
    url = f'{API}{path}{"&" if "?" in path else "?"}teamId={TEAM}'
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {TOKEN}')
    if data is not None:
        req.add_header('Content-Type', content_type or 'application/json')
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        text = r.read().decode()
        return r.status, (json.loads(text) if text and not raw else text)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body[:600]


def collect_files():
    """Ficheiros do projeto para o deploy (sem node_modules/.next/db/env)."""
    include_dirs = ['src', 'public', 'prisma', 'scripts']
    include_root = ['package.json', 'bun.lock', 'tsconfig.json', 'next.config.ts',
                    'tailwind.config.ts', 'postcss.config.mjs', 'vercel.json']
    scripts_only = {'pick-schema.js', 'seed.ts'}  # só o necessário de scripts/
    files = []
    for d in include_dirs:
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, d)):
            dirnames[:] = [x for x in dirnames if x not in ('node_modules', '.next', '__pycache__')]
            if d == 'scripts':
                filenames = [f for f in filenames if f in scripts_only]
            for f in filenames:
                p = os.path.join(dirpath, f)
                rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
                files.append((rel, p))
    for f in include_root:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            files.append((f, p))
    return files


def sha1(path: str) -> str:
    h = hashlib.sha1()
    with open(path, 'rb') as fh:
        h.update(fh.read())
    return h.hexdigest()


def set_env():
    print('── A configurar variáveis de ambiente ──')
    for key, value in [('DATABASE_URL', PROJECT_DB_URL), ('DIRECT_URL', PROJECT_DIRECT_URL)]:
        code, res = api('POST', f'/v10/projects/{PROJECT}/env',
                        {'key': key, 'value': value, 'type': 'encrypted',
                         'target': ['production', 'preview']})
        print(f'  {key}: HTTP {code}', ('ok' if code in (200, 201) else res))


def patch_project():
    print('── A configurar projeto (framework Next.js, região fra1) ──')
    code, res = api('PATCH', f'/v9/projects/{PROJECT}',
                    {'framework': 'nextjs', 'serverlessFunctionRegion': 'fra1'})
    print(f'  HTTP {code}', ('ok' if code == 200 else res))


def deploy():
    print('── A preparar ficheiros ──')
    files = collect_files()
    print(f'  {len(files)} ficheiros')
    meta = [{'file': rel, 'sha': sha1(p), 'size': os.path.getsize(p)} for rel, p in files]
    by_rel = {rel: p for rel, p in files}

    print('── A criar deployment ──')
    meta_payload = {
        'name': PROJECT,
        'target': 'production',
        'files': meta,
        'projectSettings': {
            'framework': 'nextjs',
            'buildCommand': None,
            'installCommand': None,
            'devCommand': None,
            'outputDirectory': None,
        },
    }
    code, res = api('POST', '/v13/deployments', meta_payload)
    print(f'  [debug] POST#1 → HTTP {code}, tipo={type(res).__name__}')

    # Fluxo deploybysum: 400 missing_files → upload por sha → retry
    if code == 400 and isinstance(res, dict) and res.get('error', {}).get('code') == 'missing_files':
        missing_shas = set(res.get('error', {}).get('missing') or [])
        print(f'  uploads em falta: {len(missing_shas)}')
        for rel, p in files:
            sh = sha1(p)
            if sh not in missing_shas:
                continue
            data = open(p, 'rb').read()
            up = urllib.request.Request(
                f'{API}/v2/files?teamId={TEAM}',
                data=data, method='POST')
            up.add_header('Authorization', f'Bearer {TOKEN}')
            up.add_header('Content-Type', 'application/octet-stream')
            up.add_header('x-now-digest', sh)
            up.add_header('x-now-size', str(len(data)))
            try:
                urllib.request.urlopen(up, timeout=120).read()
            except urllib.error.HTTPError as e:
                print('  ! falhou upload', rel, e.code, e.read()[:200])
                sys.exit(1)
            print(f'  ↑ {rel} ({len(data)//1024} KB)')
        code, res = api('POST', '/v13/deployments', meta_payload)
        print(f'  [debug] POST#2 → HTTP {code}, tipo={type(res).__name__}')

    if code not in (200, 201):
        print('ERRO ao criar deployment:', code, str(res)[:500])
        sys.exit(1)
    dep = res if isinstance(res, dict) else {}
    did = dep.get('id') or dep.get('deploymentId')
    print(f'  deployment: {did}')

    print('── A aguardar build (pode demorar 2-4 min) ──')
    for i in range(90):
        time.sleep(8)
        code, res = api('GET', f'/v13/deployments/{did}')
        if code != 200:
            print('  estado:', code, str(res)[:200]); continue
        st = res.get('readyState') or res.get('status')
        url = res.get('url')
        print(f'  [{i*8}s] {st} {url or ""}')
        if st == 'READY':
            print('✅ Deploy pronto:', f'https://{url}')
            return f'https://{url}'
        if st in ('ERROR', 'CANCELED'):
            print('❌ Deployment falhou')
            # logs de build
            code2, logs = api('GET', f'/v4/deployments/{did}/events?limit=40&builds=1')
            print(str(logs)[:3000])
            sys.exit(2)
    print('⏱ timeout à espera do build')
    sys.exit(3)


if __name__ == '__main__':
    if '--skip-env' not in sys.argv:
        patch_project()
        set_env()
    deploy()
