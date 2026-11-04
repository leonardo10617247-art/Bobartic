const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o servidor encontre o index.html, style.css e script.js
app.use(express.static(path.join(__dirname)));

// Rota principal que abre o jogo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor do Bobartic rodando na porta ${PORT}`);
});
