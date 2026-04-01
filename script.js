const form = document.getElementById("order-form");
const clienteInput = document.getElementById("cliente");
const pratoInput = document.getElementById("prato");
const mesaInput = document.getElementById("mesa");
const ordersContainer = document.getElementById("orders-container");
const filterButtons = document.querySelectorAll(".filter-btn");
const searchInput = document.getElementById("search-input");
const clearAllButton = document.getElementById("clear-all");

const totalOrders = document.getElementById("total-orders");
const totalPendente = document.getElementById("total-pendente");
const totalEmPreparo = document.getElementById("total-em-preparo");
const totalPronto = document.getElementById("total-pronto");
const totalEntregue = document.getElementById("total-entregue");

let pedidos = [];
let filtroAtual = "todos";
let termoBusca = "";

function gerarHorarioAtual() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function salvarPedidos() {
  localStorage.setItem("kitchenflow_pedidos", JSON.stringify(pedidos));
}

function carregarPedidos() {
  const dados = localStorage.getItem("kitchenflow_pedidos");

  if (dados) {
    pedidos = JSON.parse(dados);
  } else {
    pedidos = [
      {
        id: Date.now() + 1,
        cliente: "Carlos",
        prato: "Risoto de camarão",
        mesa: "Mesa 4",
        horario: "20:15",
        status: "pendente"
      },
      {
        id: Date.now() + 2,
        cliente: "Fernanda",
        prato: "Filé ao molho roti",
        mesa: "Mesa 2",
        horario: "20:18",
        status: "em preparo"
      }
    ];
    salvarPedidos();
  }
}

function proximoStatus(statusAtual) {
  if (statusAtual === "pendente") return "em preparo";
  if (statusAtual === "em preparo") return "pronto";
  if (statusAtual === "pronto") return "entregue";
  return "entregue";
}

function obterTextoBotao(statusAtual) {
  if (statusAtual === "pendente") return "Iniciar preparo";
  if (statusAtual === "em preparo") return "Marcar como pronto";
  if (statusAtual === "pronto") return "Marcar como entregue";
  return "Finalizado";
}

function gerarClasseStatus(status) {
  return status.replaceAll(" ", "-");
}

function gerarBadge(status) {
  return `badge-${gerarClasseStatus(status)}`;
}

function filtrarPedidos() {
  return pedidos.filter((pedido) => {
    const correspondeFiltro =
      filtroAtual === "todos" || pedido.status === filtroAtual;

    const textoBusca = `${pedido.cliente} ${pedido.prato}`.toLowerCase();
    const correspondeBusca = textoBusca.includes(termoBusca.toLowerCase());

    return correspondeFiltro && correspondeBusca;
  });
}

function atualizarResumo() {
  totalOrders.textContent = pedidos.length;
  totalPendente.textContent = pedidos.filter((pedido) => pedido.status === "pendente").length;
  totalEmPreparo.textContent = pedidos.filter((pedido) => pedido.status === "em preparo").length;
  totalPronto.textContent = pedidos.filter((pedido) => pedido.status === "pronto").length;
  totalEntregue.textContent = pedidos.filter((pedido) => pedido.status === "entregue").length;
}

function renderPedidos() {
  const listaFiltrada = filtrarPedidos();
  ordersContainer.innerHTML = "";

  if (listaFiltrada.length === 0) {
    ordersContainer.innerHTML = `
      <div class="empty-state">
        <p>Nenhum pedido encontrado.</p>
      </div>
    `;
    atualizarResumo();
    return;
  }

  listaFiltrada.forEach((pedido) => {
    const card = document.createElement("article");
    const classeStatus = gerarClasseStatus(pedido.status);
    const badgeClass = gerarBadge(pedido.status);

    card.className = `order-card status-${classeStatus}`;

    card.innerHTML = `
      <h3>${pedido.prato}</h3>
      <span class="badge ${badgeClass}">${pedido.status}</span>
      <div class="order-meta">
        <p><strong>Cliente:</strong> ${pedido.cliente}</p>
        <p><strong>Local:</strong> ${pedido.mesa}</p>
        <p><strong>Horário:</strong> ${pedido.horario}</p>
      </div>
      <div class="order-actions">
        <button
          class="btn-status"
          onclick="mudarStatus(${pedido.id})"
          ${pedido.status === "entregue" ? "disabled" : ""}
        >
          ${obterTextoBotao(pedido.status)}
        </button>

        <button
          class="btn-delete"
          onclick="removerPedido(${pedido.id})"
        >
          Excluir
        </button>
      </div>
    `;

    ordersContainer.appendChild(card);
  });

  atualizarResumo();
}

function adicionarPedido(event) {
  event.preventDefault();

  const cliente = clienteInput.value.trim();
  const prato = pratoInput.value.trim();
  const mesa = mesaInput.value.trim();

  if (!cliente || !prato || !mesa) {
    alert("Preencha todos os campos.");
    return;
  }

  const novoPedido = {
    id: Date.now(),
    cliente,
    prato,
    mesa,
    horario: gerarHorarioAtual(),
    status: "pendente"
  };

  pedidos.unshift(novoPedido);
  salvarPedidos();
  renderPedidos();
  form.reset();
  clienteInput.focus();
}

function mudarStatus(id) {
  pedidos = pedidos.map((pedido) => {
    if (pedido.id === id) {
      return {
        ...pedido,
        status: proximoStatus(pedido.status)
      };
    }
    return pedido;
  });

  salvarPedidos();
  renderPedidos();
}

function removerPedido(id) {
  const confirmar = confirm("Deseja realmente excluir este pedido?");
  if (!confirmar) return;

  pedidos = pedidos.filter((pedido) => pedido.id !== id);
  salvarPedidos();
  renderPedidos();
}

function limparTudo() {
  if (pedidos.length === 0) {
    alert("Não há pedidos para remover.");
    return;
  }

  const confirmar = confirm("Deseja apagar todos os pedidos?");
  if (!confirmar) return;

  pedidos = [];
  salvarPedidos();
  renderPedidos();
}

function aplicarFiltro(event) {
  filtroAtual = event.target.dataset.filter;

  filterButtons.forEach((button) => {
    button.classList.remove("active");
  });

  event.target.classList.add("active");
  renderPedidos();
}

function buscarPedidos(event) {
  termoBusca = event.target.value;
  renderPedidos();
}

form.addEventListener("submit", adicionarPedido);
clearAllButton.addEventListener("click", limparTudo);
searchInput.addEventListener("input", buscarPedidos);

filterButtons.forEach((button) => {
  button.addEventListener("click", aplicarFiltro);
});

carregarPedidos();
renderPedidos();