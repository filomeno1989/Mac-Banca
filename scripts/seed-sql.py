#!/usr/bin/env python3
"""Seed limpo via SQL API do Supabase (não precisa de ligação Postgres direta).
Cria: utilizadores (patrao/1234, funcionario/1111, admin IT/1989) + definições Mac Banca."""
import hashlib
import json
import os
import sys
import urllib.request
import urllib.error

REF = os.environ['SUPABASE_REF']
TOKEN = os.environ['SUPABASE_TOKEN']
URL = f'https://api.supabase.com/v1/projects/{REF}/database/query'


def hash_pin(pin: str) -> str:
    salt = os.urandom(8).hex()
    h = hashlib.scrypt(pin.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=32).hex()
    return f'{salt}:{h}'


def esc(s: str) -> str:
    return s.replace("'", "''")


users = [
    ('Patrão', 'patrao', '1234', 'PATRAO'),
    ('Funcionário', 'funcionario', '1111', 'FUNCIONARIO'),
    ('Admin IT', 'admin', '1989', 'IT'),
]

parts = []
for name, username, pin, role in users:
    parts.append(
        f"INSERT INTO \"User\" (name, username, pin, role) VALUES ('{esc(name)}', '{username}', '{hash_pin(pin)}', '{role}');"
    )
parts.append(
    "INSERT INTO \"Setting\" (id, \"businessName\", currency, \"openingCash\", \"maintenanceMode\", \"updatedAt\") "
    "VALUES ('main', 'Mac Banca', 'MT', 0, false, now()) ON CONFLICT (id) DO UPDATE SET \"businessName\" = 'Mac Banca';"
)
sql = '\n'.join(parts)

req = urllib.request.Request(
    URL,
    data=json.dumps({'query': sql}).encode(),
    headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
    method='POST',
)
try:
    r = urllib.request.urlopen(req, timeout=60)
    print('Seed OK, HTTP', r.status)
except urllib.error.HTTPError as e:
    print('ERRO', e.code, e.read().decode()[:400])
    sys.exit(1)

# verificação
req = urllib.request.Request(
    URL,
    data=json.dumps({'query': 'SELECT username, role FROM "User" ORDER BY id;'}).encode(),
    headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
    method='POST',
)
print(urllib.request.urlopen(req, timeout=30).read().decode())
