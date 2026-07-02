const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3456;
const DATA_FILE = path.join(__dirname, 'meetings-data.json');
const HTML_FILE = path.join(__dirname, 'index.html');

// ========== 数据层 ==========
let state = { meetings: [] };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (!Array.isArray(state.meetings)) state.meetings = [];
    }
    console.log('已加载 ' + state.meetings.length + ' 个会议');
  } catch(e) { console.error('加载数据失败:', e.message); state = { meetings: [] }; }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch(e) { console.error('保存数据失败:', e.message); }
}

// ========== SSE 客户端管理 ==========
const sseClients = [];

function broadcast(event, data) {
  const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  sseClients.forEach(res => {
    try { res.write(msg); } catch(e) { /* client disconnected */ }
  });
}

// ========== HTTP 处理 ==========
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // 跨域头（允许局域网其他设备访问）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/') {
    serveFile(res, HTML_FILE, 'text/html; charset=utf-8');
  }
  // 获取当前状态
  else if (pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(state));
  }
  // 提交更新
  else if (pathname === '/api/update' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { name, steps } = body;
      if (!name || !steps) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '缺少 name 或 steps' }));
        return;
      }
      // 查找或创建会议
      let meeting = state.meetings.find(m => m.name === name);
      if (meeting) {
        Object.keys(steps).forEach(k => {
          const val = steps[k];
          if (val === null || val === undefined) {
            delete meeting.steps[k];
          } else {
            meeting.steps[k] = val;
          }
        });
      } else {
        state.meetings.push({ name, steps: { ...steps } });
      }
      saveData();
      broadcast('state', state);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  }
  // 新建会议
  else if (pathname === '/api/add' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { name } = body;
      if (!name || state.meetings.find(m => m.name === name)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '名称无效或已存在' }));
        return;
      }
      state.meetings.push({ name, steps: {} });
      saveData();
      broadcast('state', state);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  }
  // 删除会议
  else if (pathname === '/api/delete' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const idx = state.meetings.findIndex(m => m.name === body.name);
      if (idx >= 0) {
        state.meetings.splice(idx, 1);
        saveData();
        broadcast('state', state);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  }
  // SSE 实时推送
  else if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    // 发送当前状态
    res.write('event: state\ndata: ' + JSON.stringify(state) + '\n\n');
    sseClients.push(res);
    // 心跳保持连接
    const keepAlive = setInterval(() => {
      try { res.write(':heartbeat\n\n'); } catch(e) { clearInterval(keepAlive); }
    }, 15000);
    req.on('close', () => {
      clearInterval(keepAlive);
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
  }
  else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

loadData();
server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 会议进度服务已启动');
  console.log('   http://localhost:' + PORT);
  console.log('   局域网访问: http://' + getLocalIP() + ':' + PORT);
  console.log('   数据文件: ' + DATA_FILE);
});

function getLocalIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}
