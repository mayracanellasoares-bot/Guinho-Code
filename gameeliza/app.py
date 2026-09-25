"""Dev_Eliza MultiDev: deterministic programming assistant and local library."""
import http.server
import json
import os
import re
import sqlite3
import webbrowser


ROOT = os.path.abspath(os.path.dirname(__file__))
LIBRARY = os.path.join(ROOT, "biblioteca")
DATABASE = os.path.join(ROOT, "memoria_projetos.db")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
EXTENSIONS = {".gd": "godot", ".cs": "csharp", ".py": "python", ".cpp": "cpp", ".js": "javascript", ".html": "html", ".css": "css", ".sql": "sql", ".json": "json", ".txt": "text"}
LANGUAGES = {"all", "godot", "csharp", "python", "cpp", "javascript", "html", "css", "sql", "text"}
MAX_UPLOAD_BYTES = 512 * 1024
TOKEN = re.compile(r"[a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ_0-9]*")
STOPWORDS = {"como", "para", "com", "uma", "uns", "das", "dos", "que", "por", "onde", "meu", "minha", "fazer", "qual", "isso", "este", "esta", "código", "codigo", "ajuda"}
REFLECTIONS = {"eu fiz": "você fez", "eu estou": "você está", "eu criei": "você criou", "meu": "seu", "minha": "sua", "meus": "seus", "minhas": "suas", "fiz": "você fez", "estou": "você está", "criei": "você criou", "eu": "você"}
REFLECT_REGEX = re.compile(r"\b(?:" + "|".join(re.escape(key) for key in sorted(REFLECTIONS, key=len, reverse=True)) + r")\b", re.I)


def tokens(text):
    return [word.casefold() for word in TOKEN.findall(text) if len(word) > 2 and word.casefold() not in STOPWORDS]


def connect():
    db = sqlite3.connect(DATABASE, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=10000")
    return db


def init_storage():
    os.makedirs(LIBRARY, exist_ok=True)
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, language TEXT NOT NULL,
            profile TEXT NOT NULL DEFAULT '', preferences TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS snippet_history (
            id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            path TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
            query TEXT NOT NULL DEFAULT '',
            topic TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS bug_notes (
            id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS learned_terms (
            id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            term TEXT NOT NULL, topic TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 1,
            occurrences INTEGER NOT NULL DEFAULT 0, positive INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, term, topic));
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            message TEXT NOT NULL, response TEXT NOT NULL, topic TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(snippet_history)")}
        if "query" not in columns:
            db.execute("ALTER TABLE snippet_history ADD COLUMN query TEXT NOT NULL DEFAULT ''")
        if "topic" not in columns:
            db.execute("ALTER TABLE snippet_history ADD COLUMN topic TEXT NOT NULL DEFAULT ''")


class DevElizaEngine:
    def __init__(self):
        entries = [
            (110, "libraries", r"\b(pandas|numpy|scikit[- ]learn|tensorflow|pytorch)\b", ["Para trabalhar com {0}, qual operação você está tentando realizar?", "O problema em {0} envolve dados, dimensões ou desempenho?", "Qual entrada mínima reproduz o comportamento de {0}?"]),
            (105, "games", r"\b(pygame|unity|godot|unreal|jogo|games?)\b", ["No desenvolvimento de jogos com {0}, como está estruturado o game loop?", "Para criar essa mecânica em {0}, quais entradas e estados precisam ser controlados?", "Você está trabalhando com {0} em 2D ou 3D e qual é o resultado esperado?"]),
            (100, "servers", r"\b(flask|fastapi|django|node(?:\.js)?|express|servidor|api|endpoint)\b", ["Ao configurar {0}, qual rota e método HTTP estão envolvidos?", "Em {0}, o payload é validado antes de chegar à regra de negócio?", "Qual código de status e qual resposta você recebe em {0}?"]),
            (108, "collision_character", r"\bcolis[aã]o\s+d[oa]\s+(meu|minha)\s+(personagem)\b", ["O que impede a colisão de {0} de funcionar no Godot?", "Quando {0} tenta colidir no Godot, quais são as máscaras dos dois objetos?"]),
            (90, "loops", r"\b(loop|laço|while|for|fps|delta|frame)\b", ["Em {0}, qual condição encerra a repetição?", "Se registrar cada passo de {0}, em qual iteração o estado diverge?"]),
            (85, "physics", r"\b(física|gravidade|vetor|velocidade|aceleração)\b", ["Em {0}, qual unidade de tempo é usada no cálculo?", "Qual valor de {0} aparece no quadro em que o resultado muda?"]),
            (80, "collision", r"\b(colisão|colidir|hitbox|raycast|trigger)\b", ["Em {0}, as áreas de contato se sobrepõem de fato?", "Em {0}, as máscaras e camadas estão configuradas nos dois objetos?"]),
            (75, "memory", r"\b(vazamento|memória|memory leak|gc|alocação)\b", ["A memória de {0} aumenta ao repetir a mesma ação?", "Há objetos ou listeners criados por {0} sem descarte?"]),
            (70, "api", r"\b(http|fetch|requisição)\b", ["Qual resposta HTTP retorna {0} e qual payload foi enviado?", "Você consegue reproduzir {0} com uma requisição mínima?"]),
            (65, "database", r"\b(sql|banco|database|sqlite|query|tabela)\b", ["Qual consulta de {0} gera resultado inesperado?", "O esquema e os parâmetros de {0} conferem com os valores inseridos?"]),
            (60, "shaders", r"\b(shader|fragment|vertex|renderização|uniform)\b", ["Qual uniforme de {0} difere do esperado?", "Se definir cor fixa para {0}, o objeto aparece?"]),
            (55, "ui", r"\b(ui|interface|botão|input|tecla|toque|css)\b", ["Em {0}, qual evento chega ao elemento?", "Há uma camada ou foco bloqueando {0}?"]),
            (50, "how_to_code", r"\b(como fazer|como programar|me mostre o c[oó]digo de)\s+(.+)", ["Para criar {1}, precisamos definir entrada, processamento e saída. Qual linguagem prefere?", "A lógica para {1} pode ser dividida em pequenas funções. Quer começar pelo algoritmo básico?"]),
            (45, "error", r"\b(erro|bug|crash|não funciona|exception|traceback)\b", ["Qual é a mensagem exata do erro e qual entrada a reproduz?", "O problema pode estar em indentação, tipagem ou escopo. Qual trecho falha?", "Consegue isolar a função problemática em um teste mínimo?"]),
        ]
        self.rules = [(name, re.compile(pattern, re.I), responses) for _, name, pattern, responses in sorted(entries, reverse=True)]

    def reflect(self, text):
        def replace(match):
            source = match.group()
            target = REFLECTIONS[source.casefold()]
            return target.upper() if source.isupper() else target[0].upper() + target[1:] if source[0].isupper() else target
        return REFLECT_REGEX.sub(replace, text)

    def answer(self, message):
        for name, pattern, responses in self.rules:
            match = pattern.search(message)
            if match:
                # Stable selection; the same input always produces the same answer.
                variant = sum(ord(char) for char in message.casefold()) % len(responses)
                if name == "collision_character":
                    place = "Godot" if re.search(r"\bGodot\b", message, re.I) else "jogo"
                    template = responses[variant].replace("Godot", place)
                    return template.format(self.reflect(match.group(1) + " " + match.group(2))), name
                groups = tuple(self.reflect(group) for group in match.groups())
                return responses[variant].format(*groups), name
        if re.search(r"\b(erro|bug|falha|crash|exception)\b", message, re.I):
            return "Qual é a primeira linha do erro e qual entrada o reproduz?", "debug"
        fallbacks = [
            "Compreendo. Para qual linguagem, biblioteca ou framework você quer direcionar essa lógica?",
            "Você está focando na arquitetura de servidores, lógica de jogos ou análise de dados?",
            "Descreva os requisitos do sistema e o menor trecho que reproduz o comportamento.",
        ]
        return fallbacks[sum(ord(char) for char in message.casefold()) % len(fallbacks)], "general"


ENGINE = DevElizaEngine()


def project(db, project_id):
    row = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if row is None:
        raise ValueError("Projeto não encontrado")
    return row


def read_text(path):
    if os.path.getsize(path) > 131072:
        return None
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read(131073)


def list_library(language="all"):
    files = []
    root_real = os.path.realpath(LIBRARY)
    for folder, dirs, names in os.walk(LIBRARY, followlinks=False):
        dirs[:] = sorted(name for name in dirs if not name.startswith(".") and not os.path.islink(os.path.join(folder, name)))
        for filename in sorted(names):
            path = os.path.join(folder, filename)
            if filename.startswith(".") or os.path.islink(path) or os.path.splitext(filename)[1].lower() not in EXTENSIONS:
                continue
            if os.path.commonpath((root_real, os.path.realpath(path))) != root_real:
                continue
            relative = os.path.relpath(path, LIBRARY).replace(os.sep, "/")
            folder_language = relative.split("/", 1)[0].casefold()
            kind = EXTENSIONS[os.path.splitext(filename)[1].lower()]
            if language != "all" and folder_language != language and kind != language:
                continue
            try:
                raw = read_text(path)
            except OSError:
                continue
            if raw is not None:
                files.append((relative, raw, folder_language if folder_language in LANGUAGES else kind))
    return files


def save_uploaded_snippet(name, content, language="all"):
    """Validate and persist one text code file inside the local library."""
    if not isinstance(name, str) or not isinstance(content, str):
        raise ValueError("Nome e conteúdo do arquivo são obrigatórios")
    if not content.strip():
        raise ValueError("O arquivo não pode estar vazio")
    size = len(content.encode("utf-8"))
    if size > MAX_UPLOAD_BYTES:
        raise ValueError("Cada arquivo pode ter no máximo 512 KB")
    if language not in LANGUAGES:
        raise ValueError("Linguagem inválida")
    normalized = name.replace("\\", "/")
    filename = os.path.basename(normalized)
    extension = os.path.splitext(filename)[1].casefold()
    if not filename or filename in {".", ".."} or extension not in EXTENSIONS:
        allowed = ", ".join(sorted(EXTENSIONS))
        raise ValueError("Extensão não suportada. Use: " + allowed)
    if language == "all":
        language = EXTENSIONS[extension]
    elif language != EXTENSIONS[extension] and not (language == "javascript" and extension == ".js"):
        raise ValueError("A extensão do arquivo não corresponde à linguagem selecionada")
    filename = re.sub(r"[^A-Za-z0-9À-ÿ_.-]", "_", filename).strip(".")
    if not filename:
        raise ValueError("Nome de arquivo inválido")
    folder = os.path.join(LIBRARY, language)
    os.makedirs(folder, exist_ok=True)
    destination = os.path.join(folder, filename)
    library_real = os.path.realpath(LIBRARY)
    if os.path.commonpath((library_real, os.path.realpath(destination))) != library_real:
        raise ValueError("Caminho de arquivo inválido")
    overwritten = os.path.exists(destination)
    if extension == ".json":
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError("Arquivos JSON precisam conter JSON válido") from error
        if not isinstance(parsed, dict) or not isinstance(parsed.get("code"), str) or not parsed["code"].strip():
            raise ValueError("JSON de snippet precisa ter o campo string 'code'")
    with open(destination, "w", encoding="utf-8", newline="") as handle:
        handle.write(content)
    return {"path": os.path.relpath(destination, LIBRARY).replace(os.sep, "/"), "language": language, "bytes": size, "overwritten": overwritten}


def learn_interaction(project_id, message, topic, response, positive=False, record=True):
    """Accumulate project-specific associations; this is memory, not ML."""
    if project_id is None:
        return {"terms": [], "topics": []}
    words = tokens(message)[:40]
    with connect() as db:
        if record:
            db.execute(
                "INSERT INTO conversations(project_id,message,response,topic) VALUES(?,?,?,?)",
                (project_id, message[:4000], response[:4000], topic),
            )
        for term in sorted(set(words)):
            db.execute(
                """INSERT INTO learned_terms(project_id,term,topic,weight,occurrences,positive)
                   VALUES(?,?,?,?,?,?)
                   ON CONFLICT(project_id,term,topic) DO UPDATE SET
                   weight=MIN(weight+?,50), occurrences=occurrences+1,
                   positive=positive+?, updated_at=CURRENT_TIMESTAMP""",
                (project_id, term, topic, 1 if not positive else 4, 1, int(positive), 4 if not positive else 4, int(positive)),
            )
        rows = db.execute(
            "SELECT term,topic,weight,occurrences,positive FROM learned_terms WHERE project_id=? ORDER BY weight DESC, occurrences DESC, term LIMIT 12",
            (project_id,),
        ).fetchall()
    return {"terms": [dict(row) for row in rows], "topics": sorted({row["topic"] for row in rows})}


def learned_for(project_id):
    if project_id is None:
        return {}
    with connect() as db:
        return {row["term"]: dict(row) for row in db.execute("SELECT term,topic,weight,occurrences,positive FROM learned_terms WHERE project_id=?", (project_id,))}


WIZARD_STAGES = [
    ("genre", re.compile(r"\b(rpg|arcade|estrat[eé]gia|aventura|simula[cç][aã]o|terror|plataforma|puzzle)\b", re.I), "Qual será o estilo do projeto: RPG, arcade, estratégia, aventura, terror, plataforma ou puzzle?"),
    ("language", re.compile(r"\b(python|javascript|typescript|html|css|gdscript|godot|c#|csharp|c\+\+|sql)\b", re.I), "Qual linguagem ou engine devemos usar?"),
    ("platform", re.compile(r"\b(navegador|web|html5|terminal|console|android|celular|windows|linux|godot)\b", re.I), "Onde o projeto será executado: navegador, terminal, Android, Windows, Linux ou Godot?"),
    ("features", re.compile(r"\b(combate|invent[aá]rio|mapa|inimigo|pontua[cç][aã]o|fase|ranking|salvamento|multiplayer|controles?)\b", re.I), "Quais sistemas principais você quer: mapa, combate, inventário, inimigos, fases, ranking ou salvamento?"),
]


def wizard_next_question(project_id, current_message=""):
    """Return the next missing creation detail from project-local conversation memory."""
    if project_id is None:
        return None
    with connect() as db:
        row = db.execute("SELECT profile FROM projects WHERE id=?", (project_id,)).fetchone()
        messages = db.execute("SELECT message FROM conversations WHERE project_id=? ORDER BY id", (project_id,)).fetchall()
    corpus = " ".join([row["profile"] if row else ""] + [item["message"] for item in messages] + [current_message])
    if not re.search(r"\b(criar|crie|desenvolver|desenvolva|fazer|fa[çc]a|jogo|aplica[cç][aã]o|projeto)\b", corpus, re.I):
        return None
    for stage, matcher, question in WIZARD_STAGES:
        if not matcher.search(corpus):
            return {"stage": stage, "question": question}
    return None


def candidates(question, language="all", limit=5, project_id=None):
    query = set(tokens(question))
    learned = learned_for(project_id)
    results = []
    for relative, raw, lang in list_library(language):
        meta = {}
        if relative.endswith(".json"):
            try:
                meta = json.loads(raw)
                if not isinstance(meta, dict):
                    continue
                code = meta.get("code", "")
                if not isinstance(code, str) or not code.strip():
                    continue
                tags = meta.get("tags", [])
                if not isinstance(tags, list):
                    tags = []
            except (ValueError, TypeError):
                continue
        else:
            code, tags = raw, []
        title = str(meta.get("title", os.path.splitext(os.path.basename(relative))[0]))[:120]
        tagwords = set(tokens(" ".join(str(tag) for tag in tags)))
        namewords = set(tokens(relative.replace("/", " ").replace("_", " ") + " " + title))
        contentwords = set(tokens(code[:24000]))
        score = 8 * len(query & tagwords) + 5 * len(query & namewords) + len(query & contentwords)
        matched = query & (tagwords | namewords | contentwords)
        score += sum(min(int(learned.get(term, {}).get("weight", 0)), 10) for term in matched)
        if language != "all" and lang == language:
            score += 2
        if score > 0:
            results.append({"path": relative, "title": title, "language": lang, "score": score, "code": code[:64000]})
    return sorted(results, key=lambda item: (-item["score"], item["path"]))[:limit]


HTML = r'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GameEliza · MultiDev Engine</title>
<style>
:root{color-scheme:dark;--bg:#000;--panel:#0a0a0a;--surface:#111;--edge:#3b3b3b;--text:#fff;--muted:#b8b8b8;--accent:#fff}*{box-sizing:border-box}html,body{min-height:100%;background:#000}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}button,input,select,textarea{font:inherit}button{cursor:pointer;background:#000;border:1px solid #fff;color:#fff;padding:10px 13px;border-radius:3px}button:hover,button:focus-visible{background:#fff;color:#000}button:disabled{opacity:.5}input,select,textarea{background:#000;color:#fff;border:1px solid #777;border-radius:3px;padding:11px;min-width:0;caret-color:#fff}input::placeholder,textarea::placeholder{color:#aaa;opacity:1}textarea{resize:vertical}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #fff;outline-offset:2px}.layout{display:grid;grid-template-columns:255px minmax(0,1fr);height:100dvh}.sidebar,.right{background:var(--panel);overflow:auto;padding:16px}.sidebar{border-right:1px solid var(--edge)}.right{display:none;border-left:1px solid var(--edge)}.layout.inspector-open{grid-template-columns:255px minmax(0,1fr) minmax(300px,34%)}.layout.inspector-open .right{display:block}.brand{display:flex;align-items:center;gap:10px;margin-bottom:3px}.logo-mark,.mini-logo{display:grid;place-items:center;color:#000;background:#fff;font-weight:900;letter-spacing:-2px}.logo-mark{width:42px;height:34px;border-radius:3px;font-size:18px;box-shadow:3px 3px 0 #555}.mini-logo{width:29px;height:25px;border-radius:2px;font-size:13px;box-shadow:2px 2px 0 #555}.brand h1{font-size:19px;letter-spacing:.04em;color:#fff;margin:0}.brand small,.sidebar-subtitle{color:#aaa;font-size:11px;letter-spacing:.08em}.sidebar-subtitle{display:block;margin:7px 0 0}.top{position:sticky;top:0;z-index:3;padding:14px 18px;border-bottom:1px solid var(--edge);background:#000}.top-brand{display:flex;align-items:center;gap:9px;color:#fff;letter-spacing:.04em}.top-brand strong{font-size:15px}.muted,small{color:var(--muted)}h1{font-size:19px;margin:0}h2{font-size:15px;margin:18px 0 9px;color:#fff}.stack{display:grid;gap:8px}.stack>*{width:100%}.files{list-style:none;padding:0;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,monospace}.files li{padding:5px;border-bottom:1px solid var(--edge)}.center{display:flex;flex-direction:column;min-height:0;min-width:0}.side-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:16px 0 12px}.tab-button{background:#000;border-color:#555;font-size:13px;padding:8px 6px}.tab-button[aria-selected="true"]{background:#fff;border-color:#fff;color:#000}.tab-panel{display:none}.tab-panel.active{display:block}.tab-panel h2{margin-top:6px}.tab-hint{padding:10px;border:1px solid var(--edge);border-radius:3px;background:#111}.right{padding:18px}.right pre{max-height:70dvh}.right details{margin-top:12px}#log{flex:1;min-height:0;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth;padding-bottom:92px}.bubble{max-width:min(88%,760px);padding:13px 15px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:3px;font-size:16px;line-height:1.65}.bot{align-self:flex-start;background:#0b0b0b;color:#fff;border-left:4px solid #fff}.user{align-self:flex-end;background:#191919;color:#fff;border-left:4px solid #fff}#chatForm{display:flex;gap:8px;padding:12px;border-top:1px solid #fff;background:#000;position:sticky;bottom:0;z-index:4;padding-bottom:calc(12px + env(safe-area-inset-bottom))}#message{flex:1;font-size:16px;min-height:46px;line-height:1.4}#send{min-width:82px;font-weight:700}pre{max-height:55dvh;overflow:auto;padding:15px;background:#000;color:#fff;border:1px solid #777;border-radius:3px;font:14px/1.55 ui-monospace,monospace;white-space:pre;tab-size:2}#snippetName{overflow-wrap:anywhere;color:#fff}#status{min-height:1.4em;color:#aaa}summary{cursor:pointer;color:#fff}@media(max-width:960px){.layout{grid-template-columns:210px 1fr}.layout.inspector-open{grid-template-columns:210px 1fr}.layout.inspector-open .right{grid-column:1/-1;border-left:0;border-top:1px solid var(--edge)}.center{height:calc(100dvh - 160px)}}@media(max-width:600px){.layout,.layout.inspector-open{display:flex;flex-direction:column;height:auto;min-height:100dvh}.sidebar{border-right:0;border-bottom:1px solid var(--edge);padding:12px}.center{height:calc(100dvh - 190px);min-height:540px}.right{min-height:300px;padding:12px}#log{padding:14px 12px 108px}.bubble{max-width:94%;font-size:16px}#chatForm{position:fixed;left:0;right:0;bottom:0;padding:9px;background:#000;border-top:1px solid #fff;padding-bottom:calc(9px + env(safe-area-inset-bottom));z-index:20}#message{max-height:132px;overflow:auto}}
</style></head><body><div class="layout"><aside class="sidebar"><div class="brand"><div class="logo-mark" aria-hidden="true">&gt;_</div><div><h1>Dev_Eliza</h1><small>LOCAL DEV SHELL</small></div></div><small class="sidebar-subtitle">MultiDev · biblioteca local</small><nav class="side-tabs" aria-label="Seções do Dev_Eliza" role="tablist"><button class="tab-button" data-tab="chat" role="tab" aria-selected="true">💬 Chat</button><button class="tab-button" data-tab="project" role="tab" aria-selected="false">📁 Projeto</button><button class="tab-button" data-tab="library" role="tab" aria-selected="false">📚 Biblioteca</button><button class="tab-button" data-tab="code" role="tab" aria-selected="false">‹/› Código</button><button class="tab-button" data-tab="memory" role="tab" aria-selected="false">🧠 Memória</button><button class="tab-button" data-tab="llm" role="tab" aria-selected="false">⚙ LLM local</button></nav><section class="tab-panel active" data-panel="chat" role="tabpanel"><h2>Conversa</h2><p class="tab-hint muted">Descreva o problema, cole um trecho ou peça uma implementação. A resposta aparece no painel central.</p></section><section class="tab-panel" data-panel="project" role="tabpanel"><h2>Projeto ativo</h2><div class="stack"><label for="project">Projeto ativo</label><select id="project"></select><input id="newName" placeholder="Nome do novo projeto" aria-label="Nome do novo projeto" maxlength="100"><input id="newProfile" placeholder="Perfil: jogo 2D, API..." aria-label="Perfil do projeto" maxlength="500"><button id="create">Criar projeto</button><label for="language">Linguagem/engine</label><select id="language"><option value="all">Todas</option><option value="godot">Godot</option><option value="python">Python</option><option value="javascript">JavaScript</option><option value="csharp">C#</option><option value="cpp">C++</option><option value="sql">SQL</option></select></div></section><section class="tab-panel" data-panel="library" role="tabpanel"><h2>Biblioteca local</h2><small>Arquivos lidos de ./biblioteca/</small><ul id="files" class="files"></ul></section><section class="tab-panel" data-panel="code" role="tabpanel"><h2>Código</h2><p class="tab-hint muted">O resultado será aberto em um painel lateral amplo para facilitar leitura e cópia.</p></section><section class="tab-panel" data-panel="memory" role="tabpanel"><h2>Memória do projeto</h2><details open><summary>Termos aprendidos</summary><ul id="learned" class="files"><li>Selecione um projeto para começar.</li></ul></details><details open><summary>Notas e preferências</summary><div class="stack"><textarea id="preferences" aria-label="Preferências de arquitetura" placeholder="Preferências de arquitetura"></textarea><button id="savePrefs">Salvar preferências</button><textarea id="bugNote" aria-label="Nota de bug resolvido" placeholder="Descreva um bug resolvido"></textarea><button id="saveNote">Salvar nota</button><ul id="notes"></ul></div></details></section><section class="tab-panel" data-panel="llm" role="tabpanel"><h2>Modelos locais</h2><p class="tab-hint muted">Configure o endereço do router GGUF e ative o modelo somente quando quiser usá-lo.</p></section></aside><main class="center"><div class="top"><div class="top-brand"><span class="mini-logo" aria-hidden="true">&gt;_</span><strong>DEV_ELIZA // CHAT</strong></div><div class="muted">Assistência local para programação e desenvolvimento.</div></div><section id="log" role="log" aria-live="polite"><div class="bubble bot">Qual problema você quer investigar? Especifique a linguagem e descreva o comportamento esperado.</div></section><form id="chatForm"><textarea id="message" rows="1" aria-label="Pergunta" placeholder="Digite sua pergunta ou cole seu código..." maxlength="4000" required></textarea><button id="send">Enviar</button></form></main><aside class="right" id="inspector"><h2>Snippet encontrado</h2><div id="snippetName" class="muted">Faça uma busca no chat.</div><pre><code id="code"></code></pre><button id="copy" disabled>Copiar código</button><button id="approve" disabled>Aprovar snippet</button><p id="status" class="muted" role="status"></p></aside></div>
<script>
document.title='Dev_Eliza · MultiDev Engine';const brandHeading=document.querySelector('.sidebar h1');if(brandHeading)brandHeading.textContent='Dev_Eliza';
const layout=document.querySelector('.layout');const tabButtons=[...document.querySelectorAll('.tab-button')];const tabPanels=[...document.querySelectorAll('.tab-panel')];function selectTab(name){tabButtons.forEach(button=>{const selected=button.dataset.tab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1});tabPanels.forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name));localStorage.setItem('devElizaTab',name);if(name==='code')layout.classList.add('inspector-open');else layout.classList.remove('inspector-open')}tabButtons.forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.tab)));const initialTab=localStorage.getItem('devElizaTab')||'chat';selectTab(tabButtons.some(button=>button.dataset.tab===initialTab)?initialTab:'chat');
const uploadLabel=document.createElement('label');uploadLabel.htmlFor='upload';uploadLabel.textContent='Anexar códigos';const uploadInput=document.createElement('input');uploadInput.id='upload';uploadInput.type='file';uploadInput.multiple=true;uploadInput.accept='.gd,.cs,.py,.cpp,.js,.sql,.json,text/plain';const uploadHint=document.createElement('small');uploadHint.textContent='Vários arquivos · máximo 512 KB por arquivo. “Todas” identifica pela extensão.';const filesList=document.getElementById('files');filesList.before(uploadLabel,uploadInput,uploadHint);
const $=id=>document.getElementById(id);let projects=[],active=null,current=null;const messageBox=$('message');function resizeMessage(){messageBox.style.height='auto';messageBox.style.height=Math.min(messageBox.scrollHeight,132)+'px'}messageBox.addEventListener('input',resizeMessage);messageBox.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('chatForm').requestSubmit()}});resizeMessage();
uploadInput.accept='*/*';const languageSelect=document.getElementById('language');[['html','HTML'],['css','CSS'],['text','Texto']].forEach(([value,label])=>languageSelect.add(new Option(label,value)));
async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json()}catch{throw Error('Resposta inválida do servidor')}if(!response.ok)throw Error(data.error||'Falha na requisição');return data}
function status(text){$('status').textContent=text}function bubble(kind,text){const el=document.createElement('div');el.className='bubble '+kind;el.textContent=text;$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight}
function renderMemory(memory){if(!memory||!memory.terms)return;const list=$('learned');list.replaceChildren();for(const item of memory.terms){const li=document.createElement('li');li.textContent=item.term+' · '+item.topic+' · peso '+item.weight;list.appendChild(li)}if(memory.terms.length===0){const li=document.createElement('li');li.textContent='Ainda sem associações aprendidas';list.appendChild(li)}}
function show(snippet){current=snippet||null;$('snippetName').textContent=snippet?snippet.path+' · relevância '+snippet.score:'Nenhum trecho relevante encontrado.';$('code').textContent=snippet?snippet.code:'';$('copy').disabled=!snippet;$('approve').disabled=!snippet||!active||!snippet.history_id;if(snippet)selectTab('code')}
async function refreshFiles(){const data=await api('/api/snippets?language='+encodeURIComponent($('language').value));$('files').replaceChildren();for(const file of data.files){const li=document.createElement('li');li.textContent=file;$('files').appendChild(li)}if(!data.files.length){const li=document.createElement('li');li.textContent='Nenhum arquivo cadastrado';$('files').appendChild(li)}}
async function refreshProjects(selectId){const data=await api('/api/projects');projects=data.projects;$('project').replaceChildren();const none=new Option('Sem projeto', '');$('project').add(none);for(const item of projects)$('project').add(new Option(item.name+' ('+item.language+')',String(item.id)));if(selectId)$('project').value=String(selectId);active=$('project').value?Number($('project').value):null;await loadProject()}
async function loadProject(){active=$('project').value?Number($('project').value):null;const item=projects.find(p=>p.id===active);$('preferences').value=item?.preferences||'';$('notes').replaceChildren();$('learned').replaceChildren();if(active){const data=await api('/api/projects?id='+active);for(const note of data.notes){const li=document.createElement('li');li.textContent=note.note;$('notes').appendChild(li)}renderMemory({terms:data.learned})}$('approve').disabled=!current||!active||!current.history_id}
$('project').addEventListener('change',()=>{show(null);loadProject().catch(e=>status(e.message))});$('language').addEventListener('change',()=>refreshFiles().catch(e=>status(e.message)));
$('upload').addEventListener('change',async event=>{const files=[...event.target.files];if(!files.length)return;try{for(const file of files){const content=await file.text();await api('/api/snippets/upload','POST',{name:file.name,content,language:$('language').value})}await refreshFiles();status(files.length+' arquivo(s) anexado(s) e indexado(s) na biblioteca local.')}catch(error){status('Falha no anexo: '+error.message)}finally{event.target.value=''}});
$('create').addEventListener('click',async()=>{try{const name=$('newName').value.trim();if(!name)throw Error('Informe o nome do projeto');const data=await api('/api/projects','POST',{name,profile:$('newProfile').value,language:$('language').value});$('newName').value='';$('newProfile').value='';await refreshProjects(data.project.id);status('Projeto criado.')}catch(e){status(e.message)}});
$('chatForm').addEventListener('submit',async e=>{e.preventDefault();const text=$('message').value.trim();if(!text)return;bubble('user',text);$('message').value='';$('send').disabled=true;try{const data=await api('/api/chat','POST',{message:text,language:$('language').value,project_id:active});bubble('bot',data.response);show(data.snippets[0]);renderMemory(data.memory);if(data.snippets.length>1)status(data.snippets.length+' trechos relevantes encontrados; mostrando o mais pontuado.'+(active?' Memória atualizada.':''));else status(data.snippets.length?'Trecho encontrado na biblioteca.'+(active?' Memória atualizada.':''):'Sem trecho correspondente na biblioteca.')}catch(error){bubble('bot','Falha local: '+error.message)}finally{$('send').disabled=false;$('message').focus()}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(current.code);status('Código copiado.')}catch{status('Cópia indisponível neste navegador. Selecione o código e copie manualmente.')}});
$('approve').addEventListener('click',async()=>{try{const data=await api('/api/snippets','POST',{project_id:active,history_id:current.history_id,path:current.path,approved:true});renderMemory(data.memory);status('Snippet aprovado; associação reforçada na memória.');$('approve').disabled=true}catch(e){status(e.message)}});
$('savePrefs').addEventListener('click',async()=>{try{const data=await api('/api/projects','PATCH',{project_id:active,preferences:$('preferences').value});projects=projects.map(p=>p.id===active?data.project:p);status('Preferências salvas.')}catch(e){status(e.message)}});
$('saveNote').addEventListener('click',async()=>{try{const note=$('bugNote').value.trim();await api('/api/projects/notes','POST',{project_id:active,note});$('bugNote').value='';await loadProject();status('Nota salva.')}catch(e){status(e.message)}});
Promise.all([refreshFiles(),refreshProjects()]).catch(e=>status(e.message));

// Browser SLM: Gemma 3 270M runs locally through Transformers.js/WebGPU.
let gemma=null, gemmaLocal=false, gemmaBusy=false;
const localBox=document.createElement('div');localBox.className='stack';localBox.style.marginTop='12px';
const localTitle=document.createElement('strong');localTitle.textContent='LLM local (GGUF)';
const localEndpoint=document.createElement('input');localEndpoint.type='url';localEndpoint.value=localStorage.getItem('devElizaLocalEndpoint')||'http://127.0.0.1:8090';localEndpoint.placeholder='http://127.0.0.1:8090';localEndpoint.setAttribute('aria-label','Endereço da API LLM local');
const localModel=document.createElement('select');localModel.id='localModel';localModel.setAttribute('aria-label','Escolher IA instalada no Termux');
[['auto','Automático (conforme a tarefa)'],['gemma','Gemma · Termux'],['smol','Smol · Termux'],['qwen','Qwen Coder · Termux'],['nemotron','Nemotron · Termux']].forEach(([id,label])=>localModel.add(new Option(label,id)));
const savedModel=localStorage.getItem('devElizaLocalModel')||'auto';localModel.value=[...localModel.options].some(o=>o.value===savedModel)?savedModel:'auto';
const localConnect=document.createElement('button');localConnect.type='button';localConnect.textContent='Conectar ao Termux';
const localHelp=document.createElement('small');localHelp.className='muted';localHelp.textContent='Escolha a IA instalada. O roteador verifica os arquivos GGUF antes de conectar.';
const localButton=document.createElement('button');localButton.type='button';localButton.textContent='Ativar Gemma no navegador';
const localState=document.createElement('small');localState.className='muted';localState.textContent='Conecte ao Termux para consultar os modelos disponíveis.';
localBox.append(localTitle,localEndpoint,localModel,localConnect,localHelp,localButton,localState);document.querySelector('[data-panel="llm"]').append(localBox);
let localLLM=false,localBusy=false,availableModels=null;
function localURL(path){return localEndpoint.value.trim().replace(/\/$/,'')+path}
async function fetchLocalModels(base){
  const response=await fetch(base+'/models',{method:'GET'});
  if(!response.ok)throw Error('Roteador desatualizado ou indisponível: /models retornou HTTP '+response.status);
  const result=await response.json();
  if(!Array.isArray(result.models))throw Error('Catálogo /models inválido');
  availableModels=new Map(result.models.map(m=>[m.id,m]));
  for(const option of localModel.options){
    if(option.value==='auto')continue;
    const entry=availableModels.get(option.value);
    option.disabled=!entry?.available;
    const name=option.value==='qwen'?'Qwen Coder':option.value==='nemotron'?'Nemotron':option.value==='gemma'?'Gemma':'Smol';
    option.textContent=name+(entry?.available?' ✓':' · não encontrado');
  }
  return result;
}
function selectedModelAvailable(){
  return localModel.value==='auto'?[...availableModels.values()].some(m=>m.available):Boolean(availableModels?.get(localModel.value)?.available);
}
localConnect.addEventListener('click',async()=>{
  if(localLLM){
    localLLM=false;localConnect.textContent='Conectar ao Termux';
    localState.textContent='Termux desconectado; biblioteca local ativa.';status('Modo Termux desativado.');return;
  }
  const base=localEndpoint.value.trim().replace(/\/$/,'');
  if(!/^https?:\/\//i.test(base)){localState.textContent='Informe uma URL http:// ou https:// válida.';return;}
  localConnect.disabled=true;
  try{
    const response=await fetch(base+'/health',{method:'GET'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const catalog=await fetchLocalModels(base);
    localStorage.setItem('devElizaLocalEndpoint',base);
    localStorage.setItem('devElizaLocalModel',localModel.value);
    if(!selectedModelAvailable())throw Error(localModel.value==='auto'?'Nenhum modelo GGUF instalado foi encontrado.':'Modelo '+localModel.value+' não encontrado no Termux. Confira o arquivo em /models.');
    localLLM=true;
    localConnect.textContent='Desconectar Termux';
    const selected=localModel.options[localModel.selectedIndex].textContent;
    localState.textContent='Conectado · '+selected+(catalog.activeModel?' · em memória: '+catalog.activeModel:'');
    status('IA selecionada: '+selected+'.');
  }catch(error){
    localLLM=false;localConnect.textContent='Conectar ao Termux';
    localState.textContent='Falha: '+error.message;
    status('Falha na conexão local: '+error.message);
  }finally{localConnect.disabled=false;}
});
localModel.addEventListener('change',()=>{
  localStorage.setItem('devElizaLocalModel',localModel.value);
  if(localLLM){
    localState.textContent=selectedModelAvailable()?'IA selecionada: '+localModel.options[localModel.selectedIndex].textContent:'Este modelo não está instalado no Termux.';
    status(localState.textContent);
  }
});
localEndpoint.addEventListener('change',()=>{
  localLLM=false;availableModels=null;
  [...localModel.options].forEach(option=>{option.disabled=false});
  localConnect.textContent='Conectar ao Termux';localState.textContent='Endereço alterado; reconecte ao Termux.';
});
localButton.addEventListener('click',async()=>{
  if(gemma){gemmaLocal=!gemmaLocal;localButton.textContent=gemmaLocal?'Usar biblioteca/SLM':'Ativar Gemma local';localState.textContent=gemmaLocal?'Gemma ativo no navegador.':'Modo biblioteca ativo.';return;}
  localButton.disabled=true;localState.textContent='Carregando Gemma 3 270M…';
  try{
    const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
    // Android browsers are more reliable with a single-threaded WASM backend.
    env.backends.onnx.wasm.numThreads=1;
    env.backends.onnx.wasm.proxy=false;
    const progress=info=>{if(info?.status==='progress'&&Number.isFinite(info.progress))localState.textContent=`Baixando Gemma 3 270M… ${Math.round(info.progress)}%`;else if(info?.status==='ready')localState.textContent='Preparando Gemma no navegador…'};
    const hasWebGPU=Boolean(navigator.gpu);
    if(!hasWebGPU) localState.textContent='Este navegador não oferece WebGPU; tentando CPU…';
    try{gemma=await pipeline('text-generation','onnx-community/gemma-3-270m-it-ONNX',{device:hasWebGPU?'webgpu':'wasm',dtype:hasWebGPU?'q4f16':'q4',progress_callback:progress});}
    catch(webgpuError){
      try{localState.textContent='WebGPU incompatível; tentando CPU…';gemma=await pipeline('text-generation','onnx-community/gemma-3-270m-it-ONNX',{device:'wasm',dtype:'q8',progress_callback:progress});}
      catch(cpuError){throw Error(`WebGPU: ${webgpuError.message||webgpuError}; CPU: ${cpuError.message||cpuError}`)}
    }
    gemmaLocal=true;localButton.disabled=false;localButton.textContent='Usar biblioteca/SLM';localState.textContent='Gemma ativo no navegador.';
  }catch(error){const raw=String(error.message||error).replace(/\s+/g,' ');const detail=/11180944/.test(raw)?'o runtime ONNX deste navegador não suporta o modelo':raw.slice(0,180);localButton.disabled=false;localState.textContent='Gemma indisponível: '+detail;status('O navegador não conseguiu executar o Gemma. A biblioteca determinística continua disponível.')}
});
document.getElementById('chatForm').addEventListener('submit',async event=>{
  if(localLLM&&!localBusy){event.preventDefault();event.stopImmediatePropagation();const text=$('message').value.trim();if(!text)return;bubble('user',text);$('message').value='';$('send').disabled=true;localBusy=true;status('Consultando o GGUF local…');let context={snippets:[],memory:{terms:[]}};try{try{context=await api('/api/chat','POST',{message:text,language:$('language').value,project_id:active});show(context.snippets[0]);renderMemory(context.memory)}catch{status('Render offline; enviando diretamente ao GGUF local…')}const response=await fetch(localURL('/v1/chat/completions'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:localModel.value.trim()||'auto',messages:[{role:'system',content:'Você é Dev_Eliza, assistente de programação. Responda em português e entregue código quando solicitado.'},{role:'user',content:text}],max_tokens:512,stream:false})});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'HTTP '+response.status);const answer=data.choices?.[0]?.message?.content;if(!answer)throw Error(data.message||data.error?.message||data.error||'O LLM local não retornou conteúdo');bubble('bot',answer.trim());status('Resposta gerada pelo GGUF local.'+(context.snippets.length?' Biblioteca consultada.':' Offline, sem consulta à biblioteca online.'))}catch(error){bubble('bot',context.response?context.response+'\n\n[IA Termux indisponível: '+error.message+']':'Falha no LLM local: '+error.message);status('IA Termux indisponível; '+(context.response?'resposta da biblioteca exibida.':'verifique o roteador e o arquivo GGUF.'))}finally{localBusy=false;$('send').disabled=false;$('message').focus()}return;}
  if(!gemmaLocal||gemmaBusy)return;
  event.preventDefault();event.stopImmediatePropagation();
  const text=$('message').value.trim();if(!text)return;
  bubble('user',text);$('message').value='';$('send').disabled=true;gemmaBusy=true;status('Consultando o Gemma local…');
  try{
    const context=await api('/api/chat','POST',{message:text,language:$('language').value,project_id:active});
    show(context.snippets[0]);renderMemory(context.memory);
    const snippet=context.snippets[0]?`\nTrecho da biblioteca:\n${context.snippets[0].code.slice(0,12000)}`:'';
    const prompt=`Você é Dev_Eliza, assistente de programação. Responda em português, seja objetiva e entregue código somente quando solicitado.\nPergunta: ${text}${snippet}\nResposta:`;
    const generated=await gemma(prompt,{max_new_tokens:220,do_sample:true,temperature:0.25,top_p:0.9,return_full_text:false});
    const answer=Array.isArray(generated)?(generated[0]?.generated_text||'Não foi possível gerar uma resposta.'):String(generated);
    bubble('bot',answer.trim());status(context.snippets.length?'Gemma respondeu usando a biblioteca local.':'Gemma respondeu localmente.');
  }catch(error){bubble('bot','Falha no Gemma local: '+error.message);status('Verifique se o navegador suporta WebGPU ou recarregue a página.')}finally{gemmaBusy=false;$('send').disabled=false;$('message').focus()}
},true);
</script>
</body></html>'''


class Handler(http.server.BaseHTTPRequestHandler):
    def send_json(self, status, value):
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def do_HEAD(self):
        if self.path in ("/", "/index.html"):
            payload = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        path, _, query = self.path.partition("?")
        params = dict(re.findall(r"(?:^|&)([a-z_]+)=([a-zA-Z0-9_-]+)", query))
        try:
            if path == "/":
                payload = HTML.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(payload)
            elif path == "/api/snippets":
                language = params.get("language", "all")
                self.check_language(language)
                self.send_json(200, {"files": [path for path, _, _ in list_library(language)]})
            elif path == "/api/projects":
                with connect() as db:
                    if "id" in params:
                        ident = self.identifier(params["id"])
                        item = project(db, ident)
                        notes = db.execute("SELECT id,note,created_at FROM bug_notes WHERE project_id=? ORDER BY id DESC LIMIT 100", (ident,)).fetchall()
                        history = db.execute("SELECT id,path,query,topic,approved,created_at FROM snippet_history WHERE project_id=? ORDER BY id DESC LIMIT 100", (ident,)).fetchall()
                        learned = db.execute("SELECT term,topic,weight,occurrences,positive,updated_at FROM learned_terms WHERE project_id=? ORDER BY weight DESC, occurrences DESC, term LIMIT 100", (ident,)).fetchall()
                        conversations = db.execute("SELECT id,message,response,topic,created_at FROM conversations WHERE project_id=? ORDER BY id DESC LIMIT 50", (ident,)).fetchall()
                        self.send_json(200, {"project": dict(item), "notes": [dict(row) for row in notes], "history": [dict(row) for row in history], "learned": [dict(row) for row in learned], "conversations": [dict(row) for row in conversations]})
                    else:
                        self.send_json(200, {"projects": [dict(row) for row in db.execute("SELECT * FROM projects ORDER BY id DESC")]})
            else:
                self.send_json(404, {"error": "Rota não encontrada"})
        except (ValueError, OSError, sqlite3.Error) as error:
            self.send_json(400, {"error": str(error)})

    def identifier(self, value):
        if isinstance(value, bool) or not str(value).isdigit() or int(value) < 1:
            raise ValueError("ID inválido")
        return int(value)

    def check_language(self, value):
        if value not in LANGUAGES:
            raise ValueError("Linguagem inválida")

    def body(self, limit=16384):
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Envie Content-Type: application/json")
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= limit:
            raise ValueError("Corpo vazio ou maior que o limite permitido")
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(body, dict):
            raise ValueError("Envie um objeto JSON")
        return body

    def do_POST(self):
        try:
            data = self.body(MAX_UPLOAD_BYTES + 8192) if self.path == "/api/snippets/upload" else self.body()
            if self.path == "/api/chat":
                message = data.get("message")
                language = data.get("language", "all")
                if not isinstance(message, str) or not message.strip() or len(message) > 4000:
                    raise ValueError("Mensagem inválida; máximo 4000 caracteres")
                self.check_language(language)
                pid = data.get("project_id")
                if pid is not None:
                    with connect() as db:
                        project(db, self.identifier(pid))
                project_id = self.identifier(pid) if pid is not None else None
                answer, topic = ENGINE.answer(message)
                wizard = wizard_next_question(project_id, message)
                if wizard:
                    answer, topic = wizard["question"], "wizard_" + wizard["stage"]
                memory = learn_interaction(project_id, message, topic, answer) if project_id is not None else {"terms": [], "topics": []}
                found = candidates(message, language, project_id=project_id)
                if pid is not None and found:
                    with connect() as db:
                        cursor = db.execute(
                            "INSERT INTO snippet_history(project_id,path,query,topic,approved) VALUES(?,?,?,?,0)",
                            (project_id, found[0]["path"], message.strip(), topic),
                        )
                        found[0]["history_id"] = cursor.lastrowid
                self.send_json(200, {"response": answer, "topic": topic, "snippets": found, "memory": memory, "wizard": wizard})
            elif self.path == "/api/snippets/upload":
                result = save_uploaded_snippet(data.get("name"), data.get("content"), data.get("language", "all"))
                self.send_json(201, {"ok": True, **result})
            elif self.path == "/api/snippets":
                ident = self.identifier(data.get("project_id"))
                history_id = self.identifier(data.get("history_id"))
                path = data.get("path")
                if not isinstance(path, str) or path not in {row[0] for row in list_library()}:
                    raise ValueError("Snippet não encontrado na biblioteca")
                if data.get("approved") is not True:
                    raise ValueError("Aprovação inválida")
                with connect() as db:
                    project(db, ident)
                    record = db.execute("SELECT query,topic FROM snippet_history WHERE id=? AND project_id=? AND path=?", (history_id, ident, path)).fetchone()
                    if record is None:
                        raise ValueError("Consulta não encontrada neste projeto")
                    changed = db.execute("UPDATE snippet_history SET approved=1 WHERE id=? AND project_id=? AND path=?", (history_id, ident, path))
                    if changed.rowcount != 1:
                        raise ValueError("Consulta não encontrada neste projeto")
                memory = learn_interaction(ident, record["query"], record["topic"] or "approved", record["query"], positive=True, record=False)
                self.send_json(200, {"ok": True, "memory": memory})
            elif self.path == "/api/projects":
                name = data.get("name")
                language = data.get("language", "all")
                profile = data.get("profile", "")
                self.check_language(language)
                if not isinstance(name, str) or not 0 < len(name.strip()) <= 100 or not isinstance(profile, str) or len(profile) > 500:
                    raise ValueError("Nome ou perfil inválido")
                with connect() as db:
                    cursor = db.execute("INSERT INTO projects(name,language,profile) VALUES(?,?,?)", (name.strip(), language, profile.strip()))
                    item = dict(project(db, cursor.lastrowid))
                self.send_json(201, {"project": item})
            elif self.path == "/api/projects/notes":
                ident = self.identifier(data.get("project_id"))
                note = data.get("note")
                if not isinstance(note, str) or not 0 < len(note.strip()) <= 4000:
                    raise ValueError("Nota inválida")
                with connect() as db:
                    project(db, ident)
                    db.execute("INSERT INTO bug_notes(project_id,note) VALUES(?,?)", (ident, note.strip()))
                self.send_json(201, {"ok": True})
            else:
                self.send_json(404, {"error": "Rota não encontrada"})
        except (ValueError, TypeError, UnicodeError, json.JSONDecodeError, sqlite3.Error, OSError) as error:
            self.send_json(400, {"error": str(error)})

    def do_PATCH(self):
        try:
            if self.path != "/api/projects":
                self.send_json(404, {"error": "Rota não encontrada"})
                return
            data = self.body()
            ident = self.identifier(data.get("project_id"))
            preferences = data.get("preferences")
            if not isinstance(preferences, str) or len(preferences) > 4000:
                raise ValueError("Preferências inválidas")
            with connect() as db:
                project(db, ident)
                db.execute("UPDATE projects SET preferences=? WHERE id=?", (preferences, ident))
                item = dict(project(db, ident))
            self.send_json(200, {"project": item})
        except (ValueError, TypeError, UnicodeError, json.JSONDecodeError, sqlite3.Error, OSError) as error:
            self.send_json(400, {"error": str(error)})


def main():
    init_storage()
    try:
        server = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as error:
        print("Porta 8000 indisponível:", error)
        return
    with server:
        print(f"Dev_Eliza MultiDev em http://{HOST}:{PORT} (Ctrl+C encerra)", flush=True)
        if "--open" in os.sys.argv:
            webbrowser.open("http://127.0.0.1:8000")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")


if __name__ == "__main__":
    main()
