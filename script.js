//Bloque 1: Configuración Física de la Arena y Teclado
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

let puenteRedSocket = null;
let nombreSalaVirtual = '';

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


// Parte 2: El Motor de Selección de Modo y Red WebSocket
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
    document.getElementById('menu-inicio').style.setProperty('display', 'none', 'important');
    document.getElementById('escenario-juego').style.setProperty('display', 'flex', 'important');
    
    if (modoActual === 'online') {
        if (window.esElCreador === true || soyHost === true) {
            document.getElementById('label-p1').innerText = aliasPropio;
            document.getElementById('btn-start-match').disabled = false;
            document.getElementById('btn-start-match').innerText = "🎮 START MATCH";
        } else {
            document.getElementById('label-p2').innerText = aliasPropio;
            document.getElementById('btn-start-match').disabled = true;
            document.getElementById('btn-start-match').innerText = "⏳ AWAITING HOST START";
        }
    } else {
        document.getElementById('label-p1').innerText = aliasPropio;
        document.getElementById('label-p2').innerText = aliasEnemigo;
        document.getElementById('btn-start-match').disabled = false;
        document.getElementById('btn-start-match').innerText = "🎮 START MATCH";
    }
    
    resetPelota(false); 
    actualizarMarcador(); 
    dibujar(); 

    // Forzamos el encendido del bucle de inmediato al entrar a la arena
    window.bucleActivo = true;
    buclePrincipalJuego();
}

function activarNodoRed() {
    const btn = document.getElementById('btn-crear-id');
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    miPeerId = "CP-" + hash;
    nombreSalaVirtual = miPeerId;

    document.getElementById('mi-id').innerText = miPeerId;
    document.getElementById('estado-conexion').innerText = "CONNECTING ANTENNA...";
    
    conectarServidorRetransmision(nombreSalaVirtual, () => {
        document.getElementById('estado-conexion').innerText = "ONLINE NODE STABLE. COPY CODE.";
        if (btn) {
            btn.innerText = "✔ ACTIVE";
            btn.disabled = true;
        }
        soyHost = true;
        window.esElCreador = true; 
        modoActual = 'online';
    });
}

function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim().toUpperCase();
    if (!idEnemigo) {
        alert("🚨 PLEASE ENTER A VALID ENEMY ID");
        return;
    }

    document.getElementById('estado-conexion').innerText = "CONNECTING...";
    nombreSalaVirtual = idEnemigo;
    soyHost = false;
    window.esElCreador = false;
    modoActual = 'online';
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_1';

    conectarServidorRetransmision(nombreSalaVirtual, () => {
        document.getElementById('estado-conexion').innerText = "SYNCHRONIZATION COMPLETED!";
        enviarMensajeRed({ tipo: 'handshake', alias: aliasPropio });
        setTimeout(() => {
            document.getElementById('caja-chat-online').classList.remove('oculto');
            arrancarEscenarioJuego();
        }, 500);
    });
}

function conectarServidorRetransmision(sala, alConectar) {
    const apiKey = "oZ6967A18967oX86967o"; 
    const urlSocket = `wss://://piesocket.com{sala}?api_key=${apiKey}&notify_self=0`;
    
    puenteRedSocket = new WebSocket(urlSocket);
    puenteRedSocket.onopen = function() { alConectar(); };
    puenteRedSocket.onmessage = function(event) {
        const datos = JSON.parse(event.data);
        procesarDatosRed(datos);
    };
}


//Bloque 3: Sincronización y Procesador de Señales Aéreas
// TRANSMISIÓN MASIVA DE COORDENADAS (60 VECES POR SEGUNDO)
function enviarMensajeRed(objeto) {
    if (puenteRedSocket && puenteRedSocket.readyState === WebSocket.OPEN) {
        puenteRedSocket.send(JSON.stringify(objeto));
    }
}

function enviarDatosRed() {
    if (modoActual !== 'online' || !puenteRedSocket) return;
    if (soyHost) {
        enviarMensajeRed({ tipo: 'sync', p1Y: p1.y, pelotaX: pelota.x, pelotaY: pelota.y, s1: p1.score, s2: p2.score, corriendo: partidaEnCurso });
    } else {
        enviarMensajeRed({ tipo: 'sync', p2Y: p2.y });
    }
}

function procesarDatosRed(data) {
    if (data.tipo === 'handshake') {
        aliasEnemigo = data.alias;
        document.getElementById('label-p2').innerText = aliasEnemigo;
        enviarMensajeRed({ tipo: 'handshake_reply', alias: aliasPropio });
        document.getElementById('caja-chat-online').classList.remove('oculto');
        arrancarEscenarioJuego();
    }
    if (data.tipo === 'handshake_reply') {
        aliasEnemigo = data.alias;
        document.getElementById('label-p1').innerText = aliasEnemigo;
    }
    if (data.tipo === 'chat') { agregarMensajePantalla(aliasEnemigo, data.mensaje); }
    if (data.tipo === 'start_match') {
        partidaEnCurso = true;
        pelota.vx = data.vx; pelota.vy = data.vy;
        sonarTonoRetro(500, 0.15);
    }
    if (data.tipo === 'reset_match') { reiniciarPartidaCompletaLocal(); }
    if (data.tipo === 'sync') {
        if (soyHost && data.p2Y !== undefined) p2.y = data.p2Y;
        if (!soyHost) {
            if (data.p1Y !== undefined) p1.y = data.p1Y;
            if (data.pelotaX !== undefined) { pelota.x = data.pelotaX; pelota.y = data.pelotaY; }
            if (data.s1 !== undefined) { p1.score = data.s1; p2.score = data.s2; actualizarMarcador(); }
            if (data.corriendo !== undefined) partidaEnCurso = data.corriendo;
        }
    }
}



//Bloque 4: Gestión de Pantallas, Saques y Caja de Chat
// ==========================================
// 4. CONTROLADORES DEL FLUJO GRÁFICO
// ==========================================
function iniciarPartidaFisica() {
    if(partidaEnCurso) return;
    partidaEnCurso = true;
    
    pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
    pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    sonarTonoRetro(500, 0.15);

    if (modoActual === 'online' && soyHost) {
        enviarMensajeRed({ tipo: 'start_match', vx: pelota.vx, vy: pelota.vy });
    }
}

function reiniciarPartidaCompleta() {
    reiniciarPartidaCompletaLocal();
    if (modoActual === 'online') { enviarMensajeRed({ tipo: 'reset_match' }); }
}

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
    
    if (puenteRedSocket) {
        puenteRedSocket.close();
        puenteRedSocket = null;
    }

    reiniciarPartidaCompletaLocal();

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

function evaluarTeclaChat(e) { if(e.key === 'Enter') enviarMensajeChat(); }
function enviarMensajeChat() {
    const input = document.getElementById('input-msg-chat');
    const msg = input.value.trim();
    if(!msg || !puenteRedSocket) return;
    agregarMensajePantalla(aliasPropio, msg);
    enviarMensajeRed({ tipo: 'chat', mensaje: msg });
    input.value = '';
}
function agregarMensajePantalla(autor, texto) {
    const cajaMsgs = document.getElementById('chat-mensajes');
    const nuevoMsg = document.createElement('div');
    nuevoMsg.innerHTML = `<span>[${autor}]:</span> ${texto}`;
    cajaMsgs.appendChild(nuevoMsg);
    cajaMsgs.scrollTop = cajaMsgs.scrollHeight;
}

//Bloque 5: Núcleo Físico, Rebotes y Renderizado de Sombras Gráficas
// ==========================================
// 5. MOTOR FÍSICO Y ACTUALIZACIONES DE POSICIÓN
// ==========================================
function actualizar() {
    if (modoActual !== 'online' || soyHost) {
        if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
        if (teclas['s'] || teclas['S']) p1.y = Math.min(480 - paletaAlto - 10, p1.y + 6);
    }

    if (modoActual === 'local' || (modoActual === 'online' && !soyHost)) {
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

    if (partidaEnCurso && (modoActual !== 'online' || soyHost)) {
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
    enviarDatosRed();
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
