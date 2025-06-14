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
# IMPORTANTE: No Vercel, as variáveis de ambiente (como DATABASE_URL e SECRET_KEY)
# devem ser configuradas diretamente no dashboard do Vercel.
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
# Certifique-se de que 'DATABASE_URL' está configurada no dashboard do Vercel.
# Ex: DATABASE_URL="postgresql://user:password@host:port/database_name"
database_url = os.getenv('DATABASE_URL')
if not database_url:
    # Se esta mensagem de erro ainda aparecer no Vercel, significa que
    # a variável DATABASE_URL não está sendo lida corretamente lá.
    # Verifique o painel do Vercel -> Seu Projeto -> Settings -> Environment Variables.
    raise ValueError("Variável de ambiente 'DATABASE_URL' não configurada. Por favor, defina-a no Vercel.")
app.config['SQLALCHEMY_DATABASE_URI'] = database_url

# Desativa o rastreamento de modificações para economizar memória (recomendado)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa a extensão SQLAlchemy
db = SQLAlchemy(app)

# Inicializa o Flask-Migrate, linkando com o app e o banco de dados
migrate = Migrate(app, db)

# Configuração da chave secreta para JWT
# Pega a chave da variável de ambiente 'SECRET_KEY'
# Certifique-se de que 'SECRET_KEY' (ou 'pizza_del_gatito_secret_key' se estiver mapeado no vercel.json)
# está configurada como uma variável de ambiente no dashboard do Vercel.
secret_key = os.getenv('SECRET_KEY', 'chave_secreta_fallback_muito_segura_para_jwt')
if secret_key == 'chave_secreta_fallback_muito_segura_para_jwt':
    print("AVISO: Usando chave secreta de fallback! Configure 'SECRET_KEY' (ou o nome mapeado no vercel.json) como variável de ambiente no Vercel para produção.")
app.config['SECRET_KEY'] = secret_key

# --- Definição dos Modelos do Banco de Dados ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    password_hash = db.Column(db.String(200), nullable=False) # Armazena o hash da senha
    role = db.Column(db.String(20), default='customer', nullable=False) # 'customer' ou 'admin'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relacionamento com Order
    orders = db.relationship('Order', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.email}>'

    def set_password(self, password):
        """Gera o hash da senha e armazena."""
        self.password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

    def check_password(self, password):
        """Verifica se a senha fornecida corresponde ao hash armazenado."""
        return self.password_hash == hashlib.sha256(password.encode('utf-8')).hexdigest()

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.Column(db.Text, nullable=False) # Armazena itens como JSON string
    total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='pending', nullable=False) # 'pending', 'preparing', 'delivered', 'cancelled'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relacionamento com OrderHistory
    history = db.relationship('OrderHistory', backref='order', lazy=True)

    def __repr__(self):
        return f'<Order {self.id}>'

class OrderHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    status_change = db.Column(db.String(50), nullable=False) # Novo status
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<OrderHistory {self.id}>'

# --- Funções Auxiliares ---

# Dados do usuário mestre (admin)
MASTER_USER = {
    'name': 'Admin Master',
    'email': 'admin@pizzaria.com',
    'phone': '(51) 99999-0000',
    'address': 'Rua Principal, 0',
    'password': 'admin', # Senha padrão para o admin
    'role': 'admin'
}

def initialize_database():
    """
    Função para inicializar o banco de dados e criar um usuário master se não existir.
    NOTA: Para ambientes de produção (Vercel), o ideal é gerenciar a criação
    do esquema e dados iniciais via Flask-Migrate (flask db upgrade) e/ou scripts de seed
    executados separadamente, não no tempo de execução do aplicativo.
    """
    with app.app_context():
        # db.create_all() # Removido, pois estamos usando Flask-Migrate (flask db upgrade)

        # Verifica se o usuário master já existe
        master_exists = User.query.filter_by(email=MASTER_USER['email']).first()
        if not master_exists:
            print("Criando usuário master...")
            master_user = User(
                name=MASTER_USER['name'],
                email=MASTER_USER['email'],
                phone=MASTER_USER['phone'],
                address=MASTER_USER['address'],
                role=MASTER_USER['role']
            )
            master_user.set_password(MASTER_USER['password'])
            db.session.add(master_user)
            db.session.commit()
            print("Usuário master criado com sucesso!")
        else:
            print("Usuário master já existe.")

def generate_token(user_id, role):
    """Gera um token JWT para o usuário."""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24) # Token expira em 24 horas
    }
    # Codifica o payload usando a chave secreta
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """Verifica e decodifica um token JWT."""
    try:
        # Decodifica o token usando a chave secreta
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token expirado.'}
    except jwt.InvalidTokenError:
        return {'error': 'Token inválido.'}

def login_required(f):
    """Decorator para rotas que exigem autenticação."""
    @app.before_request
    def check_auth():
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'message': 'Token de autenticação ausente.'}), 401
        
        try:
            token_prefix, actual_token = token.split(' ')
            if token_prefix != 'Bearer':
                raise ValueError
        except ValueError:
            return jsonify({'success': False, 'message': 'Formato de token inválido. Use "Bearer <token>"'}), 401

        payload = verify_token(actual_token)
        if 'error' in payload:
            return jsonify({'success': False, 'message': payload['error']}), 401
        
        # Armazena as informações do usuário no objeto 'g' para acesso posterior na requisição
        request.user_id = payload['user_id']
        request.user_role = payload['role']
    return f

def admin_required(f):
    """Decorator para rotas que exigem que o usuário seja admin."""
    @login_required # Garante que o usuário esteja logado primeiro
    @app.before_request
    def check_admin_role():
        if request.user_role != 'admin':
            return jsonify({'success': False, 'message': 'Acesso negado. Apenas administradores.'}), 403
    return f

# --- Rotas do Backend (API) ---

@app.route('/api/test', methods=['GET'])
def test_api():
    """Rota de teste simples para verificar a conexão do backend."""
    return jsonify({"message": "Backend da Pizzaria Del Gatito funcionando!", "timestamp": datetime.now(timezone.utc)})

@app.route('/api/register', methods=['POST'])
def register_user():
    """Rota para cadastro de novos usuários."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Requisição deve ser JSON'}), 400

    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    address = data.get('address')
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({'success': False, 'message': 'Nome, email e senha são obrigatórios.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Este email já está cadastrado.'}), 409

    try:
        new_user = User(name=name, email=email, phone=phone, address=address)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Usuário registrado com sucesso!'}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao registrar usuário: {e}")
        return jsonify({'success': False, 'message': 'Erro interno do servidor ao registrar usuário.'}), 500

@app.route('/api/login', methods=['POST'])
def login_user():
    """Rota para login de usuários."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Requisição deve ser JSON'}), 400

    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'success': False, 'message': 'Email e senha são obrigatórios.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'success': False, 'message': 'Email ou senha inválidos.'}), 401

    token = generate_token(user.id, user.role)
    return jsonify({
        'success': True,
        'message': 'Login bem-sucedido!',
        'token': token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role
        }
    }), 200

@app.route('/api/profile', methods=['GET'])
@login_required
def get_user_profile():
    """Rota para obter o perfil do usuário logado."""
    user = User.query.get(request.user_id) # Acesso a request.user_id do decorator
    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado.'}), 404
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'phone': user.phone,
            'address': user.address,
            'role': user.role,
            'created_at': user.created_at.isoformat()
        }
    }), 200

@app.route('/api/orders', methods=['POST'])
@login_required
def create_order():
    """Rota para criar um novo pedido."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Requisição deve ser JSON'}), 400

    items = data.get('items')
    total = data.get('total')

    if not all([items, total is not None]):
        return jsonify({'success': False, 'message': 'Itens e total são obrigatórios.'}), 400

    if not isinstance(items, list) or not items:
        return jsonify({'success': False, 'message': 'Itens deve ser uma lista não vazia.'}), 400
    
    try:
        new_order = Order(
            user_id=request.user_id, # Pega o ID do usuário do token verificado
            items=json.dumps(items), # Armazena a lista de itens como uma string JSON
            total=total,
            status='pending'
        )
        db.session.add(new_order)
        db.session.commit()

        # Registra no histórico
        history_entry = OrderHistory(order_id=new_order.id, status_change='pending')
        db.session.add(history_entry)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Pedido criado com sucesso!', 'order': {
            'id': new_order.id,
            'user_id': new_order.user_id,
            'items': json.loads(new_order.items),
            'total': new_order.total,
            'status': new_order.status,
            'created_at': new_order.created_at.isoformat()
        }}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar pedido: {e}")
        return jsonify({'success': False, 'message': 'Erro interno do servidor ao criar pedido.'}), 500

@app.route('/api/orders/<int:order_id>', methods=['GET'])
@login_required
def get_order_details(order_id):
    """Rota para obter detalhes de um pedido específico."""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'success': False, 'message': 'Pedido não encontrado.'}), 404
    
    # Garante que apenas o proprietário do pedido ou um admin pode visualizá-lo
    if order.user_id != request.user_id and request.user_role != 'admin':
        return jsonify({'success': False, 'message': 'Acesso negado.'}), 403

    history = OrderHistory.query.filter_by(order_id=order.id).order_by(OrderHistory.timestamp).all()
    
    return jsonify({
        'success': True,
        'order': {
            'id': order.id,
            'user_id': order.user_id,
            'items': json.loads(order.items),
            'total': order.total,
            'status': order.status,
            'created_at': order.created_at.isoformat(),
            'updated_at': order.updated_at.isoformat(),
            'history': [{
                'status_change': h.status_change,
                'timestamp': h.timestamp.isoformat()
            } for h in history]
        }
    }), 200

@app.route('/api/orders', methods=['GET'])
@login_required
def get_user_orders():
    """Rota para listar todos os pedidos do usuário logado (ou todos se for admin)."""
    if request.user_role == 'admin':
        orders = Order.query.all()
    else:
        orders = Order.query.filter_by(user_id=request.user_id).all()
    
    orders_data = []
    for order in orders:
        orders_data.append({
            'id': order.id,
            'user_id': order.user_id,
            'items': json.loads(order.items),
            'total': order.total,
            'status': order.status,
            'created_at': order.created_at.isoformat()
        })
    return jsonify({'success': True, 'orders': orders_data}), 200

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
@admin_required
def update_order_status(order_id):
    """Rota para admins atualizarem o status de um pedido."""
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'success': False, 'message': 'Status é obrigatório.'}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'success': False, 'message': 'Pedido não encontrado.'}), 404

    new_status = data['status']
    valid_statuses = ['pending', 'preparing', 'delivered', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'message': 'Status inválido.'}), 400

    try:
        order.status = new_status
        db.session.add(order)
        db.session.commit()

        # Registra no histórico
        history_entry = OrderHistory(order_id=order.id, status_change=new_status)
        db.session.add(history_entry)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Status do pedido atualizado com sucesso!', 'order': {
            'id': order.id,
            'status': order.status,
            'updated_at': order.updated_at.isoformat()
        }}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar status do pedido: {e}")
        return jsonify({'success': False, 'message': 'Erro interno do servidor ao atualizar status.'}), 500

# --- Rotas para o Frontend (HTML) ---
# Em um projeto Vercel, o ideal é servir os arquivos estáticos diretamente,
# mas estas rotas podem ser úteis para debug ou se você não usar Vercel's Static Output.

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/debug')
def debug_page():
    return render_template('debug.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# Rota para servir arquivos estáticos (CSS, JS, imagens)
# No Vercel, o diretório 'static' geralmente é servido automaticamente.
# Esta rota é mais para uso local ou para garantir.
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# Tratamento de erros
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'success': False, 'error': 'Recurso não encontrado.'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback() # Garante que a sessão do DB seja resetada em caso de erro
    return jsonify({'success': False, 'error': 'Erro interno do servidor. Tente novamente mais tarde.'}), 500

# --- Bloco de Inicialização e Execução do Aplicativo ---
if __name__ == '__main__':
    # IMPORTANTE PARA VERCEL:
    # A chamada 'initialize_database()' deve ser feita MANUALMENTE via 'flask db upgrade'
    # apontando para o seu banco de dados Supabase antes do deploy.
    # Evitar chamar diretamente aqui evita problemas de cold start e acesso ao DB,
    # pois o ambiente pode não estar totalmente pronto para conexões de DB neste ponto.
    # initialize_database() # <-- ESTA LINHA FOI COMENTADA PARA O DEPLOY NO VERCEL.

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Verificação de arquivos essenciais para o frontend (útil para debug local)
    files_to_check = [
        os.path.join(base_dir, 'templates', 'index.html'),
        os.path.join(base_dir, 'templates', 'debug.html'),
        os.path.join(base_dir, 'templates', 'admin.html'),
        os.path.join(base_dir, 'static', 'css', 'styles.css'),
        os.path.join(base_dir, 'static', 'js', 'script.js')
    ]

    print("\n📁 Verificando arquivos de template e estáticos:")
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"    ✅ {file_path}")
        else:
            print(f"    ❌ {file_path} - NÃO ENCONTRADO (Verifique se estão em 'templates' ou em 'static/css' / 'static/js')")
    
    print("\n🐱 Servidor Flask rodando! Acesse http://127.0.0.1:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)