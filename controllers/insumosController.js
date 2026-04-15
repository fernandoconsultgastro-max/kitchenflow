const db = require("../database");

// ===============================
// LISTAR INSUMOS
// ===============================
exports.listarInsumos = (req, res) => {
  const sql = `SELECT * FROM insumos ORDER BY categoria, nome`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar insumos:", err.message);
      return res.status(500).json({ erro: "Erro ao listar insumos" });
    }

    res.json(rows);
  });
};

// ===============================
// CRIAR INSUMO
// ===============================
exports.criarInsumo = (req, res) => {
  const { nome, categoria, unidade, quantidade, custo, observacao } = req.body;

  if (!nome || !unidade) {
    return res.status(400).json({ erro: "Nome e unidade são obrigatórios" });
  }

  const sql = `
    INSERT INTO insumos 
    (nome, categoria, unidade, quantidade, custo, observacao)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      nome,
      categoria || "Sem categoria",
      unidade,
      quantidade || 0,
      custo || 0,
      observacao || ""
    ],
    function (err) {
      if (err) {
        console.error("Erro ao criar insumo:", err.message);
        return res.status(500).json({ erro: "Erro ao criar insumo" });
      }

      res.json({
        id: this.lastID,
        mensagem: "Insumo criado com sucesso"
      });
    }
  );
};

// ===============================
// ATUALIZAR INSUMO
// ===============================
exports.atualizarInsumo = (req, res) => {
  const { id } = req.params;
  const { nome, categoria, unidade, quantidade, custo, observacao } = req.body;

  const sql = `
    UPDATE insumos
    SET nome = ?, categoria = ?, unidade = ?, quantidade = ?, custo = ?, observacao = ?
    WHERE id = ?
  `;

  db.run(
    sql,
    [
      nome,
      categoria || "Sem categoria",
      unidade,
      quantidade || 0,
      custo || 0,
      observacao || "",
      id
    ],
    function (err) {
      if (err) {
        console.error("Erro ao atualizar insumo:", err.message);
        return res.status(500).json({ erro: "Erro ao atualizar insumo" });
      }

      res.json({ mensagem: "Insumo atualizado com sucesso" });
    }
  );
};

// ===============================
// EXCLUIR INSUMO
// ===============================
exports.excluirInsumo = (req, res) => {
  const { id } = req.params;

  const sql = `DELETE FROM insumos WHERE id = ?`;

  db.run(sql, [id], function (err) {
    if (err) {
      console.error("Erro ao excluir insumo:", err.message);
      return res.status(500).json({ erro: "Erro ao excluir insumo" });
    }

    res.json({ mensagem: "Insumo excluído com sucesso" });
  });
};