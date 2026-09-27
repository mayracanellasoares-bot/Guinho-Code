# Guinho-Code

![Logo do Guinho-Code](./guinho-logo.svg)

Terminal web responsivo para programação, com gatinho em ASCII/PNG, anexos, histórico local e geração de arquivos/ZIP.

## Motor atual: Wllama no navegador

A interface principal usa **Wllama**, uma compilação WASM do llama.cpp. O navegador carrega um GGUF monolítico diretamente pela internet ou pelo seletor **Abrir GGUF local**; o chat não chama `/api/chat`, não usa Termux e não precisa de chave de API.

Modelos disponíveis na interface:

- **Tiny LLM F16** — aproximadamente 26,7 MB; carregamento mais rápido, modelo base e respostas simples.
- **SmolLM2 360M Q2_K** — aproximadamente 218,7 MB; mais capacidade, com maior tempo de download e inferência.

Os modelos remotos são baixados dos repositórios públicos do Hugging Face. O Wllama mantém os arquivos no cache do navegador (OPFS/IndexedDB conforme o navegador), então a próxima abertura pode reutilizar o download. O arquivo GGUF não é enviado ao GitHub nem à Vercel.

### Como usar

1. Abra <https://guinho-code.vercel.app/>.
2. Aguarde o carregamento automático do Tiny LLM ou escolha **SmolLM2**.
3. Para usar um arquivo seu, selecione **Abrir GGUF local** e depois **Carregar modelo**.
4. Quando o estado mostrar **WASM ativo** ou **WebGPU/WASM ativo**, digite no terminal.
5. Anexe PDF, TXT, Markdown, JSON ou código para análise. O limite atual é 2 MB por arquivo e 3 MB no total.

Por estabilidade no Android, o Guinho inicia em WASM/CPU e desativa WebGPU por padrão; se quiser testar a aceleração, abra o console e execute `localStorage.setItem("guinho_enable_webgpu", "1")`, depois recarregue o modelo. Se uma inferência nativa abortar, o motor é recarregado automaticamente uma vez. O modelo continua carregado ao trocar de aba; histórico e conversas ficam no navegador.

## PWA

O projeto inclui:

- `manifest.webmanifest`
- `guinho-logo.svg`, `guinho-192.png` e `guinho-512.png`
- `sw.js` com atualização do shell e fallback offline
- botão **Instalar PWA**

No Android, abra o site no Chrome e use **Instalar aplicativo**. A interface pode abrir offline depois que o shell e o modelo já estiverem no cache; uma instalação nova precisa de internet para baixar WASM/modelo.

## Recursos

- interface preto e branco, tipografia monoespaçada de 14px e layout mobile;
- gatinho preto ao lado do logotipo;
- atalhos para HTML, Canvas, jogos, Python, C++, C#, React, API, SQL, depuração, auditoria, PWA e arquivos;
- anexos PDF, texto e código;
- blocos `===FILE: nome.ext===` com download individual e ZIP;
- histórico persistido em IndexedDB com fallback para localStorage;
- exportação do histórico em JSON/TXT/ZIP;
- streaming de tokens do GGUF e botão para interromper a geração.

## Desenvolvimento

```bash
npm install
npm test
```

O frontend está em `index.html`. As funções em `api/` e as integrações de provedores foram mantidas para compatibilidade com versões antigas, mas não fazem parte do fluxo local do frontend atual.

## Licença e modelos

Respeite a licença de cada modelo GGUF e os termos dos repositórios de origem. O Guinho-Code não redistribui os pesos dos modelos.
