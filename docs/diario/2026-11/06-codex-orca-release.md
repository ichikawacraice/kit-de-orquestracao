<a id="codex-orca-release"></a>
# Entrada Codex e release 0.2.0 na ORCA

O CLI oferece `contexto` e `executar`; o AGENTS.md gerenciado compartilha as regras do projeto com o Claude. A recuperação reconhece a entrada gravada antes de um lock interrompido, sem tomar posse de um arquivo do projeto em instalações normais. A guarda ORCA aceita Codex com modelo e esforço explícitos e isolamento para escrita.

A aba ORCA procura primeiro o núcleo da mesma árvore de arquivos, evitando depender da instalação Claude ou executar uma versão antiga dela. O fallback mantém compatibilidade quando só a aba foi distribuída.

O teste real abriu um worker Codex, trocou mensagem, pergunta e resposta, confirmou um código e liberou a sessão pela ORCA. Esse ensaio comprova a comunicação; não comprova o ciclo de PR/merge nem paridade de hooks automáticos. Skills globais pessoais não são distribuídas pelo kit.

[Notas da release](../../releases/0.2.0.md). Decisão: [0035](../../adr/0035-entrada-compartilhada-para-claude-e-codex.md).
