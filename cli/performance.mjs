// A seção `performance` do `.claude/kit.json` (plugin opcional `kit-performance`): o `kit doutor` a confere contra o catálogo de
// práticas do plugin. Só aviso: nada aqui reprova, e o plugin funciona sem a seção.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ_DO_KIT } from './pacote.mjs';

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Os ids e as chaves de orçamento do `praticas.json` do plugin. */
export function lerPraticas(raiz = RAIZ_DO_KIT) {
  const c = JSON.parse(readFileSync(join(raiz, 'plugins', 'kit-performance', 'praticas.json'), 'utf8'));
  return { ids: new Set(c.praticas.map((p) => p.id)), orcamento: Object.keys(c.orcamento).filter((k) => k !== 'doc') };
}

/** As linhas do doutor para a seção `performance` do kit.json. `ligado`: o que o `enabledPlugins` diz do plugin (`undefined` se ninguém diz). */
export function conferirPerformance(kj, ligado, praticas) {
  const secao = kj?.performance;
  if (secao === undefined) return [];
  const linhas = [];
  const aviso = (m) => linhas.push(`aviso: ${m}`);
  if (ligado === false) aviso('plugin kit-performance desligado, mas o .claude/kit.json tem a seção performance: o kit.json não o religa; para religar, enabledPlugins "kit-performance@ichikawa-kit": true');
  else if (ligado === undefined) aviso('o .claude/kit.json tem a seção performance, mas o plugin kit-performance não está ligado em nenhuma camada do enabledPlugins: as skills e o revisor não rodam; instale-o (claude plugin install kit-performance@ichikawa-kit) ou ligue-o no .claude/settings.json');
  if (!objeto(secao)) { aviso(`performance precisa ser um objeto, e veio ${JSON.stringify(secao)}`); return linhas; }
  const { naoSeAplica, orcamento } = secao;
  if (naoSeAplica !== undefined) {
    if (!objeto(naoSeAplica)) aviso(`performance.naoSeAplica precisa ser um objeto { "<id da prática>": "<motivo>" }, e veio ${JSON.stringify(naoSeAplica)}`);
    else for (const [id, motivo] of Object.entries(naoSeAplica)) {
      if (!praticas.ids.has(id)) aviso(`performance.naoSeAplica: "${id}" não é uma prática do catálogo (praticas.json do plugin kit-performance); a dispensa não vale`);
      else if (typeof motivo !== 'string' || !motivo.trim()) aviso(`performance.naoSeAplica.${id} sem motivo: diga por que a prática não vale neste projeto`);
    }
  }
  if (orcamento !== undefined) {
    if (!objeto(orcamento)) aviso(`performance.orcamento precisa ser um objeto, e veio ${JSON.stringify(orcamento)}`);
    else for (const [k, v] of Object.entries(orcamento)) {
      if (!praticas.orcamento.includes(k)) aviso(`performance.orcamento.${k} não existe — as conhecidas são ${praticas.orcamento.join(', ')}`);
      else if (typeof v !== 'number' || !(v > 0)) aviso(`performance.orcamento.${k} precisa ser um número maior que zero, e veio ${JSON.stringify(v)}`);
    }
  }
  return linhas;
}
