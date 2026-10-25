#!/bin/bash
# Devolve o próximo ID de item da fila do pool (F1, F2, …), único entre TODAS as sessões desta máquina.
# Trava por mkdir (atômico), com prazo. Molde: proxima-pergunta.sh.
# O próximo é sempre DEPOIS do maior entre o contador (quando numérico) e o maior F<n> que já exista na coleção `fila` do
# painel (painel/fila/F<n>.json) ou entre os itens antigos (pool/itens/F<n>.md).
set -euo pipefail
dir="$HOME/.claude/orquestracao"; cont="$dir/pool/contador-de-itens"; trava="$dir/pool/.trava-itens"
mkdir -p "$dir/pool"
# A trava nasce COMPLETA (como no painel.mjs): diretório temporário com o `dono` dentro, que entra por rename — no APFS o
# rename sobre diretório VAZIO o substitui, então a trava nunca existe vazia para ser engolida. O rename é feito por node
# (`mv` de diretório sobre diretório existente o põe DENTRO dele). Trava existente = ocupada. Órfã = mais de 30 s E o dono
# morto (pid do token sem processo) ou sem token legível; dono vivo nunca é tomado. Só UM roubador por vez remove a órfã:
# quem quer roubar publica antes `$trava.roubo` (a mesma publicação completa, com dono); com o roubo na mão, julga e remove.
# Só dois caminhos removem a trava (o dono ao soltar a própria, e o roubador, que é um só), então não há devolução. Soltar é
# RENOMEAR a trava para um nome único e só então apagá-la: apagar o `dono` primeiro deixaria a trava vazia por um instante,
# e outro processo publicaria por cima. O roubo é órfão quando o pid do dono está morto (qualquer idade) ou quando não tem
# dono legível há mais de 60 s; quem o acha o renomeia para um nome único, relê o dono e só apaga se ainda for o julgado (ou
# se o dono dele também estiver morto); se estiver vivo, devolve. Risco residual: um roubador morto vem ANTES e três
# processos entram juntos na limpeza do roubo órfão, e o terceiro troca o roubo entre o rename e a releitura do segundo; o
# laço de tentativas absorve o caso. O trap solta a trava e o roubo só se o dono ainda é o meu token.
token="$$-$RANDOM-$RANDOM"
pegou=0; roubando=0
roubo="$trava.roubo"
tentativas="${PROXIMO_ITEM_TENTATIVAS:-50}"
renomear() { node -e 'try{require("fs").renameSync(process.argv[1],process.argv[2])}catch(e){process.exit(1)}' "$1" "$2"; }
dono_de() { cat "$1/dono" 2>/dev/null | tr -d '[:space:]' || true; }
pid_vivo() { case "${1%%-*}" in ''|*[!0-9]*) return 1 ;; esac; kill -0 "${1%%-*}" 2>/dev/null; }
mtime_de() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo ""; }
eh_orfa() { # $1 = diretório da trava
  local mt; mt=$(mtime_de "$1")
  case "$mt" in ''|*[!0-9]*) return 1 ;; esac
  [ $(( $(date +%s) - mt )) -gt 30 ] || return 1
  pid_vivo "$(dono_de "$1")" && return 1
  return 0
}
# Gancho só de teste: dorme N segundos; valor que não é número (dígitos e ponto) é ignorado.
pausa() { case "$1" in ''|*[!0-9.]*) return 0 ;; esac; sleep "$1"; }
# Publica $1 COMPLETO (temporário com o dono dentro, rename). Falso = já estava ocupado.
publicar() {
  local novo; novo=$(mktemp -d "$1.novo.XXXXXX")
  echo "$token" > "$novo/dono"
  if [ ! -e "$1" ] && renomear "$novo" "$1"; then return 0; fi
  rm -rf "$novo"; return 1
}
# Soltura sem janela: renomeia o diretório (se o dono ainda sou eu) para um nome único e só então o apaga. $2 = gancho de teste.
soltar_dir() {
  [ "$(dono_de "$1")" = "$token" ] || return 0
  pausa "${2:-}"
  local d="$1.solta.$$.$RANDOM"
  if mv "$1" "$d" 2>/dev/null; then rm -rf "$d" || echo "não consegui apagar $d" >&2; fi
  return 0
}
soltar() {
  if [ "$roubando" = 1 ]; then roubando=0; soltar_dir "$roubo"; fi
  if [ "$pegou" = 1 ]; then pegou=0; soltar_dir "$trava" "${PROXIMO_ITEM_PAUSA_SOLTAR:-}"; fi
  return 0
}
trap soltar EXIT
roubo_orfao() {
  local d mr; d=$(dono_de "$roubo")
  if [ -n "$d" ]; then pid_vivo "$d" && return 1; return 0; fi
  mr=$(mtime_de "$roubo")
  case "$mr" in ''|*[!0-9]*) return 1 ;; esac
  [ $(( $(date +%s) - mr )) -gt 60 ]
}
limpar_roubo_orfao() {
  local julgado achado destino; julgado=$(dono_de "$roubo")
  destino="$roubo.orfa.$$.$RANDOM"
  mv "$roubo" "$destino" 2>/dev/null || return 0
  achado=$(dono_de "$destino")
  if [ "$achado" = "$julgado" ] || ! pid_vivo "$achado"; then rm -rf "$destino"; return 0; fi
  renomear "$destino" "$roubo" 2>/dev/null || echo "roubo de dono vivo ficou em $destino" >&2
  return 0
}
for _ in $(seq 1 "$tentativas"); do
  if publicar "$trava"; then pegou=1; break; fi
  if eh_orfa "$trava"; then
    if publicar "$roubo"; then
      roubando=1
      if eh_orfa "$trava"; then # julga de novo, com o roubo na mão
        pausa "${PROXIMO_ITEM_PAUSA_ROUBO:-}"
        velha="$trava.orfa.$$.$RANDOM"
        if mv "$trava" "$velha" 2>/dev/null; then
          echo "trava órfã (mais de 30 s, dono morto) removida: $trava" >&2; rm -rf "$velha"
        fi
      fi
      roubando=0; soltar_dir "$roubo"
      continue
    fi
    if roubo_orfao; then limpar_roubo_orfao; fi
  fi
  sleep 0.1
done
# O molde conferia `[ -d "$trava" ]`, que é verdadeiro também quando a trava é de OUTRO e o prazo estourou.
[ "$pegou" = 1 ] || { echo "não consegui a trava do contador ($trava)" >&2; exit 1; }
# Só para teste: segura a trava por N segundos.
pausa "${PROXIMO_ITEM_PAUSA:-}"

maior=0
lido=""
[ -f "$cont" ] && lido=$(tr -d '[:space:]' < "$cont" || true)
# Contador vazio ou não numérico vale como ausente: recalcula pelos itens existentes.
case "$lido" in ''|*[!0-9]*) lido="" ;; esac
[ -n "$lido" ] && maior=$lido
# O maior F<n> existente vale SEMPRE (item criado à mão com o contador atrasado não pode ser reaproveitado).
for f in "$dir"/painel/fila/F*.json "$dir"/pool/itens/F*.md; do
  [ -e "$f" ] || continue
  b=$(basename "$f"); b=${b#F}; b=${b%%.*}
  case "$b" in ''|*[!0-9]*) continue ;; esac
  [ "$b" -gt "$maior" ] && maior=$b
done
n=$(( maior + 1 ))
echo "$n" > "$cont.$$.tmp" && mv "$cont.$$.tmp" "$cont"
echo "F$n"
