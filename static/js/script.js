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
      showNotification("Erro de conexão com o servidor", "error")
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
      throw new Error(`Servidor retornou ${response.status}: Resposta não é JSON`)
    }

    const data = await response.json()
    debugLog(`Dados JSON de ${url}`, data)

    return { response, data }
  } catch (error) {
    debugLog(`Erro na requisição para ${url}`, error)
    throw error
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
        showAuthScreen()
      }
    } catch (error) {
      debugLog("Erro na verificação de token", error)
      localStorage.removeItem("authToken")
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

  // Navegação
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
  document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", updateOrderSummary)
  })
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
  document.getElementById("user-name").textContent = currentUser.name
  updateCustomerDisplay()
  loadUserData()
  showSection("meus-pedidos")
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
    } else {
      showNotification(data.error || "Erro ao fazer login", "error")
    }
  } catch (error) {
    debugLog("Erro no login", error)
    showNotification("Erro de conexão com o servidor", "error")
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
      showNotification(data.error || "Erro ao cadastrar", "error")
    }
  } catch (error) {
    debugLog("Erro no cadastro", error)
    showNotification("Erro de conexão com o servidor", "error")
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
    }
  } catch (error) {
    debugLog("Erro ao carregar dados do usuário", error)
  }
}

// Atualizar exibição dos dados do cliente
function updateCustomerDisplay() {
  document.getElementById("customer-display-name").textContent = currentUser.name
  document.getElementById("customer-display-phone").textContent = currentUser.phone
  document.getElementById("customer-display-address").textContent = currentUser.address
}

// Renderização de pedidos
function renderMyOrders() {
  const container = document.getElementById("my-orders-container")

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

function createOrderCard(order, isHistory = false) {
  const statusClass = `status-${order.status.replace("-", "-")}`
  const statusText = getStatusText(order.status)

  return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">Pedido #${order.id}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            <div class="order-info">
                <p><strong>Data:</strong> ${formatDate(new Date(order.createdAt))}</p>
                ${
                  order.updatedAt !== order.createdAt
                    ? `<p><strong>Atualizado:</strong> ${formatDate(new Date(order.updatedAt))}</p>`
                    : ""
                }
            </div>
            <div class="order-items">
                <h4>Itens do Pedido:</h4>
                <ul>
                    ${order.items.map((item) => `<li>• ${item}</li>`).join("")}
                </ul>
            </div>
            <div class="order-total">
                Total: R$ ${order.total.toFixed(2)}
            </div>
        </div>
    `
}

function getStatusText(status) {
  const statusMap = {
    pendente: "Pendente",
    preparando: "Preparando",
    "saiu-entrega": "Saiu p/ Entrega",
    entregue: "Entregue",
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

// Atualizar resumo do pedido
function updateOrderSummary() {
  const selectedPizzas = []
  let total = 0

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const pizzaKey = checkbox.value
    selectedPizzas.push({
      name: pizzaNames[pizzaKey],
      price: pizzaPrices[pizzaKey],
    })
    total += pizzaPrices[pizzaKey]
  })

  const summaryContainer = document.getElementById("order-summary")
  const selectedItemsContainer = document.getElementById("selected-items")
  const totalAmountElement = document.getElementById("total-amount")

  if (selectedPizzas.length > 0) {
    summaryContainer.style.display = "block"
    selectedItemsContainer.innerHTML = selectedPizzas
      .map(
        (pizza) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>${pizza.name}</span>
                <span>R$ ${pizza.price.toFixed(2)}</span>
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
  const selectedPizzas = []
  let total = 0

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const pizzaKey = checkbox.value
    selectedPizzas.push(pizzaNames[pizzaKey])
    total += pizzaPrices[pizzaKey]
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
        items: selectedPizzas,
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
      showNotification(data.error || "Erro ao criar pedido", "error")
    }
  } catch (error) {
    showNotification("Erro de conexão", "error")
  }
}

// Notificações
function showNotification(message, type = "info") {
  const notification = document.createElement("div")
  notification.className = `notification notification-${type}`
  notification.textContent = message

  notification.style.animation = "slideIn 0.3s ease"

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease"
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification)
      }
    }, 300)
  }, 3000)
}
