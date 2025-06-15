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
  // CORRIGIDO: Chaves agora correspondem EXATAMENTE aos valores que chegam dos checkboxes (e da API)
  "Especial-Del-Gatito": 35.0, // Ajustado para "Especial-Del-Gatito"
  "Hawaiana": 30.0,             // Ajustado para "Hawaiana"
  margherita: 25.0,
  pepperoni: 30.0,
  calabresa: 23.0,
  "quatro-queijos": 32.0,
}

// Nomes das pizzas
const pizzaNames = {
  // CORRIGIDO: Chaves agora correspondem EXATAMENTE aos valores que chegam dos checkboxes (e da API)
  "Especial-Del-Gatito": "Especial Del Gatito", // Ajustado para "Especial-Del-Gatito"
  "Hawaiana": "Hawaiana",                         // Ajustado para "Hawaiana"
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
  // Removida a chamada direta de loadPizzas aqui, pois ela é chamada em showMainApp
  // para garantir que a autenticação e os dados do usuário estejam carregados primeiro.
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
  debugLog("showMainApp: Iniciando a interface principal do aplicativo.")
  document.getElementById("auth-screen").style.display = "none"
  document.getElementById("main-app").style.display = "block"
  // Atualiza nome do usuário no cabeçalho
  const userNameElement = document.getElementById("user-name");
  if (userNameElement) {
    userNameElement.textContent = currentUser.name;
  }
  updateCustomerDisplay()
  loadPizzas(); // Carrega as pizzas aqui, após o login/autenticação
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
  debugLog(`Mostrando seção: ${sectionId}`)
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
  debugLog("loadUserData: Tentando carregar dados do usuário...")
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
      debugLog("Pedidos ativos carregados", userOrders)
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
      debugLog("Histórico de pedidos carregado", userHistory)
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
  debugLog("Atualizando exibição dos dados do cliente.", currentUser)
  const nameElement = document.getElementById("customer-display-name");
  const phoneElement = document.getElementById("customer-display-phone");
  const addressElement = document.getElementById("customer-display-address");

  if (nameElement) nameElement.textContent = currentUser.name;
  if (phoneElement) phoneElement.textContent = currentUser.phone;
  if (addressElement) addressElement.textContent = currentUser.address;
}

// Renderização de pizzas (para a seção "Fazer Pedido")
async function loadPizzas() {
  debugLog("loadPizzas: Carregando pizzas para a seleção...")
  try {
    const { data } = await makeRequest("/api/pizzas")
    if (data.success && data.pizzas && Array.isArray(data.pizzas)) {
      const pizzaSelectionDiv = document.querySelector(".pizza-selection")
      if (pizzaSelectionDiv) {
        debugLog("loadPizzas: Pizzas recebidas da API:", data.pizzas);
        // Remove o conteúdo estático e renderiza apenas as pizzas da API
        pizzaSelectionDiv.innerHTML = data.pizzas.map(pizza => {
            debugLog(`loadPizzas: Renderizando pizza da API - ID: ${pizza.id}, Nome: ${pizza.name}, Preço: ${pizza.price}`);
            return `
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
            `;
        }).join('');

        // Adiciona event listeners APÓS a renderização
        document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
          checkbox.addEventListener("change", updateOrderSummary);
          debugLog(`loadPizzas: Adicionado listener para checkbox: ${checkbox.id}`);
        });
        updateOrderSummary(); // Atualiza o resumo inicial (se houver pizzas pré-selecionadas ou nenhuma)
      }
    } else {
      // Fallback: Se a API falhar, usa as pizzas estáticas do HTML e tenta adicionar listeners a elas
      debugLog("loadPizzas: Erro ao carregar pizzas da API. Usando pizzas estáticas do HTML.", data.error);
      document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener("change", updateOrderSummary);
        debugLog(`loadPizzas: (Fallback) Adicionado listener para checkbox: ${checkbox.id}`);
      });
      updateOrderSummary(); // Atualiza o resumo inicial com as pizzas estáticas
      showNotification(data.error || "Erro ao carregar lista de pizzas da API. Exibindo pizzas padrão.", "warning");
    }
  } catch (error) {
    debugLog("loadPizzas: Erro catastrófico ao carregar pizzas. Usando pizzas estáticas do HTML.", error);
    // Fallback: Se a requisição à API falhar completamente, usa as pizzas estáticas
    document.querySelectorAll('.pizza-item input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener("change", updateOrderSummary);
      debugLog(`loadPizzas: (Fallback Erro) Adicionado listener para checkbox: ${checkbox.id}`);
    });
    updateOrderSummary(); // Atualiza o resumo inicial com as pizzas estáticas
    showNotification(error.message || "Erro de conexão ao carregar pizzas. Exibindo pizzas padrão.", "error")
  }
}

// Função auxiliar para obter descrição da pizza
function getPizzaDescription(pizzaId) {
    // ATENÇÃO: As chaves do switch DEVEM ser exatamente iguais aos 'value' dos inputs no HTML
    // e aos IDs que vêm da API para as pizzas (se loadPizzas as sobrescrever)
    switch (pizzaId) {
        case 'margherita': return 'Molho de tomate, mussarela e manjericão';
        case 'pepperoni': return 'Molho de tomate, mussarela e pepperoni';
        case 'calabresa': return 'Molho de tomate, mussarela, calabresa e cebola';
        case 'quatro-queijos': return 'Mussarela, provolone, parmesão e gorgonzola';
        case 'Especial-Del-Gatito': return 'Molho rústico, quatro queijos, mignon, cebola caramelizada, catupiry e rúcula'; // Corrigido para "Especial-Del-Gatito"
        case 'Hawaiana': return 'Molho de tomate, mussarela, presunto e abacaxi'; // Corrigido para "Hawaiana"
        default: return 'Deliciosa pizza!';
    }
}


// Renderização de pedidos
function renderMyOrders() {
  const container = document.getElementById("my-orders-container")
  if (!container) {
    debugLog("renderMyOrders: Elemento #my-orders-container não encontrado.");
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
    debugLog("renderMyOrders: Nenhuns pedidos ativos para renderizar.");
    return
  }

  container.innerHTML = userOrders.map((order) => createOrderCard(order)).join("")
  debugLog("renderMyOrders: Pedidos ativos renderizados.", userOrders);
}

function renderMyHistory() {
  const container = document.getElementById("my-history-container")
  if (!container) {
    debugLog("renderMyHistory: Elemento #my-history-container não encontrado.");
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
    debugLog("renderMyHistory: Nenhuns pedidos no histórico para renderizar.");
    return
  }

  container.innerHTML = userHistory.map((order) => createOrderCard(order, true)).join("")
  debugLog("renderMyHistory: Histórico de pedidos renderizado.", userHistory);
}

// FUNÇÃO ATUALIZADA PARA FORMATAR OS ITENS CORRETAMENTE
function createOrderCard(order, isHistory = false) {
  const statusClass = `status-${order.status.replace(" ", "-")}` // Ajuste para status com espaço
  const statusText = getStatusText(order.status)

  // Formatar itens do pedido para exibição
  const formattedItems = Array.isArray(order.items)
    ? order.items.map((item) => {
        // Tenta encontrar a pizza pelos IDs para pegar o nome formatado e o preço
        // ATENÇÃO: 'item' aqui deve ser a string ID/chave da pizza (ex: "hawaiana", "margherita")
        const pizzaInfo = pizzaPrices[item] ? { name: pizzaNames[item], price: pizzaPrices[item] } :
                          (typeof item === 'object' && item !== null) ? item : { name: item, price: 0 }; // Fallback para objeto ou string simples
        
        return `<li>• ${pizzaInfo.name} (R$ ${parseFloat(pizzaInfo.price).toFixed(2).replace('.', ',')})</li>`;
      }).join("")
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
  debugLog("updateOrderSummary: Iniciando atualização do resumo do pedido.")
  const selectedPizzas = []
  let total = 0

  document.querySelectorAll('.pizza-item input[type="checkbox"]:checked').forEach((checkbox) => {
    const pizzaKey = checkbox.value // Pega o 'value' do input (ex: "hawaiana", "especial-del-gatito")
    debugLog(`updateOrderSummary: Checkbox marcado - ID/Value: "${pizzaKey}"`);
    // Certificar-se de que pizzaNames[pizzaKey] e pizzaPrices[pizzaKey] existem
    if (pizzaNames[pizzaKey] && pizzaPrices[pizzaKey]) {
        selectedPizzas.push({
            name: pizzaNames[pizzaKey],
            price: pizzaPrices[pizzaKey],
        })
        total += pizzaPrices[pizzaKey]
        debugLog(`updateOrderSummary: Pizza "${pizzaKey}" encontrada. Adicionando ao resumo.`);
    } else {
        // Isso vai imprimir no console do navegador se uma pizza não for encontrada
        debugLog(`updateOrderSummary: ERRO! Pizza "${pizzaKey}" NÃO encontrada em pizzaNames ou pizzaPrices. Verifique a consistência dos IDs da API e dos objetos JS.`);
    }
  })

  const summaryContainer = document.getElementById("order-summary")
  const selectedItemsContainer = document.getElementById("selected-items")
  const totalAmountElement = document.getElementById("total-amount")

  if (!summaryContainer || !selectedItemsContainer || !totalAmountElement) {
    debugLog("updateOrderSummary: Elementos de resumo de pedido não encontrados no DOM.");
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
    debugLog(`updateOrderSummary: Resumo do pedido atualizado. Total: R$ ${total.toFixed(2)}`, selectedPizzas);
  } else {
    summaryContainer.style.display = "none"
    debugLog("updateOrderSummary: Nenhuma pizza selecionada, resumo oculto.");
  }
}

// Manipulação de pedidos
async function handleNewOrder(e) {
  e.preventDefault()
  debugLog("handleNewOrder: Tentando criar novo pedido.")

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
    debugLog("handleNewOrder: Nenhuma pizza selecionada.");
    return
  }

  const token = localStorage.getItem("authToken")
  if (!token) {
    showNotification("Você precisa estar logado para fazer um pedido.", "error");
    debugLog("handleNewOrder: Token de autenticação não encontrado.");
    return;
  }

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
      debugLog("handleNewOrder: Pedido criado com sucesso!", data);
    } else {
      // Garantir que a mensagem é uma string
      showNotification(data.error || "Erro ao criar pedido", "error")
      debugLog("handleNewOrder: Erro ao criar pedido do backend.", data);
    }
  } catch (error) {
    // Garantir que a mensagem é uma string
    showNotification(error.message || "Erro de conexão", "error")
    debugLog("handleNewOrder: Erro na requisição para criar pedido.", error);
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