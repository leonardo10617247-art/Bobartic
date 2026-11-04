// --- VARIÁVEIS GLOBAIS ---
let currentUser = null; 
let playerScore = 0;
let currentTheme = "";
let roundActive = false;
let canvas, ctx;
let isDrawing = false;
let currentColor = "#000000";
let currentBrushSize = 5;
let pendingAvatarBase64 = null;

// Variáveis do Sistema de Turnos
let playersQueue = []; 
let currentDrawerIndex = 0;
let timerInterval = null;
let timeLeft = 120; 
let currentDrawer = null; 

// --- NOVOS TEMAS ---
const themes = {
    "Animais": ["Leão", "Elefante", "Girafa", "Tubarão", "Águia", "Panda", "Cachorro", "Gato", "Cobra", "Macaco"],
    "Times de Futebol": ["Flamengo", "Corinthians", "Palmeiras", "São Paulo", "Real Madrid", "Barcelona", "Manchester United", "Bayern de Munique", "PSG", "Boca Juniors"],
    "Comida": ["Pizza", "Hambúrguer", "Sushi", "Lasanha", "Churrasco", "Açaí", "Coxinha", "Pão de Queijo", "Tacos", "Sorvete"],
    "Lugares": ["Torre Eiffel", "Pirâmide do Egito", "Cristo Redentor", "Muralha da China", "Coliseu", "Estátua da Liberdade", "Machu Picchu", "Taj Mahal", "Big Ben", "Sydney Opera House"]
};

const curiosities = [
    "A Torre Eiffel pode ficar 15 cm mais alta durante o verão devido à expansão térmica do ferro.",
    "A Muralha da China não é uma única parede contínua, mas uma série de muralhas construídas ao longo de séculos.",
    "O Coliseu de Roma tinha capacidade para cerca de 50.000 espectadores e podia ser inundado para simular batalhas navais.",
    "A Estátua da Liberdade foi um presente da França para os Estados Unidos em 1886.",
    "O Cristo Redentor no Rio de Janeiro levou 9 anos para ser construído e foi inaugurado em 1931.",
    "As pirâmides do Egito são a única das Sete Maravilhas do Mundo Antigo que ainda existe.",
    "Machu Picchu foi construída pelos Incas no século XV e ficou 'esquecida' até 1911.",
    "O Taj Mahal foi construído em mármore branco e muda de cor dependendo da luz do dia."
];

// --- SISTEMA DE CONTAS E LOGIN ---
function getUsers() {
    return JSON.parse(localStorage.getItem('bobartic_users')) || {};
}

function saveUsers(users) {
    localStorage.setItem('bobartic_users', JSON.stringify(users));
}

function showRegister() {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('login-box').classList.remove('hidden');
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingAvatarBase64 = e.target.result;
        document.getElementById('avatar-preview-img').src = pendingAvatarBase64;
    };
    reader.readAsDataURL(file);
}

function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const displayName = document.getElementById('reg-displayname').value.trim();
    const nationality = document.getElementById('reg-nationality').value;
    const msg = document.getElementById('reg-msg');

    if (!username || !password || !displayName || !nationality) {
        msg.textContent = "Preencha todos os campos obrigatórios!";
        return;
    }

    const users = getUsers();
    if (users[username]) {
        msg.textContent = "Este nome de usuário já existe!";
        return;
    }

    users[username] = {
        password: password,
        displayName: displayName,
        nationality: nationality,
        avatar: pendingAvatarBase64 || "https://via.placeholder.com/80?text=?",
        score: 0
    };
    saveUsers(users);

    msg.style.color = "#66fcf1";
    msg.textContent = "Conta criada com sucesso! Faça login.";
    setTimeout(() => {
        showLogin();
        document.getElementById('login-username').value = username;
        msg.style.color = "#ff4c4c";
        msg.textContent = "";
    }, 1500);
}

function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!username || !password) {
        msg.textContent = "Preencha todos os campos!";
        return;
    }

    const users = getUsers();
    if (!users[username]) {
        msg.textContent = "Usuário não encontrado! Crie uma conta.";
        return;
    }

    if (users[username].password !== password) {
        msg.textContent = "Senha incorreta!";
        return;
    }

    currentUser = username;
    const userData = users[username];

    document.getElementById('header-displayname').textContent = userData.displayName;
    document.getElementById('header-nationality').textContent = userData.nationality;
    document.getElementById('header-avatar').src = userData.avatar;

    playerScore = userData.score || 0;
    document.getElementById('player-score').textContent = playerScore;

    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    msg.textContent = "";
    document.getElementById('login-password').value = "";

    if (!playersQueue.includes(username)) {
        playersQueue.push(username);
    }

    initGame();
}

function logout() {
    saveProgress();
    currentUser = null;
    clearInterval(timerInterval);
    
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('login-username').value = "";
    document.getElementById('login-password').value = "";
}

function saveProgress() {
    if (!currentUser) return;
    const users = getUsers();
    if (users[currentUser]) {
        users[currentUser].score = playerScore;
        saveUsers(users);
    }
}

// --- LÓGICA DO JOGO E TURNOS ---
function initGame() {
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('chat-messages').innerHTML = "";
    roundActive = false;
    
    setupCanvas();
    clearCanvas();
    
    addChatMessage("Sistema", "Bem-vindo ao Bobartic! Aguardando o início da rodada.", "chat-system");

    checkTurn();
}

function checkTurn() {
    if (playersQueue.length === 0) {
        document.getElementById('turn-status').textContent = "Nenhum jogador na fila.";
        document.getElementById('timer-display').textContent = "--:--";
        return;
    }

    currentDrawer = playersQueue[currentDrawerIndex];
    const users = getUsers();
    const drawerName = users[currentDrawer]?.displayName || currentDrawer;

    if (currentUser === currentDrawer) {
        document.getElementById('turn-status').textContent = "Sua vez de desenhar!";
        document.getElementById('draw-tools').style.display = "flex";
        document.getElementById('theme-box').style.display = "flex";
        
        const select = document.getElementById('theme-select');
        select.innerHTML = '<option value="">-- Escolha o que vai desenhar --</option>';
        
        for (const [category, items] of Object.entries(themes)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                opt.textContent = item;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
        
        addChatMessage("Sistema", "É a sua vez de desenhar! Escolha um tema e clique em 'Iniciar Desenho'.", "chat-system");
    } else {
        document.getElementById('turn-status').textContent = `Vez de ${drawerName} desenhar!`;
        document.getElementById('draw-tools').style.display = "none";
        document.getElementById('theme-box').style.display = "none";
        
        addChatMessage("Sistema", `Aguarde... ${drawerName} está desenhando. Fique atento ao chat para adivinhar!`, "chat-system");
        
        clearCanvas();
    }
}

function startDrawingTurn() {
    const select = document.getElementById('theme-select');
    currentTheme = select.value;

    if (!currentTheme) {
        addChatMessage("Sistema", "Você precisa selecionar um tema primeiro!", "chat-wrong");
        return;
    }

    roundActive = true;
    
    document.getElementById('turn-status').textContent = `Desenhe: ${currentTheme}`;
    
    clearCanvas();
    select.value = "";
    
    document.getElementById('btn-start-round').style.display = "none";
    
    addChatMessage("Sistema", `A rodada começou! O tema é secreto. Desenhe!`, "chat-system");
    
    startTimer();
}

function startTimer() {
    timeLeft = 120;
    updateTimerDisplay();
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endRound();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer-display').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function endRound() {
    roundActive = false;
    clearInterval(timerInterval);
    
    addChatMessage("Sistema", `O tempo acabou! O tema era: ${currentTheme || 'Não revelado'}.`, "chat-system");
    
    if (playersQueue.length > 0) {
        currentDrawerIndex = (currentDrawerIndex + 1) % playersQueue.length;
    }
    
    document.getElementById('btn-start-round').style.display = "block";
    document.getElementById('theme-select').value = "";
    document.getElementById('timer-display').textContent = "02:00";
    
    checkTurn();
}

// --- LÓGICA DO CHAT ---
function handleChatEnter(e) {
    if (e.key === 'Enter') {
        sendChat();
    }
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text === "") return;

    const users = getUsers();
    const displayName = users[currentUser]?.displayName || currentUser;

    addChatMessage(displayName, text, "chat-msg");
    input.value = "";

    if (roundActive && currentUser !== currentDrawer) {
        if (text.toLowerCase() === currentTheme.toLowerCase()) {
            addChatMessage("Sistema", `Você acertou! +10 pontos. O tema era: ${currentTheme}`, "chat-correct");
            playerScore += 10;
            document.getElementById('player-score').textContent = playerScore;
            saveProgress();

            if (playerScore >= 100) {
                endGame(true);
            } else {
                endRound(); 
            }
        } else {
            addChatMessage("Sistema", "Você errou! Tente novamente.", "chat-wrong");
        }
    } else if (roundActive && currentUser === currentDrawer) {
        addChatMessage("Sistema", "Você está desenhando! Espere alguém adivinhar.", "chat-system");
    } else {
        addChatMessage("Sistema", "Nenhuma rodada ativa no momento para adivinhar.", "chat-system");
    }
}

function addChatMessage(sender, text, className) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = className || "chat-msg";
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- LÓGICA DO CANVAS (DESENHO) ---
function setupCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Remove listeners antigos para não duplicar
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
    canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    if (!roundActive || currentUser !== currentDrawer) return;
    isDrawing = true;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    
    // ESSENCIAL: começa o caminho e move para a posição do clique
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    // ESSENCIAL: aplicar a cor e o tamanho atuais a cada traço
    ctx.lineWidth = currentBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

// --- CONFIGURAÇÃO DOS CONTROLES (COR E PINCEL) ---
// Estes eventos são configurados apenas UMA VEZ quando a página é carregada.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('color-picker').addEventListener('input', (e) => {
        currentColor = e.target.value;
        console.log("Cor selecionada:", currentColor); // Ajuda a debugar no console
    });
    document.getElementById('brush-size').addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value);
    });
});

function startDrawing(e) {
    if (!roundActive || currentUser !== currentDrawer) return; 
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    ctx.lineWidth = currentBrushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
}

// --- LÓGICA DE FIM DE JOGO ---
function endGame(win) {
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('game-over-title');
    const msg = document.getElementById('game-over-msg');
    
    const users = getUsers();
    const displayName = users[currentUser]?.displayName || currentUser;
    
    if (win) {
        title.textContent = "Você Venceu!";
        title.style.color = "#66fcf1";
        msg.textContent = `Parabéns, ${displayName}! Você atingiu 100 pontos e dominou o Bobartic!`;
    } else {
        title.textContent = "Fim de Jogo";
        title.style.color = "#ff4c4c";
        msg.textContent = "Você perdeu... Tente novamente!";
    }
    
    modal.classList.remove('hidden');
    clearInterval(timerInterval);
}

function restartGame() {
    playerScore = 0;
    document.getElementById('player-score').textContent = playerScore;
    saveProgress();
    
    currentDrawerIndex = 0;
    initGame();
}

// --- LÓGICA DE CURIOSIDADES ---
let curiosityIndex = 0;
function nextCuriosity() {
    document.getElementById('curiosity-text').textContent = curiosities[curiosityIndex];
    curiosityIndex = (curiosityIndex + 1) % curiosities.length;
}
