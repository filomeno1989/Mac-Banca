#!/bin/bash
# Smoke test — Mac Banca (manutenção, IT, sync offline, idempotência)
BASE=http://localhost:3100
J=/tmp/banca-jar
JIT=/tmp/banca-jar-it
PASS=0; FAIL=0
ck() { # ck <desc> <esperado> <obtido>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✅ $1"; else FAIL=$((FAIL+1)); echo "❌ $1 (esperado $2, obtido $3)"; fi
}
jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1" 2>/dev/null; }

rm -f $J $JIT $J-f

echo "── Login ──"
PID_PATRAO=$(curl -s $BASE/api/auth/login | python3 -c "import sys,json;print([u['id'] for u in json.load(sys.stdin)['users'] if u['role']=='PATRAO'][0])")
PID_FUNC=$(curl -s $BASE/api/auth/login | python3 -c "import sys,json;print([u['id'] for u in json.load(sys.stdin)['users'] if u['role']=='FUNCIONARIO'][0])")
R=$(curl -s -c $J -b $J -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"userId\":$PID_PATRAO,\"pin\":\"1234\"}")
ck "login patrão" "PATRAO" "$(echo "$R" | jqget "['user']['role']")"
R=$(curl -s -c $JIT -b $JIT -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","pin":"1989"}')
ck "login IT oculto (admin/1989)" "IT" "$(echo "$R" | jqget "['user']['role']")"
R=$(curl -s -b $JIT -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","pin":"0000"}' -o /dev/null -w "%{http_code}")
ck "IT com PIN errado → 400" "400" "$R"

echo "── IT invisível no login público ──"
R=$(curl -s $BASE/api/auth/login)
ck "lista de login não contém IT" "0" "$(echo "$R" | python3 -c "import sys,json;print(sum(1 for u in json.load(sys.stdin)['users'] if u['role']=='IT'))")"

echo "── Modo manutenção (ativado pelo IT) ──"
R=$(curl -s -b $JIT -X PATCH $BASE/api/settings -H 'Content-Type: application/json' -d '{"maintenanceMode":true,"maintenanceMessage":"Atualização programada"}')
ck "IT ativa manutenção" "True" "$(echo "$R" | jqget "['settings']['maintenanceMode']")"
R=$(curl -s -b $J -X POST $BASE/api/sales -H 'Content-Type: application/json' -d '{"items":[{"productId":1,"qty":1}],"payment":"DINHEIRO"}' -o /dev/null -w "%{http_code}")
ck "patrão bloqueado em manutenção (503)" "503" "$R"
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"userId\":$PID_FUNC,\"pin\":\"1111\"}" -o /dev/null -w "%{http_code}")
ck "funcionário não consegue entrar (503)" "503" "$R"
R=$(curl -s -b $J -X PATCH $BASE/api/settings -H 'Content-Type: application/json' -d '{"maintenanceMode":false}' -o /dev/null -w "%{http_code}")
ck "patrão NÃO pode mexer em manutenção (403)" "403" "$R"

echo "── IT opera durante a manutenção ──"
R=$(curl -s -b $JIT -X POST $BASE/api/products -H 'Content-Type: application/json' -d '{"name":"Óleo 1L teste","salePrice":125,"costPrice":105,"stock":10,"minStock":5}')
ck "IT cria produto em manutenção" "Óleo 1L teste" "$(echo "$R" | jqget "['product']['name']")"
PID=$(echo "$R" | jqget "['product']['id']")
R=$(curl -s -b $JIT -X POST $BASE/api/sales -H 'Content-Type: application/json' -d "{\"items\":[{\"productId\":$PID,\"qty\":2}],\"payment\":\"DINHEIRO\",\"received\":300}")
ck "IT faz venda em manutenção" "250" "$(echo "$R" | jqget "['sale']['total']")"
R=$(curl -s -b $JIT -X PATCH $BASE/api/settings -H 'Content-Type: application/json' -d '{"maintenanceMode":false}')
ck "IT desativa manutenção" "False" "$(echo "$R" | jqget "['settings']['maintenanceMode']")"

echo "── Sync offline (patrão) ──"
ONTEM=$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S.000Z)
R=$(curl -s -b $J -X POST $BASE/api/sales/sync -H 'Content-Type: application/json' -d "{\"sales\":[{\"clientRef\":\"OFF-t1\",\"clientDate\":\"$ONTEM\",\"items\":[{\"productId\":$PID,\"qty\":1}],\"payment\":\"MPESA\"},{\"clientRef\":\"OFF-t2\",\"clientDate\":\"$ONTEM\",\"items\":[{\"productId\":$PID,\"qty\":99}],\"payment\":\"DINHEIRO\"}]}")
ck "venda 1 sincronizada" "True" "$(echo "$R" | jqget "['results'][0]['ok']")"
ck "venda 2 (stock 99>10) sincronizada com stock negativo" "True" "$(echo "$R" | jqget "['results'][1]['ok']")"
R=$(curl -s -b $J -X POST $BASE/api/sales/sync -H 'Content-Type: application/json' -d "{\"sales\":[{\"clientRef\":\"OFF-t1\",\"items\":[{\"productId\":$PID,\"qty\":1}],\"payment\":\"MPESA\"}]}")
ck "reenvio de OFF-t1 é duplicado (idempotência)" "True" "$(echo "$R" | jqget "['results'][0]['duplicate']")"

echo "── Movimento de stock offline ──"
R=$(curl -s -b $J -X POST $BASE/api/stock/movements -H 'Content-Type: application/json' -d "{\"clientRef\":\"OFF-m1\",\"productId\":$PID,\"type\":\"ENTRADA\",\"qty\":5,\"reason\":\"Compra teste\",\"clientDate\":\"$ONTEM\"}")
ck "entrada offline gravada" "201" "$(curl -s -b $J -X POST $BASE/api/stock/movements -H 'Content-Type: application/json' -d "{\"clientRef\":\"OFF-m2\",\"productId\":$PID,\"type\":\"ENTRADA\",\"qty\":5}" -o /dev/null -w "%{http_code}")"
R=$(curl -s -b $J -X POST $BASE/api/stock/movements -H 'Content-Type: application/json' -d "{\"clientRef\":\"OFF-m2\",\"productId\":$PID,\"type\":\"ENTRADA\",\"qty\":5}")
ck "reenvio OFF-m2 duplicado" "True" "$(echo "$R" | jqget "['duplicate']")"

echo "── Stock final esperado: 10 -2 (IT) -1 (t1) -99 (t2) +5 (m1) +5 (m2) = -82 ──"
R=$(curl -s -b $J "$BASE/api/products?all=1")
ck "stock calculado corretamente" "-82" "$(echo "$R" | python3 -c "import sys,json;print([p['stock'] for p in json.load(sys.stdin)['products'] if p['name']=='Óleo 1L teste'][0])")"

echo ""
echo "RESULTADO: $PASS passaram, $FAIL falharam"
