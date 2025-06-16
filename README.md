# 🍕 Pizzaria Del Gatito

Projeto acadêmico desenvolvido para estudo na faculdade, que consiste em um sistema web para pedidos online da Pizzaria Del Gatito.

## 🖥️ Acesse

👉 [https://pizzaria-del-gatito-faculdade.onrender.com](https://pizzaria-del-gatito-faculdade.onrender.com)

## ✅ Funcionalidades

- Cadastro e login de clientes  
- Fazer e acompanhar pedidos  
- Histórico individual de pedidos  
- Área administrativa para a pizzaria  

## 🖥️ Painel Administrativo

O painel admin está disponível em:  
👉 [https://pizzaria-del-gatito-faculdade.onrender.com/admin.html](https://pizzaria-del-gatito-faculdade.onrender.com/admin.html)

### Credenciais do administrador

- **Usuário:** master@pizzaria.com  
- **Senha:** master123  

### Controle de status dos pedidos

No painel administrativo, o admin pode alterar o status dos pedidos para os seguintes estados:

- Pendente  
- Preparando  
- Saiu para Entrega  
- Entregue  

## 🍕 Sabores disponíveis

1. Margherita — Molho de tomate, mussarela e manjericão  
2. Pepperoni — Molho de tomate, mussarela e pepperoni  
3. Calabresa — Molho de tomate, mussarela, calabresa e cebola  
4. Quatro Queijos — Mussarela, provolone, parmesão e gorgonzola  
5. Especial Del Gatito — Molho rústico, quatro queijos, mignon, cebola caramelizada, catupiry e rúcula  
6. Hawaiana — Molho de tomate, mussarela, presunto e abacaxi  

## ⚠️ Observações importantes

- Usuários normais podem pedir **apenas uma pizza de cada sabor** por pedido.  
- O administrador **não realiza pedidos**, apenas gerencia os existentes pelo painel.

## 🛠️ Tecnologias usadas

- Frontend: HTML, CSS, JavaScript  
- Backend: Python (Flask)  
- Banco de dados: PostgreSQL via Supabase  

## ▶️ Como rodar localmente

```bash
git clone <url-do-repositorio>
cd pizzaria-del-gatito
pip install -r requirements.txt
python app.py
