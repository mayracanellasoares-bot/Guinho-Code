import { tokenize } from './lexer.ts';
import { parse } from './parser.ts';
import { Game } from './game.ts';
import { BIT_LIBRARY, type LibraryItem } from './library-data.ts';

const STARTER_TEMPLATES: Record<string, (title: string) => string> = {
  personagem: (title: string) => `# ${title}
tela 160x120
fundo preto

# Ator controlável com teclado ou gamepad na tela
ator Jogador
  desenho quadrado 8, verde
  posição 76, 56
  velocidade 2, 2
  controlado por setas
  limita à tela
  quando atualiza:
    # Código executado a cada quadro
  fim
fim`,

  bola: (title: string) => `# ${title}
tela 160x120
fundo azul

# Bola que rebate em todas as bordas
ator Bola
  desenho quadrado 6, amarelo
  posição 77, 57
  velocidade 2, 1.5
  quica nas bordas
fim`,

  coletar: (title: string) => `# ${title}
tela 160x120
fundo preto

pontos recebe 0

ator Jogador
  desenho quadrado 8, verde
  posição 76, 56
  controlado por setas
  limita à tela
  quando colide com "Moeda":
    pontos recebe pontos + 1
    Moeda.x recebe aleatorio(10, 140)
    Moeda.y recebe aleatorio(10, 100)
    diga "Pontos: " + pontos
  fim
fim

ator Moeda
  desenho quadrado 4, amarelo
  posição 30, 30
fim`,

  vazio: (title: string) => `# ${title}
tela 160x120
fundo preto

# Escreva seu jogo abaixo:
ator Jogador
  desenho quadrado 8, branco
  posição 76, 56
fim`,

  tetris: (title: string) => `# ${title}
tela 160x120
fundo preto

pontos recebe 0
tipo recebe 1

ator BordaEsq
  desenho retângulo 2, 108, cinza
  posição 48, 6
fim

ator BordaDir
  desenho retângulo 2, 108, cinza
  posição 112, 6
fim

ator Chao
  desenho retângulo 66, 4, cinza
  posição 48, 114
fim

ator Pilha1
  desenho retângulo 18, 6, azul
  posição 54, 108
fim

ator Pilha2
  desenho retângulo 18, 6, verde
  posição 90, 108
fim

ator Peca
  desenho retângulo 18, 6, ciano
  posição 72, 8
  velocidade 0, 0.8
  quando atualiza:
    se tecla("arrowleft") ou tecla("a") então
      se x > 52 então
        x recebe x - 1.5
      fim
    fim

    se tecla("arrowright") ou tecla("d") então
      se x < 92 então
        x recebe x + 1.5
      fim
    fim

    se tecla("arrowdown") ou tecla("s") então
      y recebe y + 1.5
    fim

    se y >= 102 então
      pontos recebe pontos + 10
      diga "Peça encaixada! Pontos: " + pontos
      y recebe 8
      x recebe 72
      tipo recebe aleatorio(1, 3)
      se tipo == 1 então
        largura recebe 18
        altura recebe 6
      senão se tipo == 2 então
        largura recebe 12
        altura recebe 12
      senão
        largura recebe 12
        altura recebe 6
      fim
    fim
  fim
  quando colide com "Pilha1":
    pontos recebe pontos + 15
    diga "Linha eliminada! Total: " + pontos
    y recebe 8
    x recebe 72
  fim
  quando colide com "Pilha2":
    pontos recebe pontos + 15
    diga "Linha eliminada! Total: " + pontos
    y recebe 8
    x recebe 72
  fim
fim`
};

const EXAMPLES: Record<string, string> = {
  pong: `tela 160x120
fundo preto

pontos1 recebe 0
pontos2 recebe 0

ator Jogador1
  desenho retângulo 4, 24, branco
  posição 8, 48
  controlado por setas
  limita à tela
fim

ator Jogador2
  desenho retângulo 4, 24, branco
  posição 148, 48
  limita à tela
  quando atualiza:
    se Bola.y > y então
      y recebe y + 1.2
    senão se Bola.y < y então
      y recebe y - 1.2
    fim
  fim
fim

ator Bola
  desenho quadrado 4, branco
  posição 78, 58
  velocidade 2, 1.5
  quica nas bordas verticais
  quando atualiza:
    se x < 0 então
      pontos2 recebe pontos2 + 1
      x recebe 78
      y recebe 58
      vx recebe 2
      diga "Ponto Jogador 2!"
    senão se x > 160 então
      pontos1 recebe pontos1 + 1
      x recebe 78
      y recebe 58
      vx recebe -2
      diga "Ponto Jogador 1!"
    fim
  fim
  quando colide com "Jogador1":
    vx recebe 2.2
  fim
  quando colide com "Jogador2":
    vx recebe -2.2
  fim
fim`,

  nave: `tela 160x120
fundo preto

pontos recebe 0

ator Nave
  desenho retângulo 12, 8, verde
  posição 74, 100
  controlado por setas
  limita à tela
  quando atualiza:
    se tecla("espaco") então
      diga "Laser disparado!"
    fim
  fim
fim

ator Inimigo
  desenho quadrado 8, vermelho
  posição 76, 10
  velocidade 1, 0.6
  quica nas bordas horizontais
  quando atualiza:
    se y > 120 então
      y recebe 0
      x recebe aleatorio(10, 140)
    fim
  fim
  quando colide com "Nave":
    diga "Alerta de colisão!"
  fim
fim

ator Estrela
  desenho quadrado 2, amarelo
  posição 80, 20
  velocidade 0, 1
  quando atualiza:
    se y > 120 então
      y recebe 0
      x recebe aleatorio(0, 160)
    fim
  fim
fim`,

  breakout: `tela 160x120
fundo preto

pontos recebe 0

ator Paleta
  desenho retângulo 20, 4, azul
  posição 70, 110
  controlado por setas
  limita à tela
fim

ator Bola
  desenho quadrado 4, branco
  posição 78, 60
  velocidade 1.5, -2
  quica nas bordas
  quando colide com "Paleta":
    vy recebe -2
  fim
  quando colide com "Bloco1":
    vy recebe 2
    pontos recebe pontos + 10
    diga "Bloco 1 destruído!"
  fim
  quando colide com "Bloco2":
    vy recebe 2
    pontos recebe pontos + 10
    diga "Bloco 2 destruído!"
  fim
  quando colide com "Bloco3":
    vy recebe 2
    pontos recebe pontos + 10
    diga "Bloco 3 destruído!"
  fim
fim

ator Bloco1
  desenho retângulo 16, 6, vermelho
  posição 30, 20
fim

ator Bloco2
  desenho retângulo 16, 6, amarelo
  posição 70, 20
fim

ator Bloco3
  desenho retângulo 16, 6, verde
  posição 110, 20
fim`,

  senao_se: `tela 160x120
fundo azul

valor recebe aleatorio(1, 3)

se valor == 1 então
  diga "Ramo 1: valor é um"
senão se valor == 2 então
  diga "Ramo 2: valor é dois"
senão se valor == 3 então
  diga "Ramo 3: valor é três"
senão
  diga "Ramo senão: outro valor"
fim

ator Cubo
  desenho quadrado 12, amarelo
  posição 74, 54
  quica nas bordas
  velocidade 1, 1
fim`,

  tetris: `tela 160x120
fundo preto

pontos recebe 0
tipo recebe 1

ator BordaEsq
  desenho retângulo 2, 108, cinza
  posição 48, 6
fim

ator BordaDir
  desenho retângulo 2, 108, cinza
  posição 112, 6
fim

ator Chao
  desenho retângulo 66, 4, cinza
  posição 48, 114
fim

ator Pilha1
  desenho retângulo 18, 6, azul
  posição 54, 108
fim

ator Pilha2
  desenho retângulo 18, 6, verde
  posição 90, 108
fim

ator Peca
  desenho retângulo 18, 6, ciano
  posição 72, 8
  velocidade 0, 0.8
  quando atualiza:
    se tecla("arrowleft") ou tecla("a") então
      se x > 52 então
        x recebe x - 1.5
      fim
    fim

    se tecla("arrowright") ou tecla("d") então
      se x < 92 então
        x recebe x + 1.5
      fim
    fim

    se tecla("arrowdown") ou tecla("s") então
      y recebe y + 1.5
    fim

    se y >= 102 então
      pontos recebe pontos + 10
      diga "Peça encaixada! Pontos: " + pontos
      y recebe 8
      x recebe 72
      tipo recebe aleatorio(1, 3)
      se tipo == 1 então
        largura recebe 18
        altura recebe 6
      senão se tipo == 2 então
        largura recebe 12
        altura recebe 12
      senão
        largura recebe 12
        altura recebe 6
      fim
    fim
  fim
  quando colide com "Pilha1":
    pontos recebe pontos + 15
    diga "Linha eliminada! Total: " + pontos
    y recebe 8
    x recebe 72
  fim
  quando colide com "Pilha2":
    pontos recebe pontos + 15
    diga "Linha eliminada! Total: " + pontos
    y recebe 8
    x recebe 72
  fim
fim`
};

// UI Elements
const editor = document.getElementById('code-editor') as HTMLTextAreaElement;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const consoleOutput = document.getElementById('console-output') as HTMLDivElement;
const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const exampleSelect = document.getElementById('example-select') as HTMLSelectElement;
const projectTitle = document.getElementById('project-title') as HTMLSpanElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const cursorPos = document.getElementById('cursor-pos') as HTMLSpanElement;

// Modal Elements
const btnNew = document.getElementById('btn-new') as HTMLButtonElement;
const modal = document.getElementById('new-modal') as HTMLDivElement;
const btnModalClose = document.getElementById('btn-modal-close') as HTMLButtonElement;
const btnModalCancel = document.getElementById('btn-modal-cancel') as HTMLButtonElement;
const btnModalConfirm = document.getElementById('btn-modal-confirm') as HTMLButtonElement;
const inputProgramName = document.getElementById('new-program-name') as HTMLInputElement;
const templateCards = document.querySelectorAll('.template-card');

// Library Elements
const btnLibrary = document.getElementById('btn-library') as HTMLButtonElement;
const libraryModal = document.getElementById('library-modal') as HTMLDivElement;
const btnLibClose = document.getElementById('btn-lib-close') as HTMLButtonElement;
const libSearchInput = document.getElementById('lib-search-input') as HTMLInputElement;
const libList = document.getElementById('lib-list') as HTMLDivElement;
const libCatBtns = document.querySelectorAll('.lib-cat-btn');

let currentLibCategory = 'todas';
let currentLibSearch = '';

let currentGame: Game | null = null;
let currentTemplateKey = 'personagem';
let saveTimeout: number | null = null;

// Local Storage helpers
const STORAGE_KEY_CODE = 'bit_usuario_codigo';
const STORAGE_KEY_TITLE = 'bit_usuario_titulo';

function loadUserCode(): string {
  return localStorage.getItem(STORAGE_KEY_CODE) || STARTER_TEMPLATES.personagem('Meu Primeiro Jogo');
}

function loadUserTitle(): string {
  return localStorage.getItem(STORAGE_KEY_TITLE) || 'Meu Primeiro Jogo';
}

function saveUserCode(code: string, title?: string) {
  localStorage.setItem(STORAGE_KEY_CODE, code);
  if (title) {
    localStorage.setItem(STORAGE_KEY_TITLE, title);
  }
  saveStatus.textContent = 'Salvo';
  saveStatus.style.color = 'var(--primary)';
}

function notifyEditing() {
  if (exampleSelect.value === 'meu_programa') {
    saveStatus.textContent = 'Salvando...';
    saveStatus.style.color = 'var(--accent)';
    if (saveTimeout !== null) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveUserCode(editor.value);
    }, 400);
  } else {
    saveStatus.textContent = 'Modo Exemplo';
    saveStatus.style.color = 'var(--text-muted)';
  }
}

function updateCursorPos() {
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  cursorPos.textContent = `Linha ${line}, Col ${col}`;
}

function log(msg: string, isError = false) {
  const el = document.createElement('div');
  el.className = isError ? 'log-entry log-error' : 'log-entry';
  el.textContent = msg;
  consoleOutput.appendChild(el);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function stopCurrentGame() {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
}

function runCode() {
  stopCurrentGame();
  consoleOutput.innerHTML = '';
  const code = editor.value;

  try {
    const tokens = tokenize(code);
    const ast = parse(tokens);

    canvas.width = ast.screenWidth;
    canvas.height = ast.screenHeight;

    currentGame = new Game(ast, canvas);
    currentGame.interpreter.onSay = (msg) => {
      log(`> ${msg}`);
    };

    currentGame.start();
    log(`Programa "${ast.title}" em execução! (${ast.screenWidth}x${ast.screenHeight}, ${ast.actors.length} atores)`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      log(`Erro: ${err.message}`, true);
    } else {
      log(`Erro desconhecido: ${String(err)}`, true);
    }
  }
}

// Modal open/close logic
function openModal() {
  inputProgramName.value = 'Meu Novo Jogo';
  currentTemplateKey = 'personagem';
  templateCards.forEach((c) => {
    const key = c.getAttribute('data-template');
    if (key === 'personagem') c.classList.add('selected');
    else c.classList.remove('selected');
  });
  modal.classList.remove('hidden');
  inputProgramName.focus();
  inputProgramName.select();
}

function closeModal() {
  modal.classList.add('hidden');
}

templateCards.forEach((card) => {
  card.addEventListener('click', () => {
    templateCards.forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    currentTemplateKey = card.getAttribute('data-template') || 'personagem';
  });
});

btnNew.addEventListener('click', openModal);
btnModalClose.addEventListener('click', closeModal);
btnModalCancel.addEventListener('click', closeModal);

btnModalConfirm.addEventListener('click', () => {
  const title = inputProgramName.value.trim() || 'Meu Novo Jogo';
  const templateGen = STARTER_TEMPLATES[currentTemplateKey] || STARTER_TEMPLATES.personagem;
  const newCode = templateGen(title);

  // Switch select to user's program
  exampleSelect.value = 'meu_programa';
  projectTitle.textContent = title;
  editor.value = newCode;
  saveUserCode(newCode, title);

  closeModal();
  runCode();
  log(`Novo programa "${title}" criado com sucesso!`);
});

// Library Logic & Rendering
function insertCodeAtCursor(codeToInsert: string) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.substring(0, start);
  const after = editor.value.substring(end);

  editor.value = before + codeToInsert + after;
  editor.selectionStart = editor.selectionEnd = start + codeToInsert.length;
  editor.focus();
  notifyEditing();
  updateCursorPos();
}

function renderLibraryList() {
  const query = currentLibSearch.trim().toLowerCase();
  libList.innerHTML = '';

  const filtered = BIT_LIBRARY.filter((item) => {
    const matchCategory = currentLibCategory === 'todas' || item.category === currentLibCategory;
    if (!matchCategory) return false;
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.syntax.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query) ||
      item.example.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.textAlign = 'center';
    empty.style.padding = '24px';
    empty.style.color = 'var(--text-muted)';
    empty.textContent = 'Nenhum item encontrado na biblioteca para a busca.';
    libList.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'lib-item-card';

    const header = document.createElement('div');
    header.className = 'lib-item-header';

    const title = document.createElement('div');
    title.className = 'lib-item-title';
    title.textContent = item.name;

    const badge = document.createElement('div');
    badge.className = 'lib-item-badge';
    badge.textContent = item.category;

    header.appendChild(title);
    header.appendChild(badge);

    const syntax = document.createElement('div');
    syntax.className = 'lib-item-syntax';
    syntax.textContent = item.syntax;

    const desc = document.createElement('div');
    desc.className = 'lib-item-desc';
    desc.textContent = item.desc;

    const example = document.createElement('div');
    example.className = 'lib-item-example';
    example.textContent = item.example;

    const actions = document.createElement('div');
    actions.className = 'lib-item-actions';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn-lib-action';
    btnCopy.textContent = '📋 Copiar';
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.example || item.syntax);
        btnCopy.textContent = '✓ Copiado!';
        setTimeout(() => {
          btnCopy.textContent = '📋 Copiar';
        }, 1200);
      } catch {
        btnCopy.textContent = 'Erro ao copiar';
      }
    });

    const btnInsert = document.createElement('button');
    btnInsert.className = 'btn-lib-action btn-new';
    btnInsert.textContent = '➕ Inserir';
    btnInsert.addEventListener('click', () => {
      const toInsert = `\n${item.example || item.syntax}\n`;
      insertCodeAtCursor(toInsert);
      closeLibraryModal();
      log(`Comando "${item.name}" inserido no editor.`);
    });

    actions.appendChild(btnCopy);
    actions.appendChild(btnInsert);

    card.appendChild(header);
    card.appendChild(syntax);
    card.appendChild(desc);
    card.appendChild(example);
    card.appendChild(actions);

    libList.appendChild(card);
  });
}

function openLibraryModal() {
  currentLibSearch = '';
  libSearchInput.value = '';
  currentLibCategory = 'todas';
  libCatBtns.forEach((b) => {
    if (b.getAttribute('data-cat') === 'todas') b.classList.add('active');
    else b.classList.remove('active');
  });
  renderLibraryList();
  libraryModal.classList.remove('hidden');
  libSearchInput.focus();
}

function closeLibraryModal() {
  libraryModal.classList.add('hidden');
}

btnLibrary.addEventListener('click', openLibraryModal);
btnLibClose.addEventListener('click', closeLibraryModal);

libSearchInput.addEventListener('input', () => {
  currentLibSearch = libSearchInput.value;
  renderLibraryList();
});

libCatBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    libCatBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentLibCategory = btn.getAttribute('data-cat') || 'todas';
    renderLibraryList();
  });
});

// Snippet Insertion
const SNIPPETS: Record<string, string> = {
  ator: `\nator NovoAtor\n  desenho quadrado 8, ciano\n  posição 40, 40\n  controlado por setas\n  limita à tela\nfim\n`,
  se: `\nse CONDIÇÃO então\n  # faça algo\nfim\n`,
  repita: `\nrepita 5 vezes\n  # comandos repetidos\nfim\n`,
  diga: `\ndiga "Olá, mundo!"\n`
};

document.querySelectorAll('.btn-snippet').forEach((btn) => {
  btn.addEventListener('click', () => {
    const snippetKey = btn.getAttribute('data-snippet') || '';
    const codeToInsert = SNIPPETS[snippetKey];
    if (codeToInsert) {
      insertCodeAtCursor(codeToInsert);
    }
  });
});

// Event Listeners for Editor
editor.addEventListener('input', () => {
  notifyEditing();
  updateCursorPos();
});
editor.addEventListener('click', updateCursorPos);
editor.addEventListener('keyup', updateCursorPos);

// Run & Stop
btnRun.addEventListener('click', runCode);
btnStop.addEventListener('click', () => {
  stopCurrentGame();
  log('Execução interrompida.');
});

exampleSelect.addEventListener('change', () => {
  const chosen = exampleSelect.value;
  if (chosen === 'meu_programa') {
    const savedCode = loadUserCode();
    const savedTitle = loadUserTitle();
    projectTitle.textContent = savedTitle;
    editor.value = savedCode;
    saveStatus.textContent = 'Salvo';
    saveStatus.style.color = 'var(--primary)';
  } else if (EXAMPLES[chosen]) {
    projectTitle.textContent = `Exemplo: ${chosen.toUpperCase()}`;
    editor.value = EXAMPLES[chosen];
    saveStatus.textContent = 'Exemplo';
    saveStatus.style.color = 'var(--text-muted)';
  }
  runCode();
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (document.activeElement === editor || document.activeElement === inputProgramName) return;
  if (currentGame) {
    currentGame.handleKeyDown(e.key);
  }
});

window.addEventListener('keyup', (e) => {
  if (document.activeElement === editor || document.activeElement === inputProgramName) return;
  if (currentGame) {
    currentGame.handleKeyUp(e.key);
  }
});

// Virtual Pad
function bindPadBtn(id: string, keyName: string) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const press = (e: Event) => {
    e.preventDefault();
    if (currentGame) currentGame.handleKeyDown(keyName);
  };
  const release = (e: Event) => {
    e.preventDefault();
    if (currentGame) currentGame.handleKeyUp(keyName);
  };

  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
}

bindPadBtn('pad-up', 'ArrowUp');
bindPadBtn('pad-down', 'ArrowDown');
bindPadBtn('pad-left', 'ArrowLeft');
bindPadBtn('pad-right', 'ArrowRight');
bindPadBtn('pad-act', ' ');

// Initial load: start with user's saved program or default starter
const initialCode = loadUserCode();
const initialTitle = loadUserTitle();
projectTitle.textContent = initialTitle;
exampleSelect.value = 'meu_programa';
editor.value = initialCode;
saveStatus.textContent = 'Salvo';
runCode();
