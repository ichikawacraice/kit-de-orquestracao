// As skills de fora no `kit doutor` (F333, ADR 0014): o que ter (dependência do catálogo) e o que desligar (plugin de fora
// com skill que o kit barra). Só lê: instalar e desligar é a pessoa quem decide, com o comando que a linha traz.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETPLACE } from './pacote.mjs';

const CATALOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'orquestracao', 'skills-de-fora.json');
const lerJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };

/**
 * Os plugins da máquina, por nome: os do CLI (`installed_plugins.json`) e os que a conta do app baixa (o manifesto `rpm`
 * mais recente em `local-agent-mode-sessions`, caminho não documentado do app). → Map nome → [{ origem: 'cli'|'app', id }].
 * Os do marketplace do kit ficam de fora: o `design` do kit não é o `design` da Anthropic (o nome repetido é o F332).
 */
export function pluginsPresentes(home) {
  const presentes = new Map();
  const por = (nome, entrada) => { if (!presentes.has(nome)) presentes.set(nome, []); presentes.get(nome).push(entrada); };
  for (const id of Object.keys(lerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins ?? {})) {
    if (!id.endsWith(`@${MARKETPLACE}`)) por(id.split('@')[0], { origem: 'cli', id });
  }
  const sessoes = join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  let maisRecente = null;
  try {
    for (const a of readdirSync(sessoes)) for (const b of readdirSync(join(sessoes, a))) {
      const m = join(sessoes, a, b, 'rpm', 'manifest.json');
      if (!existsSync(m)) continue;
      const quando = statSync(m).mtimeMs;
      if (!maisRecente || quando > maisRecente.quando) maisRecente = { m, quando };
    }
  } catch { /* sem o app, ou pasta que não é de sessão */ }
  if (maisRecente) {
    for (const p of lerJson(maisRecente.m)?.plugins ?? []) {
      const nome = lerJson(join(dirname(maisRecente.m), String(p.id), '.claude-plugin', 'plugin.json'))?.name;
      if (typeof nome === 'string') por(nome, { origem: 'app', id: nome });
    }
  }
  return presentes;
}

/** As linhas do doutor (`ok:`, `falha:`, `aviso:`) e quantas falhas. */
export function conferirSkillsDeFora({ home, catalogo = lerJson(CATALOGO) }) {
  const linhas = [];
  let falhas = 0;
  if (!catalogo) return { linhas: ['aviso: não consegui ler o catálogo de skills de fora do kit (plugins/orquestracao/skills-de-fora.json)'], falhas: 0 };
  const presentes = pluginsPresentes(home);
  for (const p of (catalogo.plugins ?? []).filter((x) => x.saida === 'depender')) {
    if (presentes.has(p.plugin)) linhas.push(`ok: ${p.plugin} instalado (o kit usa: ${p.motivo})`);
    else { falhas++; linhas.push(`falha: ${p.plugin} não instalado; o kit usa: ${p.motivo} Instale: \`claude plugin install ${p.plugin}@${p.marketplace}\`; sem ele o plugin orquestracao novo não carrega (é dependência dele). ${p.repositorioDoMarketplace ? `Se o marketplace ${p.marketplace} faltar, antes: \`claude plugin marketplace add ${p.repositorioDoMarketplace}\`` : ''}`); }
  }
  const barradas = (catalogo.skills ?? []).filter((s) => s.saida === 'barrar' || (s.saida === 'absorver' && s.feito === true));
  const porPlugin = new Map();
  for (const s of barradas) {
    const plugin = s.skill.split(':')[0];
    if (!porPlugin.has(plugin)) porPlugin.set(plugin, []);
    porPlugin.get(plugin).push(s);
  }
  for (const [plugin, skills] of porPlugin) {
    const onde = presentes.get(plugin);
    if (!onde?.length) continue;
    const lista = skills.map((s) => `${s.skill} → ${s.use}`).join('; ');
    const dependencia = (catalogo.plugins ?? []).some((p) => p.plugin === plugin && p.saida === 'depender');
    const como = onde.map((o) => (o.origem === 'app' ? 'no app (lista de plugins da conta)' : `só para você neste projeto com \`claude plugin disable ${o.id} --scope local\``));
    // da dependência não há o que fazer (o plugin fica): só informa o que o kit barra nela
    if (dependencia) { linhas.push(`info: o kit barra neste projeto ${lista}, do plugin ${plugin} (dependência do kit: o plugin fica)`); continue; }
    linhas.push(`aviso: plugin ${plugin} instalado; o kit barra neste projeto ${lista} (as outras skills dele seguem livres); se não usa as outras, desligue-o ${como.join(' e ')}: cada sessão deixa de carregar as descrições`);
  }
  return { linhas, falhas };
}
