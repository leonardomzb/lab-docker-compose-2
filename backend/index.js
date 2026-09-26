const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
const port = 3000;

// ==========================================
// 1. FUNCIÓN HELPER PARA LOGS EN JSON (DevOps)
// ==========================================
function logEvent(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level, // INFO, WARN, ERROR
    service: 'backend',
    message,
    ...metadata
  };
  // Imprime JSON en stdout para que Promtail/Loki lo lean fácilmente
  console.log(JSON.stringify(logEntry));
}

// ==========================================
// 2. MIDDLEWARE DE REGISTRO DE PETICIONES HTTP
// ==========================================
app.use((req, res, next) => {
  const start = Date.now();
  
  // Escuchar cuando finalice la respuesta para calcular tiempo y status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

    logEvent(level, `HTTP ${req.method} ${req.url}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip
    });
  });

  next();
});

// Colección de métricas por defecto de Prometheus
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Endpoint /metrics exclusivo para Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Conexión DB
const pool = new Pool({
  user: process. env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Endpoint Pintura
app.get('/pintura/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM cuadros WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      // Registrar advertencia de negocio
      logEvent('WARN', `Intento de acceso a cuadro inexistente ID: ${id}`, { id });
      res.status(404).json({ error: "Cuadro no encontrado" });
    }
  } catch (err) {
    // Registrar error grave de base de datos o consulta
    logEvent('ERROR', `Error al consultar la base de datos para cuadro ID: ${id}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Endpoint Healthcheck
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (err) {
    logEvent('ERROR', 'Healthcheck falló: Base de datos no disponible', { error: err.message });
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

app.listen(port, () => {
  logEvent('INFO', `Backend corriendo en http://localhost:${port}`, { port });
});