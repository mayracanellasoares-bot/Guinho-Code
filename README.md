# Guinho-Code Online

Interface terminal retro com dois modos:

- Online: Vercel + OpenRouter.
- Local: Termux + llama.cpp em `127.0.0.1:8080`.

## Variaveis na Vercel

Obrigatoria:

```text
OPENROUTER_API_KEY=sua_chave
```

Opcional:

```text
OPENROUTER_MODEL=qwen/qwen-2.5-coder-32b-instruct
```

## Teste local

```bash
npm i -g vercel
vercel dev
```

## Deploy

```bash
vercel --prod
```
