//Parte 1: Dimensiones, Coordenadas y Captura de Teclado
// ==========================================
// 1. CONSTANTES Y CONFIGURACIÓN DEL LIENZO
// ==========================================
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas.getContext('2d');

let modoActual = '';
let partidaEnCurso = false; 

let aliasPropio = 'PLAYER_1';
let aliasEnemigo = 'COMP_CORE';

const paletaAncho = 12, paletaAlto = 90;
const p1 = { x: 20, y: 480 / 2 - paletaAlto / 2, score: 0 };
const p2 = { x: 800 - 20 - paletaAncho, y: 480 / 2 - paletaAlto / 2, score: 0 };
const pelota = { x: 800 / 2, y: 480 / 2, radio: 7, vx: 0, vy: 0, velocidadBase: 6 };

const teclas = {};
window.addEventListener('keydown', e => teclas[e.key] = true);
window.addEventListener('keyup', e => teclas[e.key] = false);

const IA_CONFIG = { easy: 2.5, medium: 4.5, hard: 7.5 };
let velocidadIA = 4.5;

window.bucleActivo = false;


//Parte 2: Controladores del Menú, Selección de Modo y Cambio de Pantallas
// ==========================================
// 2. CONTROLADORES DEL MENÚ Y FLUJO ARCADE
// ==========================================
function seleccionarModo(modo) {
    modoActual = modo;
    velocidadIA = IA_CONFIG[document.getElementById('select-diff').value];
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_1';

    if (modo === 'local') {
        aliasEnemigo = 'PLAYER_2';
        arrancarEscenarioJuego();
    } else if (modo === 'ia') {
        aliasEnemigo = 'INFECTED_IA';
        arrancarEscenarioJuego();
    }
}

function arrancarEscenarioJuego() {
    // 1. Escondemos el menú y desplegamos la arena visualmente con prioridad absoluta
    document.getElementById('menu-inicio').style.setProperty('display', 'none', 'important');
    document.getElementById('escenario-juego').style.setProperty('display', 'flex', 'important');
    
    // 2. Configuración inmutable de etiquetas y botones para Modos Locales (IA o Versus)
    document.getElementById('label-p1').innerText = aliasPropio;
    document.getElementById('label-p2').innerText = aliasEnemigo;
    
    const btnStart = document.getElementById('btn-start-match');
    btnStart.disabled = false;
    btnStart.style.pointerEvents = "auto";
    btnStart.style.borderColor = "#00ff66";
    btnStart.style.color = "#00ff66";
    btnStart.innerText = "🎮 START MATCH";
    
    // 3. Inicializamos las físicas y el bucle a 60FPS
    resetPelota(false); 
    actualizarMarcador(); 
    dibujar(); 

    if (!window.bucleActivo) {
        window.bucleActivo = true;
        buclePrincipalJuego();
    }
}


//Parte 4: Procesamiento de Paquetes Aéreos, Saques y Chat
// ==========================================
// 4. CONTROLADORES DE PARTIDA Y SAQUE ARCADE
// ==========================================
function iniciarPartidaFisica() {
    if (partidaEnCurso) return;
    partidaEnCurso = true;
    
    // Calculamos el ángulo matemático exacto de saque inicial local inmediato
    pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
    pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    sonarTonoRetro(500, 0.15);
}

function reiniciarPartidaCompleta() {
    // Llama directamente al limpiador local sin enviar señales a internet
    reiniciarPartidaCompletaLocal();
}


// ==========================================
// 4. SECCIÓN B: CONTROLES DE FLUJO LOCAL
// ==========================================
function reiniciarPartidaCompletaLocal() {
    p1.score = 0; p2.score = 0;
    p1.y = 480 / 2 - paletaAlto / 2;
    p2.y = 480 / 2 - paletaAlto / 2;
    actualizarMarcador();
    resetPelota(false);
    partidaEnCurso = false;
    sonarTonoRetro(200, 0.2);
}

function volverAlMenuInicial() {
    partidaEnCurso = false;
    window.bucleActivo = false; 

    reiniciarPartidaCompletaLocal();

    // Transición de pantallas local inmediata
    document.getElementById('escenario-juego').style.setProperty('display', 'none', 'important');
    document.getElementById('menu-inicio').style.setProperty('display', 'flex', 'important');
}



// Parte 5: Motor de Rebotes, Inteligencia Artificial, Pintado y Audio
// ==========================================
// 5. MOTOR FÍSICO Y ACTUALIZACIONES DE POSICIÓN
// ==========================================
function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4); 
    let direccion = pelota.vx > 0 ? -1 : 1;
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3;
    
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    
    // Candado físico para expulsar la bola de la raqueta y que no se quede pegada
    if (direccion === 1) {
        pelota.x = paleta.x + paletaAncho + pelota.radio + 2;
    } else {
        pelota.x = paleta.x - pelota.radio - 2;
    }
    
    sonarTonoRetro(600, 0.08); 
}

function actualizar() {
    // 1. Control del Jugador 1 (W / S) - Siempre activo
    if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
    if (teclas['s'] || teclas['S']) p1.y = Math.min(480 - paletaAlto - 10, p1.y + 6);

    // 2. Control del Jugador 2 (Flechas ↑ / ↓) - Activo en modo Versus Local
    if (modoActual === 'local') {
        if (teclas['ArrowUp']) p2.y = Math.max(10, p2.y - 6);
        if (teclas['ArrowDown']) p2.y = Math.min(480 - paletaAlto - 10, p2.y + 6);
    }

    // 3. Inteligencia Artificial (Modo entrenamiento contra la máquina)
    if (modoActual === 'ia') {
        let centroPaleta = p2.y + paletaAlto / 2;
        if (pelota.vx > 0) { 
            if (centroPaleta < pelota.y - 12) p2.y = Math.min(480 - paletaAlto - 10, p2.y + velocidadIA);
            else if (centroPaleta > pelota.y + 12) p2.y = Math.max(10, p2.y - velocidadIA);
        }
    }

    // 4. MOTOR DE TRACCIÓN FÍSICA LOCAL COMPILADO
    if (partidaEnCurso) {
        pelota.x += pelota.vx;
        pelota.y += pelota.vy;

        // Rebotes perimetrales (Techo y Piso) locales instantáneos
        if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= 480) {
            pelota.vy = -pelota.vy;
            sonarTonoRetro(300, 0.05); 
        }

        // Colisiones frontales perfectas contra paletas calculadas en 0ms
        if (pelota.vx < 0 && pelota.x - pelota.radio <= p1.x + paletaAncho && pelota.y >= p1.y && pelota.y <= p1.y + paletaAlto) {
            calcularReboteAngulo(p1);
        }
        if (pelota.vx > 0 && pelota.x + pelota.radio >= p2.x && pelota.y >= p2.y && pelota.y <= p2.y + paletaAlto) {
            calcularReboteAngulo(p2);
        }

        // Conteo de puntos inmediato y disparo de reinicio
        if (pelota.x < 0) { p2.score++; responderPunto(); }
        else if (pelota.x > 800) { p1.score++; responderPunto(); }
    }
}



// ==========================================
// 5. SECCIÓN B: RENDERIZADO GRÁFICO, AUDIO Y BUCLE CRT
// ==========================================
function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3); // Tono grave de anotación/pérdida
    
    // El bit de energía se detiene en el centro y espera el siguiente START MATCH
    resetPelota(false); 
}

function actualizarMarcador() {
    document.getElementById('score-p1').innerText = p1.score.toString().padStart(2, '0');
    document.getElementById('score-p2').innerText = p2.score.toString().padStart(2, '0');
}

function resetPelota(autoLanzar = false) {
    pelota.x = 800 / 2;
    pelota.y = 480 / 2;
    if (autoLanzar) {
        pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
        pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    } else {
        pelota.vx = 0; 
        pelota.vy = 0;
        partidaEnCurso = false;
    }
}

// RENDERIZADO GRÁFICO CON SOMBRAS NEÓN FÓSFORO
function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Red militar central punteada
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Paletas de los jugadores (Verde Fósforo Neón)
    ctx.fillStyle = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff66';
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    // Pelota/Bit de energía (Amarillo Eléctrico)
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Evita caídas de FPS
}

// OSCILADOR SYNTH RETRO DE 8 BITS NATIVO (Web Audio API)
function sonarTonoRetro(frecuencia, duracion) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'square'; // Tipo de onda cuadrada pura de las maquinitas clásicas
        osc.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Volumen balanceado confortable
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duracion);
    } catch(e) {
        console.log("Esperando interacción para inicializar el buffer de audio.");
    }
}

// CICLO RECURSIVO INFINITO DE FOTOGRAMAS (60 FPS)
function buclePrincipalJuego() {
    if (!window.bucleActivo) return; // Frena el procesamiento si el jugador regresó al menú
    actualizar();
    dibujar();
    requestAnimationFrame(buclePrincipalJuego);
}
