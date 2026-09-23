# Dev_Eliza MultiDev

Assistente local determinístico para programação, depuração reflexiva, busca de snippets e memória de projetos. A identidade e o diálogo seguem a estrutura do script de referência `dev_eliza.py`, com regras ampliadas para jogos, dados, servidores, APIs, erros e programação geral.

## Execução

    cd gameeliza
    python3 app.py

Abra http://127.0.0.1:8000. Use o botão **Anexar códigos** para adicionar arquivos à biblioteca local; o limite é de 512 KB por arquivo. O servidor não é executado pelo GitHub Pages: para publicação pública, a interface precisa ser adaptada para uma função serverless ou hospedada em um serviço Python.

## Biblioteca

A biblioteca contém snippets originais, organizados por linguagem e tema. A busca usa pontuação determinística por palavras-chave, nome, tags, conteúdo e associações aprendidas na memória local; não usa embeddings nem copia código de terceiros.

Formatos aceitos: `.html`, `.css`, `.txt`, `.gd`, `.cs`, `.py`, `.cpp`, `.js`, `.sql` e `.json`.
