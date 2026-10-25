#!/bin/bash
# Ensaio completo da K8 num HOME de mentira (fora do /tmp): copia o que a K8 mexe, migra, verifica, restaura e compara com diff -r.
# Não toca o ~/.claude real (o skills-manager real só recebe `undeploy --dry-run`).
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REAL_HOME="$HOME"
E="${K8_ENSAIO:-$HOME/k8-ensaio}"; H="$E/home"
rm -rf "$E"; mkdir -p "$H/.claude/skills" "$H/.claude/orquestracao"
for f in settings.json CLAUDE.md hooks agents mods; do cp -R "$HOME/.claude/$f" "$H/.claude/"; done
for s in ausente papeis-e-modelos handoff-de-sessao notas-de-release orquestradora orquestrar-com-subagentes; do cp -R "$HOME/.claude/skills/$s" "$H/.claude/skills/"; done
cp -R "$HOME/.claude/orquestracao/pool" "$HOME/.claude/orquestracao/painel" "$H/.claude/orquestracao/"
cp "$HOME/.claude/orquestracao/contador-de-perguntas" "$H/.claude/orquestracao/" 2>/dev/null || true
export KIT_HOME_REAL="$REAL_HOME" HOME="$H" CLAUDE_CONFIG_DIR="$H/.claude"
cp -R "$H/.claude" "$E/antes"   # o estado de antes da migração, para o diff -r da restauração
echo "== migrar"; node "$KIT/scripts/k8/migrar.mjs" --home "$H" --fonte "$KIT" --ensaio
BK="$(ls -d "$H/.claude/orquestracao/backups/K8-"* | tail -1)"
echo "== projeto adotado para o doutor"; P="$E/projeto"; mkdir -p "$P"; git -C "$P" init -q; git -C "$P" config user.email t@k.local; git -C "$P" config user.name t
printf '# projeto\n' > "$P/CLAUDE.md"; echo '{"name":"p","version":"1.0.0","scripts":{"test":"node -e 1"}}' > "$P/package.json"; git -C "$P" add -A; git -C "$P" commit -qm base
(cd "$P" && node "$KIT/cli/kit.mjs" adotar --trocar-test >/dev/null)
echo "== verificar"; node "$KIT/scripts/k8/verificar.mjs" --home "$H" --projeto "$P" --backup "$BK" || VERIF=$?
echo "== restaurar"; node "$KIT/scripts/k8/migrar.mjs" --home "$H" --restaurar "$BK" --ensaio
echo "== diff -r (antes × depois da restauração; sem plugins/backups/cache)"
diff -r "$E/antes" "$H/.claude" -x backups -x plugins -x cache -x .DS_Store -x .claude.json && echo "diff -r: idêntico"
for s in orquestradora handoff-de-sessao notas-de-release orquestrar-com-subagentes; do [ "$(readlink "$H/.claude/skills/$s")" = "$(readlink "$E/antes/skills/$s")" ] && [ -L "$H/.claude/skills/$s" ] && echo "link $s: restaurado como link para $(readlink "$H/.claude/skills/$s")"; done
echo "verificar exit=${VERIF:-0}"
