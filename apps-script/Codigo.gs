/**
 * Seis actividades diarias · recogida de notas
 * Va en una hoja de cálculo de tu cuenta del distrito (@uintah.net).
 * Solo guarda CÓDIGOS de alumno (iniciales + número), nunca nombres.
 *
 * Instalación (una sola vez):
 *  1. Crea una hoja de cálculo nueva en tu Drive del distrito.
 *  2. Extensiones → Apps Script. Borra lo que haya y pega este archivo. Guarda.
 *  3. Elige la función «preparar» y pulsa Ejecutar (acepta los permisos).
 *  4. En la pestaña «Códigos», escribe un código por alumno en la columna A (iniciales y número: JM07, AR12…).
 *  5. Implementar → Nueva implementación → tipo «Aplicación web».
 *     Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *  6. Copia la URL que termina en /exec y pásamela (va en config.js de la web).
 *
 * Pestañas:
 *  - Resultados: cada intento, con nota automática. Columnas «Nota del profe» y «Comentario» para ti.
 *  - Por corregir: textos de escritura que todavía no tienen «Nota del profe».
 *  - Mejor nota: mejor nota, intentos y mejor velocidad lectora (palabras correctas por minuto) por alumno y ejercicio.
 *  - Códigos: lista de códigos válidos.
 */

const HOJA_RESULTADOS = 'Resultados';
const HOJA_CODIGOS = 'Códigos';
const HOJA_RESUMEN = 'Mejor nota';
const HOJA_CORREGIR = 'Por corregir';
const COLUMNAS = ['Fecha', 'Código', 'Actividad', 'Tema', 'Nº', 'Ejercicio', 'Aciertos', 'Total', 'Nota (%)',
  'Detalle por pregunta', 'Palabras por minuto', 'Intentos de lectura', 'Palabras con error', 'Texto escrito', 'Pareja', 'Nota del profe', 'Comentario'];

function preparar() {
  const ss = SpreadsheetApp.getActive();
  const r = ss.getSheetByName(HOJA_RESULTADOS) || ss.insertSheet(HOJA_RESULTADOS);
  r.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold').setBackground('#fff8e1');
  r.setFrozenRows(1);
  r.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  r.setColumnWidth(14, 380);
  r.getRange('N:N').setWrap(true);
  r.getRange('P1:Q1').setBackground('#e3f4e6');

  const c = ss.getSheetByName(HOJA_CODIGOS) || ss.insertSheet(HOJA_CODIGOS);
  c.getRange(1, 1).setValue('Código (iniciales + número, sin nombres)').setFontWeight('bold');
  c.setFrozenRows(1);

  const p = ss.getSheetByName(HOJA_CORREGIR) || ss.insertSheet(HOJA_CORREGIR);
  p.clear();
  p.getRange(1, 1).setFormula(
    "=IFERROR(QUERY(" + HOJA_RESULTADOS + "!A:Q, \"select A, B, F, N, I where N is not null and N <> '' and P is null order by A\", 1), \"No hay textos por corregir\")");
  p.setColumnWidth(4, 480);
  p.getRange('D:D').setWrap(true);

  const m = ss.getSheetByName(HOJA_RESUMEN) || ss.insertSheet(HOJA_RESUMEN);
  m.clear();
  m.getRange(1, 1).setFormula(
    "=IFERROR(QUERY(" + HOJA_RESULTADOS + "!A:K, " +
    "\"select B, C, D, E, F, max(I), count(I), max(K), max(A) where B is not null " +
    "group by B, C, D, E, F order by B, C, D, E " +
    "label max(I) 'Mejor nota (%)', count(I) 'Intentos', max(K) 'Mejor PPM', max(A) 'Último intento'\", 1), \"Aún no hay resultados\")"
  );
  const sheet1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const codigo = limpiaCodigo(d.codigo);
    const ss = SpreadsheetApp.getActive();
    const validos = ss.getSheetByName(HOJA_CODIGOS).getRange('A2:A').getValues()
      .map(x => limpiaCodigo(x[0])).filter(String);
    if (!validos.includes(codigo)) return salida('codigo-desconocido');
    const aciertos = Number(d.aciertos) || 0, total = Number(d.total) || 0;
    ss.getSheetByName(HOJA_RESULTADOS).appendRow([
      new Date(), codigo, texto(d.actividad, 40), texto(d.tema, 60), Number(d.ejercicio) || '',
      texto(d.titulo, 120), aciertos, total, total ? Math.round(aciertos / total * 100) : 0,
      texto(d.detalle, 500), Number(d.ppm) || '', texto(d.intentos, 300), texto(d.errores, 500), texto(d.texto, 5000), texto(d.pareja, 30), '', ''
    ]);
    return salida('ok');
  } catch (err) {
    return salida('error');
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return salida('Seis actividades diarias: lista para recibir notas.'); }

function limpiaCodigo(c) { return String(c || '').trim().toUpperCase().slice(0, 12); }
// Evita que un texto empiece por = + - @ y la hoja lo trate como fórmula.
function texto(v, max) { const s = String(v == null ? '' : v).slice(0, max); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function salida(t) { return ContentService.createTextOutput(t); }
