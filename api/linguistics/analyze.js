const MAX_TEXT_LENGTH = 12000;

const LANGUAGES = [
  {
    code: 'pt',
    label: 'Portugues',
    stopwords: ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'que', 'para', 'com', 'por', 'nao', 'voce', 'vc', 'quero', 'preciso', 'faca', 'faça', 'corrija']
  },
  {
    code: 'en',
    label: 'Ingles',
    stopwords: ['the', 'and', 'or', 'to', 'of', 'in', 'for', 'with', 'that', 'this', 'is', 'are', 'want', 'need', 'fix', 'create']
  },
  {
    code: 'es',
    label: 'Espanhol',
    stopwords: ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'que', 'para', 'con', 'por', 'no', 'quiero', 'necesito', 'crear']
  },
  {
    code: 'fr',
    label: 'Frances',
    stopwords: ['le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'que', 'pour', 'avec', 'pas', 'veux', 'besoin', 'creer']
  },
  {
    code: 'de',
    label: 'Alemao',
    stopwords: ['der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'zu', 'von', 'mit', 'nicht', 'ich', 'will', 'brauche', 'erstellen']
  },
  {
    code: 'it',
    label: 'Italiano',
    stopwords: ['il', 'lo', 'la', 'gli', 'le', 'un', 'una', 'di', 'che', 'per', 'con', 'non', 'voglio', 'bisogno', 'creare']
  },
  {
    code: 'ru',
    label: 'Russo',
    stopwords: ['и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'это', 'нужно']
  }
];

const RESOURCES = {
  spacy: {
    id: 'spacy',
    title: 'spaCy Models Directory',
    url: 'https://spacy.io/models',
    use: 'Modelos e regras estruturais para analise gramatical, entidades, tokens e dependencias.'
  },
  spacyMatcher: {
    id: 'spacy-matcher',
    title: 'spaCy Matcher Documentation',
    url: 'https://spacy.io/usage/rule-based-matching',
    use: 'Regras do tipo se aparecer tal padrao gramatical, classifique ou responda uma intencao.'
  },
  stanza: {
    id: 'stanza',
    title: 'Stanza Stanford NLP',
    url: 'https://stanfordnlp.github.io/stanza/',
    use: 'Pipeline linguistico tradicional com boa cobertura para idiomas complexos, incluindo Russo e Mandarim.'
  },
  snowball: {
    id: 'snowball',
    title: 'Snowball Stemming Project',
    url: 'https://snowballstem.org/',
    use: 'Radicais para Ingles, Espanhol, Alemao, Italiano, Russo, Frances e outros idiomas.'
  },
  languageTool: {
    id: 'languagetool',
    title: 'LanguageTool Development Wiki',
    url: 'https://dev.languagetool.org/',
    use: 'Base de regras para correcao gramatical e ortografica multi-idioma.'
  },
  lingua: {
    id: 'lingua-py',
    title: 'Lingua-py',
    url: 'https://github.com/pemistahl/lingua-py',
    use: 'Deteccao offline de idioma antes de escolher regras especificas.'
  },
  nltk: {
    id: 'nltk',
    title: 'NLTK',
    url: 'https://www.nltk.org/',
    use: 'Ferramentas classicas de NLP, tokenizacao, corpus e recursos educacionais.'
  },
  cogroo: {
    id: 'cogroo',
    title: 'CoGrOO',
    url: 'https://github.com/cogroo/cogroo4',
    use: 'Corretor gramatical tradicional voltado ao Portugues do Brasil.'
  },
  linguateca: {
    id: 'linguateca',
    title: 'Linguateca',
    url: 'https://www.linguateca.pt/',
    use: 'Bases, corpus e dicionarios sintaticos gratuitos para Portugues.'
  }
};

const INTENT_RULES = [
  {
    id: 'debug_code',
    label: 'Corrigir erro ou bug',
    terms: ['erro', 'bug', 'falha', 'corrija', 'conserte', 'debug', 'traceback', 'exception', 'stacktrace']
  },
  {
    id: 'create_code',
    label: 'Criar ou completar codigo',
    terms: ['crie', 'criar', 'faca', 'faça', 'desenvolva', 'implemente', 'codigo', 'html', 'javascript', 'python', 'api']
  },
  {
    id: 'review_code',
    label: 'Auditar ou revisar codigo',
    terms: ['analise', 'auditoria', 'review', 'varredura', 'verifique', 'seguranca', 'performance']
  },
  {
    id: 'generate_files',
    label: 'Gerar arquivos ou pacote',
    terms: ['arquivo', 'zip', 'baixar', 'exportar', 'html unico', 'pwa', 'apk']
  },
  {
    id: 'linguistic_processing',
    label: 'Processamento linguistico',
    terms: ['linguistica', 'idioma', 'gramatica', 'sintaxe', 'spacy', 'stanza', 'snowball', 'stemmer', 'languagetool', 'lingua', 'nltk', 'cogroo', 'linguateca', 'mandarim', 'russo', 'alemao']
  }
];

function normalize(value) {
  return String(value || '')
    .slice(0, MAX_TEXT_LENGTH)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokensOf(text) {
  return text.match(/[\p{L}\p{N}+#.]+/gu) || [];
}

function detectLanguage(originalText, normalizedText) {
  if (/[\u4e00-\u9fff]/.test(originalText)) {
    return { code: 'zh', label: 'Mandarim/Chines', confidence: 0.94, evidence: ['caracteres CJK'] };
  }
  if (/[\u0400-\u04ff]/.test(originalText)) {
    return { code: 'ru', label: 'Russo', confidence: 0.88, evidence: ['alfabeto cirilico'] };
  }

  const tokens = tokensOf(normalizedText);
  const scores = LANGUAGES.map(language => {
    const hits = language.stopwords.filter(word => tokens.includes(normalize(word)));
    return { code: language.code, label: language.label, score: hits.length, evidence: hits.slice(0, 8) };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0] || { code: 'unknown', label: 'Indefinido', score: 0, evidence: [] };
  const confidence = best.score ? Math.min(0.35 + best.score / Math.max(tokens.length, 1) * 4, 0.92) : 0.2;
  return { code: best.score ? best.code : 'unknown', label: best.score ? best.label : 'Indefinido', confidence: Number(confidence.toFixed(2)), evidence: best.evidence };
}

function detectIntents(normalizedText) {
  return INTENT_RULES.map(rule => {
    const hits = rule.terms.filter(term => normalizedText.includes(normalize(term)));
    return hits.length ? { id: rule.id, label: rule.label, score: hits.length, evidence: hits } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

function keywords(tokens) {
  const ignored = new Set(LANGUAGES.flatMap(language => language.stopwords.map(normalize)).concat(['quero', 'preciso', 'como', 'para', 'com', 'sem']));
  const counts = new Map();
  tokens.filter(token => token.length > 2 && !ignored.has(token)).forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count }));
}

function recommendedResources(language, intents, normalizedText) {
  const selected = new Map();
  const add = resource => selected.set(resource.id, resource);
  const intentIds = new Set(intents.map(intent => intent.id));

  add(RESOURCES.lingua);
  if (intentIds.has('linguistic_processing') || /spacy|matcher|sintaxe|gramatica/.test(normalizedText)) {
    add(RESOURCES.spacy);
    add(RESOURCES.spacyMatcher);
  }
  if (['ru', 'zh'].includes(language.code) || /mandarim|russo|stanza/.test(normalizedText)) add(RESOURCES.stanza);
  if (/radical|stem|stemmer|snowball|alemao|frances|ingles|russo/.test(normalizedText)) add(RESOURCES.snowball);
  if (/corret|ortograf|gramatic|languagetool/.test(normalizedText)) add(RESOURCES.languageTool);
  if (language.code === 'pt' || /portugues|brasil|cogroo|linguateca|nltk/.test(normalizedText)) {
    add(RESOURCES.nltk);
    add(RESOURCES.cogroo);
    add(RESOURCES.linguateca);
  }

  return [...selected.values()];
}

function promptHint(language, intents, resources) {
  const labels = intents.map(intent => intent.label).join(', ') || 'pedido geral';
  const sourceList = resources.slice(0, 5).map(resource => resource.title).join('; ');
  return [
    'Analise linguistica local do Guinho:',
    '- idioma provavel: ' + language.label + ' (' + language.code + '), confianca ' + language.confidence,
    '- intencao provavel: ' + labels,
    '- referencias linguisticas indicadas: ' + sourceList,
    '- use essa analise apenas como apoio; nao diga que consultou as fontes em tempo real.'
  ].join('\n');
}

function analyze(text) {
  const originalText = String(text || '').slice(0, MAX_TEXT_LENGTH);
  const normalizedText = normalize(originalText);
  const tokenList = tokensOf(normalizedText);
  const language = detectLanguage(originalText, normalizedText);
  const intents = detectIntents(normalizedText);
  const resources = recommendedResources(language, intents, normalizedText);
  return {
    ok: true,
    normalizedText,
    detectedLanguage: language,
    intents,
    keywords: keywords(tokenList),
    resources,
    promptHint: promptHint(language, intents, resources),
    limits: { maxTextLength: MAX_TEXT_LENGTH, mode: 'rule-based-offline' }
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const text = req.method === 'POST' ? req.body?.text : req.query?.q;
  if (!String(text || '').trim()) {
    res.status(400).json({ ok: false, error: 'Text is required' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json(analyze(text));
}
