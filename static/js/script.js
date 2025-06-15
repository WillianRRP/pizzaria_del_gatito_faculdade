// Estado da aplicação
let currentUser = null
let userOrders = []
let userHistory = []

// Debug mode
const DEBUG = true

function debugLog(message, data = null) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data || "")
  }
}

// Teste de conexão com o servidor
function testConnection() {
  debugLog("Testando conexão com servidor...")

  fetch("/api/test")
    .then((response) => {
      debugLog("Resposta do teste de conexão", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
    })
    .then((data) => {
      debugLog("Conexão com servidor OK", data)
    })
    .catch((error) => {
      debugLog("Erro de conexão com servidor", error)
      // Garantir que a mensagem é uma string
      showNotification(error.message || "Erro de conexão com o servidor", "error")
    })
}

// Função auxiliar para fazer requisições com melhor tratamento de erro
async function makeRequest(url, options = {}) {
  try {
    debugLog(`Fazendo requisição para ${url}`, options)

    // Configurar headers padrão
    const defaultHeaders = {
      "Content-Type": "application/json",
    }

    // Mesclar headers
    const headers = {
      ...defaultHeaders,
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    debugLog(`Resposta de ${url}`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    const contentType = response.headers.get("content-type")

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text()
      debugLog(`Resposta não é JSON de ${url}`, text.substring(0, 200))
      throw new Error(`Servidor retornou ${response.status}: Resposta não é JSON. Conteúdo: ${text.substring(0, 500)}`)
    }

    const data = await response.json()
    debugLog(`Dados JSON de ${url}`, data)

    return { response, data }
  } catch (error) {
    debugLog(`Erro na requisição para ${url}`, error)
    // O erro já é uma instância de Error, então error.message é uma string.
    throw error // Re-lança o erro para ser pego pelos handlers de nível superior
  }
}

// Preços das pizzas
const pizzaPrices = {
  margherita: 25.0,
  pepperoni: 30.0,
  calabresa: 28.0,
  "quatro-queijos": 32.0,
}

// Nomes das pizzas
const pizzaNames = {
  margherita: "Margherita",
  pepperoni: "Pepperoni",
  calabresa: "Calabresa",
  "quatro-queijos": "Quatro Queijos",
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  debugLog("DOM carregado, iniciando aplicação...")
  testConnection()
  checkAuthStatus()
  setupEventListeners()
  loadPizzas() // Carrega as pizzas assim que o DOM estiver pronto
})

// Verificar se usuário está logado
async function checkAuthStatus() {
  debugLog("Verificando status de autenticação...")

  const token = localStorage.getItem("authToken")
  if (token) {
    debugLog("Token encontrado, verificando validade...")

    try {
      const { data } = await makeRequest("/api/verify-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (data.success) {
        currentUser = data.user
        debugLog("Token válido, usuário logado", currentUser)
        showMainApp()
      } else {
        debugLog("Token inválido, removendo...")
        localStorage.removeItem("authToken")
        // Garantir que a mensagem é uma string
        showNotification(data.error || "Token inválido ou expirado. Faça login novamente.", "error")
        showAuthScreen()
      }
    } catch (error) {
      debugLog("Erro na verificação de token", error)
      localStorage.removeItem("authToken")
      // Garantir que a mensagem é uma string
      showNotification(error.message || "Erro ao verificar sessão.", "error")
      showAuthScreen()
    }
  } else {
    debugLog("Nenhum token encontrado, mostrando tela de login")
    showAuthScreen()
  }
}

// Event Listeners
function setupEventListeners() {
  // Formulários de autenticação
  document.getElementById("login-form-element").addEventListener("submit", handleLogin)
  document.getElementById("register-form-element").addEventListener("submit", handleRegister)

  // Botões de navegação
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const section = this.dataset.section
      showSection(section)
      updateActiveNavButton(this)
    })
  })

  // Formulário de novo pedido
  document.getElementById("order-form").addEventListener("submit", handleNewOrder)

  // Checkboxes de pizza para calcular total
  // Os listeners são adicionados em loadPizzas agora
  
  // Botão de logout
  document.querySelector('.btn-logout').addEventListener('click', logout);
}

// Autenticação
function showLoginForm() {
  document.getElementById("login-form").classList.add("active")
  document.getElementById("register-form").classList.remove("active")
}

function showRegisterForm() {
  document.getElementById("register-form").classList.add("active")
  document.getElementById("login-form").classList.remove("active")
}

function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "flex"
  document.getElementById("main-app").style.display = "none"
}

function showMainApp() {
  document.getElementById("auth-screen").style.display = "none"
  document.getElementById("main-app").style.display = "block"
  // Atualiza nome do usuário no cabeçalho
  const userNameElement = document.getElementById("user-name");
  if (userNameElement) {
    userNameElement.textContent = currentUser.name;
  }
  updateCustomerDisplay()
  loadUserData()
  showSection("meus-pedidos") // Mostra "Meus Pedidos" por padrão ao logar
}

async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("login-email").value.trim()
  const password = document.getElementById("login-password").value

  if (!email || !password) {
    showNotification("Por favor, preencha todos os campos", "error")
    return
  }

  try {
    const { data } = await makeRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    if (data.success) {
      localStorage.setItem("authToken", data.token)
      currentUser = data.user
      showMainApp()
      showNotification("Login realizado com sucesso!", "success")
      // Redireciona para admin.html se for admin/master
      if (currentUser.role === 'admin' || currentUser.role === 'master') {
          window.location.href = '/admin.html';
      }
    } else {
      // Garantir que a mensagem é uma string
      showNotification(data.error || "Erro ao fazer login", "error")
    }
  } catch (error) {
    debugLog("Erro no login", error)
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão com o servidor", "error")
  }
}

async function handleRegister(e) {
  e.preventDefault()

  const name = document.getElementById("register-name").value.trim()
  const email = document.getElementById("register-email").value.trim()
  const phone = document.getElementById("register-phone").value.trim()
  const address = document.getElementById("register-address").value.trim()
  const password = document.getElementById("register-password").value
  const confirmPassword = document.getElementById("register-confirm-password").value

  // Validações
  if (!name || !email || !phone || !address || !password) {
    showNotification("Por favor, preencha todos os campos", "error")
    return
  }

  if (password !== confirmPassword) {
    showNotification("As senhas não coincidem", "error")
    return
  }

  if (password.length < 6) {
    showNotification("A senha deve ter pelo menos 6 caracteres", "error")
    return
  }

  try {
    const { data } = await makeRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        password,
      }),
    })

    if (data.success) {
      showNotification("Cadastro realizado com sucesso! Faça login.", "success")
      showLoginForm()
      // Limpar formulário
      document.getElementById("register-form-element").reset()
    } else {
      // Garantir que a mensagem é uma string
      showNotification(data.error || "Erro ao cadastrar", "error")
    }
  } catch (error) {
    debugLog("Erro no cadastro", error)
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão com o servidor", "error")
  }
}

function logout() {
  localStorage.removeItem("authToken")
  currentUser = null
  userOrders = []
  userHistory = []
  showAuthScreen()
  showNotification("Logout realizado com sucesso!", "info")
}

// Navegação entre seções
function showSection(sectionId) {
  // Esconder todas as seções
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active")
  })

  // Mostrar seção selecionada
  document.getElementById(sectionId).classList.add("active")

  // Atualizar botão ativo na navegação
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active")
    if (btn.dataset.section === sectionId) {
      btn.classList.add("active")
    }
  })

  // Renderizar conteúdo específico da seção
  if (sectionId === "meus-pedidos") {
    renderMyOrders()
  } else if (sectionId === "meu-historico") {
    renderMyHistory()
  }
  // No "fazer-pedido" não há renderização pesada, apenas atualização do resumo
  if (sectionId === "fazer-pedido") {
    updateOrderSummary();
  }
}

function updateActiveNavButton(activeBtn) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active")
  })
  activeBtn.classList.add("active")
}

// Carregar dados do usuário
async function loadUserData() {
  const token = localStorage.getItem("authToken")
  if (!token) {
    debugLog("loadUserData: Token não encontrado, pulando carregamento de dados.")
    return;
  }

  try {
    // Carregar pedidos do usuário
    const { data: ordersData } = await makeRequest("/api/my-orders", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (ordersData.success) {
      userOrders = ordersData.orders
      renderMyOrders()
    } else {
      // Garantir que a mensagem é uma string
      showNotification(ordersData.error || "Erro ao carregar pedidos ativos.", "error")
    }

    // Carregar histórico do usuário
    const { data: historyData } = await makeRequest("/api/my-history", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (historyData.success) {
      userHistory = historyData.orders
      renderMyHistory()
    } else {
      // Garantir que a mensagem é uma string
      showNotification(historyData.error || "Erro ao carregar histórico de pedidos.", "error")
    }
  } catch (error) {
    debugLog("Erro ao carregar dados do usuário", error)
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão ao carregar dados.", "error")
  }
}

// Atualizar exibição dos dados do cliente
function updateCustomerDisplay() {
  const nameElement = document.getElementById("customer-display-name");
  const phoneElement = document.getElementById("customer-display-phone");
  const addressElement = document.getElementById("customer-display-address");

  if (nameElement) nameElement.textContent = currentUser.name;
  if (phoneElement) phoneElement.textContent = currentUser.phone;
  if (addressElement) addressElement.textContent = currentUser.address;
}

// Renderização de pizzas (para a seção "Fazer Pedido")
async function loadPizzas() {
  debugLog("Carregando pizzas para a seleção...")
  try {
    const { data } = await makeRequest("/api/pizzas")
    if (data.success && data.pizzas && Array.isArray(data.pizzas)) {
      const pizzaSelectionDiv = document.querySelector(".pizza-selection")
      if (pizzaSelectionDiv) {
        pizzaSelectionDiv.innerHTML = data.pizzas.map(pizza => `
          <div class="pizza-item">
              <input type="checkbox" id="${pizza.id}" value="${pizza.id}" data-price="${pizza.price}">
              <label for="${pizza.id}">
                  <div class="pizza-info">
                      <span class="pizza-name">${pizza.name}</span>
                      <span class="pizza-price">R$ ${parseFloat(pizza.price).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div class="pizza-description">${getPizzaDescription(pizza.id)}</div>
              </label>
          </div>
        `).join('');

        // Adiciona event listeners APÓS a renderização
        document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
          checkbox.addEventListener("change", updateOrderSummary);
        });
        updateOrderSummary(); // Atualiza o resumo inicial
      }
    } else {
      // Garantir que a mensagem é uma string
      showNotification(data.error || "Erro ao carregar lista de pizzas.", "error")
    }
  } catch (error) {
    debugLog("Erro ao carregar pizzas", error);
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão ao carregar pizzas.", "error")
  }
}

// Função auxiliar para obter descrição da pizza (se precisar)
function getPizzaDescription(pizzaId) {
    switch (pizzaId) {
        case 'margherita': return 'Molho de tomate, mussarela e manjericão';
        case 'pepperoni': return 'Molho de tomate, mussarela e pepperoni';
        case 'calabresa': return 'Molho de tomate, mussarela, calabresa e cebola';
        case 'quatro-queijos': return 'Mussarela, provolone, parmesão e gorgonzola';
        default: return 'Deliciosa pizza!';
    }
}


// Renderização de pedidos (AGORA COM OS ITENS FORMATADOS CORRETAMENTE)
function renderMyOrders() {
  const container = document.getElementById("my-orders-container")
  if (!container) {
    debugLog("Elemento #my-orders-container não encontrado.");
    return;
  }

  if (userOrders.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🍕</div>
                <h3>Você não tem pedidos ativos</h3>
                <p>Que tal fazer seu primeiro pedido?</p>
            </div>
        `
    return
  }

  container.innerHTML = userOrders.map((order) => createOrderCard(order)).join("")
}

function renderMyHistory() {
  const container = document.getElementById("my-history-container")
  if (!container) {
    debugLog("Elemento #my-history-container não encontrado.");
    return;
  }

  if (userHistory.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📋</div>
                <h3>Você não tem pedidos no histórico</h3>
                <p>Seus pedidos entregues aparecerão aqui</p>
            </div>
        `
    return
  }

  container.innerHTML = userHistory.map((order) => createOrderCard(order, true)).join("")
}

// FUNÇÃO ATUALIZADA PARA FORMATAR OS ITENS CORRETAMENTE
function createOrderCard(order, isHistory = false) {
  const statusClass = `status-${order.status.replace(" ", "-")}` // Ajuste para status com espaço
  const statusText = getStatusText(order.status)

  // Formatar itens do pedido para exibição
  const formattedItems = Array.isArray(order.items)
    ? order.items.map((item) => `<li>• ${item.name || item} (R$ ${(item.price || 0).toFixed(2).replace('.', ',')})</li>`).join("")
    : `<li>${order.items || "Nenhum item especificado"}</li>`; // Fallback caso 'items' não seja um array ou seja nulo

  return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">Pedido #${isHistory ? order.originalOrderId : order.id}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            <div class="order-info">
                <p><strong>Data:</strong> ${formatDate(new Date(order.createdAt))}</p>
                ${
                  order.updatedAt && order.updatedAt !== order.createdAt
                    ? `<p><strong>Atualizado:</strong> ${formatDate(new Date(order.updatedAt))}</p>`
                    : ""
                }
            </div>
            <div class="order-items">
                <h4>Itens do Pedido:</h4>
                <ul>
                    ${formattedItems}
                </ul>
            </div>
            <div class="order-total">
                Total: R$ ${parseFloat(order.total).toFixed(2).replace(".", ",")}
            </div>
        </div>
    `
}


// Atualizar resumo do pedido
function updateOrderSummary() {
  const selectedPizzas = []
  let total = 0

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const pizzaKey = checkbox.value
    // Certificar-se de que pizzaNames[pizzaKey] e pizzaPrices[pizzaKey] existem
    if (pizzaNames[pizzaKey] && pizzaPrices[pizzaKey]) {
        selectedPizzas.push({
            name: pizzaNames[pizzaKey],
            price: pizzaPrices[pizzaKey],
        })
        total += pizzaPrices[pizzaKey]
    } else {
        debugLog(`Erro: Pizza ${pizzaKey} não encontrada em pizzaNames ou pizzaPrices.`);
    }
  })

  const summaryContainer = document.getElementById("order-summary")
  const selectedItemsContainer = document.getElementById("selected-items")
  const totalAmountElement = document.getElementById("total-amount")

  if (!summaryContainer || !selectedItemsContainer || !totalAmountElement) {
    debugLog("Elementos de resumo de pedido não encontrados.");
    return;
  }

  if (selectedPizzas.length > 0) {
    summaryContainer.style.display = "block"
    selectedItemsContainer.innerHTML = selectedPizzas
      .map(
        (pizza) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>${pizza.name}</span>
                <span>R$ ${pizza.price.toFixed(2).replace(".", ",")}</span>
            </div>
        `,
      )
      .join("")
    totalAmountElement.textContent = total.toFixed(2).replace(".", ",")
  } else {
    summaryContainer.style.display = "none"
  }
}

// Manipulação de pedidos
async function handleNewOrder(e) {
  e.preventDefault()

  // Coletar pizzas selecionadas
  const selectedPizzas = [] // Vai armazenar apenas as chaves (IDs) da pizza
  let total = 0

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const pizzaKey = checkbox.value
    // A API espera uma lista de STRINGS com os nomes das pizzas, não objetos.
    // O backend irá mapear esses nomes para preços.
    if (pizzaNames[pizzaKey] && pizzaPrices[pizzaKey]) { // Verifica se existe antes de adicionar
        selectedPizzas.push(pizzaNames[pizzaKey]) // Envia o nome completo da pizza
        total += pizzaPrices[pizzaKey]
    }
  })

  if (selectedPizzas.length === 0) {
    showNotification("Por favor, selecione pelo menos uma pizza!", "error")
    return
  }

  const token = localStorage.getItem("authToken")

  try {
    const { data } = await makeRequest("/api/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: selectedPizzas, // Envia lista de nomes de pizza, como esperado pelo backend
        total: total,
      }),
    })

    if (data.success) {
      // Limpar formulário
      document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false
      })
      updateOrderSummary()

      // Atualizar lista de pedidos
      loadUserData()

      // Voltar para meus pedidos
      showSection("meus-pedidos")

      showNotification("Pedido criado com sucesso!", "success")
    } else {
      // Garantir que a mensagem é uma string
      showNotification(data.error || "Erro ao criar pedido", "error")
    }
  } catch (error) {
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão", "error")
  }
}

// Notificações
function showNotification(message, type = "info") {
  // Limpa notificações existentes para evitar acúmulo
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());

  const notification = document.createElement("div")
  notification.className = `notification notification-${type}`
  // Converte a mensagem para string, caso seja um objeto ou outro tipo
  notification.textContent = String(message)

  notification.style.animation = "slideIn 0.3s ease"

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease"
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification)
      }
    }, 300)
  }, 5000) // Aumentado para 5 segundos para melhor visibilidade
}

// Funções utilitárias de formatação
function getStatusText(status) {
  const statusMap = {
    'pendente': 'Pendente',
    'preparando': 'Preparando',
    'saiu-entrega': 'Saiu p/ Entrega',
    'entregue': 'Entregue'
  }
  return statusMap[status] || status
}

function formatDate(date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
