// F347: o medidor do piso da sessão separa a 1ª requisição por fonte e a soma bate com o que a 1ª chamada pagou. Transcript
// sintético em pasta temporária; nada lê ~/.claude.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agregar, fatiar, grupoDaFerramenta, pisoDoTranscript } from '../scripts/piso-da-sessao.mjs';

const GLOBAL = 'Contents of /Users/x/.claude/CLAUDE.md (user\'s private global instructions for all projects):\n' + 'g'.repeat(400);
const PROJETO = '\nContents of /p/CLAUDE.md (project instructions, checked into the codebase):\n' + 'p'.repeat(800);
const SKILLS = 'The following skills are available for use with the Skill tool:\n' + 's'.repeat(1200);

function transcript(dir, nome, piso) {
  const linhas = [
    { type: 'api-request-shape', shape: { system: [{ type: 'text', text: 'x'.repeat(1000) }], tools: [{ name: 'Bash', d: 'b'.repeat(300) }, { name: 'mcp__figma__use', d: 'f'.repeat(500) }] } },
    { type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text: `<system-reminder>\n${GLOBAL}${PROJETO}\n</system-reminder>` }, { type: 'text', text: 'pedido da tarefa' }] } },
    { type: 'api-request-blob', message: { role: 'system', content: [{ type: 'text', text: SKILLS }] } },
    { type: 'assistant', message: { usage: { input_tokens: 2, cache_creation_input_tokens: piso - 2, cache_read_input_tokens: 0 } } },
    { type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text: 'depois da 1ª resposta: não é piso' }] } },
  ];
  const f = join(dir, nome);
  writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return f;
}

describe('piso da sessão', () => {
  it('fatia as mensagens pelos marcadores e fecha a fonte no fim do system-reminder', () => {
    const f = fatiar(`<system-reminder>\n${GLOBAL}${PROJETO}\n</system-reminder>\nresto`);
    assert.ok(f['claude-md-global'] > 400 && f['claude-md-projeto'] > 800, JSON.stringify(f));
    assert.ok(f['claude-md-projeto'] < 900, 'o resto depois do </system-reminder> entrou no CLAUDE.md do projeto');
    assert.ok(f.outros > 0);
  });

  it('agrupa ferramenta por servidor MCP', () => {
    assert.equal(grupoDaFerramenta('mcp__Claude_Browser__computer'), 'ferramentas:mcp:Claude_Browser');
    assert.equal(grupoDaFerramenta('Artifact'), 'ferramentas:Artifact');
    assert.equal(grupoDaFerramenta('Bash'), 'ferramentas:nativas');
  });

  it('as fontes somam o piso medido, e o que vem depois da 1ª resposta não entra', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'piso-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const r = pisoDoTranscript(transcript(dir, 'a.jsonl', 10000));
    assert.ok(r, 'precondição: o transcript foi lido');
    assert.equal(r.piso, 10000);
    const soma = Object.values(r.fontes).reduce((s, n) => s + n, 0);
    assert.ok(Math.abs(soma - 10000) <= Object.keys(r.fontes).length, `soma ${soma}`);
    for (const f of ['system-prompt', 'ferramentas:nativas', 'ferramentas:mcp:figma', 'claude-md-global', 'claude-md-projeto', 'skills']) assert.ok(r.fontes[f] > 0, `sem ${f}`);
    assert.ok(r.fontes.skills > r.fontes['claude-md-projeto'], 'a proporção por tamanho se perdeu');
  });

  it('agrega por tipo (principal × subagente) com a mediana', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'piso-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    mkdirSync(join(dir, 'subagents'));
    const fs = [transcript(dir, 'a.jsonl', 9000), transcript(dir, 'b.jsonl', 11000), transcript(dir, 'c.jsonl', 30000), transcript(join(dir, 'subagents'), 's.jsonl', 4000)];
    writeFileSync(join(dir, 'sem-forma.jsonl'), JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 5 } } }) + '\n');
    const r = agregar([...fs, join(dir, 'sem-forma.jsonl')]);
    assert.equal(r.principal.sessoes, 3);
    assert.equal(r.principal.piso, 11000);
    assert.equal(r.subagente.sessoes, 1);
    assert.equal(r.subagente.piso, 4000);
  });
});
