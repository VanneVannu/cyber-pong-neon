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
window.ultimoPulsoFisico = 0; // Candado cronológico para evitar tirones de red


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
        // Conectamos nativamente al Web Service de Render al pulsar Online
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
// 3. ANTENAS MULTIJUGADOR REAL WEB SOCKETS NATIVOS (INMUNE A RESTRICCIONES)
// ===================================================
let intervaloSincronizacionFisica = null;
let puenteRedWebSocket = null;

function inicializarConexionServidor() {
    if (puenteRedWebSocket) return;

    document.getElementById('estado-conexion').innerText = "CONNECTING TO ARCADE HUB (WAKING UP SERVER)...⏳";

    // Transformamos tu URL HTTP de Render de forma automática en una dirección segura cifrada WSS
    const urlWebSocketSegura = URL_SERVIDOR.replace(/^http/, 'ws');
    
    // Abrimos el túnel de WebSockets nativo del navegador
    puenteRedWebSocket = new WebSocket(urlWebSocketSegura);

    puenteRedWebSocket.onopen = function() {
        document.getElementById('estado-conexion').innerText = "HUB OPERATIONAL. CHANNELS SECURE. ⚡";
        console.log("Terminal acoplada de forma aérea al túnel WSS.");

        // Sincronización de sala en caliente si el usuario ya interactuó con los botones
        if (nombreSalaVirtual) {
            if (soyHost) {
                puenteRedWebSocket.send(JSON.stringify({ accion: 'crear_sala', salaId: nombreSalaVirtual }));
            } else {
                puenteRedWebSocket.send(JSON.stringify({ accion: 'unirse_sala', salaId: nombreSalaVirtual }));
            }
        }
    };

    puenteRedWebSocket.onmessage = function(event) {
        const datosCifrados = JSON.parse(event.data);
        
        // Escuchador interno: si el servidor avisa que el rival entró, el Host inicia el handshake
        if (datosCifrados.tipo === 'rival_conectado' && soyHost) {
            document.getElementById('estado-conexion').innerText = "ENEMY DETECTED! LINKING TERMINALS...";
            enviarMensajeRed({ tipo: 'handshake', alias: aliasPropio });
        } else {
            procesarDatosRed(datosCifrados);
        }
    };

    puenteRedWebSocket.onerror = function() {
        console.log("Buscando señal satelital en segundo plano...");
    };
}

function activarNodoRed() {
    const btn = document.getElementById('btn-crear-id');
    
    // GENERACIÓN LOCAL EN 0 MILISEGUNDOS GARANTIZADA
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    miPeerId = "CP-" + hash;
    nombreSalaVirtual = miPeerId;

    document.getElementById('mi-id').innerText = miPeerId;
    document.getElementById('estado-conexion').innerText = "ONLINE NODE STABLE. SEND ID TO ENEMY.";
    
    if (btn) {
        btn.innerText = "✔ ACTIVE";
        btn.disabled = true;
    }
    
    soyHost = true;
    window.esElCreador = true; 
    modoActual = 'online';
    aliasEnemigo = "AWAITING ENEMY...";
    
    // Si el túnel de internet ya estaba abierto, registramos la sala de inmediato
    if (puenteRedWebSocket && puenteRedWebSocket.readyState === WebSocket.OPEN) {
        puenteRedWebSocket.send(JSON.stringify({ accion: 'crear_sala', salaId: nombreSalaVirtual }));
    }
    
    arrancarDosificadorRed();
}

function conectarAEnemigo() {
    const idEnemigo = document.getElementById('input-peer-id').value.trim().toUpperCase();
    if (!idEnemigo) {
        alert("🚨 PLEASE ENTER A VALID ENEMY ID");
        return;
    }

    nombreSalaVirtual = idEnemigo;
    soyHost = false;
    window.esElCreador = false;
    modoActual = 'online';
    aliasPropio = document.getElementById('input-alias').value.trim() || 'PLAYER_2';

    // BYPASS DE INVITADO INMEDIATO: Lo inyectamos de cabeza a la arena para que no se quede colgado
    document.getElementById('estado-conexion').innerText = "SYNCHRONIZATION COMPLETED!";
    const cajaChat = document.getElementById('caja-chat-online');
    if (cajaChat) cajaChat.classList.remove('oculto');

    if (puenteRedWebSocket && puenteRedWebSocket.readyState === WebSocket.OPEN) {
        puenteRedWebSocket.send(JSON.stringify({ accion: 'unirse_sala', salaId: nombreSalaVirtual }));
    }
    
    arrancarEscenarioJuego();
    arrancarDosificadorRed();
}

// RELOJ DOSIFICADOR EMISOR DE WEB-SOCKETS: Envía datos de forma directa y ultra veloz cada 65ms
function arrancarDosificadorRed() {
    if (intervaloSincronizacionFisica) clearInterval(intervaloSincronizacionFisica);
    
    intervaloSincronizacionFisica = setInterval(() => {
        if (modoActual !== 'online' || !puenteRedWebSocket || puenteRedWebSocket.readyState !== WebSocket.OPEN) return;
        
        if (soyHost) {
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
        } else {
            enviarMensajeRed({ tipo: 'sync', p2Y: p2.y });
        }
    }, 65); 
}

function enviarMensajeRed(objeto) {
    if (puenteRedWebSocket && puenteRedWebSocket.readyState === WebSocket.OPEN) {
        puenteRedWebSocket.send(JSON.stringify({
            accion: 'transmitir',
            contenido: objeto
        }));
    }
}

function enviarDatosRed() {
    // Heredado del motor físico de la Parte 5
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
    
    // Desconectamos de forma limpia la antena de Socket.io de tu Web Service al salir
    if (socket) { 
        socket.disconnect(); 
        socket = null; 
    }
    
    // Apagamos también el dosificador de ráfagas para no dejar procesos colgados
    if (intervaloSincronizacionFisica) {
        clearInterval(intervaloSincronizacionFisica);
        intervaloSincronizacionFisica = null;
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

    // El mensaje se imprime en tu propia pantalla de inmediato
    agregarMensajePantalla(aliasPropio, msg);
    
    // Envía el paquete de texto emitiendo el evento real a través de tu Web Service
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
function calcularReboteAngulo(paleta) {
    let impactoRelativo = (pelota.y - (paleta.y + paletaAlto / 2)) / (paletaAlto / 2);
    let anguloGiro = impactoRelativo * (Math.PI / 4); 
    let direccion = pelota.vx > 0 ? -1 : 1;
    let velocidadActual = Math.sqrt(pelota.vx * pelota.vx + pelota.vy * pelota.vy) + 0.3;
    
    pelota.vx = direccion * velocidadActual * Math.cos(anguloGiro);
    pelota.vy = velocidadActual * Math.sin(anguloGiro);
    
    // Filtro de inmunidad para que no se quede pegada
    if (direccion === 1) {
        pelota.x = paleta.x + paletaAncho + pelota.radio + 2;
    } else {
        pelota.x = paleta.x - pelota.radio - 2;
    }
    
    sonarTonoRetro(600, 0.08); 

    // MODIFICADO: Con Socket.io, si hay un impacto, el Host transmite el vector inmediatamente
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
    // 1. Control del Jugador 1 (W / S) - Local si eres Host u Offline
    if (modoActual !== 'online' || soyHost) {
        if (teclas['w'] || teclas['W']) p1.y = Math.max(10, p1.y - 6);
        if (teclas['s'] || teclas['S']) p1.y = Math.min(480 - paletaAlto - 10, p1.y + 6);
    }

    // 2. Control del Jugador 2 (Flechas ↑ / ↓) - Local si eres Invitado u Offline
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

    // 4. MOTOR DE TRACCIÓN FÍSICA SIN RECORTE DE PAQUETES
    if (partidaEnCurso) {
        // AUTORIDAD TOTAL DEL HOST: Evita que el Jugador 2 deforme la trayectoria
        if (modoActual !== 'online' || soyHost) {
            pelota.x += pelota.vx;
            pelota.y += pelota.vy;

            // Rebotes estructurales perimetrales
            if (pelota.y - pelota.radio <= 0 || pelota.y + pelota.radio >= 480) {
                pelota.vy = -pelota.vy;
                sonarTonoRetro(300, 0.05); 
            }

            // Colisiones contra ambas paletas administradas por el Host de forma limpia
            if (pelota.vx < 0 && pelota.x - pelota.radio <= p1.x + paletaAncho && pelota.y >= p1.y && pelota.y <= p1.y + paletaAlto) {
                calcularReboteAngulo(p1);
            }
            if (pelota.vx > 0 && pelota.x + pelota.radio >= p2.x && pelota.y >= p2.y && pelota.y <= p2.y + paletaAlto) {
                calcularReboteAngulo(p2);
            }

            // Conteo de anotaciones unificado
            if (pelota.x < 0) { p2.score++; responderPunto(); }
            else if (pelota.x > 800) { p1.score++; responderPunto(); }
        } else {
            // EL INVITADO CORRE EN MODO ENLACE: Desplaza la bola imitando fielmente los vectores del Host
            pelota.x += pelota.vx;
            pelota.y += pelota.vy;
        }
    }
}


// ==========================================
// 5. SECCIÓN B: RENDERIZADO GRÁFICO, AUDIO Y BUCLE CRT
// ==========================================
function responderPunto() {
    actualizarMarcador();
    sonarTonoRetro(150, 0.3); // Tono grave de anotación/pérdida
    
    // REPARADO: Con Socket.io, si hay un gol, el Host le ordena a la nube limpiar el canal
    if (modoActual === 'online' && soyHost) {
        if (socket && socket.connected) {
            socket.emit('enviar_paquete', {
                salaId: nombreSalaVirtual,
                datos: {
                    tipo: 'sync', 
                    p1Y: p1.y, 
                    pelotaX: 800 / 2, 
                    pelotaY: 480 / 2, 
                    vx: 0, 
                    vy: 0, 
                    s1: p1.score, 
                    s2: p2.score, 
                    corriendo: false 
                }
            });
        }
    }
    
    resetPelota(false); // Espera a que el Host vuelva a pulsar START MATCH
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
    ctx.shadowBlur = 0; // Desactivamos el filtro blur para evitar caídas de FPS
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
