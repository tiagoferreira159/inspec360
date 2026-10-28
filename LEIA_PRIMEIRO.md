# Inspec360 v3 — Netlify + Supabase

Pacote preparado para https://enginspec360.netlify.app/ e para o projeto Supabase informado por Tiago.

IMPORTANTE: este pacote não altera o site publicado nem executa SQL na sua conta. As configurações públicas já estão em config.js. Não é necessário instalar Node, Next.js ou pacotes para publicar.

## 1. Preserve a versão atual

Antes da atualização, entre na versão antiga pelo navegador onde os dados existem. Em Configurações / backup, baixe o backup COMPLETO com fotos. Faça isso em cada navegador que contenha registros. Guarde também o ZIP antigo e/ou o commit anterior do GitHub.

A nova versão não apaga o IndexedDB antigo e não importa dados automaticamente. Os logins locais antigos não funcionam na versão na nuvem.

## 2. Configure o Supabase Auth

- Authentication → URL Configuration.
- Site URL: https://enginspec360.netlify.app/
- Redirect URLs: adicione https://enginspec360.netlify.app/
- Salve.
- Authentication → Sign In / Providers → Email: habilite e-mail/senha.
- Desative Allow new users to sign up (cadastro público).
- Authentication → Users → Add user → Create new user.
- Informe seu e-mail e uma senha forte. Marque Auto Confirm User para a conta que você mesmo verificou.

Não é necessário configurar SMTP nesta edição: ela não envia convites nem e-mails de recuperação. Para redefinir uma senha esquecida, o responsável usa o painel do Supabase (User → ações de gerenciamento, conforme disponível). Se optar pelo envio de e-mail de recuperação, configure SMTP e implemente/teste a tela de recuperação antes de divulgá-la.

## 3. Crie o banco e o armazenamento

- No seu projeto Supabase, abra SQL Editor → New query.
- Abra 01_CRIAR_BANCO.sql em um editor de texto.
- Copie TODO o conteúdo, cole no SQL Editor e clique Run.
- A interface deve informar sucesso (por exemplo, Success. No rows returned).
- O script cria as tabelas, os perfis, as políticas de acesso e o bucket privado inspec360-arquivos. Se você já criou esse bucket, ele será mantido privado com os limites de upload definidos no script.
- O Supabase pode mostrar um aviso sobre DROP POLICY / DROP TRIGGER: o script recria apenas as políticas e o gatilho de nomes inspec_* utilizados por esta edição; não elimina tabelas nem registros. Confira que está executando o arquivo deste pacote no projeto correto.

Em Table Editor, confira: inspec_workspaces, inspec_members e inspec_records. Os dados de cada módulo são identificados por kind; os campos de cada registro ficam em payload (JSONB). Esta estrutura permite preservar os dados e laudos do sistema original sem criar uma tabela por tela. Senhas ficam exclusivamente no Supabase Auth.

Em Storage, confira o bucket inspec360-arquivos com Public desativado. Se já existem políticas genéricas antigas permitindo acesso amplo nesse bucket, remova essas políticas: as regras novas são somadas às existentes pelo PostgreSQL. Em um projeto novo, basta executar o script fornecido.

## 4. Vincule sua conta como administrador

- Abra 02_VINCULAR_ADMIN.sql.
- Substitua SEU_EMAIL_AQUI pelo e-mail exato criado no passo 2, mantendo as aspas simples.
- Exemplo: v_email text := 'seuemail@exemplo.com';
- No SQL Editor, abra uma NOVA consulta, cole o arquivo completo já ajustado e clique Run.
- Em inspec_members deve aparecer sua conta com role=admin e active=true.

Se aparecer E-mail não encontrado, crie a conta em Authentication → Users ou corrija o e-mail no script. Não coloque sua senha nesse SQL.

## 5. Publique a nova versão no Netlify

Extraia o ZIP. Atualize a raiz do repositório GitHub conectado ao Netlify com TODOS estes arquivos:

- index.html
- config.js
- cloud.js
- netlify.toml

Não publique o ZIP fechado. index.html deve estar diretamente na pasta publicada, e config.js e cloud.js devem estar ao lado dele. Os arquivos SQL e este manual podem ficar guardados no seu computador; não são necessários para o funcionamento do site.

No GitHub: repositório → Add file → Upload files → envie os quatro arquivos → Commit changes.
No Netlify: acompanhe Deploys até Published. A configuração é site estático, Publish directory = ponto (.), sem necessidade de framework. O netlify.toml já contém a configuração.
Se publicou manualmente, envie uma pasta contendo os quatro arquivos em um novo deploy manual.

Não é necessário configurar variáveis NEXT_PUBLIC_* no Netlify. Nesta edição estática, config.js fornece a URL e a chave PUBLICÁVEL. Não coloque Secret key, service_role, senha do banco ou tokens administrativos no site.

## 6. Teste o acesso e a gravação

- Abra https://enginspec360.netlify.app/ e pressione Ctrl+Shift+R.
- Confira a indicação Nuvem · v3.
- Entre com o e-mail/senha criados em Authentication, não com a conta local antiga.
- Se deseja importar seu backup antigo, faça o passo 7 ANTES de criar registros de teste.
- Caso contrário, cadastre um condomínio, uma inspeção, um ambiente e um item.
- Adicione uma foto JPEG, PNG ou WebP.
- Recarregue a página e confirme os registros.
- Abra em outro dispositivo, entre e confirme os mesmos dados.
- Use Atualizar dados para buscar alterações feitas por outros usuários. Não há sincronização em tempo real nesta edição.
- Gere o laudo com foto e confirme a exportação Word e a impressão em PDF.

## 7. Importe o backup antigo, se necessário

Na versão nova: Configurações / backup → Importar backup inicial → selecione o JSON COMPLETO da versão antiga.

A organização deve estar VAZIA: sem condomínios, inspeções ou configurações salvas. A presença de contas em inspec_members não impede a importação. Não cadastre registros de teste antes da migração.

A importação preserva os IDs e vínculos entre registros; ignora usuários, hashes e senhas locais. Fotos são convertidas para JPEG com até 1.800 pixels no maior lado. Arquivos HEIC/HEIF devem ser convertidos previamente para JPEG. Cada imagem de origem deve ter até 10 MB. A logomarca é mantida nos dados de configuração (até 3 MB no envio pelo formulário).

Não há transação única envolvendo upload de todos os arquivos: se a internet cair, pode haver importação parcial. O sistema avisa e não substitui o que já existe. Não apague o backup original. Revise os registros no painel antes de repetir uma migração; solicite apoio se houver importação parcial. Não use o backup sem fotos para migrar dados.

## 8. Cadastre os usuários do cliente

1. Supabase → Authentication → Users → Add user → Create new user.
2. Informe e-mail e senha inicial forte. Confirme apenas contas que você verificou.
3. Copie o User UID dessa pessoa (identificador UUID da conta).
4. No site, entre como administrador → Gestão de acessos → Vincular usuário.
5. Cole o User UID, informe o nome e escolha o perfil.
6. Salve e peça à pessoa que entre no site.

Perfis:
- Administrador: registros, configurações, backup/importação e gestão dos vínculos de acesso.
- Engenheiro / Editor: cadastros, inspeções, fotos e laudos; sem gestão de acessos/configurações/backup administrativo.
- Consulta: visualização e geração de laudos; sem gravação de dados. Pode alterar a própria senha.

Cada usuário pode alterar a própria senha em Minha senha. O administrador não redefine senhas de outras pessoas pelo HTML. Usuários desativados no Inspec360 perdem acesso aos dados via RLS mesmo que tenham uma sessão Auth válida; cópias já baixadas anteriormente não são recolhidas.

Todos os usuários vinculados à MESMA organização compartilham todos os registros dessa organização. Esta edição abre uma organização por conta; não possui seletor de organizações. Para novos clientes que precisem de isolamento, crie outra organização e vínculos separados com apoio técnico, usando as tabelas e políticas existentes. Não vincule clientes independentes à organização inicial esperando separação por condomínio.

## 9. Uso e manutenção

- Internet é necessária para entrar, consultar a nuvem e salvar. Não há fila offline.
- Não feche o formulário enquanto estiver Salvando. Falhas são mostradas na tela.
- Edições de um mesmo registro usam updated_at: se outra pessoa já o alterou, a gravação é recusada e deve ser refeita após Atualizar dados.
- Exclusões de inspeções e seus vínculos são sequenciais; em caso de falha no meio, atualize e confira os registros. Não há desfazer.
- Fotos são baixadas autenticadas e reutilizadas em memória enquanto a página está aberta. Organizações grandes podem apresentar carregamento lento; paginação visual e download sob demanda serão evolução futura.
- Faça backup completo regularmente; ele contém dados e fotos, sem senhas/contas Auth. O botão Importar backup inicial é para migração em organização vazia, não uma restauração que sobrescreve dados.
- Consulte Usage no painel Supabase para banco, arquivos e tráfego. O plano gratuito tem limites e pode pausar por inatividade; mantenha acompanhamento e backups.
- Atualizar arquivos do site mantém os dados no Supabase. Preservar a mesma configuração mantém a conexão.

## Erros comuns

- Invalid login credentials: conta não criada no Supabase Auth ou senha incorreta.
- Conta autenticada, mas sem acesso: execute o passo 4 ou vincule o User UID no passo 8.
- Relation/table/schema cache não encontrado: execute 01_CRIAR_BANCO.sql e aguarde a API reconhecer a estrutura.
- Acesso negado / RLS: confira active, role e workspace_id em inspec_members; confira que as políticas foram criadas pelo script.
- Não foi possível conectar: verifique internet, URL, chave e projeto ativo no Supabase.
- Tela antiga: confira o deploy e force recarga. Os quatro arquivos precisam ser da mesma versão.
- Erro de foto: utilize JPEG/PNG/WebP até 10 MB; confira bucket privado e políticas Storage.
- Registro alterado por outra pessoa: feche o formulário, Atualizar dados e refaça a edição sobre o conteúdo mais recente.

## Validação desta entrega

Os scripts devem ser executados e testados na sua conta antes de liberar ao cliente. Não foram utilizados acesso administrativo nem senhas do seu Supabase. Os testes locais e suas limitações estão em VALIDACAO.md.

Documentação oficial consultada:
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/api
https://supabase.com/docs/guides/auth/passwords
https://supabase.com/docs/guides/storage/security/access-control
