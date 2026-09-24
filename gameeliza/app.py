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
:root{color-scheme:dark;--bg:#10121b;--panel:#191e2b;--edge:#333d52;--text:#e0e6f1;--accent:#7ad9ce}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer;background:#244f53;border:1px solid #40988e;color:#eff; padding:9px 13px;border-radius:7px}button:hover{background:#306267}button:disabled{opacity:.5}input,select,textarea{background:#111727;color:var(--text);border:1px solid var(--edge);border-radius:7px;padding:10px;min-width:0}textarea{resize:vertical}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.layout{display:grid;grid-template-columns:255px minmax(0,1fr) minmax(280px,38%);height:100dvh}.sidebar,.right{background:var(--panel);overflow:auto;padding:16px}.sidebar{border-right:1px solid var(--edge)}.right{border-left:1px solid var(--edge)}h1{font-size:19px;color:var(--accent);margin:0}h2{font-size:15px;margin:18px 0 9px}.muted,small{color:#b3c0d2}.stack{display:grid;gap:8px}.stack>*{width:100%}.files{list-style:none;padding:0;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,monospace}.files li{padding:5px;border-bottom:1px solid var(--edge)}.center{display:flex;flex-direction:column;min-height:0}.top{padding:14px 18px;border-bottom:1px solid var(--edge)}#log{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}.bubble{max-width:90%;padding:11px 13px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:9px}.bot{align-self:flex-start;background:#202c38;border-left:3px solid var(--accent)}.user{align-self:flex-end;background:#323554;border-left:3px solid #ffcd75}#chatForm{display:flex;gap:8px;padding:12px;border-top:1px solid var(--edge)}#message{flex:1}pre{max-height:55dvh;overflow:auto;padding:15px;background:#0b111e;border:1px solid var(--edge);border-radius:7px;font:13px/1.5 ui-monospace,monospace;white-space:pre}#snippetName{overflow-wrap:anywhere}details{margin-top:12px}summary{cursor:pointer}#status{min-height:1.4em}@media(max-width:960px){.layout{grid-template-columns:210px 1fr}.right{grid-column:1/-1;border-left:0;border-top:1px solid var(--edge)}.center{height:65dvh}}@media(max-width:600px){.layout{display:flex;flex-direction:column;height:auto;min-height:100dvh}.sidebar{border-right:0;border-bottom:1px solid var(--edge)}.center{height:65dvh;min-height:460px}.right{min-height:240px}#chatForm{padding:8px}}
</style></head><body><div class="layout"><aside class="sidebar"><h1>GameEliza</h1><small>MultiDev · biblioteca local</small><h2>Projeto</h2><div class="stack"><label for="project">Projeto ativo</label><select id="project"></select><input id="newName" placeholder="Nome do novo projeto" aria-label="Nome do novo projeto" maxlength="100"><input id="newProfile" placeholder="Perfil: jogo 2D, API..." aria-label="Perfil do projeto" maxlength="500"><button id="create">Criar projeto</button><label for="language">Linguagem/engine</label><select id="language"><option value="all">Todas</option><option value="godot">Godot</option><option value="python">Python</option><option value="javascript">JavaScript</option><option value="csharp">C#</option><option value="cpp">C++</option><option value="sql">SQL</option></select></div><h2>Biblioteca</h2><small>Arquivos lidos de ./biblioteca/</small><ul id="files" class="files"></ul></aside><main class="center"><div class="top"><strong>Depuração reflexiva</strong><div class="muted">Respostas por regras. Código exibido vem dos arquivos locais.</div></div><section id="log" role="log" aria-live="polite"><div class="bubble bot">Qual problema você quer investigar? Especifique a linguagem e descreva o comportamento esperado.</div></section><form id="chatForm"><input id="message" aria-label="Pergunta" placeholder="Ex.: movimento com gravidade em Godot" maxlength="4000" required><button id="send">Enviar</button></form></main><aside class="right"><h2>Snippet encontrado</h2><div id="snippetName" class="muted">Faça uma busca no chat.</div><pre><code id="code"></code></pre><button id="copy" disabled>Copiar código</button><button id="approve" disabled>Aprovar snippet</button><details><summary>Memória aprendida</summary><ul id="learned" class="files"><li>Selecione um projeto para começar.</li></ul></details><details><summary>Notas e preferências</summary><div class="stack"><textarea id="preferences" aria-label="Preferências de arquitetura" placeholder="Preferências de arquitetura"></textarea><button id="savePrefs">Salvar preferências</button><textarea id="bugNote" aria-label="Nota de bug resolvido" placeholder="Descreva um bug resolvido"></textarea><button id="saveNote">Salvar nota</button><ul id="notes"></ul></div></details><p id="status" class="muted" role="status"></p></aside></div>
<script>
document.title='Dev_Eliza · MultiDev Engine';const brandHeading=document.querySelector('.sidebar h1');if(brandHeading)brandHeading.textContent='Dev_Eliza';
const uploadLabel=document.createElement('label');uploadLabel.htmlFor='upload';uploadLabel.textContent='Anexar códigos';const uploadInput=document.createElement('input');uploadInput.id='upload';uploadInput.type='file';uploadInput.multiple=true;uploadInput.accept='.gd,.cs,.py,.cpp,.js,.sql,.json,text/plain';const uploadHint=document.createElement('small');uploadHint.textContent='Vários arquivos · máximo 512 KB por arquivo. “Todas” identifica pela extensão.';const filesList=document.getElementById('files');filesList.before(uploadLabel,uploadInput,uploadHint);
const $=id=>document.getElementById(id);let projects=[],active=null,current=null;
uploadInput.accept='*/*';const languageSelect=document.getElementById('language');[['html','HTML'],['css','CSS'],['text','Texto']].forEach(([value,label])=>languageSelect.add(new Option(label,value)));
async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json()}catch{throw Error('Resposta inválida do servidor')}if(!response.ok)throw Error(data.error||'Falha na requisição');return data}
function status(text){$('status').textContent=text}function bubble(kind,text){const el=document.createElement('div');el.className='bubble '+kind;el.textContent=text;$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight}
function renderMemory(memory){if(!memory||!memory.terms)return;const list=$('learned');list.replaceChildren();for(const item of memory.terms){const li=document.createElement('li');li.textContent=item.term+' · '+item.topic+' · peso '+item.weight;list.appendChild(li)}if(memory.terms.length===0){const li=document.createElement('li');li.textContent='Ainda sem associações aprendidas';list.appendChild(li)}}
function show(snippet){current=snippet||null;$('snippetName').textContent=snippet?snippet.path+' · relevância '+snippet.score:'Nenhum trecho relevante encontrado.';$('code').textContent=snippet?snippet.code:'';$('copy').disabled=!snippet;$('approve').disabled=!snippet||!active||!snippet.history_id}
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
const localModel=document.createElement('input');localModel.value=localStorage.getItem('devElizaLocalModel')||'auto';localModel.placeholder='Modelo (auto ou nome do modelo)';localModel.setAttribute('aria-label','Modelo local');
const localConnect=document.createElement('button');localConnect.type='button';localConnect.textContent='Conectar LLM local';
const localHelp=document.createElement('small');localHelp.className='muted';localHelp.textContent='O GGUF precisa estar rodando no llama-server/router do dispositivo.';
const localButton=document.createElement('button');localButton.type='button';localButton.textContent='Ativar Gemma local';
const localState=document.createElement('small');localState.className='muted';localState.textContent='O modelo será baixado uma vez e executado neste navegador.';
localBox.append(localTitle,localEndpoint,localModel,localConnect,localHelp,localButton,localState);document.querySelector('.top').append(localBox);
let localLLM=false,localBusy=false;
function localURL(path){return localEndpoint.value.replace(/\/$/,'')+path}
localConnect.addEventListener('click',async()=>{const base=localEndpoint.value.trim().replace(/\/$/,'');if(!/^https?:\/\//i.test(base)){localState.textContent='Informe uma URL http:// ou https:// válida.';return}try{const response=await fetch(base+'/health',{method:'GET'});if(!response.ok)throw Error('HTTP '+response.status);localStorage.setItem('devElizaLocalEndpoint',base);localStorage.setItem('devElizaLocalModel',localModel.value.trim()||'auto');localLLM=true;localConnect.textContent='Desconectar LLM local';localState.textContent='LLM local conectado. As mensagens irão para o GGUF.';status('Modo LLM local ativo.')}catch(error){localLLM=false;localState.textContent='Não conectou ao LLM local. Inicie o llama-server/router e tente novamente.';status('Falha na conexão local: '+error.message)}});
localEndpoint.addEventListener('change',()=>{localLLM=false;localConnect.textContent='Conectar LLM local'});
localConnect.addEventListener('dblclick',()=>{localLLM=false;localConnect.textContent='Conectar LLM local';localState.textContent='Modo LLM local desligado.'});
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
  if(localLLM&&!localBusy){event.preventDefault();event.stopImmediatePropagation();const text=$('message').value.trim();if(!text)return;bubble('user',text);$('message').value='';$('send').disabled=true;localBusy=true;status('Consultando o GGUF local…');let context={snippets:[],memory:{terms:[]}};try{try{context=await api('/api/chat','POST',{message:text,language:$('language').value,project_id:active});show(context.snippets[0]);renderMemory(context.memory)}catch{status('Render offline; enviando diretamente ao GGUF local…')}const response=await fetch(localURL('/v1/chat/completions'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:localModel.value.trim()||'auto',messages:[{role:'system',content:'Você é Dev_Eliza, assistente de programação. Responda em português e entregue código quando solicitado.'},{role:'user',content:text}],max_tokens:512,stream:false})});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'HTTP '+response.status);const answer=data.choices?.[0]?.message?.content;if(!answer)throw Error('O LLM local não retornou conteúdo');bubble('bot',answer.trim());status('Resposta gerada pelo GGUF local.'+(context.snippets.length?' Biblioteca consultada.':' Offline, sem consulta à biblioteca online.'))}catch(error){bubble('bot','Falha no LLM local: '+error.message);status('Verifique se o llama-server/router está ativo e acessível pelo navegador.')}finally{localBusy=false;$('send').disabled=false;$('message').focus()}return;}
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
<script>window.chtlConfig={chatbotId:"3418865189",display:"fullscreen"}</script>
<script async data-id="3418865189" id="chtl-script" data-display="fullscreen" type="text/javascript" src="https://chatling.ai/js/embed.js"></script>
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
