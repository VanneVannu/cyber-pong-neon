// ===================================================
// MOTOR FÍSICO OPTIMIZADO - CYBER PONG
// ===================================================
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas ? canvas.getContext('2d') : null;

let scoreP1 = 0;
let scoreP2 = 0;
let modoActual = 'ai'; 
let dificultadIa = 'medium'; 
let aliasJugadorLocal = "PLAYER_1";
let loopId = null; // Control para evitar bucles duplicados

// Un solo AudioContext global para evitar colapso de memoria
let audioCtx = null;
function obtenerAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Paletas vectoriales
const paletaAncho = 12;
const paletaAlto = 75;

const p1 = { x: 20, y: 162 };
const p2 = { x: 568, y: 162 };
const bola = { x: 300, y: 200, radio: 6, vx: 0, vy: 0, enJuego: false };

const velocidadPaleta = 6;
const teclasPresionadas = {};

// Captura segura de teclado
window.addEventListener('keydown', e => {
    const teclaLimpia = e.key ? e.key.toLowerCase() : "";
    teclasPresionadas[teclaLimpia] = true;
    if ([" ", "arrowup", "arrowdown", "w", "s"].includes(teclaLimpia)) {
        e.preventDefault();
    }
    // Saque al presionar espacio
    if (teclaLimpia === " " || teclaLimpia === "spacebar") {
        congelarOSaqueBola();
    }
});

window.addEventListener('keyup', e => {
    const teclaLimpia = e.key ? e.key.toLowerCase() : "";
    teclasPresionadas[teclaLimpia] = false;
});

function inicializarModoLocal(modoElegido) {
    modoActual = modoElegido;
    
    const inputAlias = document.getElementById('input-alias');
    const selectDiff = document.getElementById('select-diff');
    const labelP1 = document.getElementById('label-p1');
    const labelP2 = document.getElementById('label-p2');
    const txtGuia = document.getElementById('txt-guia-controles');

    aliasJugadorLocal = inputAlias ? inputAlias.value.trim() : "PLAYER_1";
    dificultadIa = selectDiff ? selectDiff.value : "medium";

    if (labelP1) labelP1.innerText = aliasJugadorLocal;

    if (modoActual === 'ai') {
        if (labelP2) labelP2.innerText = `AI_BOT (${dificultadIa.toUpperCase()})`;
        if (txtGuia) txtGuia.innerText = "CONTROLS: [W] MOVE UP // [S] MOVE DOWN // [SPACE] SERVE";
    } else {
        if (labelP2) labelP2.innerText = "PLAYER_2 👥";
        if (txtGuia) txtGuia.innerText = "P1: [W/S] || P2: [▲/▼] || [SPACE] SERVE";
    }
    
    conmutarPantallasVisibles_Pong(true);
    reiniciarMarcadoresArena();
    iniciarBucleJuego();
}

function actualizarFisicasLocales() {
    if (!p1 || !p2 || !bola || !canvas) return;

    // 1. Control Jugador 1 (W / S)
    if (teclasPresionadas['w']) p1.y = Math.max(5, p1.y - velocidadPaleta);
    if (teclasPresionadas['s']) p1.y = Math.min(canvas.height - paletaAlto - 5, p1.y + velocidadPaleta);

    // 2. Control Jugador 2 o IA
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

    // 3. Rebotes y colisiones de la pelota
    if (bola.enJuego) {
        bola.x += bola.vx;
        bola.y += bola.vy;

        // Muros superior e inferior
        if (bola.y - bola.radio <= 0 || bola.y + bola.radio >= canvas.height) {
            bola.vy *= -1;
            sonarTonoRetroMini(400, 0.04);
        }

        // Colisión Paleta P1 (Repocisionamiento para evitar loop de rebote)
        if (bola.vx < 0 && bola.x - bola.radio <= p1.x + paletaAncho && bola.x + bola.radio >= p1.x) {
            if (bola.y >= p1.y && bola.y <= p1.y + paletaAlto) {
                bola.vx = Math.min(Math.abs(bola.vx) * 1.05, 14); // Límite de velocidad
                bola.x = p1.x + paletaAncho + bola.radio; // Expulsa la bola de la paleta
                let deltaY = bola.y - (p1.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(600, 0.05);
            }
        }

        // Colisión Paleta P2
        if (bola.vx > 0 && bola.x + bola.radio >= p2.x && bola.x - bola.radio <= p2.x + paletaAncho) {
            if (bola.y >= p2.y && bola.y <= p2.y + paletaAlto) {
                bola.vx = -Math.min(Math.abs(bola.vx) * 1.05, 14);
                bola.x = p2.x - bola.radio;
                let deltaY = bola.y - (p2.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(650, 0.05);
            }
        }

        // Anotación de puntos
        if (bola.x < 0) { scoreP2++; saquearBolaAlCentro(1); }
        else if (bola.x > canvas.width) { scoreP1++; saquearBolaAlCentro(-1); }
    }
}

function dibujarArenaVectores() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Línea central
    ctx.strokeStyle = "rgba(0, 255, 102, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(canvas.width / 2, 0); 
    ctx.lineTo(canvas.width / 2, canvas.height); 
    ctx.stroke();

    // Paletas sin exceso de shadowBlur para proteger los FPS
    ctx.fillStyle = "#00ff66";
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    if (bola.enJuego) {
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath(); 
        ctx.arc(bola.x, bola.y, bola.radio, 0, Math.PI * 2); 
        ctx.fill();
    }
}

function congelarOSaqueBola() {
    if (bola.enJuego) return;
    let dirX = Math.random() > 0.5 ? 1 : -1;
    bola.vx = dirX * 3.8;
    bola.vy = (Math.random() - 0.5) * 3;
    bola.enJuego = true;
    sonarTonoRetroMini(800, 0.08);
}

function saquearBolaAlCentro(direccion) {
    if (!canvas) return;
    bola.x = canvas.width / 2;
    bola.y = canvas.height / 2;
    bola.vx = 0; 
    bola.vy = 0;
    bola.enJuego = false;
    
    const elemP1 = document.getElementById('score-p1');
    const elemP2 = document.getElementById('score-p2');
    if (elemP1) elemP1.innerText = scoreP1;
    if (elemP2) elemP2.innerText = scoreP2;
    sonarTonoRetroMini(250, 0.25);
}

function reiniciarMarcadoresArena() {
    scoreP1 = 0; 
    scoreP2 = 0;
    const elemP1 = document.getElementById('score-p1');
    const elemP2 = document.getElementById('score-p2');
    if (elemP1) elemP1.innerText = "0";
    if (elemP2) elemP2.innerText = "0";
    p1.y = 162; 
    p2.y = 162;
    saquearBolaAlCentro(1);
}

function conmutarPantallasVisibles_Pong(entrarEnArena) {
    const menu = document.getElementById('menu-inicio');
    const escenario = document.getElementById('escenario-juego');
    if (menu && escenario) {
        if (entrarEnArena) {
            menu.classList.add('oculto');
            escenario.classList.remove('oculto');
        } else {
            menu.classList.remove('oculto');
            escenario.classList.add('oculto');
        }
    }
}

function sonarTonoRetroMini(f, d) {
    try {
        const ctxAudio = obtenerAudioContext();
        if (!ctxAudio) return;
        
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(f, ctxAudio.currentTime);
        gain.gain.setValueAtTime(0.03, ctxAudio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctxAudio.currentTime + d);
        osc.connect(gain); 
        gain.connect(ctxAudio.destination);
        osc.start(); 
        osc.stop(ctxAudio.currentTime + d);
    } catch(e) {}
}

function iniciarBucleJuego() {
    if (loopId) cancelAnimationFrame(loopId); // Cancela bucles previos
    
    function bucle() {
        actualizarFisicasLocales();
        dibujarArenaVectores();
        loopId = requestAnimationFrame(bucle);
    }
    bucle();
}

// Iniciar bucle de forma limpia al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    iniciarBucleJuego();
});
