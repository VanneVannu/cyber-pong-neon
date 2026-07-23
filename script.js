// Bloque 1: Declaración de Variables y Captura de Teclado
// CONFIGURACIÓN DEL LIENZO
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas.getContext('2d');

// VARIABLES DE CONTROL GENERAL Y RED
let modoActual = '';
let peer = null;
let conexionOnline = null;
let miPeerId = '';
let soyHost = false;

// ALIAS PERSONALIZADOS
let aliasPropio = 'PLAYER_1';
let aliasEnemigo = 'COMP_CORE';
let partidaEnCurso = false; 

// PARÁMETROS FÍSICOS DE LAS PALETAS Y LA PELOTA
const paletaAncho = 12, paletaAlto = 90;
const p1 = { x: 20, y: canvas.height / 2 - paletaAlto / 2, score: 0 };
const p2 = { x: canvas.width - 20 - paletaAncho, y: canvas.height / 2 - paletaAlto / 2, score: 0 };
const pelota = { x: canvas.width / 2, y: canvas.height / 2, radio: 7, vx: 0, vy: 0, velocidadBase: 6 };

// CAPTURA DE TECLADO GLOBAL
const teclas = {};
window.addEventListener('keydown', e => teclas[e.key] = true);
window.addEventListener('keyup', e => teclas[e.key] = false);

// VELOCIDADES DE REACCIÓN PARA LA INTELIGENCIA ARTIFICIAL
const IA_CONFIG = { easy: 2.5, medium: 4.5, hard: 7.5 };
let velocidadIA = 4.5;


// ==========================================
// REEMPLAZO BLOQUE 2: RED ACTIVADA POR BOTÓN
// ==========================================

// Eliminamos el inicio automático al cargar la página para dar estabilidad
window.onload = function() {
    console.log("Sistema Cyber Pong inicializado en espera de comandos.");
};

// Esta función se ejecuta SÓLO cuando presionan el botón de generar
function activarNodoRed() {
    const btn = document.getElementById('btn-crear-id');
    document.getElementById('mi-id').innerText = "GENERATING NODE...";
    btn.disabled = true; // Evita que el usuario pulse múltiples veces seguidas
    
    // Inicializamos el puente PeerJS
    peer = new Peer(undefined, { debug: 2 });
    
    peer.on('open', id => {
        miPeerId = id;
        document.getElementById('mi-id').innerText = id;
        document.getElementById('estado-conexion').innerText = "NODE STABLE. ready to link.";
        btn.innerText = "✔ NODE ACTIVE";
        btn.style.borderColor = "#00ff66";
        btn.style.color = "#00ff66";
        console.log("Enlace P2P establecido con éxito. ID:", id);
    });
    
    peer.on('connection', conn => {
        conexionOnline = conn;
        soyHost = true;
        configurarEventosConexion();
    });

    peer.on('error', err => {
        console.error("Fallo de red:", err);
        document.getElementById('mi-id').innerText = "ERROR CODE";
        document.getElementById('estado-conexion').innerText = "Server Timeout. Retry generation.";
        btn.disabled = false;
        btn.innerText = "⚡ RETRY GENERATE";
    });
}

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

function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim();
    if (!idEnemigo) {
        alert("🚨 PLEASE ENTER A VALID ENEMY ID");
        return;
    }
    
    document.getElementById('estado-conexion').innerText = "Connecting to remote node...";
    conexionOnline = peer.connect(idEnemigo);
    soyHost = false;
    configurarEventosConexion();
}

function configurarEventosConexion() {
    conexionOnline.on('open', () => {
        document.getElementById('estado-conexion').innerText = "SYNCHRONIZATION COMPLETED!";
        conexionOnline.send({ tipo: 'handshake', alias: aliasPropio });
        setTimeout(() => {
            document.getElementById('caja-chat-online').classList.remove('oculto');
            arrancarEscenarioJuego();
        }, 1000);
    });
    conexionOnline.on('data', data => procesarDatosRed(data));
}


// ==========================================
// REEMPLAZO BLOQUE 3: FLUJO DE PARTIDA Y VOLVER AL MENÚ
// ==========================================

function arrancarEscenarioJuego() {
    document.getElementById('menu-inicio').classList.add('oculto');
    document.getElementById('escenario-juego').classList.remove('oculto');
    
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
    actualizarMarcador(); // Asegura que los contadores arranquen en 00:00
    dibujar(); 
    if (!window.bucleActivo) {
        window.bucleActivo = true;
        buclePrincipalJuego();
    }
}

function iniciarPartidaFisica() {
    if(partidaEnCurso) return;
    partidaEnCurso = true;
    
    pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
    pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    sonarTonoRetro(500, 0.15);

    if (modoActual === 'online' && soyHost) {
        conexionOnline.send({ tipo: 'start_match', vx: pelota.vx, vy: pelota.vy });
    }
}

function reiniciarPartidaCompleta() {
    p1.score = 0; p2.score = 0;
    p1.y = canvas.height / 2 - paletaAlto / 2;
    p2.y = canvas.height / 2 - paletaAlto / 2;
    actualizarMarcador();
    resetPelota(false);
    partidaEnCurso = false;
    sonarTonoRetro(200, 0.2);

    if (modoActual === 'online') {
        conexionOnline.send({ tipo: 'reset_match' });
    }
}

// NUEVA FUNCIÓN: REGRESAR A LA PANTALLA DE SELECCIÓN INICIAL
function volverAlMenuInicial() {
    partidaEnCurso = false;
    window.bucleActivo = false; // Detiene el renderizado en segundo plano
    
    // Si hay una conexión online activa, avisamos y la cerramos
    if (conexionOnline) {
        conexionOnline.send({ tipo: 'reset_match' });
        conexionOnline.close();
        conexionOnline = null;
    }

    // Resetear posiciones y marcadores
    p1.score = 0; p2.score = 0;
    p1.y = canvas.height / 2 - paletaAlto / 2;
    p2.y = canvas.height / 2 - paletaAlto / 2;

    // Intercambio visual de pantallas
    document.getElementById('escenario-juego').classList.add('oculto');
    document.getElementById('caja-chat-online').classList.add('oculto');
    document.getElementById('panel-online').classList.add('oculto');
    document.getElementById('menu-inicio').classList.remove('oculto');
    document.getElementById('estado-conexion').innerText = "Awaiting operational synchronization...";
    document.getElementById('input-peer-id').value = '';
}



//Bloque 4: Sistema Multijugador y Chat en Tiempo Real
// ENVIAR MENSAJES DE CHAT
function evaluarTeclaChat(e) {
    if(e.key === 'Enter') enviarMensajeChat();
}

function enviarMensajeChat() {
    const input = document.getElementById('input-msg-chat');
    const msg = input.value.trim();
    if(!msg || modoActual !== 'online') return;

    agregarMensajePantalla(aliasPropio, msg);
    conexionOnline.send({ tipo: 'chat', emisor: aliasPropio, mensaje: msg });
    input.value = '';
}

function agregarMensajePantalla(autor, texto) {
    const cajaMsgs = document.getElementById('chat-mensajes');
    const nuevoMsg = document.createElement('div');
    nuevoMsg.innerHTML = `<span>[${autor}]:</span> ${texto}`;
    cajaMsgs.appendChild(nuevoMsg);
    cajaMsgs.scrollTop = cajaMsgs.scrollHeight;
}

// ENVIAR MOVIMIENTOS A LA RED CONTRA PARTE
function enviarDatosRed() {
    if (!conexionOnline || !conexionOnline.open) return;
    if (soyHost) {
        conexionOnline.send({ tipo: 'sync', p1Y: p1.y, pelotaX: pelota.x, pelotaY: pelota.y, s1: p1.score, s2: p2.score });
    } else {
        conexionOnline.send({ tipo: 'sync', p2Y: p2.y });
    }
}

// PROCESAR ENTRADA DE DATOS DE LA RED
function procesarDatosRed(data) {
    if (data.tipo === 'handshake') {
        aliasEnemigo = data.alias;
        document.getElementById('label-p1').innerText = soyHost ? aliasPropio : aliasEnemigo;
        document.getElementById('label-p2').innerText = soyHost ? aliasEnemigo : aliasPropio;
    }
    if (data.tipo === 'chat') {
        agregarMensajePantalla(data.emisor, data.mensaje);
    }
    if (data.tipo === 'start_match') {
        partidaEnCurso = true;
        pelota.vx = data.vx; pelota.vy = data.vy;
        sonarTonoRetro(500, 0.15);
    }
    if (data.tipo === 'reset_match') {
        p1.score = 0; p2.score = 0;
        p1.y = canvas.height / 2 - paletaAlto / 2;
        p2.y = canvas.height / 2 - paletaAlto / 2;
        actualizarMarcador(); resetPelota(false);
        partidaEnCurso = false; sonarTonoRetro(200, 0.2);
    }
    if (data.tipo === 'sync') {
        if (soyHost && data.p2Y !== undefined) p2.y = data.p2Y;
        if (!soyHost) {
            if (data.p1Y !== undefined) p1.y = data.p1Y;
            if (data.pelotaX !== undefined) { pelota.x = data.pelotaX; pelota.y = data.pelotaY; }
            if (data.s1 !== undefined) { p1.score = data.s1; p2.score = data.s2; actualizarMarcador(); }
        }
    }
}


// Bloque 5: Motor Físico (Movimiento, IA y Colisiones)
// CALCULADORA DE COORDENADAS E IMPACTOS
function actualizar() {
    // Control P1
    if (modoActual !== 'online' || soyHost) {
        if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
        if (teclas['s'] || teclas['S']) p1.y = Math.min(canvas.height - paletaAlto - 10, p1.y + 6);
    }
    // Control P2
    if (modoActual === 'local' || (modoActual === 'online' && !soyHost)) {
        if (teclas['ArrowUp']) p2.y = Math.max(10, p2.y - 6);
        if (teclas['ArrowDown']) p2.y = Math.min(canvas.height - paletaAlto - 10, p2.y + 6);
    }

    // COMPORTAMIENTO TÁCTICO DE LA IA INTERACTIVA
    if (modoActual === 'ia') {
        let centroPaleta = p2.y + paletaAlto / 2;
        if (pelota.vx > 0) { // Solo sigue la bola si va hacia ella
            if (centroPaleta < pelota.y - 12) p2.y = Math.min(canvas.height - paletaAlto - 10, p2.y + velocidadIA);
            else if (centroPaleta > pelota.y + 12) p2.y = Math.max(10, p2.y - velocidadIA);
        }
    }

    // FÍSICAS DE REBOTE DE LA PELOTA
    if (partidaEnCurso && (modoActual !== 'online' || soyHost)) {
        pelota.x += pelota.vx;
        pelota.y += pelota.vy;

        if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= canvas.height) {
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
        else if (pelota.x > canvas.width) { p1.score++; responderPunto(); }
    }
    enviarDatosRed();
}

function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4);
    let direccion = pelota.vx > 0 ? -1 : 1;
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3; // Aceleración arcade
    
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    sonarTonoRetro(600, 0.08);
}

function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3);
    resetPelota(true); // Reinicia con saque instantáneo tras un gol
}

function actualizarMarcador() {
    document.getElementById('score-p1').innerText = p1.score.toString().padStart(2, '0');
    document.getElementById('score-p2').innerText = p2.score.toString().padStart(2, '0');
}

function resetPelota(autoLanzar = false) {
    pelota.x = canvas.width / 2;
    pelota.y = canvas.height / 2;
    if (autoLanzar) {
        pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
        pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
    } else {
        pelota.vx = 0; pelota.vy = 0;
        partidaEnCurso = false;
    }
}

//Bloque 6: Renderizado Gráfico Véctores y Oscilador de Sonido (Bucle de FPS)
// DIBUJAR LOS ELEMENTOS CON SOMBRAS DE NEÓN
function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Línea central de red militar
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Paletas Verdes Fósforo
    ctx.fillStyle = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff66';
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    // Pelota Amarilla Eléctrica
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Desactivar sombra al terminar para optimizar rendimiento
}

// GENERADOR DE BEEPS RETRO DE CONSOLA DE 8 BITS
function sonarTonoRetro(frecuencia, duracion) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square'; // Onda cuadrada clásica de maquinita arcade
    osc.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracion);
}

// BUCLE DE RENDERIZADO RECURSIVO A 60FPS
function buclePrincipalJuego() {
    if (!window.bucleActivo) return; // Frena el ciclo si volvimos al menú
    actualizar();
    dibujar();
    requestAnimationFrame(buclePrincipalJuego);
}




