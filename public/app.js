const API = "http://localhost:3000";

// ===============================
// ESTADO GLOBAL DO FRONTEND
// ===============================
let INSUMOS = [];
let ITENS_FICHA = [];
let PRATOS = [];
let VENDAS = [];
let CMVS_PRATOS = [];
let MESAS = [];
let COMANDAS = [];
let COMANDA_ATUAL = null;

// ===============================
// REFERÊNCIAS DA TELA DE INSUMOS
// ===============================
const formInsumo = document.getElementById("form-insumo");
const listaInsumos = document.getElementById("lista-insumos");
const resumoCategorias = document.getElementById("resumo-categorias");
const inputNomeInsumo = document.getElementById("insumo-nome");

// ===============================
// REFERÊNCIAS DA TELA DE FICHA
// ===============================
const selectInsumo = document.getElementById("select-insumo");
const inputQtdInsumo = document.getElementById("qtd-insumo");
const itensFicha = document.getElementById("itens-ficha");
const inputFichaNome = document.getElementById("ficha-nome");
const inputFichaRendimento = document.getElementById("ficha-rendimento");
const inputFichaCmv = document.getElementById("ficha-cmv");
const inputFichaPreco = document.getElementById("ficha-preco");
const custoTotalEl = document.getElementById("custo-total");
const precoSugeridoEl = document.getElementById("preco-sugerido");

// ===============================
// REFERÊNCIAS DA TELA DE VENDAS
// ===============================
const selectPratoVenda = document.getElementById("select-prato-venda");
const inputVendaQuantidade = document.getElementById("venda-quantidade");
const inputVendaPreco = document.getElementById("venda-preco");
const inputVendaObservacao = document.getElementById("venda-observacao");
const listaVendas = document.getElementById("lista-vendas");
const resumoVendas = document.getElementById("resumo-vendas");
const statusVenda = document.getElementById("status-venda");

// ===============================
// REFERÊNCIAS DA CAMADA 2.1
// CMV POR PRATO
// ===============================
const listaCmvsPratos = document.getElementById("lista-cmvs-pratos");

// ===============================
// REFERÊNCIA DA ÁREA DE ALERTAS
// ===============================
const alertArea = document.getElementById("alert-area");

// ===============================
// REFERÊNCIAS DAS NOVAS TELAS
// OPERAÇÃO
// ===============================
const inputMesaNumero = document.getElementById("mesa-numero");
const inputMesaLugares = document.getElementById("mesa-lugares");
const inputMesaDescricao = document.getElementById("mesa-descricao");
const resumoMesas = document.getElementById("resumo-mesas");
const listaMesasOperacao = document.getElementById("lista-mesas-operacao");

const comandaAtualInfo = document.getElementById("comanda-atual-info");
const selectComandaPrato = document.getElementById("comanda-prato");
const inputComandaQuantidade = document.getElementById("comanda-quantidade");
const inputComandaObservacao = document.getElementById("comanda-observacao");
const listaItensComanda = document.getElementById("lista-itens-comanda");

const painelCozinha = document.getElementById("painel-cozinha");

// ===============================
// ALERTA SIMPLES
// ===============================
function showAlert(msg) {
  alert(msg);
}

// ===============================
// FORMATAÇÃO DE MOEDA
// ===============================
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// ===============================
// FORMATAÇÃO DE NÚMERO
// ===============================
function formatarNumero(valor, casas = 3) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  });
}

// ===============================
// NORMALIZAÇÃO DE TEXTO
// ===============================
function normalizarNomeInsumo(texto) {
  return String(texto || "")
    .trim()
    .replace(/\s+/g, " ");
}

// ===============================
// VERIFICAR SE CAMPO É ELEGÍVEL
// PARA CORREÇÃO ORTOGRÁFICA
// ===============================
function campoElegivelParaCorrecao(campo) {
  if (!campo) return false;

  const tag = (campo.tagName || "").toLowerCase();
  const tipo = (campo.type || "").toLowerCase();

  if (campo.disabled || campo.readOnly) {
    return false;
  }

  if (campo.dataset.semCorrecaoOrtografica === "true") {
    return false;
  }

  if (tag === "textarea") {
    return true;
  }

  if (tag !== "input") {
    return false;
  }

  const tiposPermitidos = ["text", "search", "email"];

  return tiposPermitidos.includes(tipo);
}

// ===============================
// CORREÇÃO ORTOGRÁFICA VIA LANGUAGETOOL
// ===============================
async function corrigirNomeComLanguageTool(textoOriginal) {
  const texto = normalizarNomeInsumo(textoOriginal);

  if (!texto) {
    return texto;
  }

  try {
    const resposta = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: new URLSearchParams({
        text: texto,
        language: "pt-BR"
      })
    });

    if (!resposta.ok) {
      throw new Error("Falha ao consultar o LanguageTool");
    }

    const dados = await resposta.json();

    if (!dados.matches || !Array.isArray(dados.matches) || dados.matches.length === 0) {
      return texto;
    }

    const matchesOrdenados = [...dados.matches].sort((a, b) => b.offset - a.offset);

    let textoCorrigido = texto;

    matchesOrdenados.forEach((match) => {
      if (
        !match ||
        !Array.isArray(match.replacements) ||
        match.replacements.length === 0
      ) {
        return;
      }

      const melhorSugestao = match.replacements[0]?.value;

      if (!melhorSugestao) {
        return;
      }

      const inicio = Number(match.offset || 0);
      const tamanho = Number(match.length || 0);

      textoCorrigido =
        textoCorrigido.slice(0, inicio) +
        melhorSugestao +
        textoCorrigido.slice(inicio + tamanho);
    });

    return normalizarNomeInsumo(textoCorrigido);
  } catch (error) {
    console.error("Erro na correção ortográfica:", error);
    return texto;
  }
}

// ===============================
// APLICAR CORREÇÃO EM UM CAMPO
// ===============================
async function aplicarCorrecaoNoCampo(campo) {
  if (!campoElegivelParaCorrecao(campo)) {
    return;
  }

  const valorAtual = normalizarNomeInsumo(campo.value);

  if (!valorAtual) {
    return;
  }

  if (campo.dataset.corrigindoOrtografia === "true") {
    return;
  }

  campo.dataset.corrigindoOrtografia = "true";

  try {
    const valorCorrigido = await corrigirNomeComLanguageTool(valorAtual);
    campo.value = valorCorrigido;
  } finally {
    campo.dataset.corrigindoOrtografia = "false";
  }
}

// ===============================
// ATIVAR CORREÇÃO ORTOGRÁFICA GLOBAL
// POR DELEGAÇÃO DE EVENTO
// ===============================
function ativarCorrecaoOrtograficaGlobal() {
  if (document.body.dataset.correcaoOrtograficaGlobalAtiva === "true") {
    return;
  }

  document.addEventListener(
    "focusout",
    async (event) => {
      const campo = event.target;

      if (!campoElegivelParaCorrecao(campo)) {
        return;
      }

      await aplicarCorrecaoNoCampo(campo);
    },
    true
  );

  document.body.dataset.correcaoOrtograficaGlobalAtiva = "true";
}
// ===============================
// ALERTAS VISUAIS NO TOPO
// ===============================
function limparAlertasVisuais() {
  if (!alertArea) return;
  alertArea.innerHTML = "";
}

function renderizarBlocoAlerta({ titulo, itens, corFundo, corBorda, corTexto }) {
  if (!alertArea || !Array.isArray(itens) || itens.length === 0) return "";

  const listaHtml = itens.map((item) => `<div>${item}</div>`).join("");

  return `
    <div
      style="
        background:${corFundo};
        border:1px solid ${corBorda};
        color:${corTexto};
        padding:12px;
        border-radius:10px;
        margin-bottom:10px;
      "
    >
      <strong>${titulo}</strong>
      <div style="margin-top:8px;">
        ${listaHtml}
      </div>
    </div>
  `;
}

// ===============================
// CAMADA 1
// ALERTA DE ESTOQUE BAIXO
// ===============================
function verificarEstoqueBaixo() {
  if (!alertArea) return;
  if (!Array.isArray(INSUMOS) || INSUMOS.length === 0) {
    limparAlertasVisuais();
    return;
  }

  const insumosZerados = [];
  const insumosBaixos = [];

  INSUMOS.forEach((insumo) => {
    const quantidade = Number(insumo.quantidade || 0);
    const unidade = insumo.unidade || "";
    const nome = insumo.nome || "Insumo sem nome";

    if (quantidade <= 0) {
      insumosZerados.push(`${nome} — saldo: ${formatarNumero(quantidade)} ${unidade}`);
      return;
    }

    if (quantidade <= 3) {
      insumosBaixos.push(`${nome} — saldo: ${formatarNumero(quantidade)} ${unidade}`);
    }
  });

  let html = "";

  if (insumosZerados.length > 0) {
    html += renderizarBlocoAlerta({
      titulo: "Estoque zerado",
      itens: insumosZerados,
      corFundo: "#fef2f2",
      corBorda: "#fecaca",
      corTexto: "#991b1b"
    });
  }

  if (insumosBaixos.length > 0) {
    html += renderizarBlocoAlerta({
      titulo: "Estoque baixo",
      itens: insumosBaixos,
      corFundo: "#fffbeb",
      corBorda: "#fde68a",
      corTexto: "#92400e"
    });
  }

  alertArea.innerHTML = html;
}

window.verificarEstoqueBaixo = verificarEstoqueBaixo;

// ===============================
// HELPERS DE STATUS DE CMV
// ===============================
function obterStatusCmvVisual(cmv) {
  const valor = Number(cmv || 0);

  if (valor <= 30) {
    return {
      texto: "OK",
      cor: "#166534"
    };
  }

  if (valor <= 35) {
    return {
      texto: "Atenção",
      cor: "#92400e"
    };
  }

  return {
    texto: "Alerta",
    cor: "#991b1b"
  };
}

// ===============================
// CORRIGIR NOME DO INSUMO AO SAIR DO CAMPO
// ===============================
if (inputNomeInsumo) {
  inputNomeInsumo.addEventListener("blur", async () => {
    const valorAtual = normalizarNomeInsumo(inputNomeInsumo.value);

    if (!valorAtual) return;

    const textoCorrigido = await corrigirNomeComLanguageTool(valorAtual);
    inputNomeInsumo.value = textoCorrigido;
  });
}

// ===============================
// TROCA DE TELAS
// ===============================
function trocarTela(tela) {
  const telaInsumos = document.getElementById("tela-insumos");
  const telaFicha = document.getElementById("tela-ficha");
  const telaVendas = document.getElementById("tela-vendas");
  const telaMesas = document.getElementById("tela-mesas");
  const telaComandas = document.getElementById("tela-comandas");
  const telaCozinha = document.getElementById("tela-cozinha");

  if (telaInsumos) telaInsumos.style.display = "none";
  if (telaFicha) telaFicha.style.display = "none";
  if (telaVendas) telaVendas.style.display = "none";
  if (telaMesas) telaMesas.style.display = "none";
  if (telaComandas) telaComandas.style.display = "none";
  if (telaCozinha) telaCozinha.style.display = "none";

  if (tela === "insumos" && telaInsumos) {
    telaInsumos.style.display = "block";
  }

  if (tela === "ficha" && telaFicha) {
    telaFicha.style.display = "block";
  }

 if (tela === "vendas" && telaVendas) {
  telaVendas.style.display = "block";
  carregarPratos();
  carregarPratosSimulador();
  carregarResumoVendas();
  carregarVendas();
  carregarCmvsPratos();
  carregarDashboardFinanceiro();
}
  if (tela === "mesas" && telaMesas) {
    telaMesas.style.display = "block";
    carregarMesas();
  }

  if (tela === "comandas" && telaComandas) {
    telaComandas.style.display = "block";
    carregarPratos();
    preencherSelectDePratosNaComanda();
    renderizarComandaAtual();
    carregarListaComandas();
  }

  if (tela === "cozinha" && telaCozinha) {
    telaCozinha.style.display = "block";
    carregarPainelCozinha();
  }
}

window.trocarTela = trocarTela;

// ===============================
// HELPERS DE REQUISIÇÃO
// ===============================
async function fetchJson(url, options = {}) {
  const resposta = await fetch(url, options);

  let dados = null;

  try {
    dados = await resposta.json();
  } catch (_) {
    dados = null;
  }

  if (!resposta.ok) {
    const mensagemErro =
      dados && dados.erro
        ? dados.erro
        : dados && dados.mensagem
        ? dados.mensagem
        : `Erro na requisição para ${url}`;

    throw new Error(mensagemErro);
  }

  return dados;
}

// ===============================
// CARREGAR INSUMOS DO BACKEND
// ===============================
async function carregarInsumos() {
  try {
    const resposta = await fetch(`${API}/insumos`);

    if (!resposta.ok) {
      throw new Error("Erro ao carregar insumos");
    }

    INSUMOS = await resposta.json();

    renderizarTabelaInsumos();
    renderizarResumoCategorias();
    preencherSelectDeInsumosNaFicha();
    verificarEstoqueBaixo();
  } catch (error) {
    console.error("Erro ao carregar insumos:", error);

    if (listaInsumos) {
      listaInsumos.innerHTML = `
        <tr>
          <td colspan="6">Erro ao carregar insumos.</td>
        </tr>
      `;
    }

    if (resumoCategorias) {
      resumoCategorias.innerHTML = `
        <tr>
          <td colspan="2">Erro ao carregar resumo.</td>
        </tr>
      `;
    }

    limparAlertasVisuais();
  }
}
// ===============================
// RENDERIZAR TABELA DE INSUMOS
// ===============================
function renderizarTabelaInsumos() {
  if (!listaInsumos) return;

  listaInsumos.innerHTML = "";

  if (!INSUMOS.length) {
    listaInsumos.innerHTML = `
      <tr>
        <td colspan="6">Nenhum insumo cadastrado.</td>
      </tr>
    `;
    return;
  }

  INSUMOS.forEach((insumo) => {
    const quantidade = Number(insumo.quantidade || 0);
    const custo = Number(insumo.custo || 0);
    const custoUnitario = quantidade > 0 ? custo / quantidade : 0;

    listaInsumos.innerHTML += `
      <tr>
        <td>${insumo.categoria || "-"}</td>
        <td>${insumo.nome || "-"}</td>
        <td>${quantidade}</td>
        <td>${formatarMoeda(custo)}</td>
        <td>${formatarMoeda(custoUnitario)}</td>
        <td>
          <button class="btn btn-secondary" onclick="excluirInsumo(${insumo.id})">
            Excluir
          </button>
        </td>
      </tr>
    `;
  });
}

// ===============================
// RENDERIZAR RESUMO POR CATEGORIA
// ===============================
function renderizarResumoCategorias() {
  if (!resumoCategorias) return;

  resumoCategorias.innerHTML = "";

  if (!INSUMOS.length) {
    resumoCategorias.innerHTML = `
      <tr>
        <td colspan="2">Nenhum dado encontrado.</td>
      </tr>
    `;
    return;
  }

  const grupos = {};

  INSUMOS.forEach((insumo) => {
    const categoria = insumo.categoria || "Sem categoria";
    const custo = Number(insumo.custo || 0);

    if (!grupos[categoria]) {
      grupos[categoria] = 0;
    }

    grupos[categoria] += custo;
  });

  Object.keys(grupos).forEach((categoria) => {
    resumoCategorias.innerHTML += `
      <tr>
        <td>${categoria}</td>
        <td>${formatarMoeda(grupos[categoria])}</td>
      </tr>
    `;
  });
}

// ===============================
// CADASTRAR INSUMO
// ===============================
if (formInsumo) {
  formInsumo.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nomeOriginal = inputNomeInsumo.value;
    const nomeCorrigido = await corrigirNomeComLanguageTool(nomeOriginal);

    inputNomeInsumo.value = nomeCorrigido;

    const body = {
      nome: nomeCorrigido,
      categoria: document.getElementById("insumo-categoria").value,
      unidade: document.getElementById("insumo-unidade").value,
      quantidade: parseFloat(document.getElementById("insumo-quantidade").value),
      custo: parseFloat(document.getElementById("insumo-custo").value),
      observacao: document.getElementById("insumo-observacao").value.trim()
    };

    await fetchJson(`${API}/insumos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    formInsumo.reset();
    showAlert("Insumo cadastrado com sucesso");
    carregarInsumos();
  });
}

// ===============================
// EXCLUIR INSUMO
// ===============================
async function excluirInsumo(id) {
  await fetchJson(`${API}/insumos/${id}`, { method: "DELETE" });
  showAlert("Insumo excluído");
  carregarInsumos();
}

window.excluirInsumo = excluirInsumo;

// ===============================
// PREENCHER SELECT DE INSUMOS
// ===============================
function preencherSelectDeInsumosNaFicha() {
  if (!selectInsumo) return;

  selectInsumo.innerHTML = `<option value="">Selecionar insumo</option>`;

  INSUMOS.forEach((insumo) => {
    selectInsumo.innerHTML += `
      <option value="${insumo.id}">
        ${insumo.nome}
      </option>
    `;
  });
}

// ===============================
// ADICIONAR ITEM NA FICHA
// ===============================
function addItem() {
  const insumoId = Number(selectInsumo.value);
  const quantidade = Number(inputQtdInsumo.value);

  if (!insumoId || quantidade <= 0) {
    showAlert("Preencha corretamente");
    return;
  }

  const insumo = INSUMOS.find(i => i.id === insumoId);

  ITENS_FICHA.push({
    insumo_id: insumo.id,
    nome: insumo.nome,
    quantidade_usada: quantidade,
    custo_item: (insumo.custo / insumo.quantidade) * quantidade
  });

  renderizarItensDaFicha();
  atualizarResumoDaFicha();
}

window.addItem = addItem;

// ===============================
// RENDERIZAR ITENS DA FICHA
// ===============================
function renderizarItensDaFicha() {
  if (!itensFicha) return;

  itensFicha.innerHTML = "";

  if (!ITENS_FICHA.length) {
    itensFicha.innerHTML = `
      <tr>
        <td colspan="4">Nenhum item adicionado à ficha.</td>
      </tr>
    `;
    return;
  }

  ITENS_FICHA.forEach((item) => {
    itensFicha.innerHTML += `
      <tr>
        <td>${item.nome}</td>
        <td>${item.quantidade_usada}</td>
        <td>${formatarMoeda(item.custo_item)}</td>
        <td>-</td>
      </tr>
    `;
  });
}

// ===============================
// CALCULAR CUSTO TOTAL DA FICHA
// ===============================
function calcularCustoTotalFicha() {
  return ITENS_FICHA.reduce((total, item) => total + Number(item.custo_item || 0), 0);
}

// ===============================
// CALCULAR PREÇO SUGERIDO
// ===============================
function calcularPrecoSugerido(custoTotal, cmv) {
  const cmvNumero = Number(cmv || 0);

  if (!cmvNumero || cmvNumero <= 0) {
    return 0;
  }

  return custoTotal / (cmvNumero / 100);
}

// ===============================
// ATUALIZAR RESUMO DA FICHA
// ===============================
function atualizarResumoDaFicha() {
  if (!custoTotalEl || !precoSugeridoEl) return;

  const custoTotal = calcularCustoTotalFicha();
  const cmv = inputFichaCmv ? Number(inputFichaCmv.value || 0) : 0;
  const precoSugerido = calcularPrecoSugerido(custoTotal, cmv);

  custoTotalEl.innerText = `Custo: ${formatarMoeda(custoTotal)}`;
  precoSugeridoEl.innerText = `Preço sugerido: ${formatarMoeda(precoSugerido)}`;
}

if (inputFichaCmv) {
  inputFichaCmv.addEventListener("input", atualizarResumoDaFicha);
}

if (inputFichaPreco) {
  inputFichaPreco.addEventListener("input", atualizarResumoDaFicha);
}

// ===============================
// LIMPAR FICHA
// ===============================
function limparFichaAtual() {
  ITENS_FICHA = [];

  if (inputFichaNome) inputFichaNome.value = "";
  if (inputFichaRendimento) inputFichaRendimento.value = "";
  if (inputFichaCmv) inputFichaCmv.value = "";
  if (inputFichaPreco) inputFichaPreco.value = "";
  if (inputQtdInsumo) inputQtdInsumo.value = "";
  if (selectInsumo) selectInsumo.value = "";

  renderizarItensDaFicha();
  atualizarResumoDaFicha();
}

window.limparFichaAtual = limparFichaAtual;

// ===============================
// SALVAR FICHA
// ===============================
async function salvarFicha() {
  try {
    const nome = inputFichaNome ? inputFichaNome.value.trim() : "";
    const rendimento = inputFichaRendimento ? Number(inputFichaRendimento.value || 0) : 0;
    const cmv = inputFichaCmv ? Number(inputFichaCmv.value || 0) : 0;
    const precoPraticado = inputFichaPreco ? Number(inputFichaPreco.value || 0) : 0;

    if (!nome) {
      showAlert("Informe o nome da ficha");
      return;
    }

    if (ITENS_FICHA.length === 0) {
      showAlert("Adicione pelo menos um item na ficha");
      return;
    }

    const payload = {
      nome,
      rendimento,
      descricao: "",
      cmv,
      preco_praticado: precoPraticado,
      itens: ITENS_FICHA.map((item) => ({
        insumo_id: item.insumo_id,
        quantidade_usada: item.quantidade_usada
      }))
    };

    await fetchJson(`${API}/fichas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    showAlert("Ficha salva com sucesso");
    limparFichaAtual();
  } catch (error) {
    console.error("Erro ao salvar ficha:", error);
    showAlert(error.message || "Não foi possível salvar a ficha");
  }
}

window.salvarFicha = salvarFicha;

// ===============================
// CARREGAR PRATOS
// ===============================
async function carregarPratos() {
  try {
    const resposta = await fetchJson(`${API}/pratos`);
    PRATOS = Array.isArray(resposta?.pratos)
      ? resposta.pratos
      : Array.isArray(resposta)
      ? resposta
      : [];

    preencherSelectDePratos();
    preencherSelectDePratosNaComanda();

    if (PRATOS.length === 0) {
      atualizarStatusVenda("Nenhum prato cadastrado.", "alerta");
    } else {
      atualizarStatusVenda("Pratos carregados com sucesso.", "ok");
    }
  } catch (error) {
    console.error("Erro ao carregar pratos:", error);
    atualizarStatusVenda("Erro ao carregar pratos.", "erro");

    if (selectPratoVenda) {
      selectPratoVenda.innerHTML = `<option value="">Erro ao carregar pratos</option>`;
    }

    if (selectComandaPrato) {
      selectComandaPrato.innerHTML = `<option value="">Erro ao carregar pratos</option>`;
    }
  }
}

// ===============================
// PREENCHER SELECT DE PRATOS
// ===============================
function preencherSelectDePratos() {
  if (!selectPratoVenda) return;

  selectPratoVenda.innerHTML = `<option value="">Selecione um prato</option>`;

  if (!PRATOS.length) {
    return;
  }

  PRATOS.forEach((prato) => {
    const precoVenda = Number(prato.preco_venda || 0);
    const indisponivel = prato.disponivel_para_venda === false;
    const rotuloIndisponivel = indisponivel ? " | INDISPONÍVEL" : "";

    selectPratoVenda.innerHTML += `
      <option value="${prato.id}" ${indisponivel ? "disabled" : ""}>
        ${prato.nome || "Sem nome"}${precoVenda > 0 ? ` | ${formatarMoeda(precoVenda)}` : ""}${rotuloIndisponivel}
      </option>
    `;
  });
}

if (selectPratoVenda) {
  selectPratoVenda.addEventListener("change", () => {
    const pratoId = Number(selectPratoVenda.value);

    if (!pratoId || !inputVendaPreco) return;

    const prato = PRATOS.find((item) => item.id === pratoId);
    if (!prato) return;

    const precoVenda = Number(prato.preco_venda || 0);
    if (precoVenda > 0) {
      inputVendaPreco.value = precoVenda.toFixed(2);
    }
  });
}

// ===============================
// STATUS DA VENDA
// ===============================
function atualizarStatusVenda(mensagem, tipo = "neutro") {
  if (!statusVenda) return;

  let cor = "#6b7280";
  if (tipo === "ok") cor = "#166534";
  if (tipo === "alerta") cor = "#92400e";
  if (tipo === "erro") cor = "#991b1b";

  statusVenda.innerHTML = `
    <div style="padding:10px; border-radius:10px; background:#f9fafb; color:${cor}; border:1px solid #e5e7eb;">
      ${mensagem}
    </div>
  `;
}

// ===============================
// REGISTRAR VENDA
// ===============================
async function registrarVenda() {
  try {
    if (!selectPratoVenda || !inputVendaQuantidade || !inputVendaPreco) {
      showAlert("Tela de vendas ainda não está disponível no HTML.");
      return;
    }

    const pratoId = Number(selectPratoVenda.value);
    const quantidade = Number(inputVendaQuantidade.value);
    const precoUnitario = Number(inputVendaPreco.value);
    const observacao = inputVendaObservacao ? inputVendaObservacao.value.trim() : "";

    if (!pratoId) {
      showAlert("Selecione um prato");
      return;
    }

    if (!quantidade || quantidade <= 0) {
      showAlert("Informe uma quantidade válida");
      return;
    }

    if (!precoUnitario || precoUnitario <= 0) {
      showAlert("Informe um preço unitário válido");
      return;
    }

    atualizarStatusVenda("Registrando venda...", "alerta");

    const payload = {
      prato_id: pratoId,
      quantidade,
      preco_unitario: precoUnitario,
      observacao
    };

    await fetchJson(`${API}/vendas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (inputVendaQuantidade) inputVendaQuantidade.value = "";
    if (inputVendaPreco) inputVendaPreco.value = "";
    if (inputVendaObservacao) inputVendaObservacao.value = "";
    if (selectPratoVenda) selectPratoVenda.value = "";

    atualizarStatusVenda("Venda registrada com sucesso.", "ok");
    showAlert("Venda registrada com sucesso");

    await carregarVendas();
    await carregarResumoVendas();
    await carregarInsumos();
    await carregarCmvsPratos();
    await carregarPratos();
    await carregarMesas();
    await carregarPainelCozinha();
    await carregarDashboardFinanceiro();
  } catch (error) {
    console.error("Erro ao registrar venda:", error);
    atualizarStatusVenda(error.message || "Erro ao registrar venda.", "erro");
    showAlert(error.message || "Não foi possível registrar a venda");
  }
}

window.registrarVenda = registrarVenda;

// ===============================
// RESUMO DE VENDAS
// ===============================
async function carregarResumoVendas() {
  if (!resumoVendas) return;

  try {
    const dados = await fetchJson(`${API}/vendas/resumo`);

    resumoVendas.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Total de vendas</span>
          <strong>${Number(dados.total_vendas || 0)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Pratos vendidos</span>
          <strong>${Number(dados.total_pratos_vendidos || 0)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Faturamento</span>
          <strong>${formatarMoeda(dados.faturamento_total || 0)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Custo total</span>
          <strong>${formatarMoeda(dados.custo_total || 0)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Lucro bruto</span>
          <strong>${formatarMoeda(dados.lucro_total || 0)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">CMV médio</span>
          <strong>${formatarNumero(dados.cmv_medio || 0, 2)}%</strong>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Erro ao carregar resumo de vendas:", error);
    resumoVendas.innerHTML = `
      <div style="color:#991b1b;">
        Não foi possível carregar o resumo de vendas.
      </div>
    `;
  }
}

// ===============================
// CARREGAR VENDAS
// ===============================
async function carregarVendas() {
  if (!listaVendas) return;

  try {
    VENDAS = await fetchJson(`${API}/vendas`);
    renderizarListaVendas();
  } catch (error) {
    console.error("Erro ao carregar vendas:", error);
    listaVendas.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar vendas.</td>
      </tr>
    `;
  }
}

// ===============================
// RENDERIZAR VENDAS
// ===============================
function renderizarListaVendas() {
  if (!listaVendas) return;

  listaVendas.innerHTML = "";

  if (!VENDAS.length) {
    listaVendas.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma venda registrada.</td>
      </tr>
    `;
    return;
  }

  VENDAS.forEach((venda) => {
    const cmv = Number(venda.cmv_percentual || 0);

    let estiloCMV = "";
    if (cmv <= 30) {
      estiloCMV = `style="color:#166534; font-weight:bold;"`;
    } else if (cmv <= 35) {
      estiloCMV = `style="color:#92400e; font-weight:bold;"`;
    } else {
      estiloCMV = `style="color:#991b1b; font-weight:bold;"`;
    }

    listaVendas.innerHTML += `
      <tr>
        <td>${venda.nome_prato || "-"}</td>
        <td>${Number(venda.quantidade || 0)}</td>
        <td>${formatarMoeda(venda.preco_unitario || 0)}</td>
        <td>${formatarMoeda(venda.faturamento_total || 0)}</td>
        <td>${formatarMoeda(venda.custo_total || 0)}</td>
        <td ${estiloCMV}>${formatarNumero(cmv, 2)}%</td>
        <td>${formatarMoeda(venda.lucro_bruto || 0)}</td>
      </tr>
    `;
  });
}

// ===============================
// CMV POR PRATO
// ===============================
async function carregarCmvsPratos() {
  if (!listaCmvsPratos) return;

  try {
    CMVS_PRATOS = await fetchJson(`${API}/vendas/cmvs`);
    renderizarListaCmvsPratos();
  } catch (error) {
    console.error("Erro ao carregar CMV por prato:", error);
    listaCmvsPratos.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar análise de CMV por prato.</td>
      </tr>
    `;
  }
}

function renderizarListaCmvsPratos() {
  if (!listaCmvsPratos) return;

  listaCmvsPratos.innerHTML = "";

  if (!Array.isArray(CMVS_PRATOS) || CMVS_PRATOS.length === 0) {
    listaCmvsPratos.innerHTML = `
      <tr>
        <td colspan="7">Nenhum dado de CMV por prato encontrado.</td>
      </tr>
    `;
    return;
  }

  CMVS_PRATOS.forEach((item) => {
    const status = obterStatusCmvVisual(item.cmv_percentual);

    listaCmvsPratos.innerHTML += `
      <tr>
        <td>${item.nome_prato || "-"}</td>
        <td>${Number(item.quantidade_vendida || 0)}</td>
        <td>${formatarMoeda(item.faturamento_total || 0)}</td>
        <td>${formatarMoeda(item.custo_total || 0)}</td>
        <td style="color:${status.cor}; font-weight:bold;">
          ${formatarNumero(item.cmv_percentual || 0, 2)}%
        </td>
        <td>${formatarMoeda(item.lucro_total || 0)}</td>
        <td style="color:${status.cor}; font-weight:bold;">
          ${status.texto}
        </td>
      </tr>
    `;
  });
}

// ===============================
// OPERAÇÃO
// CRIAR MESA
// ===============================
async function criarMesa() {
  try {
    if (!inputMesaNumero) {
      showAlert("Tela de mesas não encontrada.");
      return;
    }

    const payload = {
      numero: inputMesaNumero.value.trim(),
      lugares: Number(inputMesaLugares?.value || 0),
      descricao: inputMesaDescricao?.value.trim() || "",
      status: "livre"
    };

    if (!payload.numero) {
      showAlert("Informe o número da mesa.");
      return;
    }

    await fetchJson(`${API}/mesas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (inputMesaNumero) inputMesaNumero.value = "";
    if (inputMesaLugares) inputMesaLugares.value = "";
    if (inputMesaDescricao) inputMesaDescricao.value = "";

    showAlert("Mesa criada com sucesso.");
    await carregarMesas();
  } catch (error) {
    console.error("Erro ao criar mesa:", error);
    showAlert(error.message || "Não foi possível criar a mesa.");
  }
}

window.criarMesa = criarMesa;

// ===============================
// OPERAÇÃO
// CARREGAR MESAS
// ===============================
async function carregarMesas() {
  try {
    const resposta = await fetchJson(`${API}/mesas`);
    MESAS = Array.isArray(resposta?.mesas) ? resposta.mesas : [];

    renderizarResumoMesas();
    renderizarMesasOperacao();
  } catch (error) {
    console.error("Erro ao carregar mesas:", error);

    if (resumoMesas) {
      resumoMesas.innerHTML = `<p>Erro ao carregar resumo das mesas.</p>`;
    }

    if (listaMesasOperacao) {
      listaMesasOperacao.innerHTML = `<p>Erro ao carregar mesas.</p>`;
    }
  }
}

// ===============================
// OPERAÇÃO
// RENDERIZAR RESUMO DAS MESAS
// ===============================
function renderizarResumoMesas() {
  if (!resumoMesas) return;

  const livres = MESAS.filter((mesa) => mesa.status === "livre").length;
  const ocupadas = MESAS.filter((mesa) => mesa.status === "ocupada").length;
  const reservadas = MESAS.filter((mesa) => mesa.status === "reservada").length;
  const inativas = MESAS.filter((mesa) => mesa.status === "inativa").length;

  resumoMesas.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">Total de mesas</span>
        <strong>${MESAS.length}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Livres</span>
        <strong>${livres}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Ocupadas</span>
        <strong>${ocupadas}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Reservadas</span>
        <strong>${reservadas}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Inativas</span>
        <strong>${inativas}</strong>
      </div>
    </div>
  `;
}

// ===============================
// OPERAÇÃO
// RENDERIZAR MAPA DE MESAS
// ===============================
function renderizarMesasOperacao() {
  if (!listaMesasOperacao) return;

  listaMesasOperacao.innerHTML = "";

  if (!MESAS.length) {
    listaMesasOperacao.innerHTML = `<p>Nenhuma mesa cadastrada.</p>`;
    return;
  }

  MESAS.forEach((mesa) => {
    let corStatus = "#6b7280";

    if (mesa.status === "livre") corStatus = "#166534";
    if (mesa.status === "ocupada") corStatus = "#991b1b";
    if (mesa.status === "reservada") corStatus = "#92400e";
    if (mesa.status === "inativa") corStatus = "#374151";

    listaMesasOperacao.innerHTML += `
      <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>Mesa ${mesa.numero}</strong><br/>
            <span>Lugares: ${Number(mesa.lugares || 0)}</span><br/>
            <span>Descrição: ${mesa.descricao || "-"}</span><br/>
            <span style="color:${corStatus}; font-weight:bold;">Status: ${mesa.status || "-"}</span>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${
              mesa.comanda_aberta_id
                ? `
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onclick="abrirComandaExistente(${mesa.comanda_aberta_id})"
                  >
                    Ver Comanda
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="btn btn-primary"
                    onclick="abrirComandaMesa(${mesa.id})"
                  >
                    Abrir Comanda
                  </button>
                `
            }
          </div>
        </div>
      </div>
    `;
  });
}

// ===============================
// OPERAÇÃO
// ABRIR COMANDA PARA MESA
// ===============================
async function abrirComandaMesa(mesaId) {
  try {
    const dados = await fetchJson(`${API}/comandas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mesa_id: mesaId,
        origem: "salao",
        cliente_nome: "",
        observacao: ""
      })
    });

    showAlert("Comanda aberta com sucesso.");

    COMANDA_ATUAL = dados.comanda || null;

    await carregarMesas();
    await carregarPratos();
    await carregarListaComandas();

    renderizarComandaAtual();
    trocarTela("comandas");
  } catch (error) {
    console.error("Erro ao abrir comanda:", error);
    showAlert(error.message || "Não foi possível abrir a comanda.");
  }
}

window.abrirComandaMesa = abrirComandaMesa;

// ===============================
// OPERAÇÃO
// ABRIR COMANDA EXISTENTE
// ===============================
async function abrirComandaExistente(comandaId) {
  try {
    const dados = await fetchJson(`${API}/comandas/${comandaId}`);

    COMANDA_ATUAL = {
      ...dados.comanda,
      itens: dados.itens || []
    };

    await carregarPratos();
    renderizarComandaAtual();
    trocarTela("comandas");
  } catch (error) {
    console.error("Erro ao abrir comanda existente:", error);
    showAlert(error.message || "Não foi possível carregar a comanda.");
  }
}

window.abrirComandaExistente = abrirComandaExistente;

// ===============================
// PREENCHER SELECT DE PRATOS NA COMANDA
// ===============================
function preencherSelectDePratosNaComanda() {
  if (!selectComandaPrato) return;

  selectComandaPrato.innerHTML = `
    <option value="">Selecione um prato</option>
  `;

  if (!PRATOS.length) {
    return;
  }

  PRATOS.forEach((prato) => {
    const precoVenda = Number(prato.preco_venda || 0);
    const indisponivel = prato.disponivel_para_venda === false;
    const rotuloIndisponivel = indisponivel ? " | INDISPONÍVEL" : "";

    selectComandaPrato.innerHTML += `
      <option value="${prato.id}" ${indisponivel ? "disabled" : ""}>
        ${prato.nome || "Sem nome"}${precoVenda > 0 ? ` | ${formatarMoeda(precoVenda)}` : ""}${rotuloIndisponivel}
      </option>
    `;
  });
}

// ===============================
// RENDERIZAR COMANDA ATUAL
// ===============================
function renderizarComandaAtual() {
  if (!comandaAtualInfo || !listaItensComanda) return;

  if (!COMANDA_ATUAL || !COMANDA_ATUAL.id) {
    comandaAtualInfo.innerHTML = `<p>Nenhuma comanda selecionada.</p>`;
    listaItensComanda.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma comanda selecionada.</td>
      </tr>
    `;
    return;
  }

  const itens = Array.isArray(COMANDA_ATUAL.itens) ? COMANDA_ATUAL.itens : [];
  const subtotal = Number(COMANDA_ATUAL.subtotal || 0);
  const desconto = Number(COMANDA_ATUAL.desconto || 0);
  const taxaServico = Number(COMANDA_ATUAL.taxa_servico || 0);
  const total = Number(COMANDA_ATUAL.total || 0);

  comandaAtualInfo.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">Comanda</span>
        <strong>${COMANDA_ATUAL.codigo || COMANDA_ATUAL.id}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Mesa</span>
        <strong>${COMANDA_ATUAL.mesa_numero || "-"}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Origem</span>
        <strong>${COMANDA_ATUAL.origem || "-"}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Status</span>
        <strong>${COMANDA_ATUAL.status || "-"}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Subtotal</span>
        <strong>${formatarMoeda(subtotal)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Desconto</span>
        <strong>${formatarMoeda(desconto)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Taxa de Serviço</span>
        <strong>${formatarMoeda(taxaServico)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Total</span>
        <strong>${formatarMoeda(total)}</strong>
      </div>
    </div>

    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
      <button
        type="button"
        class="btn btn-primary"
        onclick="aplicarDescontoComanda()"
      >
        Aplicar Desconto
      </button>

      <button
        type="button"
        class="btn btn-secondary"
        onclick="fecharComandaAtual()"
      >
        Fechar Comanda
      </button>

      <button
        type="button"
        class="btn btn-secondary"
        onclick="cancelarComandaAtual()"
      >
        Cancelar Comanda
      </button>
    </div>
  `;

  listaItensComanda.innerHTML = "";

  if (!itens.length) {
    listaItensComanda.innerHTML = `
      <tr>
        <td colspan="5">Nenhum item lançado na comanda.</td>
      </tr>
    `;
    return;
  }

  itens.forEach((item) => {
    let corStatus = "#6b7280";

    if (item.status_item === "pendente") corStatus = "#92400e";
    if (item.status_item === "em_preparo") corStatus = "#2563eb";
    if (item.status_item === "pronto") corStatus = "#166534";
    if (item.status_item === "entregue") corStatus = "#374151";
    if (item.status_item === "cancelado") corStatus = "#991b1b";

    listaItensComanda.innerHTML += `
      <tr>
        <td>${item.nome_prato || "-"}</td>
        <td>${Number(item.quantidade || 0)}</td>
        <td>${formatarMoeda(item.preco_unitario || 0)}</td>
        <td>${formatarMoeda(item.total_item || 0)}</td>
        <td style="color:${corStatus}; font-weight:bold;">
          ${item.status_item || "-"}

          ${
            item.status_item !== "cancelado"
              ? `
                <br/>
                <button
                  class="btn btn-secondary"
                  style="margin-top:6px;"
                  onclick="cancelarItemComanda(${item.id})"
                >
                  Cancelar Item
                </button>
              `
              : ""
          }
        </td>
      </tr>
    `;
  });
}

// ===============================
// ADICIONAR ITEM NA COMANDA ATUAL
// ===============================
async function adicionarItemNaComandaAtual() {
  try {
    if (!COMANDA_ATUAL || !COMANDA_ATUAL.id) {
      showAlert("Nenhuma comanda selecionada.");
      return;
    }

    const pratoId = Number(selectComandaPrato?.value || 0);
    const quantidade = Number(inputComandaQuantidade?.value || 0);
    const observacao = inputComandaObservacao?.value.trim() || "";

    if (!pratoId) {
      showAlert("Selecione um prato.");
      return;
    }

    if (!quantidade || quantidade <= 0) {
      showAlert("Informe uma quantidade válida.");
      return;
    }

    const prato = PRATOS.find((p) => p.id === pratoId);

    if (prato && prato.disponivel_para_venda === false) {
      showAlert("Prato indisponível (sem estoque).");
      return;
    }

    await fetchJson(`${API}/comandas/${COMANDA_ATUAL.id}/itens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prato_id: pratoId,
        quantidade,
        observacao
      })
    });

    if (selectComandaPrato) selectComandaPrato.value = "";
    if (inputComandaQuantidade) inputComandaQuantidade.value = "";
    if (inputComandaObservacao) inputComandaObservacao.value = "";

    await abrirComandaExistente(COMANDA_ATUAL.id);
    await carregarMesas();
    await carregarPratos();
    await carregarListaComandas();

    showAlert("Item adicionado na comanda.");
  } catch (error) {
    console.error("Erro ao adicionar item na comanda:", error);
    showAlert(error.message || "Não foi possível adicionar o item.");
  }
}

window.adicionarItemNaComandaAtual = adicionarItemNaComandaAtual;

// ===============================
// FECHAR COMANDA ATUAL
// ===============================
async function fecharComandaAtual() {
  try {
    if (!COMANDA_ATUAL || !COMANDA_ATUAL.id) {
      showAlert("Nenhuma comanda selecionada.");
      return;
    }

    const taxaTexto = prompt("Informe a taxa de serviço em R$ (se não houver, digite 0):", "0");
    if (taxaTexto === null) return;

    const taxaServico = Number(String(taxaTexto).replace(",", ".").trim());

    if (Number.isNaN(taxaServico) || taxaServico < 0) {
      showAlert("Informe uma taxa de serviço válida.");
      return;
    }

    const pagamentos = [];
    let continuar = true;

    while (continuar) {
      const metodo = prompt("Método de pagamento: dinheiro, cartao ou pix");
      if (metodo === null) return;

      const valorTexto = prompt("Valor deste pagamento:");
      if (valorTexto === null) return;

      const valor = Number(String(valorTexto).replace(",", ".").trim());
      const metodoNormalizado = String(metodo).trim().toLowerCase();

      if (!["dinheiro", "cartao", "pix"].includes(metodoNormalizado)) {
        showAlert("Método inválido. Use dinheiro, cartao ou pix.");
        continue;
      }

      if (Number.isNaN(valor) || valor <= 0) {
        showAlert("Informe um valor válido.");
        continue;
      }

      pagamentos.push({
        metodo: metodoNormalizado,
        valor
      });

      continuar = confirm("Deseja adicionar outro pagamento?");
    }

    if (!pagamentos.length) {
      showAlert("Informe ao menos um pagamento.");
      return;
    }

    await fetchJson(`${API}/comandas/${COMANDA_ATUAL.id}/fechar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        taxa_servico: taxaServico,
        pagamentos
      })
    });

    showAlert("Comanda fechada com sucesso.");

    COMANDA_ATUAL = null;

    await carregarMesas();
    await carregarVendas();
    await carregarResumoVendas();
    await carregarCmvsPratos();
    await carregarInsumos();
    await carregarPratos();
    await carregarPainelCozinha();
    await carregarDashboardFinanceiro();
    await carregarListaComandas();

    renderizarComandaAtual();
    trocarTela("mesas");
  } catch (error) {
    console.error("Erro ao fechar comanda:", error);
    showAlert(error.message || "Não foi possível fechar a comanda.");
  }
}

window.fecharComandaAtual = fecharComandaAtual;

// ===============================
// CANCELAR COMANDA ATUAL
// ===============================
async function cancelarComandaAtual() {
  try {
    if (!COMANDA_ATUAL || !COMANDA_ATUAL.id) {
      showAlert("Nenhuma comanda selecionada.");
      return;
    }

    const confirmar = confirm("Deseja realmente cancelar esta comanda?");

    if (!confirmar) {
      return;
    }

    await fetchJson(`${API}/comandas/${COMANDA_ATUAL.id}/cancelar`, {
      method: "PATCH"
    });

    showAlert("Comanda cancelada com sucesso.");

    COMANDA_ATUAL = null;

    await carregarMesas();
    await carregarPainelCozinha();
    await carregarListaComandas();
    renderizarComandaAtual();
    trocarTela("mesas");
  } catch (error) {
    console.error("Erro ao cancelar comanda:", error);
    showAlert(error.message || "Não foi possível cancelar a comanda.");
  }
}

window.cancelarComandaAtual = cancelarComandaAtual;

// ===============================
// CANCELAR ITEM DA COMANDA
// ===============================
async function cancelarItemComanda(itemId) {
  try {
    await fetchJson(`${API}/comandas/itens/${itemId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status_item: "cancelado"
      })
    });

    if (COMANDA_ATUAL && COMANDA_ATUAL.id) {
      await abrirComandaExistente(COMANDA_ATUAL.id);
    }

    await carregarPainelCozinha();
    await carregarListaComandas();
    showAlert("Item cancelado com sucesso.");
  } catch (error) {
    console.error("Erro ao cancelar item:", error);
    showAlert(error.message || "Não foi possível cancelar o item.");
  }
}

window.cancelarItemComanda = cancelarItemComanda;

// ===============================
// APLICAR DESCONTO NA COMANDA
// ===============================
async function aplicarDescontoComanda() {
  try {
    if (!COMANDA_ATUAL || !COMANDA_ATUAL.id) {
      showAlert("Nenhuma comanda selecionada.");
      return;
    }

    const valorInformado = prompt("Digite o valor do desconto:");

    if (valorInformado === null) {
      return;
    }

    const desconto = Number(String(valorInformado).replace(",", ".").trim());

    if (Number.isNaN(desconto) || desconto < 0) {
      showAlert("Informe um valor de desconto válido.");
      return;
    }

    await fetchJson(`${API}/comandas/${COMANDA_ATUAL.id}/desconto`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        desconto
      })
    });

    await abrirComandaExistente(COMANDA_ATUAL.id);
    await carregarMesas();
    await carregarListaComandas();

    showAlert("Desconto aplicado com sucesso.");
  } catch (error) {
    console.error("Erro ao aplicar desconto na comanda:", error);
    showAlert(error.message || "Não foi possível aplicar o desconto.");
  }
}

window.aplicarDescontoComanda = aplicarDescontoComanda;

// ===============================
// ATUALIZAR STATUS DO ITEM DA COMANDA
// ===============================
async function atualizarStatusItemComanda(itemId, novoStatus) {
  try {
    await fetchJson(`${API}/comandas/itens/${itemId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status_item: novoStatus
      })
    });

    if (COMANDA_ATUAL && COMANDA_ATUAL.id) {
      await abrirComandaExistente(COMANDA_ATUAL.id);
    }

    await carregarPainelCozinha();
    await carregarListaComandas();
    showAlert("Status do item atualizado com sucesso.");
  } catch (error) {
    console.error("Erro ao atualizar status do item:", error);
    showAlert(error.message || "Não foi possível atualizar o status do item.");
  }
}

window.atualizarStatusItemComanda = atualizarStatusItemComanda;

// ===============================
// CARREGAR PAINEL DE COZINHA
// ===============================
async function carregarPainelCozinha(statusFiltro = "todos") {
  if (!painelCozinha) return;

  try {
    const resposta = await fetchJson(`${API}/comandas?status=aberta`);
    COMANDAS = Array.isArray(resposta?.comandas) ? resposta.comandas : [];

    let html = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="btn btn-secondary" onclick="carregarPainelCozinha('todos')">
          Todos
        </button>
        <button class="btn btn-secondary" onclick="carregarPainelCozinha('pendente')">
          Pendentes
        </button>
        <button class="btn btn-secondary" onclick="carregarPainelCozinha('em_preparo')">
          Em preparo
        </button>
        <button class="btn btn-secondary" onclick="carregarPainelCozinha('pronto')">
          Prontos
        </button>
        <button class="btn btn-secondary" onclick="carregarPainelCozinha('entregue')">
          Entregues
        </button>
      </div>
    `;

    let encontrouItens = false;

    for (const comanda of COMANDAS) {
      const detalhes = await fetchJson(`${API}/comandas/${comanda.id}`);
      const itens = Array.isArray(detalhes?.itens) ? detalhes.itens : [];

      let itensAtivos = itens.filter((item) => item.status_item !== "cancelado");

      if (statusFiltro !== "todos") {
        itensAtivos = itensAtivos.filter((item) => item.status_item === statusFiltro);
      }

      if (!itensAtivos.length) {
        continue;
      }

      encontrouItens = true;

      const itensHtml = itensAtivos
        .map((item) => {
          let corStatus = "#6b7280";

          if (item.status_item === "pendente") corStatus = "#92400e";
          if (item.status_item === "em_preparo") corStatus = "#2563eb";
          if (item.status_item === "pronto") corStatus = "#166534";
          if (item.status_item === "entregue") corStatus = "#374151";

          return `
            <div style="border-top:1px solid #e5e7eb; padding-top:10px; margin-top:10px;">
              <strong>${item.nome_prato}</strong><br/>
              <span>Qtd: ${Number(item.quantidade || 0)}</span><br/>
              <span style="color:${corStatus}; font-weight:bold;">
                Status: ${item.status_item || "-"}
              </span>

              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="atualizarStatusItemComanda(${item.id}, 'pendente')"
                >
                  Pendente
                </button>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="atualizarStatusItemComanda(${item.id}, 'em_preparo')"
                >
                  Em preparo
                </button>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="atualizarStatusItemComanda(${item.id}, 'pronto')"
                >
                  Pronto
                </button>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="atualizarStatusItemComanda(${item.id}, 'entregue')"
                >
                  Entregue
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      html += `
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px;">
          <strong>Comanda ${comanda.codigo || comanda.id}</strong><br/>
          <span>Mesa: ${comanda.mesa_numero || "-"}</span><br/>
          <span>Origem: ${comanda.origem || "-"}</span>
          ${itensHtml}
        </div>
      `;
    }

    if (!encontrouItens) {
      html += `<p>Nenhum item encontrado para este filtro.</p>`;
    }

    painelCozinha.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar painel de cozinha:", error);
    painelCozinha.innerHTML = "<p>Erro ao carregar painel de cozinha.</p>";
  }
}

window.carregarPainelCozinha = carregarPainelCozinha;

// RENDERIZAÇÃO VISUAL EXECUTIVA
// [KF-021] DASHBOARD FINANCEIRO AVANÇADO
// ===============================
async function carregarDashboardFinanceiro() {
  try {
 // [KF-021.1] CAPTURA DE DADOS    
    const resposta = await fetchJson(`${API}/vendas/resumo-avancado`);

    if (!resposta || !resposta.sucesso) {
      return;
    }
// [KF-021.2] NORMALIZAÇÃO
    const resumo = resposta.resumo || {};
    const pagamentos = resposta.pagamentos || {
      pix: 0,
      cartao: 0,
      dinheiro: 0
    };
    const pratoMaisVendido = resposta.prato_mais_vendido || null;
    const rankingPratos = Array.isArray(resposta.ranking_pratos)
      ? resposta.ranking_pratos
      : [];

    // [KF-021.3] INTEGRAÇÕES ANALÍTICAS

   renderizarGraficoVendas(rankingPratos);
   renderizarDreOperacional(resumo);
   renderizarAlertasGerenciais(resumo, rankingPratos);
   renderizarInteligenciaPratos(rankingPratos);
   renderizarLucratividadePratos(rankingPratos, resumo);

    const elTotalVendas = document.getElementById("totalVendas");
    const elFaturamento = document.getElementById("faturamento");
    const elCustoTotal = document.getElementById("custoTotal");
    const elLucroBruto = document.getElementById("lucroBruto");
    const elCmvMedio = document.getElementById("cmvMedio");
    const elTaxaServico = document.getElementById("taxaServico");
    const elTicketMedio = document.getElementById("ticketMedio");
    const elPratoMaisVendido = document.getElementById("pratoMaisVendido");
    const elPagamentosResumo = document.getElementById("pagamentosResumo");
    const elRankingPratos = document.getElementById("rankingPratosDashboard");

    if (elTotalVendas) {
      elTotalVendas.innerText = Number(resumo.total_vendas || 0);
    }

    if (elFaturamento) {
      elFaturamento.innerText = formatarMoeda(resumo.faturamento_total || 0);
    }

    if (elCustoTotal) {
      elCustoTotal.innerText = formatarMoeda(resumo.cmv_total || 0);
    }

    if (elLucroBruto) {
      elLucroBruto.innerText = formatarMoeda(resumo.lucro_bruto || 0);
    }

    if (elCmvMedio) {
      const faturamento = Number(resumo.faturamento_total || 0);
      const cmv = Number(resumo.cmv_total || 0);
      const percentual = faturamento > 0 ? (cmv / faturamento) * 100 : 0;
      elCmvMedio.innerText = `${percentual.toFixed(2)}%`;
    }

    if (elTaxaServico) {
      elTaxaServico.innerText = formatarMoeda(resumo.taxa_servico_total || 0);
    }

    if (elTicketMedio) {
      elTicketMedio.innerText = formatarMoeda(resumo.ticket_medio || 0);
    }

    if (elPratoMaisVendido) {
      elPratoMaisVendido.innerText = pratoMaisVendido
        ? `${pratoMaisVendido.nome_prato} (${pratoMaisVendido.quantidade})`
        : "-";
    }

    if (elPagamentosResumo) {
      elPagamentosResumo.innerHTML = `
        PIX: ${formatarMoeda(pagamentos.pix || 0)}<br>
        Cartão: ${formatarMoeda(pagamentos.cartao || 0)}<br>
        Dinheiro: ${formatarMoeda(pagamentos.dinheiro || 0)}
      `;
    }

    if (elRankingPratos) {
      if (!rankingPratos.length) {
        elRankingPratos.innerHTML = `<p>Nenhum prato vendido ainda.</p>`;
      } else {
        elRankingPratos.innerHTML = `
          <div style="display:grid; gap:10px;">
            ${rankingPratos
              .slice(0, 5)
              .map((item, index) => `
                <div style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between;">
                    <strong>${index + 1}. ${item.nome_prato || "-"}</strong>
                    <span>${formatarMoeda(item.faturamento || 0)}</span>
                  </div>
                  <div style="margin-top:6px; color:#6b7280;">
                    Quantidade: ${Number(item.quantidade || 0)}
                  </div>
                </div>
              `)
              .join("")}
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Erro no dashboard financeiro:", error);
  }
}

// ===============================
// DRE OPERACIONAL
// ===============================
function renderizarDreOperacional(resumo) {
  const elDre = document.getElementById("dreOperacional");
  if (!elDre) return;

  const faturamentoBruto = Number(resumo.faturamento_bruto || 0);
  const taxaServico = Number(resumo.taxa_servico_total || 0);
  const faturamentoTotal = Number(resumo.faturamento_total || 0);
  const cmvTotal = Number(resumo.cmv_total || 0);
  const lucroBruto = Number(resumo.lucro_bruto || 0);

  const receitaLiquida = faturamentoTotal - taxaServico;
  const margem = faturamentoTotal > 0 ? (lucroBruto / faturamentoTotal) * 100 : 0;

  elDre.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">Receita Bruta</span>
        <strong>${formatarMoeda(faturamentoBruto)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Taxa Serviço</span>
        <strong>${formatarMoeda(taxaServico)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Receita Líquida</span>
        <strong>${formatarMoeda(receitaLiquida)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">CMV</span>
        <strong>${formatarMoeda(cmvTotal)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Lucro Bruto</span>
        <strong style="color:#166534;">${formatarMoeda(lucroBruto)}</strong>
      </div>

      <div class="summary-item">
        <span class="summary-label">Margem</span>
        <strong>${margem.toFixed(2)}%</strong>
      </div>
    </div>
  `;
}

// ===============================
// ALERTAS GERENCIAIS
// ===============================
function renderizarAlertasGerenciais(resumo, rankingPratos) {
  const elAlertas = document.getElementById("alertasGerenciais");
  if (!elAlertas) return;

  const faturamentoTotal = Number(resumo.faturamento_total || 0);
  const cmvTotal = Number(resumo.cmv_total || 0);
  const lucroBruto = Number(resumo.lucro_bruto || 0);
  const totalVendas = Number(resumo.total_vendas || 0);

  const cmvPercentual =
    faturamentoTotal > 0 ? (cmvTotal / faturamentoTotal) * 100 : 0;

  const margemBruta =
    faturamentoTotal > 0 ? (lucroBruto / faturamentoTotal) * 100 : 0;

  const alertas = [];

  if (totalVendas === 0) {
    alertas.push({
      tipo: "alerta",
      titulo: "Sem vendas registradas",
      mensagem: "O sistema ainda não registrou vendas no período consultado."
    });
  }

  if (faturamentoTotal > 0 && faturamentoTotal < 100) {
    alertas.push({
      tipo: "atencao",
      titulo: "Faturamento baixo",
      mensagem: "O faturamento total ainda está baixo. Vale revisar giro e conversão de vendas."
    });
  }

  if (cmvPercentual > 35) {
    alertas.push({
      tipo: "critico",
      titulo: "CMV alto",
      mensagem: `O CMV está em ${cmvPercentual.toFixed(2)}%. Isso pode comprometer a margem.`
    });
  } else if (cmvPercentual > 30) {
    alertas.push({
      tipo: "atencao",
      titulo: "CMV em atenção",
      mensagem: `O CMV está em ${cmvPercentual.toFixed(2)}%. Acompanhe de perto.`
    });
  }

  if (faturamentoTotal > 0 && margemBruta < 40) {
    alertas.push({
      tipo: "critico",
      titulo: "Margem bruta baixa",
      mensagem: `A margem bruta está em ${margemBruta.toFixed(2)}%. Revise custos e precificação.`
    });
  }

  if (!Array.isArray(rankingPratos) || rankingPratos.length === 0) {
    alertas.push({
      tipo: "alerta",
      titulo: "Sem ranking de pratos",
      mensagem: "Ainda não há dados suficientes para analisar o desempenho dos pratos."
    });
  }

  if (!alertas.length) {
    elAlertas.innerHTML = `
      <div style="
        background:#ecfdf5;
        border:1px solid #a7f3d0;
        color:#166534;
        padding:12px;
        border-radius:10px;
      ">
        <strong>Operação saudável</strong>
        <div style="margin-top:6px;">
          Nenhum alerta crítico encontrado neste momento.
        </div>
      </div>
    `;
    return;
  }

  elAlertas.innerHTML = alertas
    .map((alerta) => {
      let fundo = "#eff6ff";
      let borda = "#bfdbfe";
      let cor = "#1d4ed8";

      if (alerta.tipo === "atencao") {
        fundo = "#fffbeb";
        borda = "#fde68a";
        cor = "#92400e";
      }

      if (alerta.tipo === "critico") {
        fundo = "#fef2f2";
        borda = "#fecaca";
        cor = "#991b1b";
      }

      return `
        <div style="
          background:${fundo};
          border:1px solid ${borda};
          color:${cor};
          padding:12px;
          border-radius:10px;
          margin-bottom:10px;
        ">
          <strong>${alerta.titulo}</strong>
          <div style="margin-top:6px;">
            ${alerta.mensagem}
          </div>
        </div>
      `;
    })
    .join("");
}

// ===============================
// [KF-024] INTELIGÊNCIA POR PRATO
// ===============================
function renderizarInteligenciaPratos(rankingPratos) {
  const elInteligencia = document.getElementById("inteligenciaPratos");
  if (!elInteligencia) return;

  if (!Array.isArray(rankingPratos) || rankingPratos.length === 0) {
    elInteligencia.innerHTML = `
      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        color:#374151;
        padding:12px;
        border-radius:10px;
      ">
        Ainda não há dados suficientes para gerar inteligência por prato.
      </div>
    `;
    return;
  }

  // [KF-024.1] Ordenações estratégicas
  const maisVendido = [...rankingPratos].sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0))[0];
  const maiorFaturamento = [...rankingPratos].sort((a, b) => Number(b.faturamento || 0) - Number(a.faturamento || 0))[0];
  const menorFaturamento = [...rankingPratos].sort((a, b) => Number(a.faturamento || 0) - Number(b.faturamento || 0))[0];

  // [KF-024.2] Leitura de atenção
  const pratosBaixoGiro = rankingPratos.filter((item) => Number(item.quantidade || 0) <= 1);
  const pratoAtencao = pratosBaixoGiro.length ? pratosBaixoGiro[0] : null;

  // [KF-024.3] Renderização
  elInteligencia.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">Mais vendido</span>
        <strong>${maisVendido?.nome_prato || "-"}</strong>
        <div style="margin-top:6px; color:#6b7280;">
          ${Number(maisVendido?.quantidade || 0)} venda(s)
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-label">Maior faturamento</span>
        <strong>${maiorFaturamento?.nome_prato || "-"}</strong>
        <div style="margin-top:6px; color:#166534;">
          ${formatarMoeda(maiorFaturamento?.faturamento || 0)}
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-label">Menor faturamento</span>
        <strong>${menorFaturamento?.nome_prato || "-"}</strong>
        <div style="margin-top:6px; color:#92400e;">
          ${formatarMoeda(menorFaturamento?.faturamento || 0)}
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-label">Prato em atenção</span>
        <strong>${pratoAtencao?.nome_prato || "Nenhum"}</strong>
        <div style="margin-top:6px; color:#991b1b;">
          ${
            pratoAtencao
              ? `Baixo giro: ${Number(pratoAtencao.quantidade || 0)} venda(s)`
              : "Nenhum prato com baixo giro no momento."
          }
        </div>
      </div>
    </div>
  `;
}

// ===============================
// [KF-025] LUCRATIVIDADE POR PRATO
// ===============================
function renderizarLucratividadePratos(rankingPratos, resumo) {
  const el = document.getElementById("lucratividadePratos");
  if (!el) return;

  if (!Array.isArray(rankingPratos) || rankingPratos.length === 0) {
    el.innerHTML = `<p>Sem dados suficientes.</p>`;
    return;
  }

  // [KF-025.1] Cálculo estimado de custo médio
  const faturamentoTotal = Number(resumo.faturamento_total || 0);
  const cmvTotal = Number(resumo.cmv_total || 0);

  const custoMedioPercentual =
    faturamentoTotal > 0 ? cmvTotal / faturamentoTotal : 0;

  // [KF-025.2] Criar estrutura com lucro estimado
  const pratos = rankingPratos.map((item) => {
    const faturamento = Number(item.faturamento || 0);
    const custoEstimado = faturamento * custoMedioPercentual;
    const lucro = faturamento - custoEstimado;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    return {
      ...item,
      lucro,
      margem
    };
  });

  // [KF-025.3] Ordenações
  const maisLucrativo = [...pratos].sort((a, b) => b.lucro - a.lucro)[0];
  const menosLucrativo = [...pratos].sort((a, b) => a.lucro - b.lucro)[0];

  const margemCritica = pratos.find((p) => p.margem < 40);

  // [KF-025.4] Render
  el.innerHTML = `
    <div class="summary-grid">

      <div class="summary-item">
        <span class="summary-label">Mais lucrativo</span>
        <strong>${maisLucrativo.nome_prato}</strong>
        <div style="color:#166534;">
          ${formatarMoeda(maisLucrativo.lucro)}
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-label">Menos lucrativo</span>
        <strong>${menosLucrativo.nome_prato}</strong>
        <div style="color:#991b1b;">
          ${formatarMoeda(menosLucrativo.lucro)}
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-label">Margem crítica</span>
        <strong>${margemCritica ? margemCritica.nome_prato : "Nenhum"}</strong>
        <div style="color:#92400e;">
          ${
            margemCritica
              ? `${margemCritica.margem.toFixed(2)}%`
              : "Operação saudável"
          }
        </div>
      </div>

    </div>
  `;
}


// ===============================
// [KF-026] SIMULADOR DE PREÇO
// ===============================

async function simularPrecoPrato() {
  const pratoId = Number(document.getElementById("simuladorPrato")?.value || 0);
  const preco = Number(document.getElementById("simuladorPreco")?.value || 0);
  const elResultado = document.getElementById("resultadoSimulador");

  if (!elResultado) return;

  if (!pratoId || !preco || preco <= 0) {
    elResultado.innerHTML = `<p>Preencha os campos.</p>`;
    return;
  }

  try {
    // [KF-026.1] CHAMADA AO BACKEND REAL
    const resposta = await fetchJson(`${API}/vendas/cmv-real`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prato_id: pratoId,
        preco
      })
    });

    if (!resposta?.sucesso) {
      elResultado.innerHTML = `
        <div style="
          background:#fef2f2;
          border:1px solid #fecaca;
          color:#991b1b;
          padding:12px;
          border-radius:10px;
        ">
          ${resposta?.mensagem || "Não foi possível calcular o CMV real."}
        </div>
      `;
      return;
    }

    const prato = resposta.prato || {};
    const custo = Number(resposta.custo_total || 0);
    const cmv = Number(resposta.cmv_percentual || 0);
    const lucro = Number(resposta.lucro || 0);
    const status = String(resposta.status_cmv || "").toLowerCase();
    const itens = Array.isArray(resposta.itens) ? resposta.itens : [];

    const margem = preco > 0 ? (lucro / preco) * 100 : 0;

    let cor = "#166534";
    let rotuloStatus = "Saudável";

    if (status === "alerta") {
      cor = "#991b1b";
      rotuloStatus = "Crítico";
    } else if (status === "atencao") {
      cor = "#92400e";
      rotuloStatus = "Atenção";
    }

    // [KF-026.2] RENDERIZAÇÃO
    elResultado.innerHTML = `
      <div style="
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:15px;
      ">
        <div style="margin-bottom:10px;">
          <strong>Prato:</strong> ${prato.nome || "Prato"}
        </div>

        <div><strong>Preço simulado:</strong> ${formatarMoeda(preco)}</div>
        <div><strong>Custo real:</strong> ${formatarMoeda(custo)}</div>
        <div><strong>Lucro real:</strong> ${formatarMoeda(lucro)}</div>
        <div><strong>Margem:</strong> ${margem.toFixed(2)}%</div>

        <div style="margin-top:10px; color:${cor};">
          <strong>CMV real:</strong> ${cmv.toFixed(2)}% (${rotuloStatus})
        </div>

        <div style="margin-top:12px;">
          <strong>Composição do custo:</strong>
          <div style="margin-top:8px; display:grid; gap:8px;">
            ${
              itens.length
                ? itens.map((item) => `
                  <div style="
                    border:1px solid #e5e7eb;
                    border-radius:8px;
                    padding:10px;
                    background:#fafafa;
                  ">
                    <div><strong>${item.nome_insumo || "-"}</strong></div>
                    <div>Qtd usada: ${formatarNumero(item.quantidade_baixada || 0)}</div>
                    <div>Custo unitário: ${formatarMoeda(item.custo_unitario || 0)}</div>
                    <div>Custo do item: ${formatarMoeda(item.custo_total_item || 0)}</div>
                  </div>
                `).join("")
                : `<div>Nenhum item encontrado para esta ficha técnica.</div>`
            }
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Erro no simulador de preço:", err);

    elResultado.innerHTML = `
      <div style="
        background:#fef2f2;
        border:1px solid #fecaca;
        color:#991b1b;
        padding:12px;
        border-radius:10px;
      ">
        Erro ao simular preço com CMV real.
      </div>
    `;
  }
}
// 
// ===============================
// [KF-026.1] POPULAR SELECT
// ===============================
async function carregarPratosSimulador() {
  const select = document.getElementById("simuladorPrato");
  const inputPreco = document.getElementById("simuladorPreco");

  if (!select) return;

  try {
    const resposta = await fetchJson(`${API}/pratos`);

    const pratos = Array.isArray(resposta?.pratos)
      ? resposta.pratos
      : Array.isArray(resposta)
      ? resposta
      : [];

    select.innerHTML = `
      <option value="">Selecione um prato</option>
      ${pratos.map((p) => `
        <option
          value="${p.id}"
          data-preco="${Number(p.preco_venda || 0)}"
        >
          ${p.nome}
        </option>
      `).join("")}
    `;

    select.onchange = function () {
      const option = select.options[select.selectedIndex];
      const preco = Number(option?.dataset?.preco || 0);

      if (inputPreco && preco > 0) {
        inputPreco.value = preco.toFixed(2);
      }
    };
  } catch (err) {
    console.error(err);
  }
}
// ===============================
// LISTA DE COMANDAS
// ===============================
async function carregarListaComandas() {
  try {
    const data = await fetchJson(`${API}/comandas`);

    const tbody = document.getElementById("lista-comandas");
    if (!tbody) return;

    const comandas = Array.isArray(data?.comandas) ? data.comandas : [];

    if (!comandas.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">Nenhuma comanda encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = comandas
      .map((c) => `
        <tr>
          <td>${c.codigo || "-"}</td>
          <td>${c.mesa_numero || "-"}</td>
          <td>${c.status || "-"}</td>
          <td>${formatarMoeda(c.subtotal || 0)}</td>
          <td>${formatarMoeda(c.total || 0)}</td>
          <td>
            <button
              type="button"
              class="btn btn-primary"
              onclick="selecionarComanda(${c.id})"
            >
              Abrir
            </button>
          </td>
        </tr>
      `)
      .join("");
  } catch (error) {
    console.error("Erro ao carregar lista de comandas:", error);

    const tbody = document.getElementById("lista-comandas");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">Erro ao carregar comandas.</td>
        </tr>
      `;
    }
  }
}

function selecionarComanda(id) {
  abrirComandaExistente(id);
}

window.selecionarComanda = selecionarComanda;

// ===============================
// INICIALIZAÇÃO DO MÓDULO DE FICHA
// ===============================
function inicializarFichaTecnica() {
  renderizarItensDaFicha();
  atualizarResumoDaFicha();
}

// ===============================
// INICIALIZAÇÃO DO MÓDULO DE VENDAS
// ===============================
function inicializarModuloVendas() {
  carregarResumoVendas();
  carregarVendas();
  carregarCmvsPratos();
  carregarDashboardFinanceiro();
}

// ===============================
// INICIALIZAÇÃO GERAL
// ===============================
async function init() {
  ativarCorrecaoOrtograficaGlobal();
  await carregarInsumos();
  await carregarPratos();
  await carregarPratosSimulador();
  await carregarMesas();
  await carregarPainelCozinha();
  await carregarDashboardFinanceiro();
  await carregarListaComandas();
  inicializarFichaTecnica();
  inicializarModuloVendas();
}

init();

/*
====================================================
NOTA DE MANUTENÇÃO
====================================================
1. Recompostas as partes finais do app.js.
2. Integrado fechamento profissional da comanda:
   - taxa de serviço
   - múltiplos pagamentos
3. Integrado dashboard avançado:
   - prato mais vendido
   - ticket médio
   - taxa de serviço
   - pagamentos
4. Integrada lista de últimas comandas.
5. Mantido padrão do código existente.
===============================

- Criado bloco de inteligência por prato
- Integrado ao dashboard principal
- Adicionado rastreio padronizado KF
- Mantida compatibilidade com ranking já existente

===============================

- Inserido simulador de preço no bloco correto
- Integrado ao init global
- Compatível com estrutura atual do app.js
- Ajustado para seu padrão real de resposta API
====================================================
[KF-026.2]
ajustado ponto de recarga do simulador ao abrir a tela de vendas
corrigida ordem de inicialização no init()
mantida compatibilidade com a estrutura atual

// ===============================
// [KF-026]
// - Substituído cálculo estimado por chamada real ao backend
// - Integrado endpoint POST /vendas/cmv-real
// - Simulador agora exibe custo, lucro, CMV e composição por insumo
// ===============================
*/