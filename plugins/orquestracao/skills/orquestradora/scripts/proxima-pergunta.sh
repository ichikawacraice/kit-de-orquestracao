#!/bin/bash
# Devolve o próximo ID de pergunta/decisão ao operador (Q1, Q2, …), único entre
# TODAS as sessões e projetos desta máquina. Trava por mkdir (atômico), com prazo.
set -euo pipefail
# F433: sem argumentos; qualquer um (inclusive --help) é recusado ANTES de gastar um ID.
case "${1:-}" in
  '') ;;
  --help|-h) echo "uso: proxima-pergunta (sem argumentos; devolve o próximo ID Q<n>)"; exit 0 ;;
  *) echo "argumento desconhecido: $1" >&2; echo "uso: proxima-pergunta (sem argumentos; devolve o próximo ID Q<n>)" >&2; exit 1 ;;
esac
dir="$HOME/.claude/orquestracao"; cont="$dir/contador-de-perguntas"; trava="$dir/.trava-perguntas"
mkdir -p "$dir"
for _ in $(seq 1 50); do mkdir "$trava" 2>/dev/null && break; sleep 0.1; done
[ -d "$trava" ] || { echo "não consegui a trava do contador ($trava)" >&2; exit 1; }
trap 'rmdir "$trava" 2>/dev/null || true' EXIT
n=$(( $(cat "$cont" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$cont"
echo "Q$n"
