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

## 8. Cadastre os usuários diretamente no Inspec360

1. Entre no site como administrador.
2. Abra Gestão de acessos → Novo usuário.
3. Informe nome, e-mail, senha inicial e confirmação da senha.
4. Escolha Administrador, Engenheiro / Editor ou Consulta.
5. Clique em Cadastrar. A conta e o perfil são criados juntos no servidor.
6. O usuário já pode entrar com o e-mail e a senha inicial cadastrados. Ele pode alterar a própria senha em Minha senha.

Não é necessário abrir o painel do Supabase nem copiar User UID para cadastrar novas pessoas. A conta inicial de administrador continua sendo preparada pelos passos 2 e 4 ao instalar do zero.

Perfis:
- Administrador: registros, configurações, backups e cadastro/gestão dos usuários da organização.
- Engenheiro / Editor: cadastros, inspeções, fotos e laudos, sem gestão de usuários.
- Consulta: visualização e geração de laudos, sem gravação de dados.

O servidor confere o JWT de quem solicita e a condição de administrador ativo na organização. A chave administrativa fica exclusivamente no ambiente da função Supabase; não é enviada ao navegador. Senhas são processadas pelo Supabase Auth e não são gravadas em tabelas da aplicação, respostas ou logs da função.

A criação administrativa confirma o e-mail sem enviar convite. O administrador deve conferir o endereço e entregar a senha inicial ao usuário por um canal adequado. O sistema não envia e-mails neste fluxo. E-mails já registrados no Auth não são vinculados automaticamente, para evitar apropriação de contas existentes.

A função inspec360-create-user já está instalada no projeto configurado. Para outra instalação, publique o código em supabase/functions/inspec360-create-user/index.ts no Supabase com verify_jwt=true. Esse código é executado no servidor, não pelo Netlify. As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são fornecidas pelo ambiente Supabase. Nunca copie a chave administrativa para config.js.

Todos os usuários da mesma organização compartilham seus registros. Clientes independentes devem ter organizações separadas. Esta edição abre uma organização por conta.

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

## Editor completo do laudo (versão 4)

Na inspeção, abra Gerar laudo. O editor permite preencher e editar os 15 tópicos iniciais: Introdução, Considerações Iniciais, Identificação, Realização do Laudo, Datas das Vistorias, Ficha Técnica, Registro Fotográfico, Metodologia, Critério Utilizado, Prioridades, Documentação Analisada, Ordem das Prioridades – Grau de Prioridade, Conclusão, Encerramento e Anexos.

- Selecione um tópico à esquerda para editar título e texto. Use + Tópico e + Subitem para ampliar a estrutura (até seis níveis).
- Use Subir/Descer para organizar os tópicos e subitens dentro do mesmo nível. A opção Incluir controla a presença do tópico e de seus descendentes no laudo.
- Preencha o título do laudo e o tipo do imóvel. O tipo também pode ser informado no cadastro do condomínio.
- Abra Formatação, fotografias, cabeçalho e rodapé para escolher 1, 2 ou 3 fotos por linha, fonte, tamanhos e cores do texto e dos títulos, além dos textos de cabeçalho e rodapé.
- Salvar laudo guarda as configurações e os conteúdos desta inspeção no banco. Pré-visualizar, Word e PDF também salvam as alterações antes de gerar o documento, quando o usuário tem permissão de edição.
- Administradores podem Salvar como modelo padrão para reaproveitar a estrutura em inspeções sem laudo configurado. Inspeções já configuradas mantêm seu próprio documento.
- O Registro Fotográfico inclui automaticamente os ambientes, itens, constatações e fotos cadastrados na inspeção. Os textos técnicos dos demais tópicos são preenchidos pelo responsável; o sistema não inventa conclusões.

Para organizar os ambientes, abra a inspeção → Ambientes e verificações → Organizar ordem das áreas. Use as setas e Salvar ordem. Essa ordem será usada na árvore da inspeção e nos documentos. A operação é atômica e recusa uma lista desatualizada quando outro usuário alterou as áreas.

O sumário da prévia e do PDF é calculado com as páginas A4 efetivamente montadas pelo navegador. Na impressão, selecione A4, escala 100% e desative os cabeçalhos/rodapés automáticos do navegador, pois o próprio laudo já contém esses elementos.

O Word usa sua paginação nativa e um campo de sumário com referências aos títulos. Ao abrir ou editar o arquivo no Word, confirme a atualização dos campos ou use Atualizar sumário/F9 para refletir a paginação do editor utilizado. Word e navegador podem produzir números de páginas diferentes; cada formato mantém suas próprias referências. As fotos no Word são organizadas em tabelas de 1, 2 ou 3 colunas.

Em uma instalação nova, execute também 03_ORDENAR_AREAS.sql após 01_CRIAR_BANCO.sql. A migração já está aplicada no projeto atual. Inclua report-studio.js e report-editor.css junto aos arquivos do site.

### Modelos de inspeção personalizados
Em **Modelos e listas**, o administrador pode criar um modelo vazio ou duplicar o modelo inicial. No editor, use **+ Ambiente**, selecione o ambiente e adicione quantos **itens de verificação** precisar. Cada ambiente possui uma lista própria. As setas alteram a ordem de ambientes e itens. Clique em **Salvar modelo** para gravar na organização; outros usuários com acesso poderão consultar os modelos.

Em uma inspeção, **Aplicar modelo** permite escolher qualquer modelo cadastrado. Também é possível escolher a inspeção diretamente na tela de modelos. A aplicação acrescenta ambientes e itens ausentes, compara nomes sem diferenciar maiúsculas e espaços nas extremidades, mantém a ordem existente e preserva avaliações e fotos. A estrutura do modelo é copiada: edições ou exclusões posteriores do modelo não alteram inspeções já criadas. Engenheiros/editores podem aplicar; usuários de consulta podem visualizar; administrar modelos requer perfil Administrador.

Os modelos são registros individuais `settings` com `type: inspectionTemplate`, protegidos pelas políticas existentes e pelo controle de revisão. A gravação de um modelo não substitui as configurações gerais nem o modelo do laudo. Se a conexão interromper a aplicação, é possível repetir para concluir os itens ausentes.

### Foto na capa e logomarcas nas páginas
No editor do laudo, expanda **Imagens da capa, cabeçalho e rodapé**. Selecione uma imagem em cada posição desejada:
- **Foto central da capa**: foto do imóvel no centro da primeira página, título acima e identificação abaixo; ajuste a altura máxima e o alinhamento dos dados.
- **Logomarca ou faixa do cabeçalho**: repetida em todas as páginas; configure largura máxima e alinhamento.
- **Logomarca ou faixa do rodapé**: repetida em todas as páginas, acima do texto e da numeração. Uma faixa horizontal pode conter logomarca, telefone e contatos, como no modelo de referência.

Aceita PNG, JPEG e WebP de até 10 MB. As imagens são preparadas para o documento, preservando as proporções; logos preservam transparência. É possível remover ou substituir qualquer uma e, quando houver logo nas configurações gerais, reutilizá-la no cabeçalho/rodapé. Clique em **Salvar laudo** para gravar; depois use a prévia, PDF ou Word. A imagem da capa pertence à inspeção; **Salvar como modelo padrão** reutiliza as logomarcas e a formatação sem copiar a foto do imóvel para outras inspeções.

### Conteúdo dos tópicos e estilos das constatações
Selecione um tópico no editor do laudo. Abaixo do texto principal, **Imagens, tabelas e textos adicionais** oferece **+ Imagem**, **+ Tabela** e **+ Bloco de texto**. Os blocos são incluídos após o texto principal; use as setas para intercalar/reordenar. Imagens têm legenda, largura, altura máxima e alinhamento. Tabelas permitem editar as células, definir título, habilitar a primeira linha como cabeçalho e acrescentar/remover linhas e colunas (até 100 linhas e 8 colunas). O cabeçalho é repetido quando a tabela ocupa mais de uma página. O Word contém tabelas editáveis e imagens incorporadas.

Expanda **Cores e tamanhos dos tipos de constatação** para definir a cor e o tamanho do texto por classificação. A configuração vale para título, descrição, classificação, prioridade e recomendação da constatação no laudo. Clique em **Salvar laudo** para gravar por inspeção ou **Salvar como modelo padrão** para reutilizar a configuração. Usuários de consulta visualizam e exportam, sem alterar o conteúdo.

As notas gerais dos itens são apresentadas diretamente, sem o prefixo “Observações”. Prioridades na tela e no laudo: **0 - Crítica; 1 - Alta; 2 - Média; 3 - Baixa; Não definida**. Os valores antigos continuam compatíveis, sem necessidade de modificar os registros existentes.
