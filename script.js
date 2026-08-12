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
    teclasPresionadas[e.key.toLowerCase()] = true;
    // Evitamos el scroll de la ventana al usar los controles
    if ([" ", "arrowup", "arrowdown", "w", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => teclasPresionadas[e.key.toLowerCase()] = false);

// ===================================================
// INICIALIZADORES DEL JUEGO LOCAL GABINETE (REPARADO)
// ===================================================
function inicializarModoLocal(modoElegido) {
    // Sincronizamos de forma exacta el modo con lo que envían tus botones en el HTML
    modoActual = modoElegido; // Guarda 'ai' o '2p'
    
    // Capturamos los elementos del formulario neón
    aliasJugadorLocal = document.getElementById('input-alias').value.trim() || "PLAYER_1";
    dificultadIa = document.getElementById('select-diff').value;

    document.getElementById('label-p1').innerText = aliasJugadorLocal;

    // Aplicamos los cambios estéticos de rango según el modo
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

    // 1. CONTROL JUGADOR 1 (SIEMPRE CON 'W' / 'S')
    if (teclasPresionadas['w']) p1.y = Math.max(5, p1.y - velocidadPaleta);
    if (teclasPresionadas['s']) p1.y = Math.min(canvas.height - paletaAlto - 5, p1.y + velocidadPaleta);

    // 2. FILTRO DE CONTROL PALETA DERECHA (JUGADOR 2 o INTELIGENCIA ARTIFICIAL)
    if (modoActual === '2p') {
        // MODO DOS JUGADORES: Captura las flechas físicas ArrowUp y ArrowDown
        if (teclasPresionadas['arrowup']) p2.y = Math.max(5, p2.y - velocidadPaleta);
        if (teclasPresionadas['arrowdown']) p2.y = Math.min(canvas.height - paletaAlto - 5, p2.y + velocidadPaleta);
    } else {
        // MODO INTELIGENCIA ARTIFICIAL: Persigue la bola de forma algorítmica calibrada
        let velocidadIa = dificultadIa === 'easy' ? 2.5 : dificultadIa === 'medium' ? 4.2 : 5.8;
        let centroPaletaIa = p2.y + paletaAlto / 2;
        if (bola.vx > 0) {
            if (bola.y < centroPaletaIa - 10) p2.y = Math.max(5, p2.y - velocidadIa);
            else if (bola.y > centroPaletaIa + 10) p2.y = Math.min(canvas.height - paletaAlto - 5, p2.y + velocidadIa);
        }
    }

    // 3. FÍSICAS REBOTE BALÍSTICO DE LA BOLA
    if (bola.enJuego) {
        bola.x += bola.vx;
        bola.y += bola.vy;

        // Rebote con Techo y Piso
        if (bola.y - bola.radio <= 0 || bola.y + bola.radio >= canvas.height) {
            bola.vy *= -1;
            sonarTonoRetroMini(400, 0.04);
        }

        // Rebote Paleta 1 (Izquierda)
        if (bola.vx < 0 && bola.x - bola.radio <= p1.x + paletaAncho && bola.x + bola.radio >= p1.x) {
            if (bola.y >= p1.y && bola.y <= p1.y + paletaAlto) {
                bola.vx *= -1.05; // Aceleración orbital arcade
                let deltaY = bola.y - (p1.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(600, 0.05);
            }
        }

        // Rebote Paleta 2 (Derecha)
        if (bola.vx > 0 && bola.x + bola.radio >= p2.x && bola.x - bola.radio <= p2.x + paletaAncho) {
            if (bola.y >= p2.y && bola.y <= p2.y + paletaAlto) {
                bola.vx *= -1.05;
                let deltaY = bola.y - (p2.y + paletaAlto / 2);
                bola.vy = deltaY * 0.22;
                sonarTonoRetroMini(650, 0.05);
            }
        }

        // Detección de Anotación de Puntos
        if (bola.x < 0) { scoreP2++; saquearBolaAlCentro(1); }
        else if (bola.x > canvas.width) { scoreP1++; saquearBolaAlCentro(-1); }
    }
}

function dibujarArenaVectores() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Malla divisoria central
    ctx.strokeStyle = "rgba(0, 255, 102, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();

    // Dibujamos las Paletas en Verde Neón Fósforo
    ctx.fillStyle = "#00ff66"; ctx.shadowBlur = 10; ctx.shadowColor = "#00ff66";
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    // Dibujamos la Bola en Ámbar brillante
    if (bola.enJuego) {
        ctx.fillStyle = "#ffcc00"; ctx.shadowColor = "#ffcc00";
        ctx.beginPath(); ctx.arc(bola.x, bola.y, bola.radio, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0; // Apagamos sombras pesadas para estabilizar FPS
}

function congelarOSaqueBola() {
    if (bola.enJuego) return;

    // Dirección inicial aleatoria del saque
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
    sonarTonoRetroMini(250, 0.25); // Pitido grave de anotación
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
bucleFisicoEterno_Pong();
