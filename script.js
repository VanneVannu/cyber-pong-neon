// ===================================================
// VARIABLES DEL MOTOR FÍSICO LOCAL INDESTRUCTIBLE
// ===================================================
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas.getContext('2d');

let scoreP1 = 0;
let scoreP2 = 0;
let modoActual = 'ai'; // 'ai' o '2p'
let dificultadIa = 'medium'; 
let aliasJugadorLocal = "PLAYER_1";

// Paletas vectoriales
const paletaAncho = 12;
const paletaAlto = 75;

const p1 = { x: 20, y: 162 };
const p2 = { x: 568, y: 162 };
const bola = { x: 300, y: 200, radio: 6, vx: 0, vy: 0, enJuego: false };

const velocidadPaleta = 6; // Velocidad óptima arcade para el teclado compartido
const teclasPresionadas = {};

// ===================================================
// CAPTURA DE TECLADO MULTIBOTÓN SIMULTÁNEO
// ===================================================
window.addEventListener('keydown', e => {
    const teclaLimpia = e.key ? e.key.toLowerCase() : "";
    teclasPresionadas[teclaLimpia] = true;
    if ([" ", "arrowup", "arrowdown", "w", "s"].includes(teclaLimpia)) {
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    const teclaLimpia = e.key ? e.key.toLowerCase() : "";
    teclasPresionadas[teclaLimpia] = false;
});

// ===================================================
// INICIALIZADORES DEL JUEGO LOCAL GABINETE
// ===================================================
function inicializarModoLocal(modoElegido) {
    modoActual = modoElegido; // Guarda 'ai' o '2p'
    
    aliasJugadorLocal = document.getElementById('input-alias').value.trim() || "PLAYER_1";
    dificultadIa = document.getElementById('select-diff').value;

    document.getElementById('label-p1').innerText = aliasJugadorLocal;

    if (modoActual === 'ai') {
        document.getElementById('label-p2').innerText = `AI_BOT (${dificultadIa.toUpperCase()})`;
        document.getElementById('txt-guia-controles').innerText = "CONTROLS: [W] MOVE UP // [S] MOVE DOWN";
    } else {
        document.getElementById('label-p2').innerText = "PLAYER_2 👥";
        document.getElementById('txt-guia-controles').innerText = "P1: [W/S] MOVE UP/DOWN  ||  P2: [▲/▼] ARROW KEYS MOVE";
    }
    
    conmutarPantallasVisibles_Pong(true);
    reiniciarMarcadoresArena();
}

// ===================================================
// MOTOR FÍSICO RECURSIVO LOCAL (CORE LOOP)
// ===================================================
function actualizarFisicasLocales() {
    if (!p1 || !p2 || !bola) return;

    // 1. Control Jugador 1 (W / S)
    if (teclasPresionadas['w']) p1.y = Math.max(5, p1.y - velocidadPaleta);
    if (teclasPresionadas['s']) p1.y = Math.min(canvas.height - paletaAlto - 5, p1.y + velocidadPaleta);

    // 2. Filtro de control paleta derecha (Jugador 2 o IA)
    if (modoActual === '2p') {
        if (teclasPresionadas['arrowup']) p2.y = Math.max(5, p2.y - velocidadPaleta);
        if (teclasPresionadas['arrowdown']) p2.y = Math.min(canvas.height - paletaAlto - 5, p2.y + velocidadPaleta);
    } else {
        let velocidadIa = dificultadIa === 'easy' ? 2.5 : dificultadIa === 'medium' ? 4.2 : 5.8;
        let centroPaletaIa = p2.y + paletaAlto / 2;
        if (bola.vx > 0) {
            if (bola.y < centroPaletaIa - 10) p2.y = Math.max(5, p2.y - velocidadIa);
            else if (bola.y > centroPaletaIa + 10) p2.y = Math.min(canvas.height - paletaAlto - 5, p2.y + velocidadIa);
        }
    }

    // 3. Físicas de rebote de la bola
    if (bola.enJuego) {
        bola.x += bola.vx;
        bola.y += bola.vy;

        if (bola.y - bola.radio <= 0 || bola.y + bola.radio >= canvas.height) {
            bola.vy *= -1;
            sonarTonoRetroMini(400, 0.04);
        }

        if (bola.vx < 0 && bola.x - bola.radio <= p1.x + paletaAncho && bola.x + bola.radio >= p1.x) {
            if (bola.y >= p1.y && bola.y <= p1.y + paletaAlto) {
                bola.vx *= -1.05;
                let deltaY = bola.y - (p1.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(600, 0.05);
            }
        }

        if (bola.vx > 0 && bola.x + bola.radio >= p2.x && bola.x - bola.radio <= p2.x + paletaAncho) {
            if (bola.y >= p2.y && bola.y <= p2.y + paletaAlto) {
                bola.vx *= -1.05;
                let deltaY = bola.y - (p2.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(650, 0.05);
            }
        }

        if (bola.x < 0) { scoreP2++; saquearBolaAlCentro(1); }
        else if (bola.x > canvas.width) { scoreP1++; saquearBolaAlCentro(-1); }
    }
}

// ===================================================
// MOTOR GRÁFICO (DIBUJAR)
// ===================================================
function dibujarArenaVectores() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(0, 255, 102, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();

    ctx.fillStyle = "#00ff66"; ctx.shadowBlur = 10; ctx.shadowColor = "#00ff66";
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    if (bola.enJuego) {
        ctx.fillStyle = "#ffcc00"; ctx.shadowColor = "#ffcc00";
        ctx.beginPath(); ctx.arc(bola.x, bola.y, bola.radio, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0;
}

// ===================================================
// NÚCLEO DE ACCIONES Y REINICIOS RETRO
// ===================================================
function congelarOSaqueBola() {
    if (bola.enJuego) return;
    let dirX = Math.random() > 0.5 ? 1 : -1;
    bola.vx = dirX * 3.8;
    bola.vy = (Math.random() - 0.5) * 3;
    bola.enJuego = true;
    sonarTonoRetroMini(800, 0.08);
}

function saquearBolaAlCentro(direccion) {
    bola.x = canvas.width / 2;
    bola.y = canvas.height / 2;
    bola.vx = 0; bola.vy = 0;
    bola.enJuego = false;
    
    document.getElementById('score-p1').innerText = scoreP1;
    document.getElementById('score-p2').innerText = scoreP2;
    sonarTonoRetroMini(250, 0.25);
}

function reiniciarMarcadoresArena() {
    scoreP1 = 0; scoreP2 = 0;
    document.getElementById('score-p1').innerText = "0";
    document.getElementById('score-p2').innerText = "0";
    p1.y = 162; p2.y = 162;
    saquearBolaAlCentro(1);
}

function conmutarPantallasVisibles_Pong(entrarEnArena) {
    if (entrarEnArena) {
        document.getElementById('menu-inicio').classList.add('oculto');
        document.getElementById('escenario-juego').classList.remove('oculto');
    } else {
        document.getElementById('menu-inicio').classList.remove('oculto');
        document.getElementById('escenario-juego').classList.add('oculto');
    }
}

function regresarAlMenuInicial_Pong() {
    conmutarPantallasVisibles_Pong(false);
}

function sonarTonoRetroMini(f, d) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + d);
    } catch(e){}
}

// BUCLE DE FOTOGRAMAS ETERNO 60 FPS LOCAL
function bucleFisicoEterno_Pong() {
    actualizarFisicasLocales();
    dibujarArenaVectores();
    requestAnimationFrame(bucleFisicoEterno_Pong);
}

// AMARRE DE EVENTOS DE CLIC MAESTRO AL TERMINAR DE CARGAR EL DOM
document.addEventListener("DOMContentLoaded", () => {
    const btnAI = document.getElementById("btn-play-ai");
    const btn2P = document.getElementById("btn-play-2p");

    if (btnAI) {
        btnAI.onclick = function(e) {
            e.preventDefault();
            inicializarModoLocal('ai');
        };
    }
    if (btn2P) {
        btn2P.onclick = function(e) {
            e.preventDefault();
            inicializarModoLocal('2p');
        };
    }
});

// ENCENDIDO DEL MOTOR GRÁFICO ETERNO
bucleFisicoEterno_Pong();
