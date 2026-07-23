// CONSTANTES Y CONFIGURACIÓN DEL LIENZO
const canvas = document.getElementById('lienzo-pong');
const ctx = canvas.getContext('2d');

let modoActual = ''; // 'ia', 'local', 'online'
let peer = null;
let conexionOnline = null;
let miPeerId = '';
let soyHost = false;

// PARÁMETROS FÍSICOS DE LOS OBJETOS
const paletaAncho = 12, paletaAlto = 90;
const p1 = { x: 20, y: canvas.height / 2 - paletaAlto / 2, score: 0 };
const p2 = { x: canvas.width - 20 - paletaAncho, y: canvas.height / 2 - paletaAlto / 2, score: 0 };
const pelota = { x: canvas.width / 2, y: canvas.height / 2, radio: 7, vx: 5, vy: 3, velocidadBase: 6 };

// CAPTURA DE TECLADO
const teclas = {};
window.addEventListener('keydown', e => teclas[e.key] = true);
window.addEventListener('keyup', e => teclas[e.key] = false);

// CONFIGURACIÓN DE LA INTELIGENCIA ARTIFICIAL (Velocidades de seguimiento)
const IA_CONFIG = { easy: 2.5, medium: 4.5, hard: 7.5 };
let velocidadIA = 4.5;

// INICIALIZACIÓN DEL SISTEMA RED P2P (PeerJS)
function inicializarPeerJS() {
    peer = new Peer();
    peer.on('open', id => {
        miPeerId = id;
        document.getElementById('mi-id').innerText = id;
    });
    peer.on('connection', conn => {
        conexionOnline = conn;
        soyHost = true;
        configurarEventosConexion();
    });
}

// CONTROLADORES DE INTERFAZ DEL MENÚ
function seleccionarModo(modo) {
    modoActual = modo;
    velocidadIA = IA_CONFIG[document.getElementById('select-diff').value];

    if (modo === 'online') {
        document.getElementById('panel-online').classList.remove('oculto');
        if (!peer) inicializarPeerJS();
    } else {
        arrancarEscenarioJuego();
    }
}

function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim();
    if (!idEnemigo) return;
    
    document.getElementById('estado-conexion').innerText = "Syncing network nodes...";
    conexionOnline = peer.connect(idEnemigo);
    soyHost = false;
    configurarEventosConexion();
}

function configurarEventosConexion() {
    conexionOnline.on('open', () => {
        document.getElementById('estado-conexion').innerText = "SYNCHRONIZATION COMPLETED!";
        setTimeout(() => arrancarEscenarioJuego(), 1000);
    });
    conexionOnline.on('data', data => procesarDatosRed(data));
}

function arrancarEscenarioJuego() {
    document.getElementById('menu-inicio').classList.add('oculto');
    document.getElementById('escenario-juego').classList.remove('oculto');
    
    if(modoActual === 'online') {
        document.getElementById('ayuda-teclado').innerText = soyHost ? "ONLINE: You are P1 (W/S)" : "ONLINE: You are P2 (Flechas ↑/↓)";
    } else if(modoActual === 'ia') {
        document.getElementById('ayuda-teclado').innerText = "CONTROLS: P1 (W/S) vs COGNITIVE BOT";
    }
    
    resetPelota();
    requestAnimationFrame(buclePrincipalJuego);
}

// LÓGICA RED MULTIJUGADOR
function enviarDatosRed() {
    if (!conexionOnline || !conexionOnline.open) return;
    if (soyHost) {
        conexionOnline.send({ p1Y: p1.y, pelotaX: pelota.x, pelotaY: pelota.y, s1: p1.score, s2: p2.score });
    } else {
        conexionOnline.send({ p2Y: p2.y });
    }
}

function procesarDatosRed(data) {
    if (soyHost && data.p2Y !== undefined) p2.y = data.p2Y;
    if (!soyHost) {
        if (data.p1Y !== undefined) p1.y = data.p1Y;
        if (data.pelotaX !== undefined) { pelota.x = data.pelotaX; pelota.y = data.pelotaY; }
        if (data.s1 !== undefined) { p1.score = data.s1; p2.score = data.s2; actualizarMarcador(); }
    }
}

// MOTOR FÍSICO Y ACTUALIZACIONES DE COORDENADAS
function actualizar() {
    // Control Jugador 1 (W/S) - Activo en Local, IA y si es Host Online
    if (modoActual !== 'online' || soyHost) {
        if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
        if (teclas['s'] || teclas['S']) p1.y = Math.min(canvas.height - paletaAlto - 10, p1.y + 6);
    }

    // Control Jugador 2 (Flechas) - Activo en Local y si es Cliente Online
    if (modoActual === 'local' || (modoActual === 'online' && !soyHost)) {
        if (teclas['ArrowUp']) p2.y = Math.max(10, p2.y - 6);
        if (teclas['ArrowDown']) p2.y = Math.min(canvas.height - paletaAlto - 10, p2.y + 6);
    }

    // LÓGICA DE COMPUTADORA VS IA INTELIGENTE
    if (modoActual === 'ia') {
        let centroPaleta = p2.y + paletaAlto / 2;
        let destinoY = pelota.y;
        
        // La IA rastrea la pelota solo cuando viene hacia su mitad de campo
        if (pelota.vx > 0) {
            if (centroPaleta < destinoY - 10) {
                p2.y = Math.min(canvas.height - paletaAlto - 10, p2.y + velocidadIA);
            } else if (centroPaleta > destinoY + 10) {
                p2.y = Math.max(10, p2.y - velocidadIA);
            }
        }
    }

    // FÍSICAS DE LA PELOTA (El Host calcula la pelota de forma centralizada en Online)
    if (modoActual !== 'online' || soyHost) {
        pelota.x += pelota.x === canvas.width / 2 && pelota.y === canvas.height / 2 ? 0 : pelota.vx;
        pelota.y += pelota.x === canvas.width / 2 && pelota.y === canvas.height / 2 ? 0 : pelota.vy;

        // Rebotes Techo y Piso
        if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= canvas.height) {
            pelota.vy = -pelota.vy;
            sonarTonoRetro(300, 0.05); // Sonido rápido de rebote
        }

        // Colisión Paleta 1
        if (pelota.vx < 0 && pelota.x - pelota.radio <= p1.x + paletaAncho && pelota.y >= p1.y && pelota.y <= p1.y + paletaAlto) {
            calcularReboteAngulo(p1);
        }

        // Colisión Paleta 2
        if (pelota.vx > 0 && pelota.x + pelota.radio >= p2.x && pelota.y >= p2.y && pelota.y <= p2.y + paletaAlto) {
            calcularReboteAngulo(p2);
        }

        // Goles y Anotación
        if (pelota.x < 0) { p2.score++; responderPunto(); }
        else if (pelota.x > canvas.width) { p1.score++; responderPunto(); }
    }

    enviarDatosRed();
}

function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4); // Máximo 45 grados de desviación
    let direccion = pelota.vx > 0 ? -1 : 1;

    // Aceleración de velocidad progresiva del juego arcade
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3;
    
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    sonarTonoRetro(600, 0.08); // Tono agudo al golpear raqueta
}

function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3); // Sonido grave de anotación
    resetPelota();
}

function actualizarMarcador() {
    document.getElementById('score-p1').innerText = p1.score.toString().padStart(2, '0');
    document.getElementById('score-p2').innerText = p2.score.toString().padStart(2, '0');
}

function resetPelota() {
    pelota.x = canvas.width / 2;
    pelota.y = canvas.height / 2;
    // Disparo inicial aleatorio
    pelota.vx = (Math.random() > 0.5 ? 1 : -1) * pelota.velocidadBase;
    pelota.vy = (Math.random() > 0.5 ? 1 : -1) * (pelota.velocidadBase - 2);
}

// RENDERIZADO VISUAL CON ESTILO VECTORES NEÓN (Verde y Amarillo)
function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Línea divisoria central punteada militar
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Dibujar Paleta 1 (Verde Fósforo)
    ctx.fillStyle = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff66';
    ctx.fillRect(p1.x, p1.y, paletaAncho, paletaAlto);

    // Dibujar Paleta 2 (Verde Fósforo)
    ctx.fillRect(p2.x, p2.y, paletaAncho, paletaAlto);

    // Dibujar Pelota (Amarillo Eléctrico)
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Limpiar brillo para evitar baja de FPS
}

// SINTETIZADOR DE AUDIO RETRO DE CONSOLA BEEP INTEGRADO (Web Audio API)
function sonarTonoRetro(frecuencia, duracion) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square'; // Sonido cuadrado ultra retro de 8 bits
    osc.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duracion);
}

// BUCLE DINÁMICO DE RENDERIZACIÓN A 60FPS
function buplePrincipalJuego() {
    actualizar();
    dibujar();
    requestAnimationFrame(buplePrincipalJuego);
}
