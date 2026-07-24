// ==========================================
// 1. CONSTANTES Y CONFIGURACIÓN DEL LIENZO
// ==========================================
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas.getContext('2d');

let modoActual = '';
let miPeerId = '';
let soyHost = false;
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

// CONTROL DE RENDERIZADO ACTIVADO ÚNICAMENTE EN COMBATE
window.bucleActivo = false;

// ==========================================
// 2. CONTROLADORES DEL MENÚ Y FLUJO ARCADE
// ==========================================
function seleccionarModo(modo) {
    modoActual = modo;
    velocidadIA = IA_CONFIG[document.getElementById('select-diff').value];
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_1';

    if (modo === 'online') {
        document.getElementById('panel-online').classList.remove('oculto');
    } else {
        if (modo === 'local') aliasEnemigo = 'PLAYER_2';
        if (modo === 'ia') aliasEnemigo = 'INFECTED_IA';
        arrancarEscenarioJuego();
    }
}

function arrancarEscenarioJuego() {
    // 1. Rompemos las reglas estrictas del CSS usando estilos directos en línea
    document.getElementById('menu-inicio').style.setProperty('display', 'none', 'important');
    document.getElementById('escenario-juego').style.setProperty('display', 'flex', 'important');
    
    // 2. Cargamos las etiquetas de texto correspondientes al modo
    if(modoActual === 'online') {
        document.getElementById('label-p1').innerText = soyHost ? aliasPropio : 'CONNECTING...';
        document.getElementById('label-p2').innerText = soyHost ? 'CONNECTING...' : aliasPropio;
        document.getElementById('btn-start-match').innerText = soyHost ? "🎮 START MATCH" : "⏳ AWAITING HOST START";
        if(!soyHost) document.getElementById('btn-start-match').disabled = true;
    } else {
        document.getElementById('label-p1').innerText = aliasPropio;
        document.getElementById('label-p2').innerText = aliasEnemigo;
        document.getElementById('btn-start-match').disabled = false;
        document.getElementById('btn-start-match').innerText = "🎮 START MATCH";
    }
    
    resetPelota(false); 
    actualizarMarcador(); 
    dibujar(); 

    if (!window.bucleActivo) {
        window.bucleActivo = true;
        buclePrincipalJuego();
    }
}


// SIMULADOR SOBERANO DE RED LOCAL
function activarNodoRed() {
    const btn = document.getElementById('btn-crear-id');
    
    // Generamos el ID local de simulación instantánea
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    miPeerId = "CP-" + hash;

    // Pintamos el código amarillo en pantalla
    document.getElementById('mi-id').innerText = miPeerId;
    document.getElementById('estado-conexion').innerText = "VIRTUAL NODE STABLE. COPY CODE.";
    
    // Cambiamos el estado del botón a activo
    if (btn) {
        btn.innerText = "✔ ACTIVE";
        btn.disabled = true;
    }
    
    // IMPORTANTE: Aquí NO forzamos el arranque del escenario de juego.
    // El sistema se quedará quieto esperando en el menú hasta que interactúes.
    soyHost = true;
}


function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim().toUpperCase();
    if (!idEnemigo) {
        alert("🚨 PLEASE ENTER A VALID ENEMY ID");
        return;
    }

    document.getElementById('estado-conexion').innerText = "SYNCHRONIZING RETINAL STAGE...";
    soyHost = false;
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_1';
    aliasEnemigo = "REMOTE_PLAYER";

    setTimeout(() => {
        document.getElementById('caja-chat-online').classList.remove('oculto');
        const cajaMsgs = document.getElementById('chat-mensajes');
        if(cajaMsgs) {
            cajaMsgs.innerHTML = `<div><span>[SYSTEM]:</span> SECURE NODE LINKED WITH ${idEnemigo}</div>`;
        }
        arrancarEscenarioJuego();
    }, 500);
}

// ==========================================
// 3. CONTROLES DE PARTIDA Y SAQUE
// ==========================================
function iniciarPartidaFisica() {
    if(partidaEnCurso) return;
    partidaEnCurso = true;
    
    pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
    pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    sonarTonoRetro(500, 0.15);
}

function reiniciarPartidaCompleta() {
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

    p1.score = 0; p2.score = 0;
    p1.y = 480 / 2 - paletaAlto / 2;
    p2.y = 480 / 2 - paletaAlto / 2;

    // Revertimos el truco visual para volver al menú de selección
    document.getElementById('escenario-juego').style.setProperty('display', 'none', 'important');
    document.getElementById('menu-inicio').style.setProperty('display', 'flex', 'important');
    
    document.getElementById('caja-chat-online').classList.add('oculto');
    document.getElementById('panel-online').classList.add('oculto');
    document.getElementById('estado-conexion').innerText = "Awaiting manual synchronization protocol...";
    document.getElementById('input-peer-id').value = '';
    
    const btnId = document.getElementById('btn-crear-id');
    if(btnId) {
        btnId.disabled = false;
        btnId.innerText = "⚡ GENERATE ID";
    }
    document.getElementById('mi-id').innerText = "OFFLINE // N/A";
}


// ==========================================
// 4. MOTOR FÍSICO Y COLISIONES VECTORES
// ==========================================
function actualizar() {
    if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
    if (teclas['s'] || teclas['S']) p1.y = Math.min(480 - paletaAlto - 10, p1.y + 6);

    if (modoActual === 'local') {
        if (teclas['ArrowUp']) p2.y = Math.max(10, p2.y - 6);
        if (teclas['ArrowDown']) p2.y = Math.min(480 - paletaAlto - 10, p2.y + 6);
    }

    if (modoActual === 'ia') {
        let centroPaleta = p2.y + paletaAlto / 2;
        if (pelota.vx > 0) {
            if (centroPaleta < pelota.y - 12) p2.y = Math.min(480 - paletaAlto - 10, p2.y + velocidadIA);
            else if (centroPaleta > pelota.y + 12) p2.y = Math.max(10, p2.y - velocidadIA);
        }
    }

    if (partidaEnCurso) {
        pelota.x += pelota.vx;
        pelota.y += pelota.vy;

        if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= 480) {
            pelota.vy = -pelota.vy;
            sonarTonoRetro(300, 0.05);
        }

        if (pelota.vx < 0 && pelota.x - pelota.radio <= p1.x + paletaAncho && pelota.y >= p1.y && pelota.y <= p1.y + paletaAlto) {
            calcularReboteAngulo(p1);
        }
        if (pelota.vx > 0 && pelota.x + pelota.radio >= p2.x && pelota.y >= p2.y && pelota.y <= p2.y + paletaAlto) {
            calcularReboteAngulo(p2);
        }

        if (pelota.x < 0) { p2.score++; responderPunto(); }
        else if (pelota.x > 800) { p1.score++; responderPunto(); }
    }
}

function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4);
    let direccion = pelota.vx > 0 ? -1 : 1;
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3;
    
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    sonarTonoRetro(600, 0.08);
}

function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3);
    resetPelota(true); 
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
        pelota.vx = 0; pelota.vy = 0;
        partidaEnCurso = false;
    }
}

// ==========================================
// 5. RENDERIZADO GRÁFICO Y AUDIO 8-BITS
// ==========================================
function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff66';
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function sonarTonoRetro(frecuencia, duracion) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracion);
}

function buclePrincipalJuego() {
    if (!window.bucleActivo) return; 
    actualizar();
    dibujar();
    requestAnimationFrame(buclePrincipalJuego);
}
