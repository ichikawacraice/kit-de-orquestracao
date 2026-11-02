// O guia de quem usa o kit (docs/guia/) e o README concordam com o código: todo comando do CLI e suas flags, todo comando
// do bin/, todo hook dos plugins, toda regra da guarda, toda opção de plugin e todo plugin aparecem no guia; todo link
// relativo do guia e do README leva a um arquivo que existe, e a âncora `#x` existe no destino.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, REGRAS_DE_DOCUMENTO } from '../gate/config.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIA = join(RAIZ, 'docs', 'guia');
const ler = (...p) => readFileSync(join(...p), 'utf8');
const paginas = () => readdirSync(GUIA).filter((n) => n.endsWith('.md')).sort();
const pagina = (n) => ler(GUIA, n);
const naoVazia = (nome, lista) => { assert.ok(Array.isArray(lista) && lista.length > 0, `${nome}: a lista lida do código veio vazia`); return lista; };
const faltando = (lista, texto) => lista.filter((x) => !texto.includes(x));

const PLUGINS = readdirSync(join(RAIZ, 'plugins')).filter((n) => existsSync(join(RAIZ, 'plugins', n, '.claude-plugin', 'plugin.json'))).sort();

describe('o guia concorda com o código', () => {
  it('as páginas do guia existem e o índice linka cada uma', () => {
    const lista = naoVazia('páginas do guia', paginas().filter((n) => n !== 'README.md'));
    const indice = pagina('README.md');
    assert.deepEqual(lista.filter((n) => !indice.includes(`](${n}`)), []);
  });

  it('o README aponta para o guia e cita todo plugin do kit', () => {
    const readme = ler(RAIZ, 'README.md');
    assert.ok(readme.includes('](docs/guia/README.md)'), 'o README não linka docs/guia/README.md');
    assert.deepEqual(faltando(naoVazia('plugins', PLUGINS).map((p) => `\`${p}\``), readme), []);
  });

  it('todo plugin está no primeiro dia e em ligar-e-desligar, e o guia não cita plugin do kit que não existe', () => {
    assert.deepEqual(faltando(naoVazia('plugins', PLUGINS).map((p) => `\`${p}\``), pagina('primeiro-dia.md')), []);
    assert.deepEqual(faltando(PLUGINS.map((p) => `## Plugin \`${p}\``), pagina('ligar-e-desligar.md')), []);
    const textos = [ler(RAIZ, 'README.md'), ...paginas().map(pagina)].join('\n');
    const citados = [...textos.matchAll(/Plugin `([\w-]+)`|([\w-]+)@(?:ichikawa-kit|kit-de-orquestracao)/g)].map((m) => m[1] ?? m[2]).filter((n) => n !== '<plugin>');
    naoVazia('plugins citados', citados);
    // o README guarda, de propósito, o nome antigo no aviso de migração
    const legado = new Set(['design']);
    assert.deepEqual([...new Set(citados)].filter((n) => !PLUGINS.includes(n) && !legado.has(n)), []);
  });

  it('todo subcomando e toda flag do CLI estão em comandos.md', () => {
    const r = spawnSync('node', [join(RAIZ, 'cli', 'kit.mjs'), 'ajuda'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, r.stderr);
    const subcomandos = naoVazia('subcomandos', [...new Set([...r.stdout.matchAll(/^\s+kit (\S+)/gm)].map((m) => m[1]))]);
    const flags = naoVazia('flags', [...new Set([...r.stdout.matchAll(/(?<![\w-])(--[a-z][\w-]*)/g)].map((m) => m[1]))]);
    const texto = pagina('comandos.md');
    assert.deepEqual(faltando(subcomandos.map((s) => `| \`kit ${s}\``), texto), [], 'cada subcomando tem a sua linha na tabela');
    const constante = ler(RAIZ, 'cli', 'kit.mjs').match(/const FLAGS = (\{.*\});/)?.[1];
    assert.ok(constante, 'não achei a constante FLAGS em cli/kit.mjs');
    const daConstante = [...new Set([...constante.matchAll(/'(--[\w-]+)'/g)].map((m) => m[1]))];
    assert.deepEqual(faltando(naoVazia('FLAGS', daConstante).map((f) => `| \`${f}`), texto), [], 'cada flag de FLAGS tem a sua linha na tabela');
    assert.deepEqual(flags.filter((f) => !new RegExp(`(?<![\\w-])${f}(?![\\w-])`).test(texto)), []);
  });

  it('todo comando do bin/ está em comandos.md', () => {
    const bin = naoVazia('bin', readdirSync(join(RAIZ, 'plugins', 'orquestracao', 'bin')).sort());
    assert.deepEqual(faltando(bin.map((b) => `\`${b}`), pagina('comandos.md')), []);
  });

  it('todo hook dos plugins está em ligar-e-desligar.md', () => {
    const hooks = [];
    for (const p of PLUGINS) {
      const arq = join(RAIZ, 'plugins', p, 'hooks', 'hooks.json');
      if (!existsSync(arq)) continue;
      for (const m of ler(arq).matchAll(/hooks\/([\w-]+)\.mjs/g)) hooks.push(m[1]);
    }
    const texto = pagina('ligar-e-desligar.md');
    assert.deepEqual(faltando([...new Set(naoVazia('hooks', hooks))].map((h) => `\`${h}\``), texto), []);
  });

  it('toda regra da guarda de operação está em ligar-e-desligar.md', () => {
    const regras = naoVazia('regras da guarda', carregarConfig(RAIZ, { gate: { comandoCompleto: 'x' } }).guarda.regras);
    assert.deepEqual(faltando(regras.map((r) => `\`${r}\``), pagina('ligar-e-desligar.md')), []);
  });

  it('toda regra de documento do gate está em ligar-e-desligar.md', () => {
    assert.deepEqual(faltando(naoVazia('regras de documento', REGRAS_DE_DOCUMENTO).map((r) => `\`${r}\``), pagina('ligar-e-desligar.md')), []);
  });

  it('todo comando de barra citado no guia existe', () => {
    const texto = paginas().map(pagina).join('\n');
    const skills = naoVazia('skills citadas', [...texto.matchAll(/`\/([\w-]+):([\w-]+)`/g)].map((m) => [m[1], m[2]]));
    assert.deepEqual(skills.filter(([p, n]) => !existsSync(join(RAIZ, 'plugins', p, 'skills', n, 'SKILL.md'))).map((x) => x.join(':')), []);
    const ausente = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'ausente', 'SKILL.md');
    assert.ok(existsSync(ausente) && texto.includes('`/ausente on`') && texto.includes('`/ausente off`'), '/ausente fora do guia ou do plugin');
    assert.ok(texto.includes('`/painel`'), '/painel fora do guia');
  });

  it('toda opção de plugin (userConfig) está em ligar-e-desligar.md', () => {
    const opcoes = [];
    for (const p of PLUGINS) opcoes.push(...Object.keys(JSON.parse(ler(RAIZ, 'plugins', p, '.claude-plugin', 'plugin.json')).userConfig ?? {}));
    assert.deepEqual(faltando(naoVazia('opções', opcoes).map((o) => `\`${o}\``), pagina('ligar-e-desligar.md')), []);
  });

  it('todo link relativo do guia e do README leva a arquivo e âncora que existem', () => {
    const arquivos = [join(RAIZ, 'README.md'), ...paginas().map((n) => join(GUIA, n))];
    const quebrados = [];
    let conferidos = 0;
    for (const arq of arquivos) {
      const texto = ler(arq).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
      for (const [, alvo] of texto.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/i.test(alvo)) continue;
        conferidos++;
        const [caminho, ancora] = alvo.split('#');
        const destino = caminho ? join(dirname(arq), caminho) : arq;
        if (!existsSync(destino)) { quebrados.push(`${relative(RAIZ, arq)} → ${alvo} (arquivo)`); continue; }
        if (!ancora) continue;
        const d = ler(destino);
        const slugs = [...d.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-'));
        if (!d.includes(`<a id="${ancora}">`) && !slugs.includes(ancora)) quebrados.push(`${relative(RAIZ, arq)} → ${alvo} (âncora)`);
      }
    }
    assert.ok(conferidos > 10, `poucos links conferidos (${conferidos}): a leitura falhou`);
    assert.deepEqual(quebrados, []);
  });
});
