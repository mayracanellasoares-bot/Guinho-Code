# Guinho-Code

![Logo do Guinho-Code](./guinho-logo.svg)

Terminal web para programação com interface responsiva, atalhos, upload de documentos e geração de arquivos.

## Produção

Abra [guinho-code.vercel.app](https://guinho-code.vercel.app/). A aplicação usa Vercel + OpenRouter; a chave permanece exclusivamente nas variáveis de ambiente do servidor.

Variáveis esperadas na Vercel:

```text
OPENROUTER_API_KEY=sua_chave
OPENROUTER_MODEL=openrouter/free
DATABASE_URL=postgresql://usuario:senha@host/database?sslmode=require
```

O endpoint `/api/chat` transmite a resposta por SSE, exclui o raciocínio interno do provedor e tenta reconectar quando a geração é interrompida.

`DATABASE_URL` é opcional. Sem ela, o histórico fica salvo no navegador por IndexedDB. Com ela, `/api/history` cria a tabela `guinho_chat_history` automaticamente e sincroniza as conversas por ID anônimo, sem cadastro, email ou senha.

## PWA

O projeto inclui:

- `manifest.webmanifest`
- `guinho-logo.svg`
- `sw.js` com atualização de documentos em rede e fallback offline
- botão **Instalar PWA** no navegador compatível

No Android, abra o site no Chrome e use **Instalar aplicativo** quando o navegador oferecer a instalação. O chat precisa de conexão para chamar a API.

## Recursos

- fonte de 14px e interface preto/branco;
- gatinho preto ao lado do logotipo;
- atalhos para HTML, Canvas, jogos, Python, C++, C#, React, API, SQL, depuração, auditoria, PWA e arquivos;
- anexos PDF, texto e código;
- blocos `===FILE: nome.ext===` com botões para baixar arquivos individuais ou ZIP;
- histórico persistido em IndexedDB, exportação em ZIP/JSON/TXT, exclusão local e sincronização opcional em Postgres.
- biblioteca linguística com análise local por regras em `/api/linguistics/analyze`, cobrindo idioma provável, intenção, palavras-chave e fontes como spaCy, Stanza, Snowball, LanguageTool, Lingua-py, NLTK, CoGrOO e Linguateca.
- biblioteca de jogos com MakeCode Arcade, microStudio, TIC-80, Kenney Assets, OpenGameArt, Itch.io Free Game Assets, Piskel e Pixelorama.

## Desenvolvimento

```bash
npm i -g vercel
vercel dev
```

O frontend está em `index.html`; as funções serverless ficam em `api/`.

## Failover automático

O endpoint /api/chat não depende de um único servidor. Ele tenta os provedores configurados em ordem e alterna quando recebe erro HTTP, timeout ou interrupção do stream. Provedores com falhas recentes entram em cooldown temporário para evitar repetir imediatamente uma fonte indisponível.

Variáveis aceitas na Vercel:

- OPENROUTER_API_KEY, OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3
- NVIDIA_API_KEY ou NVIDIA_KEY, com sufixos _2 e _3
- GROQ_API_KEY, com sufixos _2 e _3
- DEEPSEEK_API_KEY, com sufixos _2 e _3
- GEMINI_API_KEY ou GOOGLE_API_KEY, com sufixos _2 e _3

Os modelos podem ser definidos com OPENROUTER_MODEL, NVIDIA_MODEL, GROQ_MODEL, DEEPSEEK_MODEL e GEMINI_MODEL. Chaves nunca são enviadas ao navegador nem gravadas no código.
