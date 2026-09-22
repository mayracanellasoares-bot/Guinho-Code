const SOURCE_LABELS = {
  wikipedia: 'Wikipedia',
  stackoverflow: 'Stack Overflow',
  mdn: 'MDN Web Docs',
  w3schools: 'W3Schools',
  devdocs: 'DevDocs',
  catalog: 'Catalogo Guinho'
};

const CATALOG = [
  {
    source: 'catalog',
    title: 'Python - bibliotecas principais',
    url: 'https://pypi.org/',
    keywords: ['python', 'pandas', 'numpy', 'ia', 'machine learning', 'django', 'flask', 'selenium'],
    snippet: 'NumPy/Pandas para dados, Scikit-learn para ML classico, PyTorch/TensorFlow para redes neurais, Django/Flask para web e Selenium/BeautifulSoup para automacao.'
  },
  {
    source: 'catalog',
    title: 'C#/.NET - bibliotecas principais',
    url: 'https://learn.microsoft.com/dotnet/',
    keywords: ['c#', 'csharp', '.net', 'asp.net', 'entity framework', 'unity', 'json'],
    snippet: 'ASP.NET Core para APIs, EF Core para banco de dados, Unity para jogos e System.Text.Json/Newtonsoft.Json para JSON.'
  },
  {
    source: 'catalog',
    title: 'Web front-end',
    url: 'https://developer.mozilla.org/',
    keywords: ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'tailwind', 'bootstrap', 'gsap'],
    snippet: 'React, Vue e Angular para UI; Tailwind CSS e Bootstrap para estilos; GSAP para animacoes complexas.'
  },
  {
    source: 'catalog',
    title: 'Canvas e jogos web',
    url: 'https://developer.mozilla.org/docs/Web/API/Canvas_API',
    keywords: ['canvas', 'jogo', 'game', 'three', 'phaser', 'pixi', 'fabric', 'webgl'],
    snippet: 'Phaser para jogos 2D, Three.js para 3D, PixiJS para renderizacao 2D rapida e Fabric.js para editores visuais.'
  },
  {
    source: 'catalog',
    title: 'Node.js - back-end',
    url: 'https://nodejs.org/docs/latest/api/',
    keywords: ['node', 'nodejs', 'express', 'socket.io', 'prisma', 'sequelize', 'passport'],
    snippet: 'Express para APIs, Socket.IO para tempo real, Prisma/Sequelize para banco e Passport para autenticacao.'
  },
  {
    source: 'catalog',
    title: 'Java - ecossistema corporativo',
    url: 'https://docs.oracle.com/en/java/',
    keywords: ['java', 'spring', 'hibernate', 'junit', 'mockito', 'lombok'],
    snippet: 'Spring Boot para aplicacoes web, Hibernate para ORM, JUnit/Mockito para testes e Lombok para reduzir boilerplate.'
  },
  {
    source: 'catalog',
    title: 'TypeScript - apps robustos',
    url: 'https://www.typescriptlang.org/docs/',
    keywords: ['typescript', 'ts', 'zod', 'trpc', 'tanstack', 'vite', 'vitest', 'next'],
    snippet: 'TypeScript para tipagem, Zod para validacao, tRPC para APIs tipadas, TanStack Query para dados, Vite para build e Vitest para testes.'
  },
  {
    source: 'catalog',
    title: 'Mobile - Android, iOS e apps hibridos',
    url: 'https://reactnative.dev/',
    keywords: ['mobile', 'android', 'ios', 'react native', 'expo', 'flutter', 'kotlin', 'swift'],
    snippet: 'React Native/Expo para apps JavaScript, Flutter para UI multiplataforma, Kotlin para Android nativo e Swift para iOS nativo.'
  },
  {
    source: 'catalog',
    title: 'IA e automacao com LLMs',
    url: 'https://huggingface.co/docs',
    keywords: ['ia', 'ai', 'llm', 'langchain', 'llamaindex', 'hugging face', 'openai', 'ollama', 'spacy'],
    snippet: 'OpenAI SDK para modelos via API, LangChain/LlamaIndex para RAG e agentes, Hugging Face Transformers para modelos, Ollama para local e spaCy para NLP.'
  },
  {
    source: 'catalog',
    title: 'Bancos de dados e busca',
    url: 'https://www.postgresql.org/docs/',
    keywords: ['database', 'banco', 'sql', 'postgres', 'postgresql', 'sqlite', 'redis', 'prisma', 'drizzle', 'elasticsearch', 'meilisearch'],
    snippet: 'PostgreSQL para dados relacionais, SQLite para local, Redis para cache/fila, Prisma/Drizzle para ORM e Elasticsearch/Meilisearch para busca.'
  },
  {
    source: 'catalog',
    title: 'Testes e qualidade',
    url: 'https://playwright.dev/',
    keywords: ['teste', 'testes', 'qa', 'playwright', 'cypress', 'jest', 'vitest', 'testing library', 'eslint', 'prettier'],
    snippet: 'Playwright/Cypress para testes end-to-end, Jest/Vitest para unidade, Testing Library para UI, ESLint/Prettier para qualidade e padronizacao.'
  },
  {
    source: 'catalog',
    title: 'Seguranca de aplicacoes',
    url: 'https://owasp.org/www-project-top-ten/',
    keywords: ['seguranca', 'security', 'owasp', 'helmet', 'bcrypt', 'argon2', 'jose', 'jwt', 'rate limit', 'zod'],
    snippet: 'OWASP Top 10 como referencia, Helmet para headers, bcrypt/argon2 para senhas, jose/JWT para tokens, Zod para validacao e rate limiting contra abuso.'
  },
  {
    source: 'catalog',
    title: 'DevOps e deploy',
    url: 'https://docs.github.com/actions',
    keywords: ['devops', 'deploy', 'docker', 'kubernetes', 'terraform', 'github actions', 'vercel', 'nginx', 'ci', 'cd'],
    snippet: 'Docker para empacotar, GitHub Actions para CI/CD, Vercel para web/serverless, Terraform para infraestrutura, Kubernetes para orquestracao e Nginx como proxy.'
  },
  {
    source: 'catalog',
    title: 'Desktop multiplataforma',
    url: 'https://www.electronjs.org/docs/latest/',
    keywords: ['desktop', 'electron', 'tauri', 'pyside', 'qt', 'maui', '.net maui'],
    snippet: 'Electron para desktop com web stack, Tauri para binarios menores, PySide/Qt para Python desktop e .NET MAUI para C# multiplataforma.'
  },
  {
    source: 'catalog',
    title: 'Go - APIs e ferramentas',
    url: 'https://go.dev/doc/',
    keywords: ['go', 'golang', 'gin', 'fiber', 'gorm', 'cobra', 'grpc', 'api'],
    snippet: 'Gin/Fiber para APIs, GORM para ORM, Cobra para CLIs e gRPC para servicos de alta performance.'
  },
  {
    source: 'catalog',
    title: 'Rust - performance e sistemas',
    url: 'https://doc.rust-lang.org/',
    keywords: ['rust', 'tokio', 'axum', 'actix', 'serde', 'tauri', 'bevy'],
    snippet: 'Tokio para async, Axum/Actix para web, Serde para serializacao, Tauri para desktop e Bevy para jogos.'
  },
  {
    source: 'catalog',
    title: 'PHP - web tradicional e APIs',
    url: 'https://www.php.net/docs.php',
    keywords: ['php', 'laravel', 'symfony', 'composer', 'phpunit', 'wordpress'],
    snippet: 'Laravel para web moderna, Symfony para componentes corporativos, Composer para pacotes, PHPUnit para testes e WordPress para CMS.'
  },
  {
    source: 'catalog',
    title: 'Motores de jogos',
    url: 'https://docs.godotengine.org/',
    keywords: ['jogos', 'games', 'godot', 'unity', 'unreal', 'love2d', 'phaser', 'bevy'],
    snippet: 'Godot para 2D/3D leve, Unity para C#, Unreal para 3D AAA, Love2D para Lua, Phaser para web 2D e Bevy para Rust.'
  },
  {
    source: 'catalog',
    title: 'Linguistica computacional - spaCy e Stanza',
    url: 'https://spacy.io/models',
    keywords: ['linguistica', 'nlp', 'spacy', 'matcher', 'stanza', 'stanford', 'mandarim', 'russo', 'gramatica', 'sintaxe'],
    snippet: 'spaCy Models e Matcher para regras e estruturas gramaticais; Stanza/Stanford NLP para analise linguistica tradicional com boa cobertura multi-idioma.'
  },
  {
    source: 'catalog',
    title: 'Radicais e correcao - Snowball e LanguageTool',
    url: 'https://snowballstem.org/',
    keywords: ['snowball', 'stemmer', 'stemming', 'radical', 'languagetool', 'correcao', 'ortografia', 'gramatica', 'alemao', 'frances', 'ingles', 'russo'],
    snippet: 'Snowball reduz palavras ao radical em varios idiomas; LanguageTool oferece base de regras para corretores gramaticais e ortograficos offline.'
  },
  {
    source: 'catalog',
    title: 'Deteccao offline de idioma - Lingua-py',
    url: 'https://github.com/pemistahl/lingua-py',
    keywords: ['lingua', 'lingua-py', 'detectar idioma', 'idioma offline', 'language detection', 'mandarim', 'russo', 'alemao'],
    snippet: 'Lingua-py detecta idioma localmente antes de aplicar regras especificas por lingua, util para bots multi-idioma sem depender de API externa.'
  },
  {
    source: 'catalog',
    title: 'Portugues - NLTK, CoGrOO e Linguateca',
    url: 'https://www.linguateca.pt/',
    keywords: ['portugues', 'pt-br', 'nltk', 'cogroo', 'linguateca', 'corretor', 'corpus', 'dicionario', 'sintatico'],
    snippet: 'NLTK para ferramentas classicas de NLP, CoGrOO para correcao gramatical do portugues brasileiro e Linguateca para corpus e recursos sintaticos.'
  },
  {
    source: 'catalog',
    title: 'Bots - intents, respostas e fallback',
    url: 'https://rasa.com/docs/',
    keywords: ['bot', 'chatbot', 'intent', 'intents', 'respostas', 'fallback', 'rasa', 'botpress', 'chatterbot'],
    snippet: 'Estruture bots por intent, exemplos de perguntas, resposta principal, variacoes, tags, contexto e fallback.'
  }
];

function cleanQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
  res.status(status).json(body);
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

async function safeFetchJson(url, timeoutMs = 7000) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Guinho-Code/1.0 (knowledge search)'
      },
      signal: timeout.controller.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    timeout.done();
  }
}

async function searchWikipedia(query) {
  const url = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&srlimit=5&srsearch=' + encodeURIComponent(query);
  const data = await safeFetchJson(url);
  return (data?.query?.search || []).map(item => ({
    source: SOURCE_LABELS.wikipedia,
    kind: 'live',
    title: item.title,
    url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(item.title.replace(/ /g, '_')),
    snippet: stripHtml(item.snippet),
    score: item.size || 0
  }));
}

async function searchStackOverflow(query) {
  const url = 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&site=stackoverflow&pagesize=5&q=' + encodeURIComponent(query);
  const data = await safeFetchJson(url);
  return (data?.items || []).map(item => ({
    source: SOURCE_LABELS.stackoverflow,
    kind: 'live',
    title: item.title,
    url: item.link,
    snippet: 'Score ' + (item.score || 0) + ' | respostas ' + (item.answer_count || 0) + ' | tags: ' + (item.tags || []).slice(0, 5).join(', '),
    score: item.score || 0
  }));
}

function curatedDocs(query) {
  const q = encodeURIComponent(query);
  return [
    {
      source: SOURCE_LABELS.mdn,
      kind: 'curated-link',
      title: 'Pesquisar na MDN Web Docs',
      url: 'https://developer.mozilla.org/pt-BR/search?q=' + q,
      snippet: 'Melhor fonte para HTML, CSS, JavaScript, Canvas, Web APIs, compatibilidade e PWA.',
      score: 0
    },
    {
      source: SOURCE_LABELS.devdocs,
      kind: 'curated-link',
      title: 'Pesquisar no DevDocs',
      url: 'https://devdocs.io/#q=' + q,
      snippet: 'Documentacao agregada e rapida de linguagens, frameworks e APIs, com suporte offline.',
      score: 0
    },
    {
      source: SOURCE_LABELS.w3schools,
      kind: 'curated-link',
      title: 'Pesquisar no W3Schools',
      url: 'https://www.w3schools.com/search/search_result.asp?q=' + q,
      snippet: 'Consulta rapida e exemplos basicos de Python, Java, C#, SQL, HTML, CSS e JavaScript.',
      score: 0
    }
  ];
}

function searchCatalog(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return CATALOG
    .map(item => {
      const haystack = [item.title, item.snippet, ...item.keywords].join(' ').toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ item, score }) => ({
      source: SOURCE_LABELS.catalog,
      kind: 'curated',
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      score
    }));
}

function selectedSources(value) {
  const raw = String(value || 'all').toLowerCase();
  if (raw === 'all') return new Set(['wikipedia', 'stackoverflow', 'docs', 'catalog']);
  return new Set(raw.split(',').map(item => item.trim()).filter(Boolean));
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const body = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body : {};
  const query = cleanQuery(req.query?.q || body.q || body.query);
  if (query.length < 2) {
    send(res, 400, { ok: false, error: 'Informe uma busca com pelo menos 2 caracteres.' });
    return;
  }

  const sources = selectedSources(req.query?.source || body.source);
  const warnings = [];
  const jobs = [];
  if (sources.has('wikipedia')) jobs.push(searchWikipedia(query).catch(error => {
    warnings.push('Wikipedia indisponivel: ' + (error.message || 'erro'));
    return [];
  }));
  if (sources.has('stackoverflow')) jobs.push(searchStackOverflow(query).catch(error => {
    warnings.push('Stack Overflow indisponivel: ' + (error.message || 'erro'));
    return [];
  }));
  if (sources.has('docs')) jobs.push(Promise.resolve(curatedDocs(query)));
  if (sources.has('catalog')) jobs.push(Promise.resolve(searchCatalog(query)));

  const groups = await Promise.all(jobs);
  const results = groups.flat().slice(0, 20);
  send(res, 200, {
    ok: true,
    query,
    generatedAt: new Date().toISOString(),
    sameDomain: '/api/knowledge/search?q=' + encodeURIComponent(query),
    results,
    warnings
  });
}
