// Servidor: entrega o jogo (index.html) e manda chat/presentes da live do TikTok pro jogo via WebSocket.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const USUARIO = process.env.TIKTOK_USER || 'noxxzin7';
const PORTA = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.end('ok'); return; }
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('index.html nao encontrado'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
function enviar(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// teste: abra /ws e mande {"t":"chat","u":"teste","m":"atacar"} (opcional)
wss.on('connection', ws => {
  console.log('Jogo conectado');
  ws.on('message', raw => { try { const m = JSON.parse(raw); if (m && m.t) enviar(m); } catch (e) {} });
});

function conectarTikTok() {
  const live = new WebcastPushConnection(USUARIO);
  let reconectando = false;
  const tentarDeNovo = () => {
    if (reconectando) return;
    reconectando = true;
    setTimeout(conectarTikTok, 10000);
  };

  live.connect()
    .then(s => console.log('Conectado na live de @' + USUARIO + ' (sala ' + s.roomId + ')'))
    .catch(e => { console.log('Live offline ou erro, tentando de novo em 10s:', e.message || e); tentarDeNovo(); });

  live.on('chat', d => {
    enviar({ t: 'chat', u: d.nickname || d.uniqueId, m: d.comment });
  });

  live.on('gift', d => {
    // presente em sequencia (streak): so conta quando a sequencia termina
    if (d.giftType === 1 && !d.repeatEnd) return;
    enviar({
      t: 'gift',
      u: d.nickname || d.uniqueId,
      n: d.giftName,
      c: d.repeatCount || 1,
      d: d.diamondCount || 1
    });
  });

  live.on('disconnected', () => { console.log('Desconectou da live'); tentarDeNovo(); });
  live.on('streamEnd', () => { console.log('Live encerrada'); tentarDeNovo(); });
}

server.listen(PORTA, () => {
  console.log('Servidor na porta ' + PORTA);
  conectarTikTok();
});
