const db = require("../database");

// ===============================
// REGISTRAR ENTRADA (COMPRA)
// ===============================
exports.entrada = (req, res) => {
  const { insumo_id, quantidade } = req.body;

  if (!insumo_id || !quantidade) {
    return res.status(400).json({ erro: "Dados obrigatórios" });
  }

  // 1. Registrar movimentação
  const sqlMov = `
    INSERT INTO movimentacoes (insumo_id, tipo, quantidade)
    VALUES (?, 'entrada', ?)
  `;

  db.run(sqlMov, [insumo_id, quantidade], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao registrar entrada" });
    }

    // 2. Atualizar estoque no insumo
    const sqlUpdate = `
      UPDATE insumos
      SET quantidade = quantidade + ?
      WHERE id = ?
    `;

    db.run(sqlUpdate, [quantidade, insumo_id], (err2) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ erro: "Erro ao atualizar estoque" });
      }

      res.json({ mensagem: "Entrada registrada com sucesso" });
    });
  });
};

// ===============================
// REGISTRAR SAÍDA (USO)
// ===============================
exports.saida = (req, res) => {
  const { insumo_id, quantidade } = req.body;

  if (!insumo_id || !quantidade) {
    return res.status(400).json({ erro: "Dados obrigatórios" });
  }

  // 1. Verificar estoque atual
  db.get(`SELECT quantidade FROM insumos WHERE id = ?`, [insumo_id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao consultar estoque" });
    }

    if (!row || row.quantidade < quantidade) {
      return res.status(400).json({ erro: "Estoque insuficiente" });
    }

    // 2. Registrar movimentação
    const sqlMov = `
      INSERT INTO movimentacoes (insumo_id, tipo, quantidade)
      VALUES (?, 'saida', ?)
    `;

    db.run(sqlMov, [insumo_id, quantidade], function (err2) {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ erro: "Erro ao registrar saída" });
      }

      // 3. Atualizar estoque
      const sqlUpdate = `
        UPDATE insumos
        SET quantidade = quantidade - ?
        WHERE id = ?
      `;

      db.run(sqlUpdate, [quantidade, insumo_id], (err3) => {
        if (err3) {
          console.error(err3);
          return res.status(500).json({ erro: "Erro ao atualizar estoque" });
        }

        res.json({ mensagem: "Saída registrada com sucesso" });
      });
    });
  });
};

// ===============================
// LISTAR MOVIMENTAÇÕES
// ===============================
exports.listar = (req, res) => {
  const sql = `
    SELECT m.*, i.nome AS insumo_nome
    FROM movimentacoes m
    JOIN insumos i ON i.id = m.insumo_id
    ORDER BY m.data DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao listar movimentações" });
    }

    res.json(rows);
  });
};