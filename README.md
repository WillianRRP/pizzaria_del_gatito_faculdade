# 🍕 Pizzaria Del Gatito - Sistema de Pedidos para Clientes

Sistema web moderno para clientes da Pizzaria Del Gatito fazerem seus pedidos online, localizada em Alvorada Piratini.

## 🐱 Características

- **Autenticação de Clientes**: Cadastro e login seguro
- **Pedidos Personalizados**: Cada cliente vê apenas seus próprios pedidos
- **Interface Moderna**: Design responsivo com Material Design
- **Privacidade**: Clientes não podem ver pedidos de outros
- **Histórico Individual**: Acompanhe seus pedidos entregues

## 🔐 Sistema de Autenticação

### Para Clientes
- **Cadastro**: Nome, email, telefone, endereço e senha
- **Login**: Email e senha
- **Sessão Segura**: Tokens JWT com validade de 7 dias
- **Dados Protegidos**: Cada cliente acessa apenas seus dados

### Funcionalidades do Cliente
- ✅ Ver apenas seus pedidos ativos
- ✅ Fazer novos pedidos
- ✅ Acompanhar status dos pedidos
- ✅ Ver histórico pessoal de pedidos
- ❌ **NÃO pode** ver pedidos de outros clientes

## 🚀 Tecnologias

### Frontend
- HTML5 semântico
- CSS3 com Flexbox/Grid
- JavaScript ES6+ com Fetch API
- Google Fonts (Poppins)
- Material Icons
- Sistema de notificações

### Backend
- Python 3.8+
- Flask (framework web)
- Flask-CORS (CORS support)
- PyJWT (autenticação JWT)
- Hash SHA-256 para senhas

## 📦 Instalação

### 1. Clonar o repositório
\`\`\`bash
git clone <url-do-repositorio>
cd pizzaria-del-gatito
\`\`\`

### 2. Instalar dependências Python
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 3. Executar o servidor
\`\`\`bash
python app.py
\`\`\`

### 4. Acessar a aplicação
Abra o navegador em: `http://localhost:5000`

## 🎯 Fluxo do Cliente

### 1. **Primeira Visita**
- Tela de cadastro/login
- Criar conta com dados pessoais
- Login automático após cadastro

### 2. **Área do Cliente**
- Dashboard personalizado
- Navegação: Meus Pedidos | Fazer Pedido | Meu Histórico
- Dados do cliente sempre visíveis

### 3. **Fazer Pedido**
- Seleção de pizzas com descrição
- Cálculo automático do total
- Dados do cliente pré-preenchidos
- Confirmação do pedido

### 4. **Acompanhar Pedidos**
- Status em tempo real
- Apenas pedidos do cliente logado
- Histórico preservado

## 🍕 Cardápio

| Pizza | Descrição | Preço |
|-------|-----------|-------|
| Margherita | Molho de tomate, mussarela e manjericão | R$ 25,00 |
| Pepperoni | Molho de tomate, mussarela e pepperoni | R$ 30,00 |
| Calabresa | Molho de tomate, mussarela, calabresa e cebola | R$ 28,00 |
| Quatro Queijos | Mussarela, provolone, parmesão e gorgonzola | R$ 32,00 |

## 🔒 Segurança

### Autenticação
- **Senhas**: Hash SHA-256
- **Tokens**: JWT com expiração
- **Sessões**: Armazenamento local seguro
- **Validação**: Verificação em todas as rotas

### Privacidade
- **Isolamento**: Cada cliente vê apenas seus dados
- **Autorização**: Middleware de verificação
- **Logs**: Sem exposição de dados sensíveis

## 📱 Interface Responsiva

### Tela de Login/Cadastro
- **Design**: Centralizado com logo da pizzaria
- **Formulários**: Validação em tempo real
- **Transições**: Suaves entre login e cadastro

### Dashboard do Cliente
- **Header**: Logo, nome do cliente e logout
- **Navegação**: Tabs responsivas
- **Cards**: Pedidos organizados visualmente

### Fazer Pedido
- **Dados**: Informações do cliente fixas
- **Seleção**: Checkboxes com descrições
- **Resumo**: Cálculo dinâmico do total

## 🔧 API Endpoints

### Autenticação
- `POST /api/register` - Cadastrar cliente
- `POST /api/login` - Fazer login
- `POST /api/verify-token` - Verificar token válido

### Pedidos do Cliente
- `POST /api/orders` - Criar novo pedido
- `GET /api/my-orders` - Listar meus pedidos ativos
- `GET /api/my-history` - Listar meu histórico

### Administrativas (para a pizzaria)
- `GET /api/admin/orders` - Listar todos os pedidos
- `PUT /api/admin/orders/<id>` - Atualizar status do pedido
- `GET /api/stats` - Estatísticas do sistema

### Utilitários
- `GET /api/pizzas` - Listar pizzas disponíveis

## 🎨 Design System

### Cores Principais
- **Laranja**: #ff6b35 (primária)
- **Laranja Claro**: #f7931e (secundária)
- **Branco**: #ffffff (fundo)
- **Cinza**: #666666 (texto)

### Estados de Pedido
- **Pendente**: Amarelo (#fff3cd)
- **Preparando**: Azul claro (#d1ecf1)
- **Saiu p/ Entrega**: Verde claro (#d4edda)
- **Entregue**: Vermelho claro (#f8d7da)

### Tipografia
- **Fonte**: Poppins (Google Fonts)
- **Pesos**: 300, 400, 500, 600, 700

## 🔧 Desenvolvimento

### Estrutura de Arquivos
\`\`\`
pizzaria-del-gatito/
├── index.html          # Interface principal
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
├── app.py             # Servidor Flask
├── requirements.txt    # Dependências Python
└── README.md          # Documentação
\`\`\`

### Fluxo de Dados
1. **Cliente se cadastra** → Dados salvos no servidor
2. **Cliente faz login** → Recebe token JWT
3. **Cliente faz pedido** → Associado ao seu ID
4. **Cliente consulta pedidos** → Filtrados por usuário
5. **Pizzaria atualiza status** → Cliente vê em tempo real

### Próximas Funcionalidades
- [ ] Notificações push para status
- [ ] Integração com WhatsApp
- [ ] Pagamentos online (PIX/Cartão)
- [ ] Avaliação de pedidos
- [ ] Programa de fidelidade
- [ ] App mobile nativo

## 🧪 Teste do Sistema

### Cadastro de Teste
1. Acesse `http://localhost:5000`
2. Clique em "Cadastre-se aqui"
3. Preencha os dados:
   - Nome: João Silva
   - Email: joao@email.com
   - Telefone: (51) 99999-9999
   - Endereço: Rua das Flores, 123
   - Senha: 123456
4. Faça login com as credenciais

### Teste de Pedido
1. Navegue para "Fazer Pedido"
2. Selecione algumas pizzas
3. Veja o total sendo calculado
4. Confirme o pedido
5. Verifique em "Meus Pedidos"

## 📞 Suporte

**Pizzaria Del Gatito**  
📍 Alvorada Piratini  
🐱 Sistema desenvolvido para nossos queridos clientes!

### Funcionalidades Exclusivas
- ✅ **Privacidade Total**: Seus dados são só seus
- ✅ **Interface Intuitiva**: Fácil de usar
- ✅ **Acompanhamento**: Status em tempo real
- ✅ **Histórico**: Todos seus pedidos salvos
- ✅ **Segurança**: Autenticação robusta

---

*Feito com ❤️ e muito queijo para você!* 🍕🐱
