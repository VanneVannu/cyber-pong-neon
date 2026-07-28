//Parte 1: Dimensiones, Coordenadas y Captura de Teclado
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

// VARIABLES EXCLUSIVAS DE TU SERVIDOR CENTRAL REAL
// (Recuerda cambiar esta URL por el enlace que te dio tu Web Service en Render)
const URL_SERVIDOR = "https://cyber-pong-server.onrender.com"; 
let socket = null;
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
window.esElCreador = false; 


//Parte 2: Controladores del Menú, Selección de Modo y Cambio de Pantallas
// ==========================================
// 2. CONTROLADORES DEL MENÚ Y FLUJO ARCADE
// ==========================================
function seleccionarModo(modo) {
    modoActual = modo;
    velocidadIA = IA_CONFIG[document.getElementById('select-diff').value];
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_1';

    if (modo === 'online') {
        document.getElementById('panel-online').classList.remove('oculto');
        // REPARADO: Conectamos nativamente al Web Service de Render al pulsar Online
        inicializarConexionServidor();
    } else {
        if (modo === 'local') aliasEnemigo = 'PLAYER_2';
        if (modo === 'ia') aliasEnemigo = 'INFECTED_IA';
        arrancarEscenarioJuego();
    }
}

function arrancarEscenarioJuego() {
    // 1. Escondemos el menú y desplegamos la arena visualmente con prioridad absoluta
    document.getElementById('menu-inicio').style.setProperty('display', 'none', 'important');
    document.getElementById('escenario-juego').style.setProperty('display', 'flex', 'important');
    
    // 2. FORZADO INMUTABLE DE BOTÓN DE INICIO
    if (modoActual === 'online') {
        const miCodigoLocal = document.getElementById('mi-id').innerText.trim();
        
        // REGLA DE ORO DE INGENIERÍA: Si tu casilla de ID tiene un código válido generado, eres el HOST
        if (miCodigoLocal !== "OFFLINE // N/A" && miCodigoLocal !== "" && miCodigoLocal !== "SYNCHRONIZING...") {
            soyHost = true;
            window.esElCreador = true;
            
            document.getElementById('label-p1').innerText = aliasPropio;
            document.getElementById('label-p2').innerText = aliasEnemigo || "INVITED_PLAYER"; 
            
            // Forzamos el encendido indestructible del botón de saque para el Creador
            const btnStart = document.getElementById('btn-start-match');
            btnStart.disabled = false;
            btnStart.style.pointerEvents = "auto";
            btnStart.style.opacity = "1";
            btnStart.style.borderColor = "#00ff66";
            btnStart.style.color = "#00ff66";
            btnStart.innerText = "🎮 START MATCH";
            console.log("Infraestructura: Rol verificado como HOST. Mando de saque activado.");
        } else {
            // Si tu casilla de ID está vacía o en offline, entraste poniendo el código del rival (Invitado)
            soyHost = false;
            window.esElCreador = false;
            
            document.getElementById('label-p1').innerText = aliasEnemigo || "HOST_PLAYER"; 
            document.getElementById('label-p2').innerText = aliasPropio;
            
            // Forzamos el bloqueo lógico del botón para el Invitado
            const btnStart = document.getElementById('btn-start-match');
            btnStart.disabled = true;
            btnStart.style.pointerEvents = "none";
            btnStart.style.borderColor = "#14331a";
            btnStart.style.color = "#497a53";
            btnStart.innerText = "⏳ AWAITING HOST START";
            console.log("Infraestructura: Rol verificado como INVITADO. Esperando señal de saque.");
        }
    } else {
        // Modos Locales u Offline estándares
        document.getElementById('label-p1').innerText = aliasPropio;
        document.getElementById('label-p2').innerText = aliasEnemigo;
        
        const btnStart = document.getElementById('btn-start-match');
        btnStart.disabled = false;
        btnStart.style.pointerEvents = "auto";
        btnStart.style.borderColor = "#00ff66";
        btnStart.style.color = "#00ff66";
        btnStart.innerText = "🎮 START MATCH";
    }
    
    // 3. Inicializamos las físicas y el bucle a 60FPS
    resetPelota(false); 
    actualizarMarcador(); 
    dibujar(); 

    if (!window.bucleActivo) {
        window.bucleActivo = true;
        buclePrincipalJuego();
    }
}


//Parte 3: Antena Inalámbrica WebSocket y Transmisión de Datos
// ===================================================
// 3. ANTENAS DE INTERNET DIRECTAS HTTP (DOSIFICADAS DE ALTA VELOCIDAD)
// ===================================================
let intervaloEscuchaRed = null;
let intervaloSincronizacionFisica = null; // Reloj dosificador para no saturar Render
let historialMensajesProcesados = new Set(); 

function inicializarConexionServidor() {
    document.getElementById('estado-conexion').innerText = "HUB OPERATIONAL. CHANNELS ENCRYPTED. ⚡";
}

function activarNodoRed() {
    const btn = document.getElementById('btn-crear-id');
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    miPeerId = "CP-" + hash;
    nombreSalaVirtual = miPeerId;

    document.getElementById('mi-id').innerText = miPeerId;
    document.getElementById('estado-conexion').innerText = "RESERVING ROOM ON SERVER...";
    if (btn) btn.disabled = true;

    fetch(`${URL_SERVIDOR}/crear-sala`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaId: nombreSalaVirtual })
    })
    .then(res => res.json())
    .then(() => {
        document.getElementById('estado-conexion').innerText = "ROOM ACTIVE. AWAITING REMOTE NODE...";
        if (btn) {
            btn.innerText = "✔ ACTIVE";
            btn.disabled = true;
        }
        soyHost = true;
        window.esElCreador = true; 
        modoActual = 'online';
        aliasEnemigo = "AWAITING ENEMY...";
        
        arrancarAntenaEscuchaGlobal();
        arrancarDosificadorRed(); // Activamos el reloj de envío controlado
    })
    .catch(() => {
        document.getElementById('estado-conexion').innerText = "LOCAL MODE ACTIVE (SERVER WAKING UP).";
        soyHost = true;
        window.esElCreador = true;
        modoActual = 'online';
        arrancarAntenaEscuchaGlobal();
        arrancarDosificadorRed();
    });
}

function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim().toUpperCase();
    if (!idEnemigo) {
        alert("🚨 PLEASE ENTER A VALID ENEMY ID");
        return;
    }

    document.getElementById('estado-conexion').innerText = "CONNECTING TO TARGET NODE...";
    nombreSalaVirtual = idEnemigo;
    soyHost = false;
    window.esElCreador = false;
    modoActual = 'online';
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_2';

    arrancarAntenaEscuchaGlobal();
    arrancarDosificadorRed(); // El invitado también dosifica sus envíos

    setTimeout(() => {
        enviarMensajeRed({ tipo: 'handshake', alias: aliasPropio });
        document.getElementById('estado-conexion').innerText = "SYNCHRONIZATION COMPLETED!";
        document.getElementById('caja-chat-online').classList.remove('oculto');
        arrancarEscenarioJuego();
    }, 400);
}

function arrancarAntenaEscuchaGlobal() {
    if (intervaloEscuchaRed) clearInterval(intervaloEscuchaRed);
    
    intervaloEscuchaRed = setInterval(() => {
        if (!nombreSalaVirtual) return;
        
        fetch(`${URL_SERVIDOR}/escuchar/${nombreSalaVirtual}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.datos) {
                    data.datos.forEach(paquete => {
                        const firmaUnica = paquete.stamp + "-" + paquete.emisor;
                        if (paquete.emisor !== miPeerId && !historialMensajesProcesados.has(firmaUnica)) {
                            historialMensajesProcesados.add(firmaUnica);
                            procesarDatosRed(paquete.contenido);
                        }
                    });
                }
            })
            .catch(() => console.log("Rastreando señal..."));
    }, 150); 
}

// RELOJ DOSIFICADOR DEFINITIVO: Envía datos cada 50ms (20 veces por segundo) sacándolos de la función actualizar()
function arrancarDosificadorRed() {
    if (intervaloSincronizacionFisica) clearInterval(intervaloSincronizacionFisica);
    
    intervaloSincronizacionFisica = setInterval(() => {
        if (modoActual !== 'online' || !nombreSalaVirtual) return;
        
        if (soyHost) {
            enviarMensajeRed({ tipo: 'sync', p1Y: p1.y, pelotaX: pelota.x, pelotaY: pelota.y, s1: p1.score, s2: p2.score, corriendo: partidaEnCurso });
        } else {
            enviarMensajeRed({ tipo: 'sync', p2Y: p2.y });
        }
    }, 500); // 50 milisegundos mantiene la bola fluida y el servidor libre de cargas masivas
}

function enviarMensajeRed(objeto) {
    if (!nombreSalaVirtual) return;

    fetch(`${URL_SERVIDOR}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            salaId: nombreSalaVirtual,
            emisor: miPeerId,
            contenido: objeto
        })
    }).catch(() => console.log("Ráfaga bloqueada. Reintentando..."));
}

function enviarDatosRed() {
    // Esta función queda vacía a propósito porque delegamos toda la carga física al arrancarDosificadorRed()
}

//Parte 4: Procesamiento de Paquetes Aéreos, Saques y Chat
// ==========================================
// 4. PROCESAMIENTO DE PAQUETES AÉREOS Y CHAT
// ==========================================
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
        document.getElementById('caja-chat-online').classList.remove('oculto');
        arrancarEscenarioJuego();
    }
    if (data.tipo === 'chat') { 
        agregarMensajePantalla(aliasEnemigo, data.mensaje); 
    }
    if (data.tipo === 'start_match') {
        partidaEnCurso = true;
        pelota.vx = data.vx; pelota.vy = data.vy;
        sonarTonoRetro(500, 0.15);
    }
    if (data.tipo === 'reset_match') { 
        reiniciarPartidaCompletaLocal(); 
    }
    if (data.tipo === 'sync') {
        if (soyHost && data.p2Y !== undefined) p2.y = data.p2Y;
        if (!soyHost) {
            if (data.p1Y !== undefined) p1.y = data.p1Y;
            if (data.pelotaX !== undefined) { pelota.x = data.pelotaX; pelota.y = data.pelotaY; }
            // CAPTURA DE VELOCIDAD FORZADA: Evita el congelamiento en la pantalla del oponente
            if (data.vx !== undefined) { pelota.vx = data.vx; pelota.vy = data.vy; }
            if (data.s1 !== undefined) { p1.score = data.s1; p2.score = data.s2; actualizarMarcador(); }
            if (data.corriendo !== undefined) {
                partidaEnCurso = data.corriendo;
                // Desbloqueo de seguridad: si el Host reinicia la partida, liberamos la interfaz del Invitado
                if (!partidaEnCurso) {
                    document.getElementById('btn-start-match').disabled = true;
                    document.getElementById('btn-start-match').innerText = "⏳ AWAITING HOST START";
                }
            }
        }
    }
}

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

// ==========================================
// 4. SECCIÓN B: CONTROLES DE FLUJO Y CHAT REAL
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
    
    // REPARADO: Desconectamos la antena de Socket.io de tu Web Service al salir
    if (socket) { 
        socket.disconnect(); 
        socket = null; 
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

function evaluarTeclaChat(e) { 
    if(e.key === 'Enter') enviarMensajeChat(); 
}

function enviarMensajeChat() {
    const input = document.getElementById('input-msg-chat');
    const msg = input.value.trim();
    if(!msg) return; 

    // El mensaje se imprime en tu pantalla de inmediato
    agregarMensajePantalla(aliasPropio, msg);
    
    // REPARADO: Envía el mensaje emitiendo el evento real a través de tu servidor Node.js
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


// Parte 5: Motor de Rebotes, Inteligencia Artificial, Pintado y Audio
// ==========================================
// 5. MOTOR FÍSICO Y ACTUALIZACIONES DE POSICIÓN
// ==========================================

// INYECTA ESTA FUNCIÓN NUEVA AQUÍ (ARRIBA DE ACTUALIZAR)
function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4); 
    let direccion = pelota.vx > 0 ? -1 : 1;
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3;
    
    // Calculamos los nuevos vectores de velocidad
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    
    // BYPASS DE INMUNIDAD: Expulsamos a la pelota fuera de la paleta para evitar el bucle infinito de pegado
    if (direccion === 1) {
        // Si rebota a la derecha, la colocamos inmediatamente adelante de la paleta izquierda
        pelota.x = paleta.x + paletaAncho + pelota.radio + 2;
    } else {
        // Si rebota a la izquierda, la colocamos inmediatamente antes de la paleta derecha
        pelota.x = paleta.x - pelota.radio - 2;
    }
    
    sonarTonoRetro(600, 0.08); 

    // Forzamos un envío de emergencia inmediato por red al servidor para avisar el rebote exacto
    if (modoActual === 'online' && soyHost) {
        enviarMensajeRed({ 
            tipo: 'sync', 
            p1Y: p1.y, 
            pelotaX: pelota.x, 
            pelotaY: pelota.y, 
            vx: pelota.vx, 
            vy: pelota.vy,
            s1: p1.score, 
            s2: p2.score, 
            corriendo: partidaEnCurso 
        });
    }
}

function actualizar() {
    // 1. Control del Jugador 1 (W / S) - Siempre activo localmente
    if (modoActual !== 'online' || soyHost) {
        if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
        if (teclas['s'] || teclas['S']) p1.y = Math.min(480 - paletaAlto - 10, p1.y + 6);
    }

    // 2. Control del Jugador 2 (Flechas ↑ / ↓) - Activo en local o si eres Invitado online
    if (modoActual === 'local' || (modoActual === 'online' && !soyHost)) {
        if (teclas['ArrowUp']) p2.y = Math.max(10, p2.y - 6);
        if (teclas['ArrowDown']) p2.y = Math.min(480 - paletaAlto - 10, p2.y + 6);
    }

    // 3. Inteligencia Artificial (Modo entrenamiento)
    if (modoActual === 'ia') {
        let centroPaleta = p2.y + paletaAlto / 2;
        if (pelota.vx > 0) { 
            if (centroPaleta < pelota.y - 12) p2.y = Math.min(480 - paletaAlto - 10, p2.y + velocidadIA);
            else if (centroPaleta > pelota.y + 12) p2.y = Math.max(10, p2.y - velocidadIA);
        }
    }

    // 4. MOTOR FÍSICO MULTIJUGADOR ARBITRADO
    if (partidaEnCurso) {
        // REGLA DE ORO: Si es juego online, SÓLO el Host calcula los rebotes para que la bola no se quede pegada
        if (modoActual !== 'online' || soyHost) {
            pelota.x += pelota.vx;
            pelota.y += pelota.vy;

            // Rebotes estructurales contra Techo y Piso
            if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= 480) {
                pelota.vy = -pelota.vy;
                sonarTonoRetro(300, 0.05); 
            }

            // Colisión frontal contra Paleta 1 (Izquierda)
            if (pelota.vx < 0 && pelota.x - pelota.radio <= p1.x + paletaAncho && pelota.y >= p1.y && pelota.y <= p1.y + paletaAlto) {
                calcularReboteAngulo(p1);
            }
            
            // Colisión frontal contra Paleta 2 (Derecha)
            if (pelota.vx > 0 && pelota.x + pelota.radio >= p2.x && pelota.y >= p2.y && pelota.y <= p2.y + paletaAlto) {
                calcularReboteAngulo(p2);
            }

            // Conteo de Anotaciones (Goles)
            if (pelota.x < 0) { p2.score++; responderPunto(); }
            else if (pelota.x > 800) { p1.score++; responderPunto(); }
        } else {
            // Si eres el Invitado (Jugador 2), dejas que la pelota fluya de acuerdo a la velocidad que te manda el Host
            pelota.x += pelota.vx;
            pelota.y += pelota.vy;
        }
    }
}


//Versión que vacía el satélite de internet en cada anotación
function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3); // Tono grave de anotación
    
    // FILTRO DE TRÁFICO DE EMERGENCIA: Borramos los paquetes viejos del servidor al meter gol
    if (modoActual === 'online' && soyHost) {
        fetch(`${URL_SERVIDOR}/limpiar-sala`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaId: nombreSalaVirtual })
        })
        .then(() => {
            // Una vez limpia la red, le avisamos al invitado que la bola se resetea al centro
            enviarMensajeRed({ 
                tipo: 'sync', 
                p1Y: p1.y, 
                pelotaX: 800 / 2, 
                pelotaY: 480 / 2, 
                vx: 0, 
                vy: 0, 
                s1: p1.score, 
                s2: p2.score, 
                corriendo: false 
            });
        })
        .catch(e => console.log("Reajustando canal de red..."));
    }
    
    resetPelota(true); // Reinicia con saque automático inmediato
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
    ctx.shadowBlur = 0; // Desactivamos el filtro blur para evitar caídas de FPS
}

// OSCILADOR SYNTH RETRO DE 8 BITS NATIVO (Web Audio API)
function sonarTonoRetro(frecuencia, duracion) {
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
}

// CICLO RECURSIVO INFINITO DE FOTOGRAMAS (60 FPS)
function buclePrincipalJuego() {
    if (!window.bucleActivo) return; // Frena el procesamiento si el jugador regresó al menú
    actualizar();
    dibujar();
    requestAnimationFrame(buclePrincipalJuego);
}
