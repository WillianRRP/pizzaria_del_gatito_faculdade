from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_cors import CORS
from datetime import datetime, timedelta, timezone # Importa timezone para melhor manejo de datas UTC
import json
import hashlib
from flask_sqlalchemy import SQLAlchemy
import jwt
import os
from dotenv import load_dotenv
from sqlalchemy import text, func # Importar 'text' para primaryjoin e 'func' para funções de DB como now()
from flask_migrate import Migrate # IMPORTANTE: Adicionado para gerenciar migrações de banco de dados

# Carrega variáveis de ambiente do arquivo .env
# IMPORTANTE: No Vercel/Render, as variáveis de ambiente (como DATABASE_URL e SECRET_KEY)
# devem ser configuradas diretamente no dashboard da plataforma.
# load_dotenv() só funciona para o ambiente de desenvolvimento local.
load_dotenv()

# --- Configuração do Aplicativo Flask ---
# Inicializa o aplicativo Flask
app = Flask(__name__)

# Configurações de CORS para permitir requisições de diferentes origens
# Permite todas as origens para '/api/*', o que é útil em desenvolvimento.
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuração do banco de dados PostgreSQL usando Flask-SQLAlchemy
# Pega a URL do banco de dados da variável de ambiente 'DATABASE_URL'
# Certifique-se de que 'DATABASE_URL' está configurada no dashboard do Vercel/Render.
# Ex: DATABASE_URL="postgresql://user:password@host:port/database_name"
database_url = os.getenv('DATABASE_URL')
if not database_url:
    # Se esta mensagem de erro ainda aparecer no Vercel/Render, significa que
    # a variável DATABASE_URL não está sendo lida corretamente lá.
    # Verifique o painel da plataforma -> Seu Projeto -> Settings -> Environment Variables.
    raise ValueError("Variável de ambiente 'DATABASE_URL' não configurada. Por favor, defina-a na plataforma de deploy.")
app.config['SQLALCHEMY_DATABASE_URI'] = database_url

# Desativa o rastreamento de modificações para economizar memória (recomendado)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa a extensão SQLAlchemy
db = SQLAlchemy(app)

# Inicializa o Flask-Migrate, linkando com o app e o banco de dados
migrate = Migrate(app, db)

# Configuração da chave secreta para JWT
# Pega a chave da variável de ambiente 'SECRET_KEY'
# Certifique-se de que 'SECRET_KEY' está configurada como uma variável de ambiente na plataforma de deploy.
secret_key = os.getenv('SECRET_KEY', 'chave_secreta_fallback_muito_segura_para_jwt')
if secret_key == 'chave_secreta_fallback_muito_segura_para_jwt':
    print("AVISO: Usando chave secreta de fallback! Configure 'SECRET_KEY' como variável de ambiente na plataforma para produção.")
app.config['SECRET_KEY'] = secret_key

# --- Definição dos Modelos do Banco de Dados ---

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    password_hash = db.Column(db.String(200), nullable=False) # Armazena o hash da senha
    role = db.Column(db.String(20), default='customer', nullable=False) # 'customer' ou 'admin'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relacionamento com Order
    orders = db.relationship('Order', backref='user', lazy=True, cascade="all, delete-orphan")
    history_orders = db.relationship( # Relacionamento para OrderHistory
        'OrderHistory',
        backref=db.backref('user_ref', lazy=True),
        primaryjoin=lambda: User.id == OrderHistory.user_id,
        viewonly=True
    )

    def __repr__(self):
        return f'<User {self.email}>'

    def set_password(self, password):
        """Gera o hash da senha e armazena."""
        self.password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

    def check_password(self, password):
        """Verifica se a senha fornecida corresponde ao hash armazenado."""
        return self.password_hash == hashlib.sha256(password.encode('utf-8')).hexdigest()

    def to_dict(self, include_password_hash=False):
        data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'role': self.role,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }
        if include_password_hash:
            data['password_hash'] = self.password_hash
        return data

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    customer_name = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(50))
    customer_address = db.Column(db.Text)
    items = db.Column(db.JSON) # Armazena a lista de itens da pizza como JSON (PostgreSQL lida com JSONB)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(50), default='pendente', nullable=False) # 'pendente', 'preparando', 'saiu-entrega', 'entregue'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Order {self.id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'customerName': self.customer_name,
            'customerPhone': self.customer_phone,
            'customerAddress': self.customer_address,
            'items': self.items,
            'total': float(self.total),
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

class OrderHistory(db.Model):
    __tablename__ = 'order_history'
    id = db.Column(db.Integer, primary_key=True)
    original_order_id = db.Column(db.Integer, nullable=False, unique=True) # ID do pedido original
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True) # Permite NULL se user for deletado

    customer_name = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(50))
    customer_address = db.Column(db.Text)
    items = db.Column(db.JSON) # Armazena a lista de itens da pizza como JSON (PostgreSQL lida com JSONB)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False) # Deve ser 'entregue' para esta tabela
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Data de criação do pedido original
    completed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Data em que o pedido foi concluído e movido para o histórico

    def __repr__(self):
        return f'<OrderHistory {self.id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'originalOrderId': self.original_order_id,
            'userId': self.user_id,
            'customerName': self.customer_name,
            'customerPhone': self.customer_phone,
            'customerAddress': self.customer_address,
            'items': self.items,
            'total': float(self.total),
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'completedAt': self.completed_at.isoformat() if self.completed_at else None
        }

# --- Funções de Utilitário ---

def hash_password(password: str) -> str:
    """Gera um hash SHA256 para a senha fornecida."""
    return hashlib.sha256(password.encode()).hexdigest()

MASTER_USER = {
    'id': None,
    'name': 'Administrador',
    'email': 'master@pizzaria.com',
    'phone': '(51) 99999-0000',
    'address': 'Pizzaria Del Gatito',
    'password_hash': hash_password('master123'),
    'role': 'master',
    'createdAt': datetime.now(timezone.utc)
}

def is_master_user(user: dict | User) -> bool:
    """Verifica se o usuário fornecido é o usuário master."""
    if isinstance(user, User):
        return user.role == 'master'
    elif isinstance(user, dict):
        return user.get('role') == 'master'
    return False

# --- Funções JWT (JSON Web Token) ---
def generate_token(user_id: int) -> str:
    """Gera um token JWT para o user_id fornecido."""
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7) # Token expira em 7 dias
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token: str) -> int | None:
    """Verifica um token JWT e retorna o user_id se válido, None caso contrário."""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def get_current_user(request_obj) -> dict | None:
    """
    Obtém o usuário atual a partir do token de autenticação no cabeçalho da requisição.
    Retorna um dicionário com os dados do usuário (sem hash de senha).
    """
    auth_header = request_obj.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    if user_id is not None:
        # AQUI: Se for o master user, ele ainda pode não ter um ID no DB
        # mas o acesso é permitido se o token for gerado para ele (ex: em dev local)
        # Para produção, o master user DEVE ser criado via flask db upgrade/shell
        if MASTER_USER['id'] is not None and user_id == MASTER_USER['id']:
            master_user_data = MASTER_USER.copy()
            master_user_data['createdAt'] = master_user_data['createdAt'].isoformat()
            master_user_data.pop('password_hash', None)
            return master_user_data

        user = User.query.get(user_id)
        if user:
            return user.to_dict(include_password_hash=False)
    return None

# --- Dados das pizzas (permanecem em memória, pois são fixos e não requerem DB) ---
PIZZA_PRICES = {
    'margherita': 25.00,
    'pepperoni': 30.00,
    'calabresa': 28.00,
    'quatro-queijos': 32.00
}

PIZZA_NAMES = {
    'margherita': 'Margherita',
    'pepperoni': 'Pepperoni',
    'calabresa': 'Calabresa',
    'quatro-queijos': 'Quatro Queijos'
}

# --- Inicialização do Banco de Dados e Usuário Master ---
def initialize_database():
    """
    Garante que o usuário master padrão esteja presente no DB.
    As tabelas são criadas/atualizadas via migrações do Flask-Migrate (flask db upgrade), não mais por db.create_all().
    """
    with app.app_context():
        try:
            print("[INFO] Verificando e criando usuário master...")
            
            master_user_in_db = User.query.filter_by(email=MASTER_USER['email']).first()
            
            if not master_user_in_db:
                print("[INFO] Usuário master não encontrado. Criando...")
                new_master = User(
                    name=MASTER_USER['name'],
                    email=MASTER_USER['email'],
                    phone=MASTER_USER['phone'],
                    address=MASTER_USER['address'],
                    password_hash=MASTER_USER['password_hash'],
                    role='master',
                    created_at=MASTER_USER['createdAt']
                )
                db.session.add(new_master)
                db.session.commit()
                MASTER_USER['id'] = new_master.id
                print(f"[INFO] Usuário master criado com sucesso! ID: {MASTER_USER['id']}")
            else:
                MASTER_USER['id'] = master_user_in_db.id
                print(f"[INFO] Usuário master já existe. ID: {MASTER_USER['id']}")
        except Exception as e:
            db.session.rollback()
            print(f"[ERRO] Erro ao inicializar o banco de dados (usuário master): {e}")
            raise

# --- ROTAS DA API ---

@app.route('/api/test', methods=['GET'])
def api_test():
    """Rota de teste para verificar a conectividade da API e do DB."""
    print("[DEBUG] Rota /api/test chamada")
    with app.app_context():
        try:
            total_users = User.query.count()
            total_active_orders = Order.query.count()
            total_history_orders = OrderHistory.query.count()

            return jsonify({
                'success': True,
                'message': 'API funcionando e conectada ao banco de dados!',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'users': total_users,
                'orders': total_active_orders,
                'history_orders': total_history_orders
            })
        except Exception as e:
            print(f"[ERROR] Erro ao acessar o DB na rota /api/test: {e}")
            return jsonify({'success': False, 'error': f'Erro ao conectar ao banco de dados: {e}'}), 500

@app.route('/api/register', methods=['POST'])
def api_register():
    """Rota para registrar um novo usuário."""
    print("[DEBUG] Rota /api/register chamada")
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Nenhum dado recebido'}), 400

        required_fields = ['name', 'email', 'phone', 'address', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'Campo {field} é obrigatório'}), 400

        email = data['email'].lower().strip()
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'success': False, 'error': 'Email já cadastrado'}), 400

        new_user = User(
            name=data['name'].strip(),
            email=email,
            phone=data['phone'].strip(),
            address=data['address'].strip(),
            created_at=datetime.now(timezone.utc)
        )
        new_user.set_password(data['password'])
        db.session.add(new_user)
        db.session.commit()
        print(f"[DEBUG] Usuário criado e salvo no DB: {new_user.email} com ID: {new_user.id}")
        return jsonify({
            'success': True,
            'message': 'Usuário cadastrado com sucesso',
            'user_id': new_user.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Erro no cadastro de usuário: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    """Rota para autenticação de usuário e emissão de token JWT."""
    print("[DEBUG] Rota /api/login chamada")

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Nenhum dado recebido'}), 400

        email = data.get('email', '').lower().strip()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email e senha obrigatórios'}), 400

        print(f"[DEBUG] Tentativa de login para: {email}")

        # Verifica se é o usuário master primeiro
        if email == MASTER_USER['email']:
            # No ambiente de deploy (Render), o usuário master deve existir no DB.
            # Se não existir, pode ter havido um problema na migração inicial.
            if MASTER_USER['id'] is None:
                master_user_in_db = User.query.filter_by(email=MASTER_USER['email']).first()
                if master_user_in_db:
                    MASTER_USER['id'] = master_user_in_db.id
                else:
                    # Este caso deve ser raro se 'flask db upgrade' foi rodado no Render Shell
                    print("[AVISO] O usuário master não existe no DB. Por favor, execute 'flask db upgrade' no shell do Render uma única vez.")
                    return jsonify({'success': False, 'error': 'Erro na inicialização do usuário master. Tente novamente após aplicar as migrações.'}), 500
            
            if hash_password(password) == MASTER_USER['password_hash']:
                token = generate_token(MASTER_USER['id'])
                user_data = {k: v for k, v in MASTER_USER.items() if k not in ['password_hash']}
                user_data['createdAt'] = user_data['createdAt'].isoformat()
                print(f"[DEBUG] Login master realizado: {email}")
                return jsonify({
                    'success': True,
                    'token': token,
                    'user': user_data
                })

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            print(f"[DEBUG] Email ou senha incorretos para: {email}")
            return jsonify({'success': False, 'error': 'Email ou senha incorretos'}), 401

        token = generate_token(user.id)
        user_data = user.to_dict(include_password_hash=False)

        print(f"[DEBUG] Login realizado com sucesso: {email}")
        return jsonify({
            'success': True,
            'token': token,
            'user': user_data
        })

    except Exception as e:
        print(f"[ERROR] Erro no login: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/verify-token', methods=['POST'])
def api_verify_token():
    """Rota para verificar a validade de um token JWT."""
    print("[DEBUG] Rota /api/verify-token chamada")

    try:
        user = get_current_user(request)
        if user:
            return jsonify({'success': True, 'user': user})
        else:
            return jsonify({'success': False, 'error': 'Token inválido ou expirado'}), 401

    except Exception as e:
        print(f"[ERROR] Erro na verificação de token: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/orders', methods=['POST'])
def api_create_order():
    """Rota para criar um novo pedido de pizza."""
    print("[DEBUG] Rota /api/orders (POST) chamada")

    try:
        user_data = get_current_user(request)
        if not user_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401
        
        user = User.query.get(user_data['id'])
        if not user:
            return jsonify({'success': False, 'error': 'Usuário não encontrado no banco de dados'}), 500

        data = request.get_json()

        if not data or not data.get('items'):
            return jsonify({'success': False, 'error': 'Selecione pelo menos uma pizza'}), 400

        total = 0.0
        order_items = []
        for item_name_raw in data['items']:
            item_name = item_name_raw.strip()
            found_price = False
            for key, name in PIZZA_NAMES.items():
                if name == item_name and key in PIZZA_PRICES:
                    total += PIZZA_PRICES[key]
                    order_items.append({"name": name, "price": PIZZA_PRICES[key]})
                    found_price = True
                    break
            if not found_price:
                return jsonify({'success': False, 'error': f'Item de pizza inválido: {item_name}'}), 400

        if total == 0:
            return jsonify({'success': False, 'error': 'Nenhuma pizza válida selecionada'}), 400

        new_order = Order(
            user_id=user.id,
            customer_name=user.name,
            customer_phone=user.phone,
            customer_address=user.address,
            items=order_items,
            total=total,
            status='pendente',
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

        db.session.add(new_order)
        db.session.commit()
        print(f"[DEBUG] Pedido criado e salvo no DB: ID {new_order.id} para usuário {user.email}")
        return jsonify({'success': True, 'order': new_order.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Erro ao criar pedido: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/my-orders', methods=['GET'])
def api_my_orders():
    """Rota para o usuário visualizar seus pedidos ativos."""
    print("[DEBUG] Rota /api/my-orders (GET) chamada")

    try:
        user_data = get_current_user(request)
        if not user_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        user_orders_db = Order.query.filter_by(user_id=user_data['id']).order_by(Order.created_at.desc()).all()
        user_orders_json = [order.to_dict() for order in user_orders_db]

        return jsonify({'success': True, 'orders': user_orders_json})

    except Exception as e:
        print(f"[ERROR] Erro ao buscar pedidos do usuário: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/my-history', methods=['GET'])
def api_my_history():
    """Rota para o usuário visualizar seu histórico de pedidos concluídos."""
    print("[DEBUG] Rota /api/my-history (GET) chamada")

    try:
        user_data = get_current_user(request)
        if not user_data:
            return jsonify({'success': False, 'error': 'Não autenticado'}), 401

        user_history_db = OrderHistory.query.filter_by(user_id=user_data['id']).order_by(OrderHistory.completed_at.desc()).all()
        user_history_json = [order.to_dict() for order in user_history_db]

        return jsonify({'success': True, 'orders': user_history_json})

    except Exception as e:
        print(f"[ERROR] Erro ao buscar histórico do usuário: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pizzas', methods=['GET'])
def api_pizzas():
    """Rota para retornar a lista de pizzas e seus preços."""
    print("[DEBUG] Rota /api/pizzas (GET) chamada")

    try:
        pizzas = []
        for key, name in PIZZA_NAMES.items():
            pizzas.append({
                'id': key,
                'name': name,
                'price': PIZZA_PRICES[key]
            })

        return jsonify({'success': True, 'pizzas': pizzas})

    except Exception as e:
        print(f"[ERROR] Erro ao buscar pizzas: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# --- ROTAS ADMINISTRATIVAS ---

@app.route('/api/admin/orders', methods=['GET'])
def api_admin_orders():
    """Rota para o administrador visualizar todos os pedidos ativos."""
    print("[DEBUG] Rota /api/admin/orders (GET) chamada")

    try:
        user = get_current_user(request)
        if not user or not is_master_user(user):
            return jsonify({'success': False, 'error': 'Acesso negado. Apenas para administradores.'}), 403

        all_orders_db = Order.query.order_by(Order.created_at.desc()).all()
        all_orders_json = [order.to_dict() for order in all_orders_db]

        return jsonify({'success': True, 'orders': all_orders_json})

    except Exception as e:
        print(f"[ERROR] Erro ao buscar pedidos para admin: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/orders/<int:order_id>', methods=['PUT'])
def api_update_order_status(order_id: int):
    """
    Rota para o administrador atualizar o status de um pedido.
    Se o status for 'entregue', o pedido é movido para o histórico.
    """
    print(f"[DEBUG] Rota /api/admin/orders/{order_id} (PUT) chamada")

    try:
        user = get_current_user(request)
        if not user or not is_master_user(user):
            return jsonify({'success': False, 'error': 'Acesso negado. Apenas para administradores.'}), 403

        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'success': False, 'error': 'Status é obrigatório no corpo da requisição'}), 400

        new_status = data['status'].strip()
        valid_statuses = ['pendente', 'preparando', 'saiu-entrega', 'entregue']
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'error': f'Status inválido. Status permitidos: {", ".join(valid_statuses)}'}), 400

        order_to_update = Order.query.get(order_id)
        if not order_to_update:
            return jsonify({'success': False, 'error': f'Pedido com ID {order_id} não encontrado'}), 404

        old_status = order_to_update.status
        order_to_update.status = new_status
        order_to_update.updated_at = datetime.now(timezone.utc)

        if new_status == 'entregue':
            print(f"[DEBUG] Movendo pedido {order_id} para o histórico...")
            history_entry = OrderHistory(
                original_order_id=order_to_update.id,
                user_id=order_to_update.user_id,
                customer_name=order_to_update.customer_name,
                customer_phone=order_to_update.customer_phone,
                customer_address=order_to_update.customer_address,
                items=order_to_update.items,
                total=order_to_update.total,
                status=new_status,
                created_at=order_to_update.created_at,
                completed_at=datetime.now(timezone.utc)
            )
            db.session.add(history_entry)
            db.session.delete(order_to_update)
            db.session.commit()
            print(f"[DEBUG] Pedido {order_id} movido para histórico com sucesso.")
            updated_order_data = history_entry.to_dict()
        else:
            db.session.commit()
            print(f"[DEBUG] Pedido {order_id} atualizado no DB: {old_status} → {new_status}")
            updated_order_data = order_to_update.to_dict()

        return jsonify({
            'success': True,
            'message': f'Status do pedido {order_id} atualizado para "{new_status}"',
            'order': updated_order_data
        })

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Erro ao atualizar pedido {order_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
def api_admin_stats():
    """Rota para o administrador visualizar estatísticas gerais da pizzaria."""
    print("[DEBUG] Rota /api/admin/stats (GET) chamada")

    try:
        user = get_current_user(request)
        if not user or not is_master_user(user):
            return jsonify({'success': False, 'error': 'Acesso negado. Apenas para administradores.'}), 403

        total_users = User.query.count()
        total_active_orders = Order.query.count()
        total_completed_orders = OrderHistory.query.count()

        status_counts = db.session.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        status_breakdown = {status: count for status, count in status_counts}

        total_revenue_result = db.session.query(func.sum(OrderHistory.total)).scalar()
        total_revenue = float(total_revenue_result) if total_revenue_result is not None else 0.0

        pending_revenue_result = db.session.query(func.sum(Order.total)).scalar()
        pending_revenue = float(pending_revenue_result) if pending_revenue_result is not None else 0.0

        return jsonify({
            'success': True,
            'stats': {
                'users': total_users,
                'active_orders': total_active_orders,
                'completed_orders': total_completed_orders,
                'status_breakdown': status_breakdown,
                'total_revenue': total_revenue,
                'pending_revenue': pending_revenue
            }
        })

    except Exception as e:
        print(f"[ERROR] Erro ao buscar estatísticas: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# --- ROTAS DE SERVIÇO DE ARQUIVOS ESTÁTICOS ---

@app.route('/admin.html')
def admin_page():
    """Serve a página HTML do painel administrativo."""
    print("[DEBUG] Servindo admin.html")
    try:
        return render_template('admin.html')
    except Exception:
        return "admin.html não encontrado no diretório 'templates'", 404

@app.route('/admin')
def admin_redirect():
    """Redireciona de /admin para /admin.html."""
    print("[DEBUG] Redirecionando /admin para /admin.html")
    return redirect(url_for('admin_page'))
@app.route('/api/admin/history', methods=['GET'])
def api_admin_history():
    """Rota para o administrador visualizar o histórico completo de pedidos."""
    print("[DEBUG] Rota /api/admin/history (GET) chamada")

    try:
        user = get_current_user(request)
        if not user or not is_master_user(user):
            return jsonify({'success': False, 'error': 'Acesso negado. Apenas para administradores.'}), 403

        all_history_db = OrderHistory.query.order_by(OrderHistory.completed_at.desc()).all()
        all_history_json = [order.to_dict() for order in all_history_db]

        return jsonify({'success': True, 'orders': all_history_json})

    except Exception as e:
        print(f"[ERROR] Erro ao buscar histórico para admin: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/')
def index():
    """Serve a página HTML principal da aplicação."""
    print("[DEBUG] Servindo index.html")
    try:
        return render_template('index.html')
    except Exception:
        return "index.html não encontrado no diretório 'templates'", 404

@app.route('/debug.html')
def debug_page():
    """Serve a página HTML de debug."""
    print("[DEBUG] Servindo debug.html")
    try:
        return render_template('debug.html')
    except Exception:
        return "debug.html não encontrado no diretório 'templates'", 404

@app.route('/test.html')
def test_page():
    """Serve a página HTML de teste."""
    print("[DEBUG] Servindo test.html")
    try:
        return render_template('test.html')
    except Exception:
        return "test.html não encontrado no diretório 'templates'", 404

@app.route('/test-simple.html')
def test_simple():
    """Serve uma página HTML de teste simplificada."""
    print("[DEBUG] Servindo test-simple.html")
    try:
        return render_template('test-simple.html')
    except Exception:
        return "test-simple.html não encontrado no diretório 'templates'", 404

# --- TRATAMENTO DE ERROS GLOBAIS ---

@app.errorhandler(404)
def not_found(error):
    """Manipulador de erro para rotas não encontradas (404 Not Found)."""
    print(f"[ERROR] Rota não encontrada: {request.path}")
    return jsonify({'success': False, 'error': 'Rota não encontrada. Verifique o URL. :('}), 404

@app.errorhandler(500)
def internal_error(error):
    """Manipulador de erro para erros internos do servidor (500 Internal Server Error)."""
    db.session.rollback() # Garante que transações pendentes sejam desfeitas em caso de erro 500
    print(f"[ERROR] Erro interno do servidor: {error}")
    return jsonify({'success': False, 'error': 'Erro interno do servidor. Tente novamente mais tarde.'}), 500

# --- Bloco de Inicialização e Execução do Aplicativo (Apenas para desenvolvimento local) ---
# ESTE É O ÚNICO BLOCO if __name__ == '__main__': QUE DEVE EXISTIR NO ARQUIVO.
if __name__ == '__main__':
    # A função initialize_database() deve ser chamada apenas para configuração inicial do DB e usuário master.
    # Para o deploy em ambientes de produção (Vercel, Render), o ideal é que as migrações (flask db upgrade)
    # e a criação do usuário master sejam feitas manualmente (ou via script de build/shell) UMA ÚNICA VEZ.
    # Chamar initialize_database() aqui pode causar problemas em ambientes de produção durante o cold start.
    with app.app_context(): # Garante que o contexto da aplicação esteja ativo para operações de DB
        initialize_database() # <-- MANTENHA ESTA LINHA COMENTADA PARA O DEPLOY EM PRODUÇÃO (Render/Vercel).
                               # Descomente-a APENAS para executar localmente e garantir a criação inicial do master user.

    base_dir = os.path.dirname(os.path.abspath(__file__))

    print("\n📁 Verificando arquivos de template e estáticos:")
    files_to_check = [
        os.path.join(base_dir, 'templates', 'index.html'),
        os.path.join(base_dir, 'templates', 'debug.html'),
        os.path.join(base_dir, 'templates', 'admin.html'),
        os.path.join(base_dir, 'static', 'css', 'styles.css'),
        os.path.join(base_dir, 'static', 'js', 'script.js')
    ]
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"    ✅ {file_path}")
        else:
            print(f"    ❌ {file_path} - NÃO ENCONTRADO (Verifique se estão em 'templates' ou em 'static/css' / 'static/js')")
    
    print("\n🐱 Servidor Flask rodando localmente! Acesse http://127.0.0.1:5000")
    # A linha abaixo é APENAS para execução local e deve ser ignorada pela Gunicorn/servidores de produção.
    app.run(debug=True, host='0.0.0.0', port=5000)