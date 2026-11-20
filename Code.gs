/**
 * Gym Tracker — backend (Google Apps Script)
 * Guarda todo en un Google Sheets con dos hojas:
 *   - Rutina:    tus días de entrenamiento y ejercicios planificados
 *   - Registros: cada serie que hiciste (fecha, ejercicio, peso, reps...)
 */

const SHEET_RUTINA = 'Rutina';
const SHEET_REG = 'Registros';
const H_RUTINA = ['dia', 'ejercicio', 'series', 'reps', 'incremento', 'notas'];
const H_REG = ['sesionId', 'fecha', 'dia', 'ejercicio', 'serie', 'peso', 'reps', 'rpe', 'notas', 'creado'];

/** Punto de entrada de la web app. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gym Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/**
 * Devuelve la planilla. Si el script está vinculado a un Sheets usa ese;
 * si es un proyecto independiente crea uno la primera vez y lo recuerda.
 */
function getSS_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SS_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fue borrada: se crea otra */ }
  }
  const ss = SpreadsheetApp.create('Gym Tracker — Datos');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (name === SHEET_REG) sh.getRange('B:B').setNumberFormat('@'); // fecha como texto
    const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  return sh;
}

function readSheet_(ss, name, headers) {
  const sh = ensureSheet_(ss, name, headers);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = ss.getSpreadsheetTimeZone();
  return sh.getRange(2, 1, n, headers.length).getValues()
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) {
          v = Utilities.formatDate(v, tz, h === 'creado' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
        }
        o[h] = v;
      });
      return o;
    });
}

function writeAll_(ss, name, headers, rows) {
  const sh = ensureSheet_(ss, name, headers);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, headers.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, headers.length)
      .setValues(rows.map(o => headers.map(h => (o[h] === undefined || o[h] === null) ? '' : o[h])));
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ================= API llamada desde la app ================= */

function getData() {
  const ss = getSS_();
  return {
    rutina: readSheet_(ss, SHEET_RUTINA, H_RUTINA),
    registros: readSheet_(ss, SHEET_REG, H_REG),
    sheetUrl: ss.getUrl()
  };
}

/** Reemplaza la rutina completa. rows: [{dia, ejercicio, series, reps, incremento, notas}] */
function saveRutina(rows) {
  return withLock_(() => {
    const ss = getSS_();
    writeAll_(ss, SHEET_RUTINA, H_RUTINA, rows || []);
    return getData();
  });
}

/**
 * Guarda un entrenamiento.
 * sesion: {fecha:'yyyy-MM-dd', dia, notas, sets:[{ejercicio, serie, peso, reps, rpe}]}
 */
function saveSesion(sesion) {
  return withLock_(() => {
    const ss = getSS_();
    const sh = ensureSheet_(ss, SHEET_REG, H_REG);
    const id = sesion.sesionId || Utilities.getUuid();
    const creado = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    const rows = (sesion.sets || []).map(s => [
      id, String(sesion.fecha), sesion.dia || '', s.ejercicio, Number(s.serie) || 1,
      Number(s.peso) || 0, Number(s.reps) || 0, s.rpe === '' || s.rpe == null ? '' : Number(s.rpe),
      sesion.notas || '', creado
    ]);
    if (!rows.length) throw new Error('No hay series para guardar');
    // Si es una edición, borra la versión anterior de la sesión
    if (sesion.sesionId) deleteRows_(ss, id);
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 2, rows.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, rows.length, H_REG.length).setValues(rows);
    return getData();
  });
}

function deleteRows_(ss, sesionId) {
  const all = readSheet_(ss, SHEET_REG, H_REG).filter(r => r.sesionId !== sesionId);
  writeAll_(ss, SHEET_REG, H_REG, all);
}

function deleteSesion(sesionId) {
  return withLock_(() => {
    const ss = getSS_();
    deleteRows_(ss, sesionId);
    return getData();
  });
}
