#!/bin/bash
# Devolve o próximo ID de pergunta/decisão ao operador (Q1, Q2, …), único entre
# TODAS as sessões e projetos desta máquina. Trava por mkdir (atômico), com prazo.
set -euo pipefail
dir="$HOME/.claude/orquestracao"; cont="$dir/contador-de-perguntas"; trava="$dir/.trava-perguntas"
mkdir -p "$dir"
for _ in $(seq 1 50); do mkdir "$trava" 2>/dev/null && break; sleep 0.1; done
[ -d "$trava" ] || { echo "não consegui a trava do contador ($trava)" >&2; exit 1; }
trap 'rmdir "$trava" 2>/dev/null || true' EXIT
n=$(( $(cat "$cont" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$cont"
echo "Q$n"
