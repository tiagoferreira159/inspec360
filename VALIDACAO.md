# Validação da entrega

## Verificado localmente

- Sintaxe dos scripts JavaScript.
- Execução de 01_CRIAR_BANCO.sql e 02_VINCULAR_ADMIN.sql em PostgreSQL embutido PGlite, com schemas auth/storage de teste.
- Reexecução do script de estrutura sem apagar registros.
- RLS: administrador, editor, consulta, conta sem vínculo, conta desativada e tentativa de elevar o próprio perfil.
- Storage: leitura para membros ativos, gravação para editor/admin, recusa de exclusão para consulta e isolamento de conta sem vínculo.
- Testes de DOM com jsdom e API simulada: login, condomínio, inspeção, ambiente, item, fluxo de foto privada, recarga de sessão, erro visível ao salvar, conflito de versão, bloqueio de cadastro para consulta, troca da própria senha e exclusão encadeada.

## Limites da verificação

- A API dos testes de interface é simulada; não foram criados usuários nem executados scripts no Supabase real.
- O teste SQL utiliza uma instância PostgreSQL local embutida, com schemas reduzidos de Auth/Storage; a integração hospedada deve ser confirmada após instalação.
- Não foi possível instalar o navegador Chromium neste ambiente. Não houve inspeção visual em navegador real. O canvas usado nos testes de DOM é simulado: não valida qualidade de imagem ou compressão real.
- A geração original de Word/PDF foi preservada, mas não foi validada visualmente nesta atualização. Teste com um laudo real após instalar.
- Testes em dois dispositivos reais, mudança de senha no serviço hospedado e políticas no bucket do projeto precisam ser executados no ambiente do usuário.
- O pacote não foi publicado no Netlify nesta entrega.

## Configuração do ambiente hospedado

A migração create_inspec360_initial_schema foi aplicada no projeto ngicvcysdkuasjnmxyas.
As três tabelas públicas estão com RLS habilitado, e o bucket inspec360-arquivos está privado.
A auditoria de segurança do Supabase retornou zero alertas. A consulta executada como authenticated sem vínculo não visualizou organizações, membros ou registros.

Nenhuma conta Auth foi criada automaticamente. O responsável deve cadastrar a conta inicial diretamente em Authentication → Users; depois ela poderá ser vinculada como administradora. Não foram criadas credenciais ou funções administrativas de instalação.

Ainda depende da conta inicial: teste real de login válido, gravação com usuário administrador e upload/download autenticado de uma fotografia no ambiente hospedado.
