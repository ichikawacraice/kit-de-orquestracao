// Entrada compartilhada: o Codex lê AGENTS.md e acessa o mesmo núcleo que o plugin Claude.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sha256 } from './lock.mjs';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRADA = `# Ichikawa's Kit — Claude e Codex

Leia CLAUDE.md inteiro antes de trabalhar: ele contém as regras compartilhadas do projeto.
A configuração continua em .claude/kit.json e o estado em ~/.claude/orquestracao/;
não crie uma fila ou um painel separado para Codex.

No Codex, use o CLI do kit (local: node cli/kit.mjs; outros projetos:
npx -y github:ichikawacraice/kit-de-orquestracao).
- kit contexto: manual de adaptação e catálogo de skills e agentes.
- kit contexto <caminho do catálogo>: lê a instrução original, incluindo referências relativas.
- kit executar <comando> [argumentos]: executa os comandos do plugin sem depender do PATH do Claude.

Na ORCA, use a identidade ORCA_AGENT_SESSION_ID, mensagens e worktrees da IDE.
Leia o manual com kit contexto antes de coordenar trabalho. Use o agente escolhido
pelo operador; modelos Sonnet/Opus/Haiku são exclusivos do Claude. Para Codex,
escolha modelo e esforço disponíveis na ORCA, de acordo com o risco, sem traduzir
nomes de modelos Claude em nomes GPT automaticamente.
Os hooks do plugin Claude não são ativados por este arquivo no Codex. Cumpra
explicitamente as regras de revisão, testes, isolamento, segredos e entrega.
`;
export function planejarEntrada(destino, lock, mudancas, conflito, { recuperando = false } = {}) {
  const rel = 'AGENTS.md';
  const atual = existsSync(join(destino, rel)) ? readFileSync(join(destino, rel), 'utf8') : null;
  if (atual === ENTRADA) {
    if (recuperando) lock.arquivos[rel] = sha256(ENTRADA);
    return;
  }
  // AGENTS preexistente pertence ao projeto; nunca o substitua.
  if (atual !== null && !(rel in lock.arquivos)) return;
  if (atual !== null && sha256(atual) !== lock.arquivos[rel]) { conflito('AGENTS.md editado à mão — não troquei'); return; }
  mudancas.push({ arquivo: rel, antigo: atual, novo: ENTRADA });
  lock.arquivos[rel] = sha256(ENTRADA);
}
export const COMANDOS = ['painel', 'testes-afetados', 'esperar-fundo', 'proximo-item', 'proxima-pergunta', 'subir-versao', 'limpar-disco', 'atualizar-plugins'];
export function executar(comando, args) {
  if (!COMANDOS.includes(comando)) return { codigo: 2, erro: `comando inválido; disponíveis: ${COMANDOS.join(', ')}` };
  const r = spawnSync('bash', [join(raiz, 'plugins/orquestracao/bin', comando), ...args], { stdio: 'inherit' });
  return { codigo: r.status ?? 1, erro: r.error?.message };
}

const bases = ['plugins/orquestracao', 'plugins/processos', 'plugins/kit-performance', 'design-system/plugins/design-system'];
function catalogo() {
  return bases.flatMap((base) => readdirSync(join(raiz, base), { recursive: true })
    .filter((f) => /(?:SKILL|[^/]+)\.md$/.test(f) && !f.includes('evals/'))
    .map((f) => `${base}/${f}`)).sort();
}
export function contexto(arquivo) {
  if (!arquivo) return { codigo: 0, saida: `${readFileSync(join(raiz, 'docs/guia/claude-e-codex.md'), 'utf8')}\nCatálogo (kit contexto <caminho>):\n${catalogo().join('\n')}\n` };
  const rel = relative(raiz, resolve(raiz, arquivo)).split('\\').join('/');
  if (!catalogo().includes(rel)) return { codigo: 2, erro: 'caminho fora do catálogo do kit' };
  return { codigo: 0, saida: readFileSync(join(raiz, rel), 'utf8') };
}
