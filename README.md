# Gaivota Consultoria Contábil — versão Cloudflare Pages

Site independente publicado em **https://gaivota-regularizacao-obras.pages.dev/**.

## Implantação
- Repositório GitHub `Edilene-Gaivota/Gaivota-site`, branch `main`.
- Cloudflare Pages conectado ao GitHub; sem framework e sem comando de build.
- `index.html`, `style.css` e `script.js`: página inicial e interações.
- `blog/index.html`: blog independente com 19 manchetes históricas (até outubro/2026), busca e filtros; **não é feed de notícias em tempo real**.

## O que foi reproduzido
Layout responsivo em verde #2CB38D e roxo #4B345D, seção de serviços, formação, treinamentos, jornada do atendimento, perguntas frequentes, integração com WhatsApp empresarial e formulário que prepara mensagem no WhatsApp.

## Limites da migração
Este repositório é uma **reconstrução**, não um backup/exportação integral da aplicação ChatGPT original.
- Elementos gráficos foram aproximados. O logotipo e as fotografias originais não foram migrados fielmente.
- Notícias foram preservadas como títulos históricos; sem sincronização automática. Apenas links de fontes que puderam ser confirmados são apresentados.
- A área administrativa de avaliações e o editor interno do blog são privados e **não foram importados**.
- O formulário de avaliação **não armazena** dados em banco e encaminha informações somente quando a pessoa confirma o WhatsApp.
- Alguns efeitos visuais e movimentos podem diferir do site original.

## Manutenção
Edite arquivos na branch `main`. A Cloudflare Pages publica automaticamente as alterações após um deploy bem-sucedido. Confira o histórico de deploys no painel antes de compartilhar o site.

## Segurança
Evite inserir senhas, tokens ou dados de clientes nos arquivos. Para administrar artigos e avaliações com persistência, integre um CMS e armazenamento externos com autenticação e política de privacidade adequada.
