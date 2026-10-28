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

## Validação com a conta inicial

A conta inicial foi criada pelo próprio responsável no painel do Supabase, confirmada e vinculada como administradora. Na versão de prévia publicada pelo Netlify, o login funcionou e exibiu o perfil Administrador.

Pela interface hospedada foram gravados e lidos um condomínio, uma inspeção, um ambiente e um item temporários. A pré-visualização do laudo funcionou e o Word foi exportado: o arquivo DOCX baixado foi verificado como ZIP íntegro, com XML válido e conteúdo da inspeção.

O envio da imagem sintética de teste não foi concluído: a autorização de upload do navegador foi recusada. Nenhum arquivo foi enviado por outra rota. O usuário pediu que a conclusão prossiga apenas pelas integrações, sem navegador Cloud. As políticas de acesso a fotos foram verificadas no banco; o fluxo de upload foi testado localmente com API/canvas simulados, mas o upload/download real continua pendente.

Os quatro registros temporários estão identificados por “Validação técnica temporária”, “Teste técnico de gravação e fotografia”, “Ambiente de validação” e “Item técnico temporário”. Não há fotografias de teste no Storage.

## Cadastro de usuários pela ferramenta

A função inspec360-create-user está publicada com verificação JWT habilitada. Ela valida o usuário no Auth, consulta seu perfil administrador ativo pela API com RLS, cria a conta no Auth e usa a RPC existente para vincular o perfil, revalidando a autorização. Contas existentes não são modificadas nem vinculadas automaticamente. Em caso de falha de vínculo, a função tenta remover apenas a conta que acabou de criar.

Testes automatizados do servidor: ausência/token inválido, ausência de perfil administrador, validação dos campos, duplicidade, criação/vínculo, compensação e CORS. Testes de DOM simulados: formulário sem UID, confirmação de senha, criação e manutenção da sessão administrativa. No endpoint hospedado, OPTIONS/CORS foi verificado e chamadas sem sessão/com token inválido receberam HTTP 401. Ainda não foi criada uma conta real por essa função durante esta validação; o caminho positivo de Auth/RPC foi exercitado com APIs simuladas.

## Laudos configuráveis e ordenação das áreas

Implementados editor por inspeção, os 15 tópicos solicitados, subitens até seis níveis, títulos editáveis, tipo do imóvel, inclusão/exclusão e ordenação de tópicos, modelo padrão da organização, fontes/tamanhos/cores, cabeçalho/rodapé e fotografias em até três colunas.

A configuração é guardada em inspections.payload.reportDoc e o modelo compartilhado em settings.payload.reportTemplate, protegidos pelas políticas existentes. A migração inspec360_reorder_inspection_areas adiciona uma RPC SECURITY INVOKER: usa RLS, exige editor/admin e confere a lista e as versões antes de atualizar todas as ordens na mesma transação.

Validação:
- Testes de modelo (Node): todos os tópicos iniciais, subitens, exclusão, ordenação, agrupamento de três fotos e sanitização da formatação.
- PostgreSQL/PGlite: reordenação atômica, recusa de versões antigas e bloqueio do perfil consulta. No banco hospedado, a RPC também foi executada em uma transação revertida, sem modificar as áreas reais.
- Chromium local, com API de teste simulada e imagens sintéticas: editor, salvamento, modelo padrão, consulta sem edição, ordem de áreas, fontes e grupos de 1/2/3 fotos, paginação de parágrafos longos e sumário com várias páginas.
- PDF real de seis páginas: quantidade de páginas conferida, sumário comparado ao mapa de títulos, cabeçalho/rodapé/numeração em todas as páginas e inspeção visual das seis páginas.
- DOCX real renderizado por LibreOffice para PDF/PNG: seis páginas inspecionadas visualmente, sumário, cabeçalho/rodapé, fotos em duas linhas de três, estrutura XML e campos atualizáveis do Word.

O Word usa paginação nativa, evitando que diferenças de métricas em relação ao navegador provoquem páginas vazias. Após editar o arquivo no Word, os campos/sumário precisam ser atualizados no próprio editor. A impressão do PDF deve usar A4, escala 100% e os cabeçalhos/rodapés automáticos do navegador desativados.

Nenhum conteúdo de laudo, conclusão ou imagem de cliente foi criado/modificado pelos testes. O teste visual usou apenas dados locais sintéticos; o teste da RPC hospedada foi revertido.

## Modelos de inspeção personalizados
- 18 testes automatizados aprovados (4 novos para modelos e 14 de regressão): itens específicos por ambiente, nomes repetidos, aplicação repetida, preservação de avaliações e ordem, retomada de aplicação interrompida e permissões de consulta/editor.
- Chromium com API sintética: criação com dois ambientes e itens diferentes, edição salva, aplicação pela tela de modelos e pela inspeção, repetição sem duplicidades, duplicação e exclusão sem remover dados da inspeção. Sem erros JavaScript.
- Supabase real: inserção e leitura de um modelo com dois itens sob o usuário administrador, em transação revertida (ROLLBACK); nenhuma fixture persistida. Políticas existentes verificadas: somente administradores alteram settings; editores aplicam áreas e itens; consulta somente leitura. Nenhuma migração necessária.

## Correção do vínculo fotográfico em laudos personalizados
- Causa reproduzida: tópico Registro Fotográfico recriado como texto em subitem de um laudo versão 1, sem nenhum tópico com kind=photos. As fotos permaneciam vinculadas aos itens no banco, mas não eram compostas no documento.
- Normalização versão 2 recupera esse vínculo em documentos legados, mantendo IDs, textos, hierarquia, ordem e exclusões. Documentos já na versão 2 respeitam a escolha explícita de conteúdo automático. Vínculos existentes não são duplicados.
- Editor permite escolher o conteúdo automático do tópico e informa quantidade de fotos cadastradas e onde serão incluídas. Validação impede dois tópicos fotográficos ativos para evitar repetição.
- 20 testes automatizados aprovados. Chromium com API e imagens sintéticas reproduziu o caso legado: prévia e impressão com quatro fotos, texto preservado, seletor funcional e vínculo salvo. Word conferido com quatro imagens incorporadas; PDF conferido com quatro ocorrências de imagem.
- Nenhuma alteração direta em laudos, textos ou fotos de produção; recuperação aplicada ao abrir/gerar o documento e persistida pelo fluxo normal de salvamento.
