import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig, REGRAS_DE_DOCUMENTO } from "../config.mjs";
import { conferirDocs, relatar, slugDeTitulo } from "../as-docs-concordam.mjs";
import { main } from "../a-vez-do-gate.mjs";

/**
 * **As docs concordam (K12).** Cada regra tem um caso bom que passa, uma CÓPIA MUTADA do bom que reprova na
 * linha certa (a mutação é um `replace` que o teste confere que mudou o texto), e uma pasta vazia que diz
 * "nada a conferir" em vez de verde calado. Cada caso monta o seu repositório num diretório temporário.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, "..", "as-docs-concordam.mjs");

function pasta(arquivos) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-docs-")));
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(join(raiz, caminho, ".."), { recursive: true });
    writeFileSync(join(raiz, caminho), typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo, null, 2));
  }
  return raiz;
}
const limpar = (raiz) => rmSync(raiz, { recursive: true, force: true });

/** Muta o texto e prova que mudou — mutação que não muda nada faria o teste vermelho passar por acidente. */
function mutar(texto, de, para) {
  assert.ok(texto.includes(de), `a mutação não acha ${JSON.stringify(de)} no texto`);
  const novo = texto.replace(de, para);
  assert.notEqual(novo, texto);
  return novo;
}
const onde = (r) => r.achados.map((a) => `${a.arquivo}:${a.linha}`);

const SPEC = (status) => `# SPEC-001 — Algo\n\n- **Data:** 2026-10-25\n- **Status:** ${status}\n\nCorpo.\n`;
const INDICE_DE_SPEC = (status) => `# Specs\n\n| Spec | Título | Status |\n|---|---|---|\n| [SPEC-001](SPEC-001-algo.md) | Algo | ${status} |\n`;
const ADR_INDICE = (decisao = "Decide X", linha1 = "[0001](0001-um.md)") =>
  `# ADRs\n\n| Nº | Decisão | Status |\n|---|---|---|\n| ${linha1} | ${decisao} | Aceito |\n| [0002](0002-dois.md) | Decide Y | Aceito |\n`;

describe("status-da-spec", () => {
  const bom = () => ({ "docs/specs/SPEC-001-algo.md": SPEC("Aprovada"), "docs/specs/README.md": INDICE_DE_SPEC("Aprovada") });

  it("o caso bom passa e a conferência olhou a spec (não é pasta vazia)", () => {
    const raiz = pasta(bom());
    try {
      const r = conferirDocs(raiz, {}, ["status-da-spec"]);
      assert.deepEqual(r.achados, []);
      assert.deepEqual(r.nada, []); // examinou de verdade: nada de "nada a conferir"
    } finally {
      limpar(raiz);
    }
  });

  it("status fora do vocabulário reprova na linha do **Status:**", () => {
    const arquivos = bom();
    arquivos["docs/specs/SPEC-001-algo.md"] = mutar(arquivos["docs/specs/SPEC-001-algo.md"], "Aprovada", "Parcialmente implementada");
    const raiz = pasta(arquivos);
    try {
      const r = conferirDocs(raiz, {}, ["status-da-spec"]);
      assert.deepEqual(onde(r), ["docs/specs/SPEC-001-algo.md:4"]);
      assert.match(r.achados[0].motivo, /fora do vocabulário/);
    } finally {
      limpar(raiz);
    }
  });

  it("índice que diz outro status reprova na linha do índice", () => {
    const arquivos = bom();
    arquivos["docs/specs/README.md"] = mutar(arquivos["docs/specs/README.md"], "| Aprovada |", "| Rascunho |");
    const raiz = pasta(arquivos);
    try {
      const r = conferirDocs(raiz, {}, ["status-da-spec"]);
      assert.deepEqual(onde(r), ["docs/specs/README.md:5"]);
      assert.match(r.achados[0].motivo, /o índice diz "Rascunho" e a spec diz "Aprovada"/);
    } finally {
      limpar(raiz);
    }
  });

  it("spec fora do índice e spec sem **Status:** reprovam; o vocabulário vem de documentos.estados", () => {
    const raiz = pasta({ ...bom(), "docs/specs/SPEC-002-b.md": "# sem status\n", "docs/specs/SPEC-003-c.md": SPEC("Aprovada") });
    try {
      const r = conferirDocs(raiz, {}, ["status-da-spec"]);
      assert.deepEqual(onde(r), ["docs/specs/SPEC-002-b.md:1", "docs/specs/SPEC-003-c.md:4"]);
      const outro = conferirDocs(raiz, { estados: ["Aprovada"] }, ["status-da-spec"]);
      assert.equal(outro.achados.length, 2); // o vocabulário mudou e o resultado continua medindo
    } finally {
      limpar(raiz);
    }
  });

  it("pasta sem specs diz 'nada a conferir' em vez de verde calado", () => {
    const raiz = pasta({ "docs/outra.md": "x\n" });
    try {
      const r = conferirDocs(raiz, {}, ["status-da-spec"]);
      assert.deepEqual(r.achados, []);
      assert.equal(r.nada.length, 1);
      assert.match(r.nada[0].motivo, /nenhuma SPEC-NNN/);
    } finally {
      limpar(raiz);
    }
  });
});

describe("indice-de-adr", () => {
  const bom = () => ({
    "docs/adr/0001-um.md": "# um\n",
    "docs/adr/0002-dois.md": "# dois\n",
    "docs/adr/README.md": ADR_INDICE(),
  });

  it("o caso bom passa e olhou os ADRs", () => {
    const raiz = pasta(bom());
    try {
      const r = conferirDocs(raiz, {}, ["indice-de-adr"]);
      assert.deepEqual(r.achados, []);
      assert.deepEqual(r.nada, []);
    } finally {
      limpar(raiz);
    }
  });

  it("ADR em disco fora do índice reprova no arquivo", () => {
    const raiz = pasta({ ...bom(), "docs/adr/0003-tres.md": "# três\n" });
    try {
      assert.deepEqual(onde(conferirDocs(raiz, {}, ["indice-de-adr"])), ["docs/adr/0003-tres.md:1"]);
    } finally {
      limpar(raiz);
    }
  });

  it("linha do índice para arquivo que não existe, e rótulo trocado, reprovam na linha do índice", () => {
    const a = bom();
    a["docs/adr/README.md"] = mutar(a["docs/adr/README.md"], "(0002-dois.md)", "(0002-sumiu.md)");
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["indice-de-adr"]);
      assert.deepEqual(onde(r), ["docs/adr/0002-dois.md:1", "docs/adr/README.md:6"]);
    } finally {
      limpar(raiz);
    }
    const b = bom();
    b["docs/adr/README.md"] = mutar(b["docs/adr/README.md"], "[0001](0001-um.md)", "[0009](0001-um.md)");
    const raiz2 = pasta(b);
    try {
      const r = conferirDocs(raiz2, {}, ["indice-de-adr"]);
      assert.deepEqual(onde(r), ["docs/adr/README.md:5"]);
      assert.match(r.achados[0].motivo, /rótulo \[0009\]/);
    } finally {
      limpar(raiz2);
    }
  });

  it("célula Decisão acima de 200 caracteres reprova na linha; 200 exatos passam", () => {
    const limite = "x".repeat(200);
    const a = bom();
    a["docs/adr/README.md"] = ADR_INDICE(limite);
    const raiz = pasta(a);
    try {
      assert.deepEqual(conferirDocs(raiz, {}, ["indice-de-adr"]).achados, []);
    } finally {
      limpar(raiz);
    }
    const b = bom();
    b["docs/adr/README.md"] = ADR_INDICE(limite + "y");
    const raiz2 = pasta(b);
    try {
      const r = conferirDocs(raiz2, {}, ["indice-de-adr"]);
      assert.deepEqual(onde(r), ["docs/adr/README.md:5"]);
      assert.match(r.achados[0].motivo, /201 caracteres \(\+1 sobre 200\)/);
    } finally {
      limpar(raiz2);
    }
  });

  it("rótulo `ADR 0390` com o número do arquivo passa (foi o falso positivo do Izanagi); com outro número reprova", () => {
    const a = bom();
    a["docs/adr/README.md"] = ADR_INDICE("Decide X", "[ADR 0001](0001-um.md)");
    const raiz = pasta(a);
    try {
      assert.deepEqual(conferirDocs(raiz, {}, ["indice-de-adr"]).achados, []);
    } finally {
      limpar(raiz);
    }
    const b = bom();
    b["docs/adr/README.md"] = ADR_INDICE("Decide X", "[ADR 0009](0001-um.md)");
    const raiz2 = pasta(b);
    try {
      assert.deepEqual(onde(conferirDocs(raiz2, {}, ["indice-de-adr"])), ["docs/adr/README.md:5"]);
    } finally {
      limpar(raiz2);
    }
  });

  it("rótulo livre reprova (só `NNNN` ou `ADR NNNN` com o número do arquivo vale); `./` no link do índice é normalizado", () => {
    const a = bom();
    a["docs/adr/README.md"] = ADR_INDICE("Decide X", "[qualquer](0001-um.md)");
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["indice-de-adr"]);
      assert.deepEqual(onde(r), ["docs/adr/README.md:5"]);
      assert.match(r.achados[0].motivo, /rótulo \[qualquer\]/);
    } finally {
      limpar(raiz);
    }
    const b = bom();
    b["docs/adr/README.md"] = ADR_INDICE("Decide X", "[0001](./0001-um.md)");
    const raiz2 = pasta(b);
    try {
      assert.deepEqual(conferirDocs(raiz2, {}, ["indice-de-adr"]).achados, []);
    } finally {
      limpar(raiz2);
    }
  });

  it("pasta sem ADR diz 'nada a conferir'", () => {
    const raiz = pasta({ "docs/adr/README.md": "# vazio\n" });
    try {
      const r = conferirDocs(raiz, {}, ["indice-de-adr"]);
      assert.deepEqual(r.achados, []);
      assert.match(r.nada[0].motivo, /nenhum NNNN/);
    } finally {
      limpar(raiz);
    }
  });
});

describe("linha-do-roadmap", () => {
  const ROADMAP = (item) => `# Roadmap\n\n<a id="x"></a>\n- [x] ${item}\n- [ ] outro item curto\n`;
  const bom = () => ({
    "docs/roadmap.md": ROADMAP("fez a coisa · [spec](specs/SPEC-001-a.md#alvo) · [detalhe](diario/2026-10.md#d1)"),
    "docs/specs/SPEC-001-a.md": '<a id="alvo"></a>\n# A\n',
    "docs/diario/2026-10.md": '<a id="d1"></a>\n# d1\n',
  });

  it("o caso bom passa e olhou itens", () => {
    const raiz = pasta(bom());
    try {
      const r = conferirDocs(raiz, {}, ["linha-do-roadmap"]);
      assert.deepEqual(r.achados, []);
      assert.deepEqual(r.nada, []);
    } finally {
      limpar(raiz);
    }
  });

  it("o link para a entrada do diário na pasta do mês passa com <a id>; sem <a id> reprova", () => {
    const item = "fez a coisa · [detalhe](diario/2026-11/03-x.md#x)";
    const raiz = pasta({ "docs/roadmap.md": ROADMAP(item), "docs/diario/2026-11/03-x.md": '<a id="x"></a>\n# x\n' });
    try {
      const r = conferirDocs(raiz, {}, ["linha-do-roadmap"]);
      assert.deepEqual(r.achados, []);
    } finally {
      limpar(raiz);
    }
    const raiz2 = pasta({ "docs/roadmap.md": ROADMAP(item), "docs/diario/2026-11/03-x.md": "# x\n" });
    try {
      const r = conferirDocs(raiz2, {}, ["linha-do-roadmap"]);
      assert.equal(r.achados.length, 1);
      assert.match(r.achados[0].motivo, /âncora explícita/);
    } finally {
      limpar(raiz2);
    }
  });

  it("linha de 401 caracteres reprova na linha do item; 400 exatos passam", () => {
    const base = "- [x] ";
    const exata = base + "a".repeat(400 - base.length);
    const raiz = pasta({ "docs/roadmap.md": `# R\n${exata}\n` });
    try {
      assert.deepEqual(conferirDocs(raiz, {}, ["linha-do-roadmap"]).achados, []);
    } finally {
      limpar(raiz);
    }
    const raiz2 = pasta({ "docs/roadmap.md": `# R\n${exata}b\n` });
    try {
      const r = conferirDocs(raiz2, {}, ["linha-do-roadmap"]);
      assert.deepEqual(onde(r), ["docs/roadmap.md:2"]);
      assert.match(r.achados[0].motivo, /401 caracteres/);
    } finally {
      limpar(raiz2);
    }
  });

  it("três links de spec/ADR no item reprovam; o link do diário não conta", () => {
    const a = bom();
    a["docs/roadmap.md"] = ROADMAP("x · [a](specs/SPEC-001-a.md) · [b](specs/SPEC-001-a.md) · [c](adr/0001-um.md) · [d](diario/2026-10.md)");
    a["docs/adr/0001-um.md"] = "# um\n";
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["linha-do-roadmap"]);
      assert.deepEqual(onde(r), ["docs/roadmap.md:4"]);
      assert.match(r.achados[0].motivo, /3 links de spec\/ADR/);
    } finally {
      limpar(raiz);
    }
  });

  it("âncora que o destino não declara como <a id> reprova na linha do link, mesmo se o título geraria o slug", () => {
    const a = bom();
    a["docs/specs/SPEC-001-a.md"] = mutar(a["docs/specs/SPEC-001-a.md"], '<a id="alvo"></a>', "## alvo");
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["linha-do-roadmap"]);
      assert.deepEqual(onde(r), ["docs/roadmap.md:4"]);
      assert.match(r.achados[0].motivo, /não declara <a id="alvo">/);
    } finally {
      limpar(raiz);
    }
  });

  it("link do roadmap para outro doc aceita o slug do título, mas a âncora tem de existir (o falso positivo do Izanagi)", () => {
    const a = bom();
    a["docs/roadmap.md"] = ROADMAP("x · [doc](outro.md#um-título) · [doc2](outro.md#nao-existe)");
    a["docs/outro.md"] = "# Um título\n";
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["linha-do-roadmap"]);
      assert.deepEqual(onde(r), ["docs/roadmap.md:4"]);
      assert.match(r.achados[0].motivo, /nao-existe: a âncora não existe/);
    } finally {
      limpar(raiz);
    }
  });

  it("link entre crases é o padrão ilustrado e não é conferido", () => {
    const raiz = pasta({ "docs/roadmap.md": "# R\n- [x] como linkar: `[detalhe](diario/9999-99.md#nada)`\n" });
    try {
      assert.deepEqual(conferirDocs(raiz, {}, ["linha-do-roadmap"]).achados, []);
    } finally {
      limpar(raiz);
    }
  });

  it("sem roadmap, ou sem item, diz 'nada a conferir'", () => {
    const raiz = pasta({ "docs/x.md": "x\n" });
    const raiz2 = pasta({ "docs/roadmap.md": "# só título\n" });
    try {
      assert.match(conferirDocs(raiz, {}, ["linha-do-roadmap"]).nada[0].motivo, /não existe/);
      assert.match(conferirDocs(raiz2, {}, ["linha-do-roadmap"]).nada[0].motivo, /nenhum item/);
    } finally {
      limpar(raiz);
      limpar(raiz2);
    }
  });
});

describe("links-relativos", () => {
  const bom = () => ({
    "docs/a.md": "# A\n\nveja [b](b.md#seção-b) e [o topo](#a) e [fora](https://x.y/z#w).\n",
    "docs/b.md": "# B\n\n## Seção B\n",
  });

  it("o caso bom passa e olhou links", () => {
    const raiz = pasta(bom());
    try {
      const r = conferirDocs(raiz, {}, ["links-relativos"]);
      assert.deepEqual(r.achados, []);
      assert.deepEqual(r.nada, []);
    } finally {
      limpar(raiz);
    }
  });

  it("arquivo inexistente reprova na linha do link", () => {
    const a = bom();
    a["docs/a.md"] = mutar(a["docs/a.md"], "(b.md#seção-b)", "(c.md#seção-b)");
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["links-relativos"]);
      assert.deepEqual(onde(r), ["docs/a.md:3"]);
      assert.match(r.achados[0].motivo, /o arquivo não existe/);
    } finally {
      limpar(raiz);
    }
  });

  it("âncora que não existe reprova; o slug chutado sem acento não vale e o <a id> vale", () => {
    const a = { "docs/a.md": "# A\n[x](b.md#convencao)\n[y](b.md#explicita)\n", "docs/b.md": '# Convenção\n<a id="explicita"></a>\n' };
    const raiz = pasta(a);
    try {
      const r = conferirDocs(raiz, {}, ["links-relativos"]);
      assert.deepEqual(onde(r), ["docs/a.md:2"]);
    } finally {
      limpar(raiz);
    }
    assert.equal(slugDeTitulo("Revisão 2026-08-23 (v1.4) — o teto"), "revisão-2026-08-23-v14--o-teto");
  });

  it("link em bloco de código ou entre crases não é conferido, e a linha segue certa depois dele", () => {
    const a = { "docs/a.md": "# A\n```md\n[x](nao-existe.md)\n```\n`[y](tambem-nao.md)`\n[z](quebrado.md)\n" };
    const raiz = pasta(a);
    try {
      assert.deepEqual(onde(conferirDocs(raiz, {}, ["links-relativos"])), ["docs/a.md:6"]);
    } finally {
      limpar(raiz);
    }
  });

  it("link que começa com / resolve a partir da raiz do repositório: existente passa, inexistente reprova", () => {
    const raiz = pasta({ "docs/sub/a.md": "# A\n[ok](/docs/b.md)\n[mau](/docs/c.md)\n", "docs/b.md": "# B\n" });
    try {
      const r = conferirDocs(raiz, {}, ["links-relativos"]);
      assert.deepEqual(onde(r), ["docs/sub/a.md:3"]);
      assert.match(r.achados[0].motivo, /o arquivo não existe/);
    } finally {
      limpar(raiz);
    }
  });

  it("pasta docs ausente diz 'nada a conferir'", () => {
    const raiz = pasta({ "README.md": "x\n" });
    try {
      assert.match(conferirDocs(raiz, {}, ["links-relativos"]).nada[0].motivo, /não existe/);
    } finally {
      limpar(raiz);
    }
  });
});

describe("tamanho-do-diario", () => {
  it("150000 bytes passam, 150001 reprovam na primeira linha do arquivo", () => {
    const raiz = pasta({ "docs/diario/2026-09.md": "a".repeat(150_000), "docs/diario/2026-10.md": "a".repeat(150_001), "docs/diario/README.md": "i\n" });
    try {
      const r = conferirDocs(raiz, {}, ["tamanho-do-diario"]);
      assert.deepEqual(onde(r), ["docs/diario/2026-10.md:1"]);
      assert.match(r.achados[0].motivo, /150001 bytes \(\+1 sobre 150000\)/);
    } finally {
      limpar(raiz);
    }
  });

  it("o orçamento vem de documentos.orcamentos", () => {
    const raiz = pasta({ "docs/diario/2026-10.md": "a".repeat(11) });
    try {
      assert.equal(conferirDocs(raiz, { orcamentos: { diarioEmBytes: 10 } }, ["tamanho-do-diario"]).achados.length, 1);
      assert.equal(conferirDocs(raiz, {}, ["tamanho-do-diario"]).achados.length, 0);
    } finally {
      limpar(raiz);
    }
  });

  it("pasta sem diário diz 'nada a conferir'", () => {
    const raiz = pasta({ "docs/x.md": "x\n" });
    try {
      assert.match(conferirDocs(raiz, {}, ["tamanho-do-diario"]).nada[0].motivo, /nenhum AAAA-MM\.md nem AAAA-MM\/DD-\*\.md/);
    } finally {
      limpar(raiz);
    }
  });

  describe("a entrada por arquivo (AAAA-MM/DD-<ancora>.md)", () => {
    const entrada = (ancora, corpo = "") => `<a id="${ancora}"></a>\n# 03/11 · ${ancora}\n${corpo}`;
    const rodar = (arquivos, documentos = {}) => {
      const raiz = pasta(arquivos);
      try {
        return conferirDocs(raiz, documentos, ["tamanho-do-diario"]);
      } finally {
        limpar(raiz);
      }
    };

    it("a entrada boa passa e a linha de fecho conta 1 arquivo", () => {
      const r = rodar({ "docs/diario/2026-11/03-cache-frio.md": entrada("cache-frio") });
      assert.deepEqual(r.achados, []);
      assert.deepEqual(r.nada, []);
      assert.equal(r.arquivos, 1);
    });

    it("nome fora do formato reprova, um achado por arquivo, citando DD-<ancora>.md", () => {
      for (const nome of ["3-x.md", "03-Cache.md", "03_x.md", "x.md"]) {
        const r = rodar({ [`docs/diario/2026-11/${nome}`]: entrada("x") });
        assert.equal(r.arquivos, 1, nome);
        assert.equal(r.achados.length, 1, nome);
        assert.match(r.achados[0].motivo, /DD-<ancora>\.md/, nome);
      }
    });

    it("âncora diferente do nome, ou ausente, reprova", () => {
      const diferente = rodar({ "docs/diario/2026-11/03-a.md": entrada("b") });
      assert.equal(diferente.achados.length, 1);
      assert.match(diferente.achados[0].motivo, /a âncora do nome/);
      const ausente = rodar({ "docs/diario/2026-11/03-a.md": "# só título\n" });
      assert.equal(ausente.achados.length, 1);
      assert.match(ausente.achados[0].motivo, /a âncora do nome/);
    });

    it("arquivo vazio ou só de espaços reprova", () => {
      for (const corpo of ["", "  \n \t\n"]) {
        const r = rodar({ "docs/diario/2026-11/03-a.md": corpo });
        assert.equal(r.arquivos, 1);
        assert.equal(r.achados.length, 1);
        assert.match(r.achados[0].motivo, /vazio/);
      }
    });

    it("entrada acima do orçamento reprova; no limite passa", () => {
      const cabeca = entrada("a");
      const limite = 150_000;
      const exata = cabeca + "x".repeat(limite - Buffer.byteLength(cabeca));
      assert.deepEqual(rodar({ "docs/diario/2026-11/03-a.md": exata }).achados, []);
      const r = rodar({ "docs/diario/2026-11/03-a.md": exata + "x" });
      assert.deepEqual(onde(r), ["docs/diario/2026-11/03-a.md:1"]);
      assert.match(r.achados[0].motivo, /150001 bytes \(\+1 sobre 150000\)/);
      assert.match(r.achados[0].motivo, /divida em duas entradas/);
    });

    it("pasta com nome que não é AAAA-MM reprova; README e solto na raiz são ignorados", () => {
      for (const nome of ["2026-13", "nov"]) {
        const r = rodar({ [`docs/diario/${nome}/01-x.md`]: entrada("x") });
        assert.equal(r.achados.length, 1, nome);
        assert.match(r.achados[0].motivo, /pasta do mês fora de AAAA-MM/, nome);
      }
      const ok = rodar({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/README.md": "i\n", "docs/diario/notas.txt": "n\n" });
      assert.deepEqual(ok.achados, []);
    });

    it("link simbólico pendurado na raiz do diário é pulado, sem exceção", () => {
      const raiz = pasta({ "docs/diario/2026-11/03-x.md": entrada("x") });
      try {
        symlinkSync(join(raiz, "nao-existe"), join(raiz, "docs/diario/pendurado"));
        const r = conferirDocs(raiz, {}, ["tamanho-do-diario"]);
        assert.equal(r.arquivos, 1);
        assert.deepEqual(r.achados, []);
      } finally {
        limpar(raiz);
      }
    });

    it("pasta chamada x.md dentro do mês não derruba o gate: não é arquivo, não conta como entrada", () => {
      const raiz = pasta({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/2026-11/x.md/dentro.txt": "i\n" });
      try {
        const r = conferirDocs(raiz, {}, ["tamanho-do-diario"]);
        assert.equal(r.arquivos, 1);
        assert.ok(r.achados.every((a) => !/EISDIR/.test(a.motivo)));
      } finally {
        limpar(raiz);
      }
    });

    it("link simbólico .md pendurado dentro do mês é pulado, sem exceção", () => {
      const raiz = pasta({ "docs/diario/2026-11/03-x.md": entrada("x") });
      try {
        symlinkSync(join(raiz, "nao-existe"), join(raiz, "docs/diario/2026-11/04-y.md"));
        const r = conferirDocs(raiz, {}, ["tamanho-do-diario"]);
        assert.equal(r.arquivos, 1);
        assert.deepEqual(r.achados, []);
      } finally {
        limpar(raiz);
      }
    });

    it("pasta oculta dentro do mês é ignorada, como na raiz", () => {
      const r = rodar({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/2026-11/.algo/z.txt": "z\n" });
      assert.equal(r.arquivos, 1);
      assert.deepEqual(r.achados, []);
    });

    it("pasta oculta na raiz do diário é ignorada; a de nome inválido sem ponto continua reprovando", () => {
      const ok = rodar({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/.obsidian/x.json": "{}", "docs/diario/.git/HEAD": "ref\n" });
      assert.deepEqual(ok.achados, []);
      const ruim = rodar({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/obsidian/x.json": "{}" });
      assert.equal(ruim.achados.length, 1);
    });

    it("subpasta dentro da pasta do mês reprova, mesmo com .md dentro", () => {
      const r = rodar({ "docs/diario/2026-11/03-x.md": entrada("x"), "docs/diario/2026-11/sub/y.md": entrada("y") });
      assert.deepEqual(onde(r), ["docs/diario/2026-11/sub:1"]);
      assert.match(r.achados[0].motivo, /subpasta dentro do mês; a entrada mora direto em AAAA-MM\//);
    });

    it("mês depois da primeira pasta como arquivo único reprova; o mês da transição e as partes antigas não", () => {
      const r = rodar({ "docs/diario/2026-10/01-x.md": entrada("x"), "docs/diario/2026-11.md": "a\n" });
      assert.deepEqual(onde(r), ["docs/diario/2026-11.md:1"]);
      assert.match(r.achados[0].motivo, /mês depois da primeira pasta \(2026-10\) vira pasta/);
      const transicao = rodar({ "docs/diario/2026-10/01-x.md": entrada("x"), "docs/diario/2026-10.md": "a\n", "docs/diario/2026-09-parte-2.md": "a\n" });
      assert.deepEqual(transicao.achados, []);
    });

    it("sem pasta nenhuma, o acervo de arquivos únicos segue valendo (vem depois do caso que reprova)", () => {
      const r = rodar({ "docs/diario/2026-11.md": "a\n", "docs/diario/2026-12.md": "a\n" });
      assert.deepEqual(r.achados, []);
      assert.equal(r.arquivos, 2);
    });

    it("só o README na pasta: 'nada a conferir' cita os dois formatos", () => {
      const r = rodar({ "docs/diario/README.md": "i\n" });
      assert.equal(r.nada.length, 1);
      assert.match(r.nada[0].motivo, /nenhum AAAA-MM\.md nem AAAA-MM\/DD-\*\.md/);
    });
  });
});

describe("a linha de fecho", () => {
  it("sem achado, `N regras, M arquivos, 0 achados`; com achado, nenhuma linha de fecho", () => {
    const raiz = pasta({
      "docs/adr/0001-um.md": "# um\n",
      "docs/adr/0002-dois.md": "# dois\n",
      "docs/adr/README.md": ADR_INDICE(),
      "docs/diario/2026-10.md": "x\n",
    });
    try {
      const r = conferirDocs(raiz, {}, ["indice-de-adr", "tamanho-do-diario"]);
      const linhas = [];
      assert.equal(relatar(r, (t) => linhas.push(t)), 0);
      assert.deepEqual(linhas, ["2 regras, 3 arquivos, 0 achados"]);

      const ruim = conferirDocs(raiz, { orcamentos: { diarioEmBytes: 1 }, adr: "docs/adr" }, ["tamanho-do-diario"]);
      const saida = [];
      assert.equal(relatar(ruim, (t) => saida.push(t)), 1);
      assert.equal(saida.length, 1);
      assert.doesNotMatch(saida.join("\n"), /0 achados/);
    } finally {
      limpar(raiz);
    }
  });

  it("pasta vazia: o 'nada a conferir' continua, e a linha de fecho conta 0 arquivos", () => {
    const raiz = pasta({ "docs/x.md": "x\n" });
    try {
      const linhas = [];
      relatar(conferirDocs(raiz, {}, ["tamanho-do-diario"]), (t) => linhas.push(t));
      assert.deepEqual(linhas, ["[tamanho-do-diario] nada a conferir: nenhum AAAA-MM.md nem AAAA-MM/DD-*.md em docs/diario", "1 regras, 0 arquivos, 0 achados"]);
    } finally {
      limpar(raiz);
    }
  });
});

describe("a configuração e o script", () => {
  it("regra desconhecida em documentos.conferir é erro alto, e as cinco conhecidas passam", () => {
    assert.equal(REGRAS_DE_DOCUMENTO.length, 5);
    assert.deepEqual(carregarConfig("/x", { documentos: { conferir: REGRAS_DE_DOCUMENTO } }).documentos.conferir, REGRAS_DE_DOCUMENTO);
    assert.throws(() => carregarConfig("/x", { documentos: { conferir: ["status-da-specs"] } }), /não é uma regra/);
    assert.throws(() => carregarConfig("/x", { documentos: { conferir: "links-relativos" } }), /precisa ser uma lista/);
    assert.throws(() => carregarConfig("/x", { documentos: { orcamentos: { diarioEmBytes: 0 } } }), /inteiro ≥ 1/);
    assert.throws(() => carregarConfig("/x", { documentos: { orcamentos: { inventado: 5 } } }), /não existe/);
    const casa = { home: pasta({}) }; // casa vazia: sem opção gravada, vale o padrão do plugin
    assert.deepEqual(carregarConfig("/x", {}, casa).documentos.conferir, REGRAS_DE_DOCUMENTO); // sem a chave, as cinco rodam (A7)
    assert.deepEqual(carregarConfig("/x", { documentos: { conferir: [] } }, casa).documentos.conferir, []); // [] explícito = nenhuma
  });

  it("o script sai 1 e escreve `arquivo:linha — motivo`; --regra escolhe a regra; sem achado sai 0", () => {
    const raiz = pasta({
      "docs/specs/SPEC-001-algo.md": SPEC("Quase pronta"),
      "docs/specs/README.md": INDICE_DE_SPEC("Quase pronta"),
      ".claude/kit.json": { documentos: { conferir: ["status-da-spec"] } },
    });
    try {
      execFileSync("git", ["init", "-q"], { cwd: raiz, timeout: 10_000, killSignal: "SIGKILL" });
      const roda = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: raiz, encoding: "utf-8", timeout: 20_000, killSignal: "SIGKILL" });
      const ruim = roda();
      assert.equal(ruim.status, 1, ruim.stderr);
      assert.match(ruim.stdout, /^docs\/specs\/SPEC-001-algo\.md:4 — status "Quase pronta" fora do vocabulário/m);
      const outra = roda("--regra", "tamanho-do-diario");
      assert.equal(outra.status, 0, outra.stderr);
      assert.match(outra.stdout, /\[tamanho-do-diario\] nada a conferir/);
      assert.equal(roda("--regra", "inventada").status, 1); // regra desconhecida nunca é verde
    } finally {
      limpar(raiz);
    }
  });
});

describe("ligado ao gate", () => {
  const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe", timeout: 10_000, killSignal: "SIGKILL" });
  function projeto(documentos) {
    const marca = "marca.txt";
    const raiz = pasta({
      "package.json": { name: "p", version: "1.0.0", scripts: { suite: `node -e "require('fs').appendFileSync(process.env.MARCA,'S')"` } },
      ".claude/kit.json": { gate: { comandoCompleto: "npm run suite" }, documentos },
      "docs/specs/SPEC-001-algo.md": SPEC("Quase pronta"),
      "docs/specs/README.md": INDICE_DE_SPEC("Quase pronta"),
    });
    git(["init", "-q"], raiz);
    git(["config", "user.email", "t@kit.local"], raiz);
    git(["config", "user.name", "t"], raiz);
    git(["add", "-A"], raiz);
    git(["commit", "-qm", "base"], raiz);
    const base = mkdtempSync(join(tmpdir(), "kit-docs-base-"));
    const env = { ...process.env, CI: "", KIT_GATE_TRAVA: join(base, "g.trava"), KIT_CONSERTO_TRAVA: join(base, "c.trava"), KIT_GATE_VERDE_DIR: join(base, "verde"), KIT_NUCLEOS_DIR: join(base, "nucleos"), MARCA: join(base, marca) };
    return { raiz, base, env };
  }

  it("doc divergente com a regra ligada: o gate sai 1 e a suíte nem roda; sem a regra ligada, roda", async () => {
    const ligado = projeto({ conferir: ["status-da-spec"] });
    const desligado = projeto({ conferir: [] });
    try {
      assert.equal(await main(ligado.env, [], ligado.raiz), 1);
      assert.equal(existsSync(ligado.env.MARCA), false); // a suíte não rodou
      assert.equal(existsSync(join(ligado.base, "verde")), false); // e nada de verde guardado

      assert.equal(await main(desligado.env, [], desligado.raiz), 0); // controle: a mesma doc ruim, regra desligada, a suíte roda
      assert.equal(existsSync(desligado.env.MARCA), true);
    } finally {
      for (const p of [ligado, desligado]) {
        limpar(p.raiz);
        limpar(p.base);
      }
    }
  });

  it("doc de acordo com a regra ligada: a suíte roda", async () => {
    const p = projeto({ conferir: ["status-da-spec"], estados: ["Quase pronta"] });
    try {
      assert.equal(await main(p.env, [], p.raiz), 0);
      assert.equal(existsSync(p.env.MARCA), true);
    } finally {
      limpar(p.raiz);
      limpar(p.base);
    }
  });
});
