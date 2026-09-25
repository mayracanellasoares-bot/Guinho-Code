# Dev_Eliza MultiDev

Assistente local determinístico para programação, depuração reflexiva, busca de snippets e memória de projetos. A identidade e o diálogo seguem a estrutura do script de referência `dev_eliza.py`, com regras ampliadas para jogos, dados, servidores, APIs, erros e programação geral.

## Execução

    cd gameeliza
    python3 app.py

Abra http://127.0.0.1:8000. Use o botão **Anexar códigos** para adicionar arquivos à biblioteca local; o limite é de 512 KB por arquivo. O servidor não é executado pelo GitHub Pages: para publicação pública, a interface precisa ser adaptada para uma função serverless ou hospedada em um serviço Python.

## Biblioteca

A biblioteca contém snippets originais, organizados por linguagem e tema. A busca usa pontuação determinística por palavras-chave, nome, tags, conteúdo e associações aprendidas na memória local; não usa embeddings nem copia código de terceiros.

Formatos aceitos: `.html`, `.css`, `.txt`, `.gd`, `.cs`, `.py`, `.cpp`, `.js`, `.sql` e `.json`.


## Escolha de IA instalada no Termux (Gemma / Smol)

A aba **LLM local** possui um seletor: Automático, Gemma, Smol, Qwen Coder e
Nemotron. Os arquivos ficam no aparelho: o `guinho-router.py` encontra GGUFs
e expõe a lista no endpoint `/models`.

1. Atualize **também no aparelho** o arquivo `guinho-router.py` deste
   repositório. Alterações no GitHub não substituem automaticamente a cópia
   em ``/guinho-router.py`.
2. Coloque os GGUFs em ``/storage/downloads/I.As`, ``/storage/downloads`
   (inclusive uma subpasta), ou ``/models`. Nomes contendo `gemma` e
   `smol` são detectados sem precisar renomear os arquivos. Para um
   diretório diferente, configure `GUINHO_MODEL_DIR` antes de iniciar.
3. Se houver vários arquivos ambíguos, indique o arquivo exato:

   ```bash
   export GUINHO_GEMMA_MODEL="$HOME/storage/downloads/I.As/seu-gemma.gguf"
   export GUINHO_SMOL_MODEL="$HOME/storage/downloads/I.As/seu-smol.gguf"
   ```

4. Execute `python `/guinho-router.py` e verifique os arquivos reconhecidos:

   ```bash
   curl -s http://127.0.0.1:8090/models
   ```

5. No mesmo aparelho, execute `cd gameeliza && python app.py` e acesse
   `http://127.0.0.1:8000`. Abra **LLM local**, escolha **Gemma** ou **Smol**,
   clique em **Conectar ao Termux** e envie a mensagem. A troca de modelos
   não requer reiniciar a interface. Somente um GGUF fica carregado por vez;
   a troca pode levar alguns segundos.

**Atenção:** este seletor aceita GGUF compatível com llama.cpp; não carrega
ONNX ou safetensors. O botão separado "Ativar Gemma no navegador" usa outra
implementação e não lê arquivos do Termux. O endereço `127.0.0.1` refere-se ao
próprio aparelho: a integração não expõe essas SLMs aos visitantes do site
público na Vercel.
