// --- CONEXÃO COM O SERVIDOR ---
const socket = io();
let currentUser = null;
let canvas, ctx;
let isDrawing = false;
let currentColor = "#000000";
let currentBrushSize = 5;

// Variáveis de estado do jogador
let myScore = 0;
let isMyTurn = false;

const colorPalette = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500"];

// --- SISTEMA DE LOGIN E CONTA ---
function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!username || !password) {
        msg.textContent = "Preencha todos os campos!";
        return;
    }

    // Simulação local de login (você pode adaptar para o banco real depois)
    currentUser = username;
    document.getElementById('header-displayname').textContent = username;
    document.getElementById('player-score').textContent = 0;
    
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    // Avisa o servidor que entramos
    socket.emit('joinGame', { name: username });
    
    setupCanvas();
    buildPalette();
    clearCanvas();
}

// --- LÓGICA DE MULTIPLAYER (Ouvindo o Servidor) ---
socket.on('playersList', (players) => {
    addChatMessage("Sistema", `Jogadores online: ${players.map(p => p.name).join(', ')}`, "chat-system");
});

socket.on('turnChanged', (drawerId) => {
    isMyTurn = (drawerId === socket.id);
    
    if (isMyTurn) {
        document.getElementById('turn-status').textContent = "Sua vez de desenhar!";
        document.getElementById('draw-tools').style.display = "flex";
        document.getElementById('theme-box').style.display = "flex";
        
        // Popula o select de temas
        const select = document.getElementById('theme-select');
        select.innerHTML = '<option value="">Escolha...</option>';
        ["Leão", "Elefante", "Pizza", "Hambúrguer", "Flamengo", "Torre Eiffel", "Cristo Redentor", "Tubarão"].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t;
            select.appendChild(opt);
        });
    } else {
        document.getElementById('turn-status').textContent = "Aguarde, outro jogador está desenhando...";
        document.getElementById('draw-tools').style.display = "none";
        document.getElementById('theme-box').style.display = "none";
        clearCanvas();
    }
});

socket.on('yourTheme', (theme) => {
    document.getElementById('turn-status').textContent = `Desenhe: ${theme}`;
    document.getElementById('theme-box').style.display = "none"; // Esconde a seleção
    document.getElementById('btn-start-round').style.display = "none";
});

socket.on('draw', (data) => {
    // Desenha o que o outro jogador desenhou
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.color;
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

socket.on('timerUpdate', (time) => {
    document.getElementById('timer-display').textContent = `00:${time.toString().padStart(2, '0')}`;
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.name, data.text, "chat-msg");
});

socket.on('correctGuess', (data) => {
    addChatMessage("Sistema", `${data.playerName} acertou! O tema era: ${data.theme}`, "chat-correct");
});

socket.on('roundEnded', () => {
    document.getElementById('timer-display').textContent = "02:00";
});

// --- AÇÕES DO JOGADOR ---
function startDrawingTurn() {
    const theme = document.getElementById('theme-select').value;
    if (!theme) {
        addChatMessage("Sistema", "Escolha um tema!", "chat-wrong");
        return;
    }
    socket.emit('startDrawing', theme);
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text === "") return;
    
    // Envia para o servidor verificar se acertou
    socket.emit('chatMessage', text);
    input.value = "";
}

// --- CONFIGURAÇÃO DO CANVAS ---
function setupCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    canvas.addEventListener('mousedown', (e) => {
        if (!isMyTurn) return;
        isDrawing = true;
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !isMyTurn) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.lineWidth = currentBrushSize;
        ctx.strokeStyle = currentColor;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        // Envia para o servidor
        socket.emit('draw', { x: x, y: y, color: currentColor, size: currentBrushSize });
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; ctx.beginPath(); });
    
    document.getElementById('brush-size').addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value);
    });
}

function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
}

function buildPalette() {
    const paletteDiv = document.getElementById('palette');
    paletteDiv.innerHTML = '';
    colorPalette.forEach((color, index) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;
        if (index === 0) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentColor = color;
        });
        paletteDiv.appendChild(btn);
    });
}

function addChatMessage(sender, text, className) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = className || "chat-msg";
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleChatEnter(e) { if (e.key === 'Enter') sendChat(); }
