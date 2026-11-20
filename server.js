// Ponte TikTok LIVE -> jogo. Escuta a live e manda presentes/comentários para a página por WebSocket.
const express = require('express'), http = require('http');
const { WebSocketServer } = require('ws');
const lib = require('tiktok-live-connector');
const Conn = lib.WebcastPushConnection || lib.TikTokLiveConnection; // aceita versões antigas e novas
const USER = (process.env.TIKTOK_USER || '').replace('@', '').trim();

const app = express();
app.use(express.static(__dirname + '/public'));
let ok = false;
app.get('/status', (q, r) => r.json({ user: USER, conectado: ok }));

const srv = http.createServer(app);
const wss = new WebSocketServer({ server: srv, path: '/ws' });
const send = o => { const s = JSON.stringify(o); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };

let timer = null;
const retry = () => { ok = false; if (timer) return; timer = setTimeout(() => { timer = null; conectar(); }, 15000); };

function conectar() {
  if (!USER) { console.log('Defina a variável TIKTOK_USER com o seu @ (sem o @).'); return; }
  const c = new Conn(USER, {});
  c.connect()
    .then(() => { ok = true; console.log('Conectado na live de @' + USER); })
    .catch(e => { console.log('Live offline ou erro, tentando de novo em 15s:', (e && e.message) || e); retry(); });
  c.on('chat', d => send({ t: 'chat', u: d.uniqueId || (d.user && d.user.uniqueId) || 'Alguém', m: d.comment || '' }));
  c.on('gift', d => {
    const g = d.giftDetails || {}, type = d.giftType !== undefined ? d.giftType : g.giftType;
    if (type === 1 && !d.repeatEnd) return; // sequência ainda em andamento: conta só no final
    send({ t: 'gift', u: d.uniqueId || (d.user && d.user.uniqueId) || 'Alguém',
      n: d.giftName || g.giftName || 'Presente', d: d.diamondCount !== undefined ? d.diamondCount : (g.diamondCount || 1), c: d.repeatCount || 1 });
  });
  c.on('disconnected', retry);
  c.on('streamEnd', retry);
}

srv.listen(process.env.PORT || 3000, () => { console.log('Servidor no ar'); conectar(); });
