const db = require("../database");

// ===============================
// HELPERS DE BANCO
// ===============================
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ===============================
// FORMATAÇÃO DE NÚMERO
// ===============================
function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

// ===============================
// CALCULAR CMV
// ===============================
function calcularCMVPercentual(custoTotal, faturamentoTotal) {
  const custo = numero(custoTotal, 0);
  const faturamento = numero(faturamentoTotal, 0);

  if (faturamento <= 0) {
    return 0;
  }

  return (custo / faturamento) * 100;
}

// ===============================
// STATUS GERENCIAL DE CMV
// ===============================
function obterStatusCMV(cmvPercentual) {
  const cmv = numero(cmvPercentual, 0);

  if (cmv <= 30) return "ok";
  if (cmv <= 35) return "atencao";
  return "alerta";
}

// ===============================
// BUSCAR PRATO COM FICHA
// ===============================
async function buscarPratoPorId(pratoId) {
  return getAsync(
    `
    SELECT
      p.id,
      p.nome,
      p.ficha_id,
      p.preco_venda,
      p.categoria,
      p.status,
      f.id AS ficha_tecnica_id,
      f.nome AS ficha_nome,
      f.cmv AS ficha_cmv,
      f.preco_sugerido,
      f.preco_praticado
    FROM pratos p
    LEFT JOIN fichas_tecnicas f ON f.id = p.ficha_id
    WHERE p.id = ?
    `,
    [pratoId]
  );
}

// ===============================
// BUSCAR ITENS DA FICHA
// ===============================
async function buscarItensDaFicha(fichaId) {
  return allAsync(
    `
    SELECT
      fi.id,
      fi.ficha_id,
      fi.insumo_id,
      fi.quantidade AS quantidade_usada_ficha,
      i.nome AS insumo_nome,
      i.unidade,
      i.quantidade AS estoque_atual,
      i.custo AS custo_compra
    FROM fichas_tecnicas_itens fi
    INNER JOIN insumos i ON i.id = fi.insumo_id
    WHERE fi.ficha_id = ?
    ORDER BY fi.id ASC
    `,
    [fichaId]
  );
}

// ===============================
// CALCULAR CONSUMO DA VENDA
// multiplica a ficha pela quantidade vendida
// ===============================
function calcularConsumoDaVenda(itensFicha, quantidadeVendida) {
  const qtdVenda = numero(quantidadeVendida, 0);

  return itensFicha.map((item) => {
    const estoqueAtual = numero(item.estoque_atual, 0);
    const quantidadeBaseFicha = numero(item.quantidade_usada_ficha, 0);
    const custoCompra = numero(item.custo_compra, 0);

    // Regra atual do projeto:
    // insumos.quantidade = saldo atual
    // insumos.custo = custo total base da compra cadastrada
    const custoUnitario = estoqueAtual > 0 ? custoCompra / estoqueAtual : 0;

    const quantidadeBaixada = quantidadeBaseFicha * qtdVenda;
    const custoTotalItem = custoUnitario * quantidadeBaixada;
    const saldoRestantePrevisto = estoqueAtual - quantidadeBaixada;

    return {
      insumo_id: item.insumo_id,
      nome_insumo: item.insumo_nome,
      unidade: item.unidade,
      estoque_atual: estoqueAtual,
      quantidade_usada_ficha: quantidadeBaseFicha,
      quantidade_baixada: quantidadeBaixada,
      saldo_restante_previsto: saldoRestantePrevisto,
      custo_unitario: custoUnitario,
      custo_total_item: custoTotalItem
    };
  });
}

// ===============================
// VALIDAR ESTOQUE ANTES DA VENDA
// ===============================
function validarEstoqueConsumo(itensConsumo) {
  const insuficientes = itensConsumo.filter((item) => {
    return numero(item.quantidade_baixada, 0) > numero(item.estoque_atual, 0);
  });

  return {
    ok: insuficientes.length === 0,
    insuficientes
  };
}

// ===============================
// GERAR ALERTAS DE ESTOQUE
// ===============================
function gerarAlertasEstoque(itensConsumo) {
  const alertas = [];

  itensConsumo.forEach((item) => {
    const saldoRestante = numero(item.saldo_restante_previsto, 0);

    if (saldoRestante < 0) {
      alertas.push({
        tipo: "estoque_insuficiente",
        insumo_id: item.insumo_id,
        nome_insumo: item.nome_insumo,
        mensagem: `Estoque insuficiente para o insumo ${item.nome_insumo}`
      });
      return;
    }

    if (saldoRestante === 0) {
      alertas.push({
        tipo: "estoque_zerado",
        insumo_id: item.insumo_id,
        nome_insumo: item.nome_insumo,
        mensagem: `O insumo ${item.nome_insumo} ficará zerado após esta venda`
      });
      return;
    }

    if (saldoRestante <= 3) {
      alertas.push({
        tipo: "estoque_baixo",
        insumo_id: item.insumo_id,
        nome_insumo: item.nome_insumo,
        mensagem: `O insumo ${item.nome_insumo} ficará com estoque baixo após esta venda`
      });
    }
  });

  return alertas;
}

// ===============================
// MONTAR RESUMO DA VENDA
// ===============================
function montarResumoVenda({ prato, quantidade, precoUnitario, itensConsumo }) {
  const qtd = numero(quantidade, 0);
  const preco = numero(precoUnitario, 0);

  const custoTotal = itensConsumo.reduce((acc, item) => {
    return acc + numero(item.custo_total_item, 0);
  }, 0);

  const faturamentoTotal = qtd * preco;
  const cmvPercentual = calcularCMVPercentual(custoTotal, faturamentoTotal);
  const lucroBruto = faturamentoTotal - custoTotal;
  const statusCMV = obterStatusCMV(cmvPercentual);
  const alertasEstoque = gerarAlertasEstoque(itensConsumo);

  return {
    prato_id: prato.id,
    ficha_id: prato.ficha_id,
    nome_prato: prato.nome,
    quantidade: qtd,
    preco_unitario: preco,
    faturamento_total: faturamentoTotal,
    custo_total: custoTotal,
    cmv_percentual: cmvPercentual,
    lucro_bruto: lucroBruto,
    status_cmv: statusCMV,
    alertas_estoque: alertasEstoque,
    itens: itensConsumo
  };
}

// ===============================
// [KF-BE-001] SIMULAR VENDA
// não grava nada
// apenas calcula impacto gerencial
// ===============================
exports.simularVenda = async (req, res) => {
  try {
    const { prato_id, quantidade, preco_unitario } = req.body;

    if (!prato_id || !quantidade || numero(quantidade) <= 0) {
      return res.status(400).json({
        erro: "prato_id e quantidade são obrigatórios"
      });
    }

    const prato = await buscarPratoPorId(Number(prato_id));

    if (!prato) {
      return res.status(404).json({
        erro: "Prato não encontrado"
      });
    }

    if (!prato.ficha_id) {
      return res.status(400).json({
        erro: "O prato não possui ficha técnica vinculada"
      });
    }

    const itensFicha = await buscarItensDaFicha(Number(prato.ficha_id));

    if (!itensFicha.length) {
      return res.status(400).json({
        erro: "A ficha técnica do prato não possui itens"
      });
    }

    const precoUnitario =
      numero(preco_unitario, 0) > 0
        ? numero(preco_unitario, 0)
        : numero(prato.preco_venda, 0) > 0
          ? numero(prato.preco_venda, 0)
          : numero(prato.preco_praticado, 0);

    const itensConsumo = calcularConsumoDaVenda(itensFicha, Number(quantidade));
    const validacao = validarEstoqueConsumo(itensConsumo);

    if (!validacao.ok) {
      return res.status(400).json({
        erro: "Estoque insuficiente para concluir a simulação",
        estoque_insuficiente: validacao.insuficientes
      });
    }

    const resumo = montarResumoVenda({
      prato,
      quantidade: Number(quantidade),
      precoUnitario,
      itensConsumo
    });

    res.json({
      mensagem: "Simulação realizada com sucesso",
      venda: resumo
    });
  } catch (error) {
    console.error("Erro ao simular venda:", error.message);
    res.status(500).json({
      erro: "Erro ao simular venda"
    });
  }
};

// ===============================
// [KF-BE-002] REGISTRAR VENDA
// grava venda, itens e baixa estoque
// ===============================
exports.criarVenda = async (req, res) => {
  try {
    const { prato_id, quantidade, preco_unitario, observacao } = req.body;

    if (!prato_id || !quantidade || numero(quantidade) <= 0) {
      return res.status(400).json({
        erro: "prato_id e quantidade são obrigatórios"
      });
    }

    const prato = await buscarPratoPorId(Number(prato_id));

    if (!prato) {
      return res.status(404).json({
        erro: "Prato não encontrado"
      });
    }

    if (!prato.ficha_id) {
      return res.status(400).json({
        erro: "O prato não possui ficha técnica vinculada"
      });
    }

    const itensFicha = await buscarItensDaFicha(Number(prato.ficha_id));

    if (!itensFicha.length) {
      return res.status(400).json({
        erro: "A ficha técnica do prato não possui itens"
      });
    }

    const precoUnitario =
      numero(preco_unitario, 0) > 0
        ? numero(preco_unitario, 0)
        : numero(prato.preco_venda, 0) > 0
          ? numero(prato.preco_venda, 0)
          : numero(prato.preco_praticado, 0);

    if (precoUnitario <= 0) {
      return res.status(400).json({
        erro: "Preço unitário inválido para a venda"
      });
    }

    const itensConsumo = calcularConsumoDaVenda(itensFicha, Number(quantidade));
    const validacao = validarEstoqueConsumo(itensConsumo);

    if (!validacao.ok) {
      return res.status(400).json({
        erro: "Estoque insuficiente para concluir a venda",
        estoque_insuficiente: validacao.insuficientes
      });
    }

    const resumo = montarResumoVenda({
      prato,
      quantidade: Number(quantidade),
      precoUnitario,
      itensConsumo
    });

    const resultadoVenda = await runAsync(
      `
      INSERT INTO vendas (
        prato_id,
        ficha_id,
        nome_prato,
        quantidade,
        preco_unitario,
        faturamento_total,
        custo_total,
        cmv_percentual,
        lucro_bruto,
        observacao
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        resumo.prato_id,
        resumo.ficha_id,
        resumo.nome_prato,
        resumo.quantidade,
        resumo.preco_unitario,
        resumo.faturamento_total,
        resumo.custo_total,
        resumo.cmv_percentual,
        resumo.lucro_bruto,
        observacao || ""
      ]
    );

    const vendaId = resultadoVenda.lastID;

    for (const item of resumo.itens) {
      await runAsync(
        `
        INSERT INTO vendas_itens (
          venda_id,
          insumo_id,
          nome_insumo,
          quantidade_baixada,
          unidade,
          custo_unitario,
          custo_total_item
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          vendaId,
          item.insumo_id,
          item.nome_insumo,
          item.quantidade_baixada,
          item.unidade,
          item.custo_unitario,
          item.custo_total_item
        ]
      );
    }

    for (const item of resumo.itens) {
      await runAsync(
        `
        UPDATE insumos
        SET quantidade = quantidade - ?
        WHERE id = ?
        `,
        [item.quantidade_baixada, item.insumo_id]
      );

      await runAsync(
        `
        INSERT INTO movimentacoes (
          insumo_id,
          tipo,
          quantidade,
          origem,
          referencia_id,
          observacao
        )
        VALUES (?, 'saida', ?, 'venda', ?, ?)
        `,
        [
          item.insumo_id,
          item.quantidade_baixada,
          vendaId,
          `Baixa automática da venda do prato ${resumo.nome_prato}`
        ]
      );
    }

    res.status(201).json({
      mensagem: "Venda registrada com sucesso",
      venda_id: vendaId,
      venda: {
        id: vendaId,
        ...resumo
      }
    });
  } catch (error) {
    console.error("Erro ao registrar venda:", error.message);
    res.status(500).json({
      erro: "Erro ao registrar venda"
    });
  }
};

// ===============================
// [KF-BE-003] LISTAR VENDAS
// ===============================
exports.listarVendas = async (req, res) => {
  try {
    const vendas = await allAsync(
      `
      SELECT
        id,
        prato_id,
        ficha_id,
        nome_prato,
        quantidade,
        preco_unitario,
        faturamento_total,
        custo_total,
        cmv_percentual,
        lucro_bruto,
        observacao,
        data_venda,
        created_at
      FROM vendas
      ORDER BY datetime(data_venda) DESC, id DESC
      `
    );

    const vendasComStatus = vendas.map((venda) => ({
      ...venda,
      status_cmv: obterStatusCMV(venda.cmv_percentual)
    }));

    res.json(vendasComStatus);
  } catch (error) {
    console.error("Erro ao listar vendas:", error.message);
    res.status(500).json({
      erro: "Erro ao listar vendas"
    });
  }
};

// ===============================
// [KF-BE-004] DETALHAR VENDA
// ===============================
exports.detalharVenda = async (req, res) => {
  try {
    const { id } = req.params;

    const venda = await getAsync(
      `
      SELECT
        id,
        prato_id,
        ficha_id,
        nome_prato,
        quantidade,
        preco_unitario,
        faturamento_total,
        custo_total,
        cmv_percentual,
        lucro_bruto,
        observacao,
        data_venda,
        created_at
      FROM vendas
      WHERE id = ?
      `,
      [id]
    );

    if (!venda) {
      return res.status(404).json({
        erro: "Venda não encontrada"
      });
    }

    const itens = await allAsync(
      `
      SELECT
        id,
        venda_id,
        insumo_id,
        nome_insumo,
        quantidade_baixada,
        unidade,
        custo_unitario,
        custo_total_item
      FROM vendas_itens
      WHERE venda_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({
      ...venda,
      status_cmv: obterStatusCMV(venda.cmv_percentual),
      itens
    });
  } catch (error) {
    console.error("Erro ao detalhar venda:", error.message);
    res.status(500).json({
      erro: "Erro ao detalhar venda"
    });
  }
};

// ===============================
// [KF-BE-005] RESUMO GERENCIAL DE VENDAS
// ===============================
exports.resumoVendas = async (req, res) => {
  try {
    const resumo = await getAsync(
      `
      SELECT
        COUNT(*) AS total_vendas,
        COALESCE(SUM(quantidade), 0) AS total_pratos_vendidos,
        COALESCE(SUM(faturamento_total), 0) AS faturamento_total,
        COALESCE(SUM(custo_total), 0) AS custo_total,
        COALESCE(SUM(lucro_bruto), 0) AS lucro_total
      FROM vendas
      `
    );

    const faturamento = numero(resumo?.faturamento_total, 0);
    const custo = numero(resumo?.custo_total, 0);
    const cmvMedio = calcularCMVPercentual(custo, faturamento);

    res.json({
      total_vendas: numero(resumo?.total_vendas, 0),
      total_pratos_vendidos: numero(resumo?.total_pratos_vendidos, 0),
      faturamento_total: faturamento,
      custo_total: custo,
      lucro_total: numero(resumo?.lucro_total, 0),
      cmv_medio: cmvMedio,
      status_cmv: obterStatusCMV(cmvMedio)
    });
  } catch (error) {
    console.error("Erro ao gerar resumo de vendas:", error.message);
    res.status(500).json({
      erro: "Erro ao gerar resumo de vendas"
    });
  }
};

// ===============================
// [KF-BE-006] CMV POR PRATO
// GET /vendas/cmvs
// ===============================
exports.cmvsPorPrato = async (req, res) => {
  try {
    const linhas = await allAsync(
      `
      SELECT
        prato_id,
        nome_prato,
        COALESCE(SUM(quantidade), 0) AS quantidade_vendida,
        COALESCE(SUM(faturamento_total), 0) AS faturamento_total,
        COALESCE(SUM(custo_total), 0) AS custo_total,
        COALESCE(SUM(lucro_bruto), 0) AS lucro_total
      FROM vendas
      GROUP BY prato_id, nome_prato
      ORDER BY faturamento_total DESC, nome_prato ASC
      `
    );

    const analise = linhas.map((linha) => {
      const faturamento = numero(linha.faturamento_total, 0);
      const custo = numero(linha.custo_total, 0);
      const lucro = numero(linha.lucro_total, 0);
      const cmv = calcularCMVPercentual(custo, faturamento);

      return {
        prato_id: numero(linha.prato_id, 0),
        nome_prato: linha.nome_prato || "Sem nome",
        quantidade_vendida: numero(linha.quantidade_vendida, 0),
        faturamento_total: faturamento,
        custo_total: custo,
        lucro_total: lucro,
        cmv_percentual: cmv,
        status_cmv: obterStatusCMV(cmv)
      };
    });

    res.json(analise);
  } catch (error) {
    console.error("Erro ao gerar CMV por prato:", error.message);
    res.status(500).json({
      erro: "Erro ao gerar análise de CMV por prato"
    });
  }
};

// ===============================
// [KF-BE-027] CMV REAL POR PRATO
// ===============================
exports.cmvRealPorPrato = async (req, res) => {
  try {
    const { prato_id, preco } = req.body;

    const pratoId = numero(prato_id, 0);
    const precoVenda = numero(preco, 0);

    if (!pratoId || precoVenda <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe prato_id e preco válidos"
      });
    }

    // [KF-BE-027.1] BUSCAR PRATO
    const prato = await buscarPratoPorId(pratoId);

    if (!prato) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Prato não encontrado"
      });
    }

    if (!prato.ficha_id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O prato não possui ficha técnica vinculada"
      });
    }

    // [KF-BE-027.2] BUSCAR ITENS DA FICHA
    const itensFicha = await buscarItensDaFicha(Number(prato.ficha_id));

    if (!Array.isArray(itensFicha) || !itensFicha.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A ficha técnica do prato não possui itens"
      });
    }

    // [KF-BE-027.3] CALCULAR CONSUMO UNITÁRIO
    const itensConsumo = calcularConsumoDaVenda(itensFicha, 1);

    const custoTotal = itensConsumo.reduce((acc, item) => {
      return acc + numero(item.custo_total_item, 0);
    }, 0);

    const cmvPercentual = calcularCMVPercentual(custoTotal, precoVenda);
    const lucro = precoVenda - custoTotal;
    const status_cmv = obterStatusCMV(cmvPercentual);

    // [KF-BE-027.4] RESPOSTA
    return res.json({
      sucesso: true,
      prato: {
        id: prato.id,
        nome: prato.nome,
        ficha_id: prato.ficha_id
      },
      custo_total: custoTotal,
      cmv_percentual: cmvPercentual,
      lucro,
      status_cmv,
      itens: itensConsumo
    });
  } catch (error) {
    console.error("Erro ao calcular CMV real por prato:", error.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao calcular CMV real por prato"
    });
  }
};

// ===============================
// EXPORTAR HELPERS
// ===============================
exports._helpers = {
  calcularCMVPercentual,
  obterStatusCMV,
  buscarPratoPorId,
  buscarItensDaFicha,
  calcularConsumoDaVenda,
  validarEstoqueConsumo,
  gerarAlertasEstoque,
  montarResumoVenda
};

// ===============================
// [KF-BE-007] RESUMO AVANÇADO (MODELO NOVO)
// GET /vendas/resumo-avancado
// ===============================
exports.resumoAvancado = async (req, res) => {
  try {
    // ===============================
    // RESUMO FINANCEIRO
    // ===============================
    const financeiro = await getAsync(`
      SELECT
        COUNT(*) AS total_vendas,
        COALESCE(SUM(subtotal), 0) AS faturamento_bruto,
        COALESCE(SUM(taxa_servico), 0) AS total_taxa_servico,
        COALESCE(SUM(total), 0) AS faturamento_total,
        COALESCE(SUM(cmv_total), 0) AS cmv_total,
        COALESCE(SUM(lucro_bruto), 0) AS lucro_bruto
      FROM vendas
      WHERE comanda_id IS NOT NULL
    `);

    const totalVendas = numero(financeiro?.total_vendas, 0);
    const faturamentoTotal = numero(financeiro?.faturamento_total, 0);

    const ticketMedio =
      totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

    // ===============================
    // PAGAMENTOS
    // ===============================
    const pagamentos = await allAsync(`
      SELECT
        metodo,
        COALESCE(SUM(valor), 0) AS total
      FROM pagamentos
      GROUP BY metodo
    `);

    const pagamentosFormatado = {
      pix: 0,
      cartao: 0,
      dinheiro: 0
    };

    pagamentos.forEach((p) => {
      const metodo = String(p.metodo || "").toLowerCase();

      if (Object.prototype.hasOwnProperty.call(pagamentosFormatado, metodo)) {
        pagamentosFormatado[metodo] = numero(p.total, 0);
      }
    });

    // ===============================
    // PRATO MAIS VENDIDO
    // ===============================
    const pratoTop = await getAsync(`
      SELECT
        nome_prato,
        SUM(quantidade) AS quantidade
      FROM vendas_itens
      WHERE nome_prato IS NOT NULL
      GROUP BY nome_prato
      ORDER BY quantidade DESC
      LIMIT 1
    `);

    // ===============================
    // RANKING DE PRATOS
    // ===============================
    const ranking = await allAsync(`
      SELECT
        nome_prato,
        SUM(quantidade) AS quantidade,
        SUM(total_item) AS faturamento
      FROM vendas_itens
      WHERE nome_prato IS NOT NULL
      GROUP BY nome_prato
      ORDER BY faturamento DESC
      LIMIT 10
    `);

    // ===============================
    // RESPOSTA FINAL
    // ===============================
    return res.json({
      sucesso: true,
      resumo: {
        total_vendas: totalVendas,
        faturamento_bruto: numero(financeiro?.faturamento_bruto, 0),
        taxa_servico_total: numero(financeiro?.total_taxa_servico, 0),
        faturamento_total: faturamentoTotal,
        cmv_total: numero(financeiro?.cmv_total, 0),
        lucro_bruto: numero(financeiro?.lucro_bruto, 0),
        ticket_medio: ticketMedio
      },
      pagamentos: pagamentosFormatado,
      prato_mais_vendido: pratoTop || null,
      ranking_pratos: ranking
    });
  } catch (error) {
    console.error("Erro no resumo avançado:", error.message);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao gerar resumo avançado",
      erro: error.message
    });
  }
};

// ===============================
// NOTA DE MANUTENÇÃO
// [KF-BE-027]
// - Reorganizado vendasController.js com rastreio por blocos
// - Mantida a base existente do projeto
// - Inserida função exports.cmvRealPorPrato no lugar correto
// - Mantido exports._helpers após os blocos principais
// - Preservado resumoAvancado no final do arquivo
// ===============================