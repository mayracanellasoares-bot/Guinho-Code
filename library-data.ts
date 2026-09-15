export interface LibraryItem {
  name: string;
  category: 'cenario' | 'atores' | 'comportamento' | 'eventos' | 'controle' | 'funcoes' | 'propriedades' | 'cores';
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
  }
];
