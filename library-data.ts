export interface LibraryItem {
  name: string;
  category: 'cenario' | 'atores' | 'comportamento' | 'eventos' | 'controle' | 'funcoes' | 'propriedades' | 'cores' | 'referencias' | 'ecossistemas' | 'linguistica' | 'bots';
  syntax: string;
  desc: string;
  example: string;
}

export const BIT_LIBRARY: LibraryItem[] = [
  // Cenário & Configuração
  {
    name: 'tela',
    category: 'cenario',
    syntax: 'tela LARGURAxALTURA',
    desc: 'Define a resolução nativa da tela do jogo (ex: 160x120 para estética retrô pixel art).',
    example: 'tela 160x120'
  },
  {
    name: 'fundo',
    category: 'cenario',
    syntax: 'fundo COR',
    desc: 'Define a cor de fundo do cenário do jogo.',
    example: 'fundo preto'
  },
  {
    name: 'recebe (atribuição)',
    category: 'cenario',
    syntax: 'variavel recebe VALOR',
    desc: 'Cria uma variável ou atualiza o seu valor.',
    example: 'pontos recebe 0\nvidas recebe 3'
  },
  {
    name: 'diga',
    category: 'cenario',
    syntax: 'diga EXPRESSAO',
    desc: 'Exibe uma mensagem ou valor no console do jogo.',
    example: 'diga "Jogo Iniciado!"\ndiga "Pontos: " + pontos'
  },

  // Atores
  {
    name: 'ator ... fim',
    category: 'atores',
    syntax: 'ator NomeDoAtor\n  ...\nfim',
    desc: 'Declara um novo ator/objeto com seus atributos visuais e comportamentos.',
    example: 'ator Jogador\n  desenho quadrado 8, verde\n  posição 76, 56\nfim'
  },
  {
    name: 'desenho quadrado',
    category: 'atores',
    syntax: 'desenho quadrado TAMANHO, COR',
    desc: 'Define o formato visual do ator como um quadrado.',
    example: 'desenho quadrado 8, azul'
  },
  {
    name: 'desenho retângulo',
    category: 'atores',
    syntax: 'desenho retângulo LARGURA, ALTURA, COR',
    desc: 'Define o formato visual do ator como um retângulo com largura e altura personalizadas.',
    example: 'desenho retângulo 20, 6, amarelo'
  },
  {
    name: 'posição',
    category: 'atores',
    syntax: 'posição X, Y',
    desc: 'Posiciona o ator nas coordenadas iniciais X e Y da tela.',
    example: 'posição 80, 60'
  },
  {
    name: 'velocidade',
    category: 'atores',
    syntax: 'velocidade VX, VY',
    desc: 'Aplica velocidade contínua aos eixos horizontal (vx) e vertical (vy).',
    example: 'velocidade 2, 1.5'
  },

  // Comportamentos Automáticos
  {
    name: 'controlado por setas',
    category: 'comportamento',
    syntax: 'controlado por setas',
    desc: 'Permite controlar o ator automaticamente usando as setas do teclado (ou gamepad na tela).',
    example: 'ator Nave\n  desenho retângulo 10, 6, ciano\n  controlado por setas\nfim'
  },
  {
    name: 'limita à tela',
    category: 'comportamento',
    syntax: 'limita à tela',
    desc: 'Impede o ator de ultrapassar as quatro bordas da tela.',
    example: 'limita à tela'
  },
  {
    name: 'quica nas bordas',
    category: 'comportamento',
    syntax: 'quica nas bordas',
    desc: 'Faz o ator rebater automaticamente ao encostar em qualquer uma das quatro bordas.',
    example: 'quica nas bordas'
  },
  {
    name: 'quica nas bordas horizontais',
    category: 'comportamento',
    syntax: 'quica nas bordas horizontais',
    desc: 'Rebate a velocidade horizontal (vx) ao atingir os limites esquerdo e direito.',
    example: 'quica nas bordas horizontais'
  },
  {
    name: 'quica nas bordas verticais',
    category: 'comportamento',
    syntax: 'quica nas bordas verticais',
    desc: 'Rebate a velocidade vertical (vy) ao atingir o teto e o chão.',
    example: 'quica nas bordas verticais'
  },

  // Eventos
  {
    name: 'quando atualiza:',
    category: 'eventos',
    syntax: 'quando atualiza:\n  ...\nfim',
    desc: 'Bloco executado repetidamente a cada quadro de animação (game loop).',
    example: 'quando atualiza:\n  se x > 160 então\n    x recebe 0\n  fim\nfim'
  },
  {
    name: 'quando colide com:',
    category: 'eventos',
    syntax: 'quando colide com "NomeDoOutroAtor":\n  ...\nfim',
    desc: 'Executado no momento exato em que o ator colide com outro ator especificado.',
    example: 'quando colide com "Moeda":\n  pontos recebe pontos + 1\n  diga "Pegou a moeda!"\nfim'
  },

  // Controle de Fluxo
  {
    name: 'se ... então ... fim',
    category: 'controle',
    syntax: 'se CONDIÇÃO então\n  ...\nfim',
    desc: 'Executa comandos se a condição for verdadeira.',
    example: 'se vidas <= 0 então\n  diga "Fim de Jogo!"\nfim'
  },
  {
    name: 'senão se / senão',
    category: 'controle',
    syntax: 'se C1 então\n  ...\nsenão se C2 então\n  ...\nsenão\n  ...\nfim',
    desc: 'Cria ramificações alternativas para testar múltiplas condições.',
    example: 'se pontos > 10 então\n  diga "Pontuação alta"\nsenão\n  diga "Continue jogando"\nfim'
  },
  {
    name: 'repita N vezes',
    category: 'controle',
    syntax: 'repita QUANTIDADE vezes\n  ...\nfim',
    desc: 'Executa um bloco de comandos o número determinado de vezes.',
    example: 'repita 3 vezes\n  diga "Contagem!"\nfim'
  },
  {
    name: 'enquanto ... faça',
    category: 'controle',
    syntax: 'enquanto CONDIÇÃO faça\n  ...\nfim',
    desc: 'Repete o bloco de código enquanto a condição permanecer verdadeira.',
    example: 'enquanto contagem > 0 faça\n  contagem recebe contagem - 1\nfim'
  },

  // Funções Nativas (Built-ins da Biblioteca)
  {
    name: 'aleatorio(min, max)',
    category: 'funcoes',
    syntax: 'aleatorio(min, max)',
    desc: 'Retorna um número inteiro pseudo-aleatório entre min e max (inclusive). Aceita com ou sem acento.',
    example: 'x recebe aleatorio(10, 150)'
  },
  {
    name: 'distancia(x1, y1, x2, y2)',
    category: 'funcoes',
    syntax: 'distancia(x1, y1, x2, y2)',
    desc: 'Calcula a distância euclidiana entre dois pontos (x1, y1) e (x2, y2).',
    example: 'd recebe distancia(x, y, Inimigo.x, Inimigo.y)'
  },
  {
    name: 'tecla("nome")',
    category: 'funcoes',
    syntax: 'tecla("nome")',
    desc: 'Retorna verdadeiro se a tecla informada estiver pressionada (ex: "arrowup", "espaco", "a", "w").',
    example: 'se tecla("espaco") então\n  diga "Tiro disparado!"\nfim'
  },
  {
    name: 'toque()',
    category: 'funcoes',
    syntax: 'toque()',
    desc: 'Retorna verdadeiro se a tela do celular ou tablet estiver sendo tocada.',
    example: 'se toque() então\n  y recebe y - 1\nfim'
  },
  {
    name: 'tempo()',
    category: 'funcoes',
    syntax: 'tempo()',
    desc: 'Retorna o tempo decorrido desde o início da execução em segundos.',
    example: 'segundos recebe tempo()'
  },
  {
    name: 'seno(angulo) / cosseno(angulo)',
    category: 'funcoes',
    syntax: 'seno(graus) ou cosseno(graus)',
    desc: 'Calcula o seno ou cosseno trigonométrico para o ângulo informado em graus.',
    example: 'offset recebe seno(tempo() * 60) * 10'
  },
  {
    name: 'raiz(valor)',
    category: 'funcoes',
    syntax: 'raiz(numero)',
    desc: 'Calcula a raiz quadrada de um número.',
    example: 'r recebe raiz(16) # r = 4'
  },
  {
    name: 'absoluto(valor)',
    category: 'funcoes',
    syntax: 'absoluto(numero)',
    desc: 'Retorna o módulo (valor positivo absoluto).',
    example: 'distX recebe absoluto(x - Inimigo.x)'
  },
  {
    name: 'piso(v) / teto(v) / arredonda(v)',
    category: 'funcoes',
    syntax: 'piso(v), teto(v), arredonda(v)',
    desc: 'Funções de arredondamento para baixo (piso), para cima (teto) e para o inteiro mais próximo (arredonda).',
    example: 'inteiro recebe piso(3.8) # 3'
  },

  // Propriedades dos Atores
  {
    name: 'x / y',
    category: 'propriedades',
    syntax: 'x, y (ou Ator.x, Ator.y)',
    desc: 'Coordenadas horizontais e verticais do ator no plano 2D.',
    example: 'x recebe x + 2\nInimigo.y recebe 10'
  },
  {
    name: 'vx / vy',
    category: 'propriedades',
    syntax: 'vx, vy (ou Ator.vx, Ator.vy)',
    desc: 'Velocidade vetorial nos eixos X e Y aplicada automaticamente a cada quadro.',
    example: 'vx recebe -1.5\nvy recebe 0'
  },
  {
    name: 'largura / altura',
    category: 'propriedades',
    syntax: 'largura, altura (ou Ator.largura, Ator.altura)',
    desc: 'Dimensões dinâmicas do ator em pixels.',
    example: 'largura recebe 24\naltura recebe 8'
  },
  {
    name: 'ativo',
    category: 'propriedades',
    syntax: 'ativo (ou Ator.ativo)',
    desc: 'Indica se o ator está visível e participando das colisões (verdadeiro/falso).',
    example: 'ativo recebe falso'
  },

  // Cores Suportadas
  {
    name: 'Cores Padrão do Bit',
    category: 'cores',
    syntax: 'preto, branco, vermelho, verde, azul, amarelo, ciano, magenta, cinza, laranja, roxo, rosa, marrom, invisivel',
    desc: 'Paleta padrão integrada de cores 8-bit pré-definidas.',
    example: 'fundo azul\ndesenho quadrado 10, amarelo'
  },

  // Referências técnicas para programação
  {
    name: 'Wikipédia Técnica de Programação',
    category: 'referencias',
    syntax: 'conceitos, algoritmos, história, arquitetura de software',
    desc: 'Base enciclopédica útil para definições, contexto histórico, algoritmos, linguagens e fundamentos de computação.',
    example: 'https://pt.wikipedia.org/wiki/Linguagem_de_programa%C3%A7%C3%A3o\nhttps://en.wikipedia.org/wiki/Portal:Programming\nhttps://pt.wikipedia.org/wiki/WikiWikiWeb'
  },
  {
    name: 'MDN Web Docs',
    category: 'referencias',
    syntax: 'HTML, CSS, JavaScript, Canvas, APIs Web, PWA',
    desc: 'Referência prioritária para desenvolvimento web: sintaxe, compatibilidade, APIs do navegador e comportamento correto de HTML, CSS e JavaScript.',
    example: 'https://developer.mozilla.org/'
  },
  {
    name: 'W3Schools',
    category: 'referencias',
    syntax: 'consulta rápida, tutoriais, exemplos básicos',
    desc: 'Fonte prática para exemplos rápidos de Python, Java, C#, SQL, HTML, CSS, JavaScript e outras tecnologias.',
    example: 'https://www.w3schools.com/'
  },
  {
    name: 'Stack Overflow',
    category: 'referencias',
    syntax: 'erros, exceções, bugs, soluções práticas',
    desc: 'Base prática de perguntas e respostas para investigar mensagens de erro, bugs recorrentes e soluções já discutidas por programadores.',
    example: 'https://stackoverflow.com/'
  },
  {
    name: 'DevDocs.io',
    category: 'referencias',
    syntax: 'documentação agregada e pesquisável',
    desc: 'Manual rápido que reúne documentação de centenas de linguagens, bibliotecas e frameworks em uma interface única, com suporte offline.',
    example: 'https://devdocs.io/'
  },

  // Ecossistemas e bibliotecas externas
  {
    name: 'Python - Bibliotecas principais',
    category: 'ecossistemas',
    syntax: 'NumPy, Pandas, Scikit-learn, TensorFlow, PyTorch, Django, Flask, Selenium, BeautifulSoup',
    desc: 'Ecossistema forte para IA, ciência de dados, automação, web scraping e back-end.',
    example: 'Use NumPy/Pandas para dados, Scikit-learn para ML clássico, PyTorch/TensorFlow para redes neurais, Django/Flask para web e Selenium/BeautifulSoup para automação.'
  },
  {
    name: 'C#/.NET - Bibliotecas principais',
    category: 'ecossistemas',
    syntax: 'ASP.NET Core, Entity Framework Core, Unity, Newtonsoft.Json, System.Text.Json',
    desc: 'Ecossistema forte para aplicações corporativas, APIs, jogos com Unity e sistemas de alta performance.',
    example: 'Use ASP.NET Core para APIs, EF Core para banco de dados, Unity para jogos e System.Text.Json ou Newtonsoft.Json para JSON.'
  },
  {
    name: 'Web Front-End - Bibliotecas principais',
    category: 'ecossistemas',
    syntax: 'React, Vue, Angular, Tailwind CSS, Bootstrap, GSAP',
    desc: 'Bibliotecas e frameworks para interfaces web, componentes, layout responsivo e animações.',
    example: 'Use React para UI escalável, Vue para simplicidade, Angular para aplicações corporativas, Tailwind/Bootstrap para estilos e GSAP para animações.'
  },
  {
    name: 'Canvas e Jogos Web',
    category: 'ecossistemas',
    syntax: 'Three.js, Phaser, PixiJS, Fabric.js',
    desc: 'Ferramentas para gráficos, jogos 2D/3D, renderização de alta performance e editores visuais no navegador.',
    example: 'Use Phaser para jogos 2D, Three.js para 3D, PixiJS para renderização 2D rápida e Fabric.js para editores de formas/imagens.'
  },
  {
    name: 'Node.js - Bibliotecas principais',
    category: 'ecossistemas',
    syntax: 'Express, Socket.IO, Prisma, Sequelize, Passport',
    desc: 'Ecossistema para back-end JavaScript/TypeScript, APIs, tempo real, autenticação e banco de dados.',
    example: 'Use Express para APIs, Socket.IO para tempo real, Prisma/Sequelize para banco e Passport para autenticação.'
  },
  {
    name: 'Java - Bibliotecas principais',
    category: 'ecossistemas',
    syntax: 'Spring Boot, Hibernate, JUnit, Mockito, Lombok',
    desc: 'Ecossistema corporativo robusto para APIs, microsserviços, persistência, testes e redução de código repetitivo.',
    example: 'Use Spring Boot para aplicações web, Hibernate para ORM, JUnit/Mockito para testes e Lombok para reduzir boilerplate.'
  },
  {
    name: 'TypeScript - Aplicações robustas',
    category: 'ecossistemas',
    syntax: 'TypeScript, Zod, tRPC, TanStack Query, Vite, Vitest, Next.js',
    desc: 'Ecossistema para aplicações web com tipagem, validação, build rápido, testes e APIs mais seguras.',
    example: 'Use TypeScript para tipagem, Zod para validação, TanStack Query para dados, Vite para build e Vitest para testes.'
  },
  {
    name: 'Mobile - Android e iOS',
    category: 'ecossistemas',
    syntax: 'React Native, Expo, Flutter, Kotlin, Swift',
    desc: 'Opções para criar aplicativos móveis nativos ou multiplataforma, com diferentes custos de manutenção.',
    example: 'Use Expo para app mobile rápido com JavaScript, Flutter para UI multiplataforma, Kotlin para Android nativo e Swift para iOS nativo.'
  },
  {
    name: 'IA e agentes',
    category: 'ecossistemas',
    syntax: 'OpenAI SDK, LangChain, LlamaIndex, Hugging Face, Ollama, spaCy',
    desc: 'Bibliotecas para modelos de linguagem, RAG, agentes, automação, NLP e execução local de modelos.',
    example: 'Use OpenAI SDK para API, LangChain/LlamaIndex para RAG, Hugging Face para modelos, Ollama para local e spaCy para NLP.'
  },
  {
    name: 'Banco de dados e busca',
    category: 'ecossistemas',
    syntax: 'PostgreSQL, SQLite, Redis, Prisma, Drizzle, Elasticsearch, Meilisearch',
    desc: 'Camada de persistência, cache, ORM e busca textual para aplicações reais.',
    example: 'Use PostgreSQL para dados principais, Redis para cache/fila, Prisma ou Drizzle para ORM e Meilisearch/Elasticsearch para busca.'
  },
  {
    name: 'Testes e qualidade',
    category: 'ecossistemas',
    syntax: 'Playwright, Cypress, Jest, Vitest, Testing Library, ESLint, Prettier',
    desc: 'Ferramentas para testes end-to-end, unitários, componentes, lint e padronização de código.',
    example: 'Use Playwright para fluxo real no navegador, Vitest/Jest para unidade, Testing Library para UI e ESLint/Prettier para qualidade.'
  },
  {
    name: 'Segurança de aplicações',
    category: 'ecossistemas',
    syntax: 'OWASP, Helmet, bcrypt, argon2, jose, JWT, rate limiting, Zod',
    desc: 'Base para autenticação, validação, headers seguros, tokens, hash de senha e proteção contra abuso.',
    example: 'Use OWASP como checklist, Helmet para headers, argon2/bcrypt para senhas, jose para JWT e rate limit para endpoints sensíveis.'
  },
  {
    name: 'DevOps e deploy',
    category: 'ecossistemas',
    syntax: 'Docker, GitHub Actions, Vercel, Terraform, Kubernetes, Nginx',
    desc: 'Ferramentas para empacotamento, CI/CD, deploy, infraestrutura e operação de aplicações.',
    example: 'Use GitHub Actions para CI/CD, Vercel para web/serverless, Docker para empacotar e Terraform/Kubernetes quando houver infraestrutura maior.'
  },
  {
    name: 'Desktop multiplataforma',
    category: 'ecossistemas',
    syntax: 'Electron, Tauri, PySide, Qt, .NET MAUI',
    desc: 'Opções para criar aplicativos desktop com web stack, Rust, Python ou C#.',
    example: 'Use Electron para compatibilidade web, Tauri para binário menor, PySide/Qt para Python desktop e .NET MAUI para C#.'
  },
  {
    name: 'Go - APIs e ferramentas',
    category: 'ecossistemas',
    syntax: 'Go, Gin, Fiber, GORM, Cobra, gRPC',
    desc: 'Ecossistema eficiente para APIs, serviços, CLIs e sistemas de alta performance.',
    example: 'Use Gin/Fiber para APIs, GORM para banco, Cobra para CLI e gRPC para comunicação entre serviços.'
  },
  {
    name: 'Rust - performance e segurança',
    category: 'ecossistemas',
    syntax: 'Rust, Tokio, Axum, Actix Web, Serde, Tauri, Bevy',
    desc: 'Ecossistema para aplicações performáticas, seguras, assíncronas, desktop e jogos.',
    example: 'Use Tokio para async, Axum/Actix para web, Serde para serialização, Tauri para desktop e Bevy para jogos.'
  },
  {
    name: 'PHP - Web e CMS',
    category: 'ecossistemas',
    syntax: 'PHP, Laravel, Symfony, Composer, PHPUnit, WordPress',
    desc: 'Ecossistema tradicional e ainda forte para sites, APIs, CMS e sistemas web.',
    example: 'Use Laravel para produtividade, Symfony para componentes corporativos, Composer para pacotes e PHPUnit para testes.'
  },
  {
    name: 'Motores de jogos',
    category: 'ecossistemas',
    syntax: 'Godot, Unity, Unreal, Phaser, Love2D, Bevy',
    desc: 'Opções de engines e frameworks para jogos 2D, 3D, web, mobile e desktop.',
    example: 'Use Godot para 2D/3D leve, Unity para C#, Unreal para 3D avançado, Phaser para web 2D e Bevy para Rust.'
  },

  // Linguística computacional
  {
    name: 'Processamento gramatical multi-idioma',
    category: 'linguistica',
    syntax: 'spaCy Models, spaCy Matcher, Stanza Stanford NLP',
    desc: 'Base para tokenização, entidades, classes gramaticais, dependências sintáticas e regras estruturais em múltiplos idiomas.',
    example: 'Use spaCy Models para pipelines prontos, spaCy Matcher para regras por padrão linguístico e Stanza para análises tradicionais em idiomas como Mandarim e Russo.'
  },
  {
    name: 'Radicais e correção ortográfica',
    category: 'linguistica',
    syntax: 'Snowball Stemmer, LanguageTool',
    desc: 'Ferramentas para reduzir palavras ao radical e estruturar corretores gramaticais/ortográficos offline em múltiplos idiomas.',
    example: 'Use Snowball para stemming em Inglês, Espanhol, Alemão, Italiano, Russo e Francês; use LanguageTool como referência de regras de correção.'
  },
  {
    name: 'Detecção offline de idioma',
    category: 'linguistica',
    syntax: 'Lingua-py',
    desc: 'Identifica o idioma provável do texto antes de aplicar regras específicas, útil para bots que atendem em Português, Inglês, Alemão, Russo ou Mandarim.',
    example: 'Detecte o idioma primeiro; depois escolha regras, prompts e fontes adequadas para aquela língua.'
  },
  {
    name: 'Português - corpus e gramática',
    category: 'linguistica',
    syntax: 'NLTK, CoGrOO, Linguateca',
    desc: 'Recursos para análise, correção e consulta linguística do português, especialmente Português do Brasil.',
    example: 'Use NLTK para NLP clássico, CoGrOO para correção gramatical brasileira e Linguateca para corpus e dicionários sintáticos.'
  },

  // Bases de resposta para bots
  {
    name: 'Datasets para chatbots',
    category: 'bots',
    syntax: 'Kaggle, CoQA, bases JSON/CSV/TXT',
    desc: 'Conjuntos de dados úteis para exemplos de perguntas, respostas, classificação de intenção e manutenção de contexto em conversas.',
    example: 'Estruture os dados por intent, exemplos de perguntas, resposta principal, variações, tags e fallback.'
  },
  {
    name: 'Frameworks de bots',
    category: 'bots',
    syntax: 'Rasa, Botpress, ChatterBot',
    desc: 'Ferramentas para gerenciar intents, fluxos, respostas, contexto e treinamento de bots.',
    example: 'Use Rasa/Botpress para fluxos estruturados; ChatterBot pode servir para experimentos, mas exige curadoria de corpus.'
  },
  {
    name: 'Templates de atendimento e prompts',
    category: 'bots',
    syntax: 'respostas rápidas, fallback, persona, tom, scripts',
    desc: 'Biblioteca de respostas prontas para saudação, dúvidas frequentes, erro, transferência, conclusão e coleta de dados.',
    example: 'Exemplo de intent: saudacao\nPerguntas: oi, bom dia, tudo bem?\nResposta: Olá. Como posso ajudar no seu projeto hoje?\nFallback: Não tenho dados suficientes. Envie o erro, código ou objetivo.'
  }
];
