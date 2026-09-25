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
   em `~/guinho-router.py`.
2. Coloque os GGUFs em `~/storage/downloads/I.As`, `~/storage/downloads`
   (inclusive uma subpasta), ou `~/models`. Nomes contendo `gemma` e
   `smol` são detectados sem precisar renomear os arquivos. Para um
   diretório diferente, configure `GUINHO_MODEL_DIR` antes de iniciar.
3. Se houver vários arquivos ambíguos, indique o arquivo exato:

   ```bash
   export GUINHO_GEMMA_MODEL="$HOME/storage/downloads/I.As/seu-gemma.gguf"
   export GUINHO_SMOL_MODEL="$HOME/storage/downloads/I.As/seu-smol.gguf"
   ```

4. Execute `python ~/guinho-router.py` e verifique os arquivos reconhecidos:

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


## Ollama: SmolLM2 e Gemma já instalados no Termux

O roteador da porta `8090` agora consulta também a API local do Ollama em
`127.0.0.1:11434`. O Eliza exibe modelos GGUF e modelos Ollama, com identificação
da origem e desabilita os que não foram encontrados. Não é necessário exportar
os modelos do Ollama como GGUF, copiá-los nem cadastrar API externa.

Os tags reconhecidos são `smollm2:360m` (opção **SmolLM2 360M**),
`smollm2:135m` (opção **SmolLM2 135M**) e `gemma3:270m`
(**Gemma 3 270M (Ollama)**). A opção Gemma original prefere o GGUF, quando
presente, e usa o Ollama quando o GGUF não estiver disponível. O modo
**Automático** só considera modelos detectados. Modelos `-cloud` não entram
nessa lista local.

Inicie o Ollama em uma sessão do Termux (se ainda não estiver rodando):

```bash
ollama serve
```

Em outra sessão, atualize e inicie o roteador:

```bash
curl -fL https://raw.githubusercontent.com/mayracanellasoares-bot/Guinho-Code/main/guinho-router.py -o ~/guinho-router.py
python ~/guinho-router.py
```

Confirme os modelos e a origem antes de abrir a interface:

```bash
curl -s http://127.0.0.1:8090/models
```

Para atualizar o código do Eliza (se já tiver um clone do projeto):

```bash
cd ~/Guinho-Code
git pull --ff-only
cd gameeliza
python app.py
```

O caminho do clone pode ser diferente; a atualização deve ser aplicada ao
`gameeliza/app.py` do diretório que está em execução. No navegador do mesmo
aparelho, abra `http://127.0.0.1:8000`, entre em **LLM local**, selecione
a IA e conecte ao endereço `http://127.0.0.1:8090`.

O seletor é local ao aparelho, não publica os modelos no site da Vercel.
A troca não baixa pesos novos e não interrompe o daemon do Ollama; o roteador
encerra apenas o processo do llama-server que ele mesmo iniciou.
