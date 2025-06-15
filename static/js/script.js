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

    debugLog(`Resposta da requisição para ${url}`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    const data = await response.json() // Tenta sempre parsear o JSON
    debugLog(`Dados da resposta para ${url}`, data)

    if (!response.ok) {
      // Se a resposta não for OK (ex: 401, 403, 500), lança um erro com a mensagem do backend
      const errorMessage = data.error || `Erro HTTP: ${response.status}`
      throw new Error(errorMessage)
    }

    return { response, data }
  } catch (error) {
    debugLog(`Erro na requisição para ${url}`, error)
    // Relança o erro para que o chamador possa tratá-lo
    throw error
  }
}

// --- Funções de Autenticação ---
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners()
  checkAuth() // Verifica autenticação ao carregar a página
  testConnection() // Chama o teste de conexão
})

function setupEventListeners() {
  // Telas de Autenticação
  document
    .getElementById("login-form-element")
    .addEventListener("submit", handleLogin)
  document
    .getElementById("register-form-element")
    .addEventListener("submit", handleRegister)
  document
    .getElementById("show-register")
    .addEventListener("click", () => switchAuthForm("register"))
  document
    .getElementById("show-login")
    .addEventListener("click", () => switchAuthForm("login"))

  // Navegação Principal
  document.getElementById("nav-meus-pedidos").addEventListener("click", () => {
    showSection("meus-pedidos")
    highlightNavBtn("meus-pedidos")
  })
  document.getElementById("nav-novo-pedido").addEventListener("click", () => {
    showSection("novo-pedido")
    highlightNavBtn("novo-pedido")
  })
  document.getElementById("nav-meu-historico").addEventListener("click", () => {
    showSection("meu-historico")
    highlightNavBtn("meu-historico")
  })

  // Botão de Logout
  document.getElementById("logout-button").addEventListener("click", logoutUser)

  // Formulário de Novo Pedido
  document
    .querySelectorAll('.pizza-item input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", updateOrderSummary)
    })
  document
    .getElementById("new-order-form")
    .addEventListener("submit", handleCreateOrder)
}

function switchAuthForm(formId) {
  const loginForm = document.getElementById("login-form")
  const registerForm = document.getElementById("register-form")

  if (formId === "login") {
    loginForm.classList.add("active")
    registerForm.classList.remove("active")
  } else {
    loginForm.classList.remove("active")
    registerForm.classList.add("active")
  }
}

async function handleLogin(e) {
  e.preventDefault()
  debugLog("Tentativa de login...")

  const email = document.getElementById("login-email").value
  const password = document.getElementById("login-password").value

  try {
    const { data } = await makeRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    if (data.success) {
      localStorage.setItem("authToken", data.token)
      currentUser = data.user
      showNotification("Login realizado com sucesso!", "success")
      showApp()
      loadUserData() // Carrega dados do usuário após login
    } else {
      showNotification(data.error || "Erro no login", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão", "error")
  }
}

async function handleRegister(e) {
  e.preventDefault()
  debugLog("Tentativa de registo...")

  const name = document.getElementById("register-name").value
  const email = document.getElementById("register-email").value
  const phone = document.getElementById("register-phone").value
  const address = document.getElementById("register-address").value
  const password = document.getElementById("register-password").value
  const confirmPassword = document.getElementById("register-confirm-password").value

  if (password !== confirmPassword) {
    showNotification("As senhas não coincidem!", "error")
    return
  }

  try {
    const { data } = await makeRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, address, password }),
    })

    if (data.success) {
      showNotification("Registo realizado com sucesso! Faça login.", "success")
      switchAuthForm("login") // Volta para o formulário de login
    } else {
      showNotification(data.error || "Erro no registo", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão", "error")
  }
}

async function checkAuth() {
  debugLog("Verificando autenticação...")
  const token = localStorage.getItem("authToken")

  if (token) {
    try {
      const { data } = await makeRequest("/api/verify-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (data.success) {
        currentUser = data.user
        debugLog("Usuário autenticado:", currentUser)
        showApp()
        loadUserData() // Carrega dados do usuário se já estiver autenticado
      } else {
        debugLog("Token inválido ou expirado. Redirecionando para login.")
        localStorage.removeItem("authToken") // Remove token inválido
        showAuthScreen()
      }
    } catch (error) {
      debugLog("Erro na verificação do token:", error)
      localStorage.removeItem("authToken") // Remove token em caso de erro
      showAuthScreen()
    }
  } else {
    debugLog("Nenhum token encontrado. Mostrando tela de autenticação.")
    showAuthScreen()
  }
}

function logoutUser() {
  debugLog("A fazer logout...")
  localStorage.removeItem("authToken")
  currentUser = null
  userOrders = [] // LIMPAR DADOS DO UTILIZADOR AO SAIR
  userHistory = [] // LIMPAR DADOS DO UTILIZADOR AO SAIR
  showAuthScreen()
  showNotification("Logout realizado com sucesso!", "info")
}

// --- Funções de UI ---
function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "flex"
  document.getElementById("main-app").style.display = "none"
  switchAuthForm("login") // Garante que o formulário de login é o padrão
}

function showApp() {
  document.getElementById("auth-screen").style.display = "none"
  document.getElementById("main-app").style.display = "flex"
  document.getElementById("user-name").textContent = currentUser.name
  // Por padrão, mostra a secção "Meus Pedidos"
  showSection("meus-pedidos")
  highlightNavBtn("meus-pedidos")
}

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active")
  })
  document.getElementById(sectionId).classList.add("active")
}

function highlightNavBtn(sectionId) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active")
  })
  document.getElementById(`nav-${sectionId}`).classList.add("active")
}

// --- Funções de Dados do Usuário ---
async function loadUserData() {
  debugLog("Carregando dados do utilizador...")
  if (!currentUser) {
    debugLog("Nenhum utilizador logado, não carregando dados.")
    return // Não tenta carregar dados se não houver utilizador
  }

  // Limpa os arrays antes de carregar novos dados para evitar duplicidade ou dados antigos
  userOrders = []
  userHistory = []

  const token = localStorage.getItem("authToken")

  try {
    // Carregar pedidos ativos
    const { data: ordersData } = await makeRequest("/api/my-orders", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (ordersData.success) {
      userOrders = ordersData.orders
      renderUserOrders()
      debugLog("Pedidos ativos carregados:", userOrders)
    } else {
      showNotification(ordersData.error || "Erro ao carregar pedidos", "error")
    }

    // Carregar histórico de pedidos
    const { data: historyData } = await makeRequest("/api/my-history", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (historyData.success) {
      userHistory = historyData.orders
      renderUserHistory()
      debugLog("Histórico de pedidos carregado:", userHistory)
    } else {
      showNotification(historyData.error || "Erro ao carregar histórico", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão ao carregar dados", "error")
  }
}

function renderUserOrders() {
  const container = document.getElementById("my-orders-container")
  if (!container) return; // Garante que o elemento existe

  if (userOrders.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🤷‍♀️</div>
                <h3>Você não tem pedidos ativos</h3>
                <p>Que tal fazer um <a href="#" onclick="showSection('novo-pedido'); highlightNavBtn('novo-pedido'); return false;">novo pedido</a>?</p>
            </div>
        `
    return
  }

  container.innerHTML = userOrders.map((order) => createOrderCard(order)).join("")
}

function renderUserHistory() {
  const container = document.getElementById("my-history-container")
  if (!container) return; // Garante que o elemento existe

  if (userHistory.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📜</div>
                <h3>Seu histórico de pedidos está vazio</h3>
                <p>Seus pedidos concluídos aparecerão aqui.</p>
            </div>
        `
    return
  }

  container.innerHTML = userHistory.map((order) => createOrderCard(order)).join("")
}


// Cria o card de pedido para exibição na interface do utilizador (não admin)
function createOrderCard(order) {
  const statusClass = `status-${order.status.replace(/ /g, '-')}`
  const statusText = getStatusText(order.status)

  // Formata a lista de itens do pedido. order.items é um array de objetos {name, price}.
  const formattedItems = Array.isArray(order.items)
    ? `<ul class="order-items-list">${order.items.map(item => `<li>• ${item.name || item} (R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price || 0)})</li>`).join('')}</ul>`
    : `N/A`;

  return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">Pedido #${order.id}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            <div class="order-info">
                <p><strong>Total:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</p>
                <p><strong>Data:</strong> ${formatDate(new Date(order.createdAt))}</p>
                ${order.completedAt ? `<p><strong>Concluído em:</strong> ${formatDate(new Date(order.completedAt))}</p>` : ''}
            </div>
            <div class="order-items">
                <h4>Itens do Pedido:</h4>
                ${formattedItems}
            </div>
        </div>
    `
}

// --- Funções de Pedido ---
async function handleCreateOrder(e) {
  e.preventDefault()
  debugLog("A criar novo pedido...")

  const selectedPizzas = Array.from(
    document.querySelectorAll('.pizza-item input[type="checkbox"]:checked'),
  ).map((checkbox) => checkbox.value) // Note: value should be the pizza name (e.g., 'Margherita')

  let total = 0
  const pizzaItems = [] // Para armazenar objetos {name, price}
  selectedPizzas.forEach(pizzaName => {
      const pizzaData = getPizzaDataByName(pizzaName);
      if (pizzaData) {
          total += pizzaData.price;
          pizzaItems.push({ name: pizzaData.name, price: pizzaData.price });
      }
  });

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
        items: pizzaItems, // Envia a lista de objetos {name, price}
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
      highlightNavBtn("meus-pedidos")

      showNotification("Pedido criado com sucesso!", "success")
    } else {
      showNotification(data.error || "Erro ao criar pedido", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão", "error")
  }
}

function updateOrderSummary() {
  debugLog("A atualizar resumo do pedido...")
  const summaryDiv = document.getElementById("order-summary")
  const selectedItemsDiv = document.getElementById("selected-items")
  const totalAmountSpan = document.getElementById("total-amount")

  selectedItemsDiv.innerHTML = ""
  let currentTotal = 0

  const selectedPizzas = Array.from(
    document.querySelectorAll('.pizza-item input[type="checkbox"]:checked'),
  )

  if (selectedPizzas.length > 0) {
    summaryDiv.style.display = "block"
    selectedPizzas.forEach((checkbox) => {
      const pizzaName = checkbox.value
      const pizzaData = getPizzaDataByName(pizzaName)
      if (pizzaData) {
        currentTotal += pizzaData.price
        const itemElement = document.createElement("p")
        itemElement.innerHTML = `<span>${pizzaData.name}</span><strong>R$ ${pizzaData.price.toFixed(2).replace('.', ',')}</strong>`
        selectedItemsDiv.appendChild(itemElement)
      }
    })
  } else {
    summaryDiv.style.display = "none"
  }

  totalAmountSpan.textContent = currentTotal.toFixed(2).replace('.', ',')
}


// Mapeamento local de pizzas (para exibir no frontend antes de fazer o pedido)
const PIZZAS_DATA = [
    { id: 'margherita', name: 'Margherita', price: 25.00, description: 'Molho de tomate, mussarela, manjericão fresco.' },
    { id: 'pepperoni', name: 'Pepperoni', price: 30.00, description: 'Molho de tomate, mussarela, pepperoni fatiado.' },
    { id: 'calabresa', name: 'Calabresa', price: 28.00, description: 'Molho de tomate, mussarela, calabresa fatiada, cebola.' },
    { id: 'quatro-queijos', name: 'Quatro Queijos', price: 32.00, description: 'Molho de tomate, mussarela, provolone, parmesão, gorgonzola.' },
    { id: 'frango-catupiry', name: 'Frango com Catupiry', price: 30.00, description: 'Molho de tomate, mussarela, frango desfiado, catupiry.' },
    { id: 'portuguesa', name: 'Portuguesa', price: 29.00, description: 'Molho de tomate, mussarela, presunto, ovos, cebola, azeitona.' },
    { id: 'vegetariana', name: 'Vegetariana', price: 27.00, description: 'Molho de tomate, mussarela, pimentões, cebola, champignon, azeitona.' },
    { id: 'chocolate', name: 'Chocolate (Doce)', price: 35.00, description: 'Chocolate ao leite, granulado.' },
];

function getPizzaDataByName(name) {
    return PIZZAS_DATA.find(pizza => pizza.name === name);
}

function renderPizzaSelection() {
    const container = document.getElementById('pizza-selection-container');
    if (!container) return;

    container.innerHTML = PIZZAS_DATA.map(pizza => `
        <div class="pizza-item">
            <input type="checkbox" id="pizza-${pizza.id}" value="${pizza.name}">
            <label for="pizza-${pizza.id}">
                <div class="pizza-info">
                    <span class="pizza-name">${pizza.name}</span>
                    <span class="pizza-price">R$ ${pizza.price.toFixed(2).replace('.', ',')}</span>
                </div>
                <span class="pizza-description">${pizza.description}</span>
            </label>
        </div>
    `).join('');

    // Re-adiciona os event listeners após renderizar
    document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateOrderSummary);
    });
}
// Chamar a renderização de pizzas quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', renderPizzaSelection);


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

// Funções de formatação de data (já existente)
function formatDate(date) {
  return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
  });
}

function getStatusText(status) {
  const statusMap = {
      'pendente': 'Pendente',
      'preparando': 'Preparando',
      'saiu-entrega': 'Saiu p/ Entrega',
      'entregue': 'Entregue'
  };
  return statusMap[status] || status;
}
