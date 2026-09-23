# GameEliza MultiDev

Aplicação local determinística para depuração reflexiva, busca de snippets e memória de projetos.

## Execução

    cd gameeliza
    python3 app.py

Abra http://127.0.0.1:8000. O servidor não é executado pelo GitHub Pages: para uma publicação pública, a interface precisa ser adaptada para uma função serverless ou hospedada em um serviço Python.

## Biblioteca

A biblioteca contém snippets originais, organizados por linguagem e tema. A busca usa pontuação por palavras-chave, nome, tags e conteúdo; não usa embeddings nem copia código de terceiros.

Formatos aceitos no upload: .html, .css, .txt, .gd, .cs, .py, .cpp, .js, .sql e .json. Limite: 512 KB por arquivo.
