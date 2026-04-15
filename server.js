const express = require("express");
const cors = require("cors");
const path = require("path");

// Inicializa banco
require("./database.js");

const app = express();

// ===============================
// MIDDLEWARES
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// ROTAS DA API
// ===============================
const insumosRoutes = require("./routes/insumos");
const fichasRoutes = require("./routes/fichas");
const pratosRoutes = require("./routes/pratos");
const movimentacoesRoutes = require("./routes/movimentacoes");
const vendasRoutes = require("./routes/vendas");
const comandasRoutes = require("./routes/comandas");
const mesasRoutes = require("./routes/mesas");

// ===============================
// REGISTRO DAS ROTAS
// ===============================
app.use("/insumos", insumosRoutes);
app.use("/fichas", fichasRoutes);
app.use("/pratos", pratosRoutes);
app.use("/movimentacoes", movimentacoesRoutes);
app.use("/vendas", vendasRoutes);
app.use("/comandas", comandasRoutes);
app.use("/mesas", mesasRoutes);

// ===============================
// ROTA PRINCIPAL
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// START DO SERVIDOR
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
