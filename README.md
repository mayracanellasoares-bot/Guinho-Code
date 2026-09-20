# Guinho-Code

Terminal web retro verde/preto para gerar código com dois modos:

- **Online:** Vercel + OpenRouter, com a chave mantida no servidor.
- **Local:** Termux + llama.cpp em `http://127.0.0.1:8080/v1`.

## Publicar online

1. Importe este repositório na Vercel.
2. Em **Project Settings > Environment Variables**, adicione:
   ```text
   OPENROUTER_API_KEY=sua_chave_openrouter
   ```
3. Opcionalmente escolha o modelo:
   ```text
   OPENROUTER_MODEL=qwen/qwen-2.5-coder-32b-instruct
   ```
4. Faça um redeploy e abra a URL da Vercel.
5. No Guinho-Code, deixe o modo **Online · OpenRouter** e toque em **Conectar**.

A chave não fica no HTML e não é enviada para o navegador. O endpoint `/api/chat` faz o streaming da resposta para a interface.

## Rodar localmente

O servidor do llama.cpp deve estar ativo no Termux:

```bash
cd ~/llama.cpp
./build/bin/llama-server \
  -m ~/storage/downloads/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf \
  -c 32768 -t 4 -ngl 0 --host 127.0.0.1 --port 8080
```

Depois abra o site e selecione **Local · Termux**. O navegador precisa estar no mesmo aparelho do llama-server.

## Desenvolvimento

```bash
npm i -g vercel
vercel dev
```

O projeto é um HTML único na raiz, com funções serverless em `api/`.