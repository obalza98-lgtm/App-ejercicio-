/**
 * HIERRO — backend (Google Apps Script)
 * Todo se guarda en un Google Sheets tuyo:
 *   Rutina, Registros (series), Comidas, Alimentos (propios), PesoCorporal, Config
 */

const SH = {
  rutina:    { name: 'Rutina',       h: ['dia', 'ejercicio', 'series', 'reps', 'incremento', 'notas'] },
  registros: { name: 'Registros',    h: ['sesionId', 'fecha', 'dia', 'ejercicio', 'serie', 'peso', 'reps', 'rpe', 'notas', 'creado'] },
  comidas:   { name: 'Comidas',      h: ['id', 'fecha', 'comida', 'alimento', 'gramos', 'kcal', 'prot', 'carb', 'grasa', 'creado'] },
  alimentos: { name: 'Alimentos',    h: ['nombre', 'kcal', 'prot', 'carb', 'grasa', 'porcion'] },
  pesos:     { name: 'PesoCorporal', h: ['fecha', 'peso'] },
  config:    { name: 'Config',       h: ['clave', 'valor'] }
};
const TEXT_COLS = ['fecha', 'creado']; // se guardan como texto para que Sheets no las convierta

/** Opcional: ID de la planilla a usar si el script NO está creado desde Extensiones → Apps Script. */
const SHEET_ID = '';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('HIERRO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/* ================= Planilla ================= */

function getSS_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SS_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fue borrada: se crea otra */ }
  }
  const ss = SpreadsheetApp.create('HIERRO — Datos');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

function ensureSheet_(ss, key) {
  const def = SH[key];
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.h.length).setValues([def.h]).setFontWeight('bold');
    sh.setFrozenRows(1);
    def.h.forEach((h, i) => { if (TEXT_COLS.indexOf(h) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@'); });
    const blank = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  }
  return sh;
}

function read_(ss, key) {
  const def = SH[key];
  const sh = ensureSheet_(ss, key);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = ss.getSpreadsheetTimeZone();
  return sh.getRange(2, 1, n, def.h.length).getValues()
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => {
      const o = {};
      def.h.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, h === 'creado' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
        o[h] = v;
      });
      return o;
    });
}

function toRow_(key, o) {
  return SH[key].h.map(h => (o[h] === undefined || o[h] === null) ? '' : o[h]);
}

function writeAll_(ss, key, rows) {
  const def = SH[key];
  const sh = ensureSheet_(ss, key);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, def.h.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, def.h.length).setValues(rows.map(o => toRow_(key, o)));
}

function append_(ss, key, rows) {
  if (!rows.length) return;
  const def = SH[key];
  const sh = ensureSheet_(ss, key);
  const start = sh.getLastRow() + 1;
  def.h.forEach((h, i) => { if (TEXT_COLS.indexOf(h) >= 0) sh.getRange(start, i + 1, rows.length, 1).setNumberFormat('@'); });
  sh.getRange(start, 1, rows.length, def.h.length).setValues(rows.map(o => toRow_(key, o)));
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function now_(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function readCfg_(ss) {
  const row = read_(ss, 'config').find(r => r.clave === 'cfg');
  try { return row ? JSON.parse(row.valor) : {}; } catch (e) { return {}; }
}

function writeCfg_(ss, cfg) {
  const rows = read_(ss, 'config').filter(r => r.clave !== 'cfg');
  rows.push({ clave: 'cfg', valor: JSON.stringify(cfg) });
  writeAll_(ss, 'config', rows);
}

/* ================= API llamada desde la app ================= */

function getData() {
  const ss = getSS_();
  return {
    rutina: read_(ss, 'rutina'),
    registros: read_(ss, 'registros'),
    comidas: read_(ss, 'comidas'),
    alimentos: read_(ss, 'alimentos'),
    pesos: read_(ss, 'pesos'),
    cfg: readCfg_(ss),
    sheetUrl: ss.getUrl()
  };
}

/* ---- Entrenamiento ---- */

function saveRutina(rows) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, 'rutina', rows || []);
    return getData();
  });
}

/** sesion: {sesionId?, fecha, dia, notas, sets:[{ejercicio, serie, peso, reps, rpe}]} */
function saveSesion(sesion) {
  return withLock_(() => {
    const ss = getSS_();
    const id = sesion.sesionId || Utilities.getUuid();
    const creado = now_(ss);
    const rows = (sesion.sets || []).map(s => ({
      sesionId: id, fecha: String(sesion.fecha), dia: sesion.dia || '', ejercicio: s.ejercicio,
      serie: Number(s.serie) || 1, peso: Number(s.peso) || 0, reps: Number(s.reps) || 0,
      rpe: s.rpe === '' || s.rpe == null ? '' : Number(s.rpe), notas: sesion.notas || '', creado: creado
    }));
    if (!rows.length) throw new Error('No hay series para guardar');
    if (sesion.sesionId) writeAll_(ss, 'registros', read_(ss, 'registros').filter(r => r.sesionId !== id));
    append_(ss, 'registros', rows);
    return getData();
  });
}

function deleteSesion(sesionId) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, 'registros', read_(ss, 'registros').filter(r => r.sesionId !== sesionId));
    return getData();
  });
}

/* ---- Comida ---- */

function addComidas(items) {
  return withLock_(() => {
    const ss = getSS_();
    const creado = now_(ss);
    append_(ss, 'comidas', (items || []).map(i => Object.assign({}, i, { fecha: String(i.fecha), creado: i.creado || creado })));
    return true;
  });
}

function updateComida(item) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, 'comidas', read_(ss, 'comidas').map(r => r.id === item.id ? Object.assign({}, r, item) : r));
    return true;
  });
}

function deleteComida(id) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, 'comidas', read_(ss, 'comidas').filter(r => r.id !== id));
    return true;
  });
}

/** Guarda (o actualiza por nombre) un alimento propio. Valores por 100 g. */
function saveAlimento(a) {
  return withLock_(() => {
    const ss = getSS_();
    const rows = read_(ss, 'alimentos').filter(r => String(r.nombre).toLowerCase() !== String(a.nombre).toLowerCase());
    rows.push(a);
    writeAll_(ss, 'alimentos', rows);
    return true;
  });
}

/**
 * Busca alimentos en Open Food Facts (base abierta y gratuita).
 * Si el texto es un código de barras busca ese producto exacto.
 */
function buscarAlimentoOnline(q) {
  q = String(q || '').trim();
  if (!q) return [];
  const opts = { muteHttpExceptions: true, headers: { 'User-Agent': 'HierroGymTracker/2.0 (uso personal)' } };
  const map = p => {
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] != null ? n['energy-kcal_100g'] : (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
    if (kcal == null || !p.product_name) return null;
    return {
      nombre: p.product_name + (p.brands ? ' (' + String(p.brands).split(',')[0] + ')' : ''),
      kcal: Math.round(kcal), prot: +(n.proteins_100g || 0).toFixed(1),
      carb: +(n.carbohydrates_100g || 0).toFixed(1), grasa: +(n.fat_100g || 0).toFixed(1),
      porcion: Number(p.serving_quantity) || 100, src: 'online'
    };
  };
  if (/^\d{8,14}$/.test(q)) {
    const r = UrlFetchApp.fetch('https://world.openfoodfacts.org/api/v2/product/' + q + '.json', opts);
    if (r.getResponseCode() !== 200) return [];
    const j = JSON.parse(r.getContentText());
    const m = j.product ? map(j.product) : null;
    return m ? [m] : [];
  }
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25' +
    '&fields=product_name,brands,nutriments,serving_quantity&search_terms=' + encodeURIComponent(q);
  const r = UrlFetchApp.fetch(url, opts);
  if (r.getResponseCode() !== 200) throw new Error('El buscador online no respondió (' + r.getResponseCode() + '). Probá de nuevo.');
  return (JSON.parse(r.getContentText()).products || []).map(map).filter(Boolean);
}

/* ---- Peso corporal y configuración ---- */

function savePeso(fecha, peso) {
  return withLock_(() => {
    const ss = getSS_();
    const rows = read_(ss, 'pesos').filter(r => r.fecha !== fecha);
    rows.push({ fecha: String(fecha), peso: Number(peso) });
    rows.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    writeAll_(ss, 'pesos', rows);
    return true;
  });
}

function deletePeso(fecha) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, 'pesos', read_(ss, 'pesos').filter(r => r.fecha !== fecha));
    return true;
  });
}

function saveConfig(cfg) {
  return withLock_(() => {
    const ss = getSS_();
    const prev = readCfg_(ss);
    cfg.auto = prev.auto || cfg.auto; // las automatizaciones se guardan aparte
    writeCfg_(ss, cfg);
    return true;
  });
}

/* ================= Automatizaciones ================= */

const AUTO_FNS = ['weeklyReport', 'dailyReminder'];

/** opts: {semanal: bool, recordatorio: bool, hora: 0-23} */
function setupAutomations(opts) {
  return withLock_(() => {
    ScriptApp.getProjectTriggers()
      .filter(t => AUTO_FNS.indexOf(t.getHandlerFunction()) >= 0)
      .forEach(t => ScriptApp.deleteTrigger(t));
    const hora = Math.max(0, Math.min(23, Number(opts.hora) || 21));
    if (opts.semanal) ScriptApp.newTrigger('weeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
    if (opts.recordatorio) ScriptApp.newTrigger('dailyReminder').timeBased().everyDays(1).atHour(hora).create();
    const ss = getSS_();
    const cfg = readCfg_(ss);
    cfg.auto = { semanal: !!opts.semanal, recordatorio: !!opts.recordatorio, hora: hora };
    writeCfg_(ss, cfg);
    return { auto: cfg.auto, email: myEmail_() };
  });
}

function myEmail_() {
  return Session.getEffectiveUser().getEmail();
}

/** Envía el reporte ahora (botón "Enviarme un reporte"). */
function sendReportNow() {
  weeklyReport();
  return myEmail_();
}

// --- helpers de fechas (yyyy-MM-dd) ---
function ymd_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function addDays_(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd_(d); }
function weekStart_(s) { const d = new Date(s + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return addDays_(s, -dow); }
function today_(ss) { return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'); }
function round_(n, d) { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; }

function targets_(cfg, peso) {
  const w = peso || Number(cfg.peso) || 75;
  const h = Number(cfg.altura) || 175, a = Number(cfg.edad) || 30;
  const act = Number(cfg.actividad) || 1.55;
  const bmr = 10 * w + 6.25 * h - 5 * a + (cfg.sexo === 'f' ? -161 : 5);
  const adj = { perder: -450, mantener: 0, ganar: 300 }[cfg.objetivo || 'mantener'];
  const kcal = Number(cfg.kcalManual) > 0 ? Number(cfg.kcalManual)
    : Math.round((bmr * act + adj + (Number(cfg.kcalAjuste) || 0)) / 50) * 50;
  const prot = Math.round(w * (cfg.objetivo === 'perder' ? 2.2 : 2));
  return { kcal: kcal, prot: prot };
}

function buildReport_() {
  const ss = getSS_();
  const d = getData();
  const hoy = today_(ss);
  const ini = addDays_(weekStart_(hoy), -7), fin = addDays_(ini, 6);
  const iniPrev = addDays_(ini, -7);
  const inRange = (f, a, b) => f >= a && f <= b;

  const reg = d.registros.filter(r => inRange(r.fecha, ini, fin));
  const regPrev = d.registros.filter(r => inRange(r.fecha, iniPrev, addDays_(ini, -1)));
  const ses = {}; reg.forEach(r => ses[r.sesionId] = 1);
  const sesPrev = {}; regPrev.forEach(r => sesPrev[r.sesionId] = 1);
  const vol = reg.reduce((a, r) => a + r.peso * r.reps, 0);
  const volPrev = regPrev.reduce((a, r) => a + r.peso * r.reps, 0);

  // Récords de la semana
  const prs = [];
  const exs = {}; reg.forEach(r => exs[r.ejercicio] = Math.max(exs[r.ejercicio] || 0, Number(r.peso)));
  Object.keys(exs).forEach(ex => {
    const antes = d.registros.filter(r => r.ejercicio === ex && r.fecha < ini).map(r => Number(r.peso));
    if (antes.length && exs[ex] > Math.max.apply(null, antes)) prs.push(ex + ': ' + exs[ex] + ' kg');
  });

  // Comida
  const dias = {};
  d.comidas.filter(c => inRange(c.fecha, ini, fin)).forEach(c => {
    const x = dias[c.fecha] || (dias[c.fecha] = { kcal: 0, prot: 0 });
    x.kcal += Number(c.kcal) || 0; x.prot += Number(c.prot) || 0;
  });
  const nd = Object.keys(dias).length;
  const kcalProm = nd ? Object.keys(dias).reduce((a, k) => a + dias[k].kcal, 0) / nd : 0;
  const protProm = nd ? Object.keys(dias).reduce((a, k) => a + dias[k].prot, 0) / nd : 0;

  // Peso corporal
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const pw = avg(d.pesos.filter(p => inRange(p.fecha, ini, fin)).map(p => Number(p.peso)));
  const pwPrev = avg(d.pesos.filter(p => inRange(p.fecha, iniPrev, addDays_(ini, -1))).map(p => Number(p.peso)));
  const t = targets_(d.cfg, pw);
  const meta = Number(d.cfg.entrenosSemana) || 3;
  const n = Object.keys(ses).length;

  const veredicto = n >= meta
    ? '🔥 Cumpliste la meta: ' + n + '/' + meta + ' entrenamientos. Así se hace.'
    : (n === 0 ? '💀 Cero entrenamientos. Esta semana se compensa.' : '⚠️ ' + n + '/' + meta + ' entrenamientos. Te faltó, esta semana se ajusta.');
  const fila = (k, v, s) => '<tr><td style="padding:10px 0;color:#8b8b96">' + k + '</td><td style="padding:10px 0;text-align:right;font-weight:700;font-size:18px">' + v +
    (s ? '<div style="font-size:12px;font-weight:400;color:#8b8b96">' + s + '</div>' : '') + '</td></tr>';
  const diff = (a, b, u) => b ? ((a - b >= 0 ? '+' : '') + round_(a - b, 1) + u + ' vs semana anterior') : '';

  const html =
    '<div style="background:#09090b;color:#f5f5f7;font-family:Arial,sans-serif;padding:24px;max-width:520px;margin:auto;border-radius:16px">' +
    '<div style="font-size:30px;font-weight:900;letter-spacing:2px;color:#ff3d00">HIERRO</div>' +
    '<div style="color:#8b8b96;margin-bottom:16px">Reporte semanal · ' + ini + ' al ' + fin + '</div>' +
    '<div style="background:#1c1c21;border-left:4px solid #ff3d00;padding:12px 14px;border-radius:8px;margin-bottom:16px">' + veredicto + '</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    fila('Entrenamientos', n + ' / ' + meta, diff(n, Object.keys(sesPrev).length, '')) +
    fila('Volumen total', Math.round(vol).toLocaleString('es') + ' kg', diff(vol, volPrev, ' kg')) +
    fila('Series', reg.length, '') +
    fila('Calorías promedio', nd ? Math.round(kcalProm) + ' kcal' : 'sin registrar', nd ? 'objetivo ' + t.kcal + ' · ' + nd + ' días registrados' : '') +
    fila('Proteína promedio', nd ? Math.round(protProm) + ' g' : '—', nd ? 'objetivo ' + t.prot + ' g' : '') +
    fila('Peso corporal', pw ? round_(pw, 1) + ' kg' : 'sin registrar', pw && pwPrev ? diff(pw, pwPrev, ' kg') : '') +
    '</table>' +
    (prs.length ? '<div style="margin-top:16px;font-weight:700;color:#c8ff00">🏆 Récords de la semana</div><div>' + prs.join('<br>') + '</div>' : '') +
    '<div style="margin-top:20px;color:#8b8b96;font-style:italic">El hierro no miente.</div></div>';

  return { subject: 'HIERRO · Tu semana: ' + n + '/' + meta + ' entrenos' + (prs.length ? ' · ' + prs.length + ' récords 🏆' : ''), html: html };
}

/** Disparado automáticamente los lunes a la mañana. */
function weeklyReport() {
  const r = buildReport_();
  MailApp.sendEmail({ to: myEmail_(), subject: r.subject, htmlBody: r.html });
}

/** Disparado todos los días a la hora configurada: solo manda mail si hay algo que reclamarte. */
function dailyReminder() {
  const ss = getSS_();
  const d = getData();
  const hoy = today_(ss);
  const msgs = [];
  if (!d.comidas.some(c => c.fecha === hoy)) msgs.push('🍗 No registraste nada de comida hoy. Sin datos no hay progreso.');
  const ult = d.registros.reduce((m, r) => r.fecha > m ? r.fecha : m, '');
  if (ult) {
    const dias = Math.round((new Date(hoy + 'T00:00:00Z') - new Date(ult + 'T00:00:00Z')) / 86400000);
    if (dias >= 3) msgs.push('🏋️ Hace ' + dias + ' días que no entrenás. El hierro te está esperando.');
  }
  if (!d.pesos.some(p => p.fecha >= addDays_(hoy, -6))) msgs.push('⚖️ Hace más de una semana que no te pesás.');
  if (!msgs.length) return;
  MailApp.sendEmail({
    to: myEmail_(), subject: 'HIERRO · ' + msgs.length + ' cosa' + (msgs.length > 1 ? 's' : '') + ' pendiente' + (msgs.length > 1 ? 's' : ''),
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' + msgs.join('<br>') +
      '<br><br><i style="color:#888">Disciplina &gt; motivación.</i></div>'
  });
}
