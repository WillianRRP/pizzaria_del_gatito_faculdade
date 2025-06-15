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

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(
        errorData?.error || `HTTP ${response.status}: ${response.statusText}`
      )
    }

    const data = await response.json()
    debugLog(`Resposta de ${url}`, data)
    return { response, data }
  } catch (error) {
    debugLog(`Erro na requisição para ${url}`, error)
    throw error
  }
}

// --- Funções de Autenticação ---
async function handleLogin(event) {
  event.preventDefault()
  debugLog("Login iniciado...")

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
      debugLog("Login bem-sucedido", currentUser)
      showNotification("Login realizado com sucesso!", "success")
      showAppContent()
      loadUserData()
      // Redirecionar para admin.html se for admin
      if (currentUser.role === 'admin' || currentUser.role === 'master') {
          window.location.href = '/admin.html';
      }
    } else {
      showNotification(data.error || "Email ou senha incorretos", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão", "error")
  }
}

async function handleRegister(event) {
  event.preventDefault()
  debugLog("Registro iniciado...")

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
      showNotification("Cadastro realizado com sucesso! Faça login.", "success")
      showLoginForm() // Volta para a tela de login
    } else {
      showNotification(data.error || "Erro ao cadastrar usuário", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão", "error")
  }
}

function handleLogout() {
  localStorage.removeItem("authToken")
  currentUser = null
  userOrders = []
  userHistory = []
  showAuthScreen()
  showNotification("Você foi desconectado.", "info")
  debugLog("Logout realizado")
}

async function verifyAuthToken() {
  debugLog("Verificando token de autenticação...")
  const token = localStorage.getItem("authToken")
  if (!token) {
    debugLog("Nenhum token encontrado.")
    showAuthScreen()
    return false
  }

  try {
    const { data } = await makeRequest("/api/verify-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (data.success) {
      currentUser = data.user
      debugLog("Token válido. Usuário atual:", currentUser)
      showAppContent()
      loadUserData()
      return true
    } else {
      debugLog("Token inválido ou expirado.", data.error)
      localStorage.removeItem("authToken")
      showAuthScreen()
      showNotification(data.error || "Sessão expirada. Faça login novamente.", "info")
      return false
    }
  } catch (error) {
    debugLog("Erro na verificação de token", error)
    localStorage.removeItem("authToken")
    showAuthScreen()
    showNotification("Erro ao verificar sessão.", "error")
    return false
  }
}

// --- Funções de UI (Mostrar/Esconder Seções) ---
function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "flex"
  document.getElementById("app-content").style.display = "none"
}

function showAppContent() {
  document.getElementById("auth-screen").style.display = "none"
  document.getElementById("app-content").style.display = "flex" // Ou 'block' dependendo do layout
}

function showLoginForm() {
  document.getElementById("login-form").classList.add("active")
  document.getElementById("register-form").classList.remove("active")
}

function showRegisterForm() {
  document.getElementById("login-form").classList.remove("active")
  document.getElementById("register-form").classList.add("active")
}

function showSection(sectionId) {
  document.querySelectorAll(".section").forEach((section) => {
    section.style.display = "none"
  })
  document.getElementById(sectionId).style.display = "block"

  document.querySelectorAll(".sidebar-link").forEach(link => {
      link.classList.remove("active");
  });
  document.querySelector(`.sidebar-link[data-section="${sectionId}"]`).classList.add("active");

  // Atualiza as seções específicas ao serem mostradas
  if (sectionId === 'meus-pedidos') {
      renderUserOrders();
  } else if (sectionId === 'meu-historico') {
      renderUserHistory();
  } else if (sectionId === 'fazer-pedido') {
      updateOrderSummary();
  }
}


// --- Funções de Dados da Aplicação ---

async function loadUserData() {
  if (!currentUser) return debugLog("Usuário não logado para carregar dados.")

  debugLog("Carregando dados do usuário (pedidos e histórico)...")

  const token = localStorage.getItem("authToken")
  if (!token) return

  try {
    // Carrega pedidos ativos
    const { data: ordersData } = await makeRequest("/api/my-orders", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (ordersData.success) {
      userOrders = ordersData.orders
      debugLog("Pedidos ativos carregados:", userOrders)
      renderUserOrders()
    } else {
      showNotification(ordersData.error || "Erro ao carregar pedidos ativos", "error")
    }

    // Carrega histórico de pedidos
    const { data: historyData } = await makeRequest("/api/my-history", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (historyData.success) {
      userHistory = historyData.orders
      debugLog("Histórico de pedidos carregado:", userHistory)
      renderUserHistory()
    } else {
      showNotification(historyData.error || "Erro ao carregar histórico", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão ao carregar dados", "error")
  }
}

// --- FUNÇÃO ADICIONADA: Formata a lista de itens de um pedido ---
function formatOrderItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return 'Nenhum item.';
    }
    return items.map(item => `${item.name} (R$ ${parseFloat(item.price).toFixed(2)})`).join('<br>');
}


function renderUserOrders() {
  const container = document.getElementById("my-orders-container")
  container.innerHTML = "" // Limpa o conteúdo anterior

  if (userOrders.length === 0) {
    container.innerHTML = "<p>Você não tem nenhum pedido ativo no momento.</p>"
    return
  }

  userOrders.forEach((order) => {
    const orderCard = document.createElement("div")
    orderCard.className = "order-card"
    orderCard.innerHTML = `
            <h3>Pedido #${order.id}</h3>
            <p><strong>Status:</strong> ${getStatusText(order.status)}</p>
            <p><strong>Total:</strong> R$ ${parseFloat(order.total).toFixed(2)}</p>
            <p><strong>Itens:</strong><br>${formatOrderItems(order.items)}</p>
            <p><strong>Criado em:</strong> ${formatDate(new Date(order.createdAt))}</p>
        `
    container.appendChild(orderCard)
  })
}

function renderUserHistory() {
  const container = document.getElementById("my-history-container")
  container.innerHTML = "" // Limpa o conteúdo anterior

  if (userHistory.length === 0) {
    container.innerHTML = "<p>Seu histórico de pedidos está vazio.</p>"
    return
  }

  userHistory.forEach((order) => {
    const orderCard = document.createElement("div")
    orderCard.className = "order-card history"
    orderCard.innerHTML = `
            <h3>Pedido Histórico #${order.originalOrderId}</h3>
            <p><strong>Total:</strong> R$ ${parseFloat(order.total).toFixed(2)}</p>
            <p><strong>Itens:</strong><br>${formatOrderItems(order.items)}</p>
            <p><strong>Concluído em:</strong> ${formatDate(new Date(order.completedAt))}</p>
        `
    container.appendChild(orderCard)
  })
}


// --- Funções de Pedido ---
let selectedPizzas = [] // Armazena os nomes das pizzas selecionadas
let total = 0

async function loadPizzas() {
  debugLog("Carregando pizzas do servidor...")
  try {
    const { data } = await makeRequest("/api/pizzas")
    if (data.success) {
      const pizzaSelectionDiv = document.getElementById("pizza-selection")
      pizzaSelectionDiv.innerHTML = "" // Limpa o conteúdo existente

      data.pizzas.forEach((pizza) => {
        const pizzaItemDiv = document.createElement("div")
        pizzaItemDiv.className = "pizza-item"
        pizzaItemDiv.innerHTML = `
                    <input type="checkbox" id="${pizza.id}" name="pizza" value="${pizza.name}" data-price="${pizza.price}">
                    <label for="${pizza.id}">${pizza.name} - R$ ${parseFloat(pizza.price).toFixed(2)}</label>
                `
        pizzaSelectionDiv.appendChild(pizzaItemDiv)
      })

      // Adiciona event listeners para os checkboxes
      document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
          checkbox.addEventListener("change", updateOrderSummary);
      });
      debugLog("Pizzas carregadas e checkboxes configurados.")
      updateOrderSummary() // Garante que o resumo esteja atualizado
    } else {
      showNotification(data.error || "Erro ao carregar pizzas", "error")
    }
  } catch (error) {
    showNotification(error.message || "Erro de conexão ao carregar pizzas", "error")
  }
}

function updateOrderSummary() {
  selectedPizzas = []
  total = 0
  const selectedItemsDiv = document.getElementById("selected-items")
  selectedItemsDiv.innerHTML = ""
  const totalAmountSpan = document.getElementById("total-amount")
  const orderSummaryDiv = document.getElementById("order-summary")

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const name = checkbox.value
    const price = parseFloat(checkbox.dataset.price)
    selectedPizzas.push(name)
    total += price

    const itemElement = document.createElement("p")
    itemElement.textContent = `${name}: R$ ${price.toFixed(2)}`
    selectedItemsDiv.appendChild(itemElement)
  })

  totalAmountSpan.textContent = total.toFixed(2)

  if (selectedPizzas.length > 0) {
    orderSummaryDiv.style.display = "block"
  } else {
    orderSummaryDiv.style.display = "none"
  }
}

async function handlePlaceOrder(event) {
  event.preventDefault()
  debugLog("Fazendo pedido...")

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

      showNotification("Pedido criado com sucesso! Lembre-se, para visualizar o andamento do pedido, atualize a página", "success")
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
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// --- Event Listeners e Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  // Configura event listeners para os botões do formulário de autenticação
  const loginFormElement = document.getElementById("login-form-element")
  if (loginFormElement) {
    loginFormElement.addEventListener("submit", handleLogin)
  }

  const registerFormElement = document.getElementById("register-form-element")
  if (registerFormElement) {
    registerFormElement.addEventListener("submit", handleRegister)
  }

  const loginLink = document.getElementById("show-login")
  if (loginLink) {
    loginLink.addEventListener("click", showLoginForm)
  }

  const registerLink = document.getElementById("show-register")
  if (registerLink) {
    registerLink.addEventListener("click", showRegisterForm)
  }

  const logoutButton = document.getElementById("logout-button")
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout)
  }

  // Configura event listeners para o formulário de pedido
  const placeOrderForm = document.getElementById("place-order-form")
  if (placeOrderForm) {
      placeOrderForm.addEventListener("submit", handlePlaceOrder)
  }

  // Configura event listeners para os links da sidebar
  document.querySelectorAll(".sidebar-link").forEach(link => {
      link.addEventListener("click", (e) => {
          e.preventDefault();
          const sectionId = e.currentTarget.dataset.section;
          showSection(sectionId);
      });
  });

  // Inicializa: verifica o token, carrega pizzas e tenta mostrar a seção inicial
  verifyAuthToken()
  loadPizzas()
  showSection("fazer-pedido") // Mostra a seção "Fazer Pedido" por padrão no app
})