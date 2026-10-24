# INSPEC360 — versão web estática (GitHub + Netlify)

Aplicação em HTML, CSS e JavaScript para uso individual e testes de inspeção predial. **Não requer banco de dados remoto**. Dados, fotos, logomarca, configurações e contas locais são guardados no IndexedDB do navegador.

## Publicar pelo GitHub e Netlify

1. Crie um repositório no GitHub, por exemplo `inspec360`.
2. Faça upload **do conteúdo desta pasta na raiz do repositório**: `index.html`, `netlify.toml`, `README.md` e `.gitignore`.
3. Acesse o Netlify e selecione **Add new project → Import an existing project → GitHub**.
4. Autorize a conexão, selecione o repositório e confira: **Build command**: `echo 'Inspec360: site estatico pronto'`; **Publish directory**: `.` (ponto).
5. Clique em **Deploy**. Acesse a URL HTTPS `https://SEU-SITE.netlify.app` fornecida pelo Netlify.
6. No primeiro acesso, crie o administrador local. Acesse **Configurações** para carregar a logomarca e **Gestão de acessos** para criar perfis locais.

### Alternativa mais rápida

No Netlify, use **Deploy manually / drag and drop** com a pasta extraída (contendo `index.html` na raiz), sem GitHub. Para atualizações automáticas, prefira o GitHub.

## Funcionalidades incluídas

- Condomínios, inspeções, ambientes, itens, constatações e fotografias.
- Dashboard e acompanhamento de execução.
- Login e perfis **locais** (administrador, editor e consulta).
- Logomarca personalizável na capa e no Word.
- Laudo editável em DOCX; PDF pela opção *Imprimir → Salvar como PDF*.
- Backup e restauração JSON locais, incluindo fotografias e usuários.

## ATENÇÃO: dados e segurança

**O endereço HTTPS não transforma este sistema em uma aplicação multiusuário segura.** O login é implementado no próprio navegador; usuários não são sincronizados e permissões podem ser contornadas por alguém com controle do dispositivo/DevTools. Não insira dados pessoais, fotos privadas ou documentos sensíveis nesta edição pública como se estivessem protegidos por login.

- Cada navegador e dispositivo tem **um armazenamento separado**. Registrar no computador A não disponibiliza no celular B.
- O administrador criado no computador A não pode ser usado automaticamente no celular B; cada navegador novo configura seus próprios usuários locais.
- Atualizações do código pela mesma URL **normalmente** mantêm o IndexedDB; alteração de domínio, janela anônima, limpeza de armazenamento, política do navegador ou falta de espaço podem apagá-lo ou torná-lo inacessível.
- Faça backups JSON completos frequentemente, e mantenha-os em local seguro. Contêm **fotos, dados e hashes de senha**.
- A restauração substitui os dados locais do navegador atual. Não importa inspeções de outros dispositivos automaticamente.
- Não tente armazenar senhas, tokens de serviços, segredos ou chaves administrativas no HTML/JavaScript público.
- Para login e controle de acesso reais em múltiplos dispositivos, será necessário backend de autenticação e autorização e armazenamento remoto, por exemplo Supabase com políticas RLS.

## Utilização local

O site publicado no Netlify funciona sem instalar nada. Para desenvolvimento local, abra esta pasta por um servidor HTTP, por exemplo:

```bash
python -m http.server 8765
```

Acesse `http://localhost:8765`.

## Limites

Esta é a edição inicial destinada a uso local individual/testes, ainda sem validação funcional completa em diferentes navegadores. Teste inclusão de fotos, laudos, backup/restauração e tamanho das exportações antes de utilizá-la profissionalmente. Verifique e valide tecnicamente os laudos antes da emissão.
