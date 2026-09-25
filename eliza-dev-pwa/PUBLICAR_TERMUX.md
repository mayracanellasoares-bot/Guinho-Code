# Publicar Eliza Dev com o próprio Android (Termux)

Este procedimento publica **somente o Eliza na porta 8000** por um túnel
HTTPS. Ollama (11434) e o roteador (8090) permanecem em 127.0.0.1.
O telefone executa a inferência; o túnel não hospeda a IA.

## Teste com pessoas convidadas (link temporário)

1. Deixe Ollama e roteador funcionando no Termux.
2. Encerre o Eliza anterior (Ctrl+C). Atualize apenas o arquivo com
   `curl -fL .../main/eliza-dev-pwa/eliza_server_clip.py -o eliza_server_clip_novo.py`,
   valide com `python -m py_compile`, preserve backup e troque o arquivo.
3. Instale o túnel: `pkg install cloudflared`. Se o Termux oferecer mais de
   um repositório, confirme que o pacote está disponível com `pkg search cloudflared`.
4. **Na sessão do Eliza** escolha uma senha forte sem gravá-la em histórico:

   ```bash
   cd ~/eliza-dev-pwa
   read -r -s -p 'Senha de acesso ao Eliza: ' ELIZA_ACCESS_PASSWORD
   echo
   export ELIZA_ACCESS_PASSWORD
   export ELIZA_REQUIRE_AUTH=1
   export ELIZA_ALLOW_CLOUD=0
   python eliza_server_clip.py
   ```

   A interface solicitará usuário `eliza` e a senha informada. Protege todas
   as rotas, inclusive `/api/chat` e os downloads. Não compartilhe a senha
   publicamente.

5. **Em outra sessão** inicie o túnel:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8000
   ```

   Copie o endereço HTTPS `https://...trycloudflare.com` que aparecer e
   encaminhe apenas a pessoas autorizadas. A URL muda quando o processo
   reinicia. Confirme no navegador de outra rede.

**Não** publique as portas 11434 e 8090, não use `0.0.0.0` para Ollama ou
roteador e não exponha o Eliza sem a senha. A opção Gemma Cloud fica
desabilitada no exemplo para não consumir recursos externos inadvertidamente.

O telefone precisa permanecer ligado, com conexão disponível, Termux sem
restrições agressivas de bateria e os processos em execução. `termux-wake-lock`
pode ajudar, mas não garante uptime. Múltiplos usuários disputam a RAM/GPU do
mesmo aparelho; pedidos simultâneos de geração recebem HTTP 429 até liberar
a execução.

## Endereço permanente e convidados individuais

Um Quick Tunnel é só para demonstração; não tem garantia de disponibilidade.
Para endereço estável, configure um Cloudflare Tunnel nomeado em domínio
gerenciado por você e uma aplicação **Cloudflare Access** com política Allow
para os e-mails convidados. Crie a política **antes** de tornar a rota pública,
apontando o hostname para `http://127.0.0.1:8000`. Habilite a proteção
do túnel por Access. O usuário deve completar o fluxo de Cloudflare na própria
conta; não grave o token do túnel no GitHub.

Para serviço público contínuo, use máquina dedicada ou servidor com
infraestrutura de inferência apropriada; um Android não oferece disponibilidade
nem isolamento equivalente. A senha compartilhada é solução de teste, não
gestão individual de contas.
