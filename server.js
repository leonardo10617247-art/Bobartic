const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- LÓGICA DO JOGO NO SERVIDOR ---
let players = {}; // Guarda quem está online
let currentDrawerId = null;
let currentTheme = "";
let timer = null;
let timeLeft = 120;

// Lista de temas
const themes = ["Leão", "Elefante", "Pizza", "Hambúrguer", "Flamengo", "Torre Eiffel", "Cristo Redentor", "Tubarão"];

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    // Jogador entrou
    socket.on('joinGame', (userData) => {
        players[socket.id] = { id: socket.id, name: userData.name, score: 0 };
        
        // Se for o primeiro a entrar, ele começa desenhando
        if (Object.keys(players).length === 1) {
            startNewRound();
        }
        
        updatePlayersList();
    });

    // Jogador desenhou
    socket.on('draw', (data) => {
        // Repassa o desenho para TODOS os outros jogadores
        socket.broadcast.emit('draw', data);
    });

    // Jogador limpou a tela
    socket.on('clearCanvas', () => {
        socket.broadcast.emit('clearCanvas');
    });

    // Jogador escolheu o tema e iniciou
    socket.on('startDrawing', (theme) => {
        if (socket.id === currentDrawerId) {
            currentTheme = theme;
            timeLeft = 120;
            io.emit('roundStarted', { drawerId: currentDrawerId, theme: null }); // Não envia o tema para os adivinhadores
            socket.emit('yourTheme', currentTheme); // Envia o tema só para quem desenha
            
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
                timeLeft--;
                io.emit('timerUpdate', timeLeft);
                if (timeLeft <= 0) {
                    endRound();
                }
            }, 1000);
        }
    });

    // Jogador enviou mensagem no chat
    socket.on('chatMessage', (msg) => {
        const player = players[socket.id];
        if (!player) return;

        // Verifica se acertou o tema
        if (socket.id !== currentDrawerId && msg.toLowerCase() === currentTheme.toLowerCase() && timeLeft > 0) {
            player.score += 10;
            io.emit('correctGuess', { playerName: player.name, theme: currentTheme });
            io.emit('updateScores', players);
            endRound(); // Fim da rodada, passa a vez
        } else {
            io.emit('chatMessage', { name: player.name, text: msg });
        }
    });

    // Jogador saiu
    socket.on('disconnect', () => {
        delete players[socket.id];
        if (socket.id === currentDrawerId) {
            endRound();
        }
        updatePlayersList();
    });
});

function startNewRound() {
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) return;
    
    // Passa para o próximo jogador
    let nextIndex = 0;
    if (currentDrawerId) {
        const currentIndex = playerIds.indexOf(currentDrawerId);
        nextIndex = (currentIndex + 1) % playerIds.length;
    }
    currentDrawerId = playerIds[nextIndex];
    
    io.emit('turnChanged', currentDrawerId);
}

function endRound() {
    if (timer) clearInterval(timer);
    timeLeft = 120;
    currentTheme = "";
    io.emit('roundEnded');
    startNewRound();
}

function updatePlayersList() {
    io.emit('playersList', Object.values(players));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
