const http = require("http");
const fs = require("fs");
const url = require("url");

// 日志组件配置 - 根据实际环境修改路径
const COMPONENTS = {
  "higress-gateway": { name: "Higress Gateway", file: "/var/log/hiclaw/higress-gateway.log" },
  "higress-controller": { name: "Higress Controller", file: "/var/log/hiclaw/higress-controller.log" },
  "higress-pilot": { name: "Higress Pilot", file: "/var/log/hiclaw/higress-pilot.log" },
  "higress-console": { name: "Higress Console", file: "/var/log/hiclaw/higress-console.log" },
  "higress-apiserver": { name: "Higress API Server", file: "/var/log/hiclaw/higress-apiserver.log" },
  "manager-agent": { name: "Manager Agent", file: "/var/log/hiclaw/manager-agent.log" },
  "mc-mirror": { name: "MinIO Mirror", file: "/var/log/hiclaw/mc-mirror.log" },
  "minio": { name: "MinIO", file: "/var/log/hiclaw/minio.log" },
  "tuwunel": { name: "Matrix Server", file: "/var/log/hiclaw/tuwunel.log" },
  "nginx-access": { name: "Nginx Access", file: "/var/log/nginx/access.log" },
  "nginx-error": { name: "Nginx Error", file: "/var/log/nginx/error.log" },
  "supervisord": { name: "Supervisor", file: "/var/log/supervisord.log" }
};

function parseLogs(content, maxLines) {
  const lines = content.split("\n").filter(l => l.trim()).slice(-maxLines);
  return lines.map((line, idx) => {
    let level = "INFO";
    const lineLower = line.toLowerCase();
    if (lineLower.includes("error") || lineLower.includes("err")) level = "ERROR";
    else if (lineLower.includes("warn") || lineLower.includes("warning")) level = "WARN";
    else if (lineLower.includes("debug")) level = "DEBUG";
    
    let timestamp = new Date().toISOString();
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    if (tsMatch) timestamp = tsMatch[1];
    
    return { id: idx, timestamp, level, message: line.substring(0, 2000) };
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  if (pathname === "/log-search/api/health") {
    res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
    return;
  }
  
  if (pathname === "/log-search/api/components") {
    const components = [];
    for (const [id, info] of Object.entries(COMPONENTS)) {
      try {
        const stat = fs.statSync(info.file);
        components.push({ id, name: info.name, file: info.file, size: stat.size, exists: true });
      } catch (e) {
        components.push({ id, name: info.name, file: info.file, size: 0, exists: false });
      }
    }
    res.end(JSON.stringify({ components }));
    return;
  }
  
  if (pathname === "/log-search/api/logs") {
    const component = parsedUrl.query.component || "higress-gateway";
    const lines = parseInt(parsedUrl.query.lines) || 200;
    const level = parsedUrl.query.level;
    const search = parsedUrl.query.search;
    
    const info = COMPONENTS[component];
    if (!info) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Component not found" }));
      return;
    }
    
    try {
      const content = fs.readFileSync(info.file, "utf-8");
      let logs = parseLogs(content, Math.min(lines, 1000));
      
      if (level && level !== "ALL") {
        logs = logs.filter(l => l.level === level);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        logs = logs.filter(l => l.message.toLowerCase().includes(searchLower));
      }
      
      res.end(JSON.stringify({ component, name: info.name, total: logs.length, logs }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", path: pathname }));
});

const PORT = process.env.LOG_SEARCH_PORT || 19996;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Log Search API running on port ${PORT}`);
});
