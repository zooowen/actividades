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
 *  - 📊 Panel: resumen visual (niveles, gráficas y tabla por alumno). Se crea con la función «actualizarPanel»
 *    y después se actualiza solo cada vez que abres la hoja (o con el menú 📊 Panel → Actualizar el panel).
 *  - 🧩 Mapa: nota media de cada alumno en cada actividad, con colores.
 *  - ➗ Panel mates y ➗ Resultados mates: lo mismo, solo con las actividades de matemáticas
 *    (fichas de refuerzo, Reto de multiplicar y Taller de divisiones). El panel general no las incluye.
 *
 * Panel del profesor: abre la URL /exec terminada en ?panel=1 (solo funciona con tu cuenta).
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

// ---------- Panel del profesor ----------
// Ábrelo con la URL /exec añadiendo ?panel=1. Solo funciona si has iniciado sesión con la cuenta dueña de la hoja.
function doGet(e) {
  if (e && e.parameter && e.parameter.panel) {
    if (!esProfe()) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:30px">🔒 Acceso solo para el profesor. Inicia sesión con tu cuenta del distrito.</p>');
    return HtmlService.createHtmlOutput(PANEL_HTML).setTitle('Panel del profesor · Seis actividades').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return salida('Seis actividades diarias: lista para recibir notas.');
}

function esProfe() {
  const yo = Session.getEffectiveUser().getEmail(), quien = Session.getActiveUser().getEmail();
  return !!quien && quien === yo;
}

function datosPanel() {
  if (!esProfe()) throw new Error('Sin permiso');
  const ss = SpreadsheetApp.getActive();
  const r = ss.getSheetByName(HOJA_RESULTADOS);
  const n = r.getLastRow();
  const filas = n > 1 ? r.getRange(2, 1, n - 1, COLUMNAS.length).getValues() : [];
  const codigos = ss.getSheetByName(HOJA_CODIGOS).getRange('A2:A').getValues().map(x => limpiaCodigo(x[0])).filter(String);
  return {
    codigos,
    filas: filas.map((f, i) => ({
      fila: i + 2, fecha: f[0] instanceof Date ? f[0].toISOString() : String(f[0]), codigo: f[1], actividad: f[2], tema: f[3], n: f[4],
      titulo: f[5], aciertos: f[6], total: f[7], nota: f[8], detalle: f[9], ppm: f[10], intentos: f[11], errores: f[12],
      texto: f[13], pareja: f[14], notaProfe: f[15], comentario: f[16]
    }))
  };
}

function guardarEvaluacion(fila, nota, comentario) {
  if (!esProfe()) throw new Error('Sin permiso');
  fila = Number(fila);
  if (fila < 2) throw new Error('Fila no válida');
  SpreadsheetApp.getActive().getSheetByName(HOJA_RESULTADOS).getRange(fila, 16, 1, 2).setValues([[texto(nota, 20), texto(comentario, 500)]]);
  return true;
}

const PANEL_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base target="_top">
<style>
:root{--ink:#1d2433;--mu:#5b6476;--bg:#f6f7fb;--line:#e3e6ee;--ok:#2a9d3f;--bad:#d62828;--mid:#f2b705;--blue:#1d6fd6}
*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:15px}
header{background:var(--blue);color:#fff;padding:14px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
header h1{margin:0;font-size:20px}nav{display:flex;gap:6px;flex-wrap:wrap}
nav button{font:inherit;border:0;border-radius:999px;padding:6px 14px;background:rgba(255,255,255,.2);color:#fff;cursor:pointer}
nav button.on{background:#fff;color:var(--blue);font-weight:700}
main{max-width:1200px;margin:0 auto;padding:16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}.kpi b{display:block;font-size:26px}.kpi small{color:var(--mu)}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f3f5fa;position:sticky;top:0;cursor:pointer;white-space:nowrap}tr:hover td{background:#fafbfd}
.pill{display:inline-block;border-radius:999px;padding:1px 9px;font-weight:700;font-size:13px}
.g{background:#e3f4e6;color:var(--ok)}.y{background:#fff4d6;color:#a26b00}.r{background:#fde8e8;color:var(--bad)}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}select,input,textarea{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px}
.bar{height:16px;border-radius:4px;background:var(--blue)}.barrow{display:grid;grid-template-columns:220px 1fr 50px;gap:8px;align-items:center;margin:4px 0}
.txt{white-space:pre-wrap;background:#fbfcfe;border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0}
button.save{font:inherit;border:0;border-radius:8px;padding:6px 14px;background:var(--ok);color:#fff;cursor:pointer}
.mu{color:var(--mu)}.empty{padding:30px;text-align:center;color:var(--mu)}
</style></head><body>
<header><h1>📊 Panel del profesor · Seis actividades diarias</h1>
<nav><button data-v="resumen" class="on">Resumen</button><button data-v="alumnos">Por alumno</button><button data-v="corregir">Por corregir</button><button data-v="todo">Todos los intentos</button><button id="reload">🔄</button></nav></header>
<main id="m"><p class="empty">Cargando…</p></main>
<script>
let D={codigos:[],filas:[]},V='resumen',SEL='',F={act:'',tema:'',cod:''},SORT={k:'fecha',d:-1};
const $=s=>document.querySelector(s), esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{const d=new Date(s);return isNaN(d)?esc(s):d.toLocaleDateString('es-ES')+' '+d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})};
const pill=n=>n===''||n==null?'':'<span class="pill '+(n>=80?'g':n>=60?'y':'r')+'">'+n+' %</span>';
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):'';
const uniq=a=>[...new Set(a)].filter(x=>x!==''&&x!=null).sort();
function load(){$('#m').innerHTML='<p class="empty">Cargando…</p>';google.script.run.withSuccessHandler(d=>{D=d;render()}).withFailureHandler(e=>$('#m').innerHTML='<p class="empty">Error: '+esc(e.message)+'</p>').datosPanel()}
document.querySelectorAll('nav [data-v]').forEach(b=>b.onclick=()=>{V=b.dataset.v;document.querySelectorAll('nav [data-v]').forEach(x=>x.classList.toggle('on',x===b));render()});
$('#reload').onclick=load;
function render(){({resumen,alumnos,corregir,todo})[V]()}
function resumen(){const f=D.filas;if(!f.length){$('#m').innerHTML='<p class="empty">Todavía no hay resultados.</p>';return}
 const hoy=new Date();hoy.setHours(0,0,0,0);const sem=new Date(hoy-6*864e5);
 const activos=uniq(f.filter(r=>new Date(r.fecha)>=sem).map(r=>r.codigo)).length;
 const pend=f.filter(r=>r.texto&&r.notaProfe==='').length;
 const acts=uniq(f.map(r=>r.actividad));
 let h='<div class="kpis"><div class="kpi"><small>Intentos</small><b>'+f.length+'</b></div><div class="kpi"><small>Nota media</small><b>'+avg(f.map(r=>+r.nota))+' %</b></div><div class="kpi"><small>Alumnos activos (7 días)</small><b>'+activos+' / '+D.codigos.length+'</b></div><div class="kpi"><small>Textos por corregir</small><b>'+pend+'</b></div></div>';
 h+='<div class="card"><h3>Nota media por actividad</h3>'+acts.map(a=>{const v=avg(f.filter(r=>r.actividad===a).map(r=>+r.nota));return '<div class="barrow"><span>'+esc(a)+'</span><div class="bar" style="width:'+v+'%;background:'+(v>=80?'var(--ok)':v>=60?'var(--mid)':'var(--bad)')+'"></div><b>'+v+'%</b></div>'}).join('')+'</div>';
 const por=D.codigos.map(c=>{const x=f.filter(r=>r.codigo===c);const last=x.map(r=>r.fecha).sort().pop();return {c,n:x.length,m:avg(x.map(r=>+r.nota)),last}});
 h+='<div class="card"><h3>Alumnos</h3><table><tr><th>Código</th><th>Intentos</th><th>Nota media</th><th>Último intento</th></tr>'+por.map(p=>'<tr style="cursor:pointer" data-c="'+esc(p.c)+'"><td><b>'+esc(p.c)+'</b></td><td>'+p.n+'</td><td>'+pill(p.m)+'</td><td>'+(p.last?fmt(p.last):'<span class="mu">sin actividad</span>')+'</td></tr>').join('')+'</table></div>';
 $('#m').innerHTML=h;document.querySelectorAll('[data-c]').forEach(t=>t.onclick=()=>{SEL=t.dataset.c;V='alumnos';document.querySelectorAll('nav [data-v]').forEach(x=>x.classList.toggle('on',x.dataset.v==='alumnos'));render()})}
function alumnos(){const cods=uniq(D.codigos.concat(D.filas.map(r=>r.codigo)));SEL=SEL||cods[0]||'';
 let h='<div class="filters"><select id="sel">'+cods.map(c=>'<option'+(c===SEL?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></div>';
 const x=D.filas.filter(r=>r.codigo===SEL);
 if(!x.length){$('#m').innerHTML=h+'<p class="empty">Este alumno todavía no ha hecho actividades.</p>';$('#sel').onchange=e=>{SEL=e.target.value;render()};return}
 const best={};x.forEach(r=>{const k=r.actividad+' · '+r.titulo;if(!best[k]||+r.nota>+best[k].nota)best[k]=Object.assign({},r,{veces:0});best[k].veces=(best[k].veces||0)+1});
 const ppm=x.filter(r=>r.ppm!=='').sort((a,b)=>a.fecha<b.fecha?-1:1);
 h+='<div class="kpis"><div class="kpi"><small>Intentos</small><b>'+x.length+'</b></div><div class="kpi"><small>Nota media</small><b>'+avg(x.map(r=>+r.nota))+' %</b></div><div class="kpi"><small>Ejercicios superados (≥80 %)</small><b>'+Object.values(best).filter(r=>r.nota>=80).length+' / '+Object.keys(best).length+'</b></div><div class="kpi"><small>Mejor velocidad lectora</small><b>'+(ppm.length?Math.max(...ppm.map(r=>+r.ppm))+' pcpm':'—')+'</b></div></div>';
 if(ppm.length)h+='<div class="card"><h3>Velocidad lectora (palabras correctas por minuto)</h3>'+ppm.map(r=>'<div class="barrow"><span>'+fmt(r.fecha)+' · '+esc(r.titulo)+'</span><div class="bar" style="width:'+Math.min(100,r.ppm/2)+'%"></div><b>'+r.ppm+'</b></div>').join('')+'</div>';
 const errs={};x.forEach(r=>String(r.errores||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(w=>errs[w]=(errs[w]||0)+1));
 if(Object.keys(errs).length)h+='<div class="card"><h3>Palabras que lee con error</h3>'+Object.entries(errs).sort((a,b)=>b[1]-a[1]).map(([w,n])=>'<span class="pill r" style="margin:2px">'+esc(w)+(n>1?' ×'+n:'')+'</span>').join(' ')+'</div>';
 h+='<div class="card"><h3>Mejor resultado por ejercicio</h3><table><tr><th>Actividad</th><th>Ejercicio</th><th>Mejor nota</th><th>Intentos</th><th>Nota del profe</th></tr>'+Object.values(best).sort((a,b)=>a.actividad<b.actividad?-1:1).map(r=>'<tr><td>'+esc(r.actividad)+'</td><td>'+esc(r.titulo)+'</td><td>'+pill(+r.nota)+'</td><td>'+r.veces+'</td><td>'+esc(r.notaProfe)+'</td></tr>').join('')+'</table></div>';
 $('#m').innerHTML=h;$('#sel').onchange=e=>{SEL=e.target.value;render()}}
function corregir(){const p=D.filas.filter(r=>r.texto&&r.notaProfe==='').sort((a,b)=>a.fecha<b.fecha?-1:1);
 if(!p.length){$('#m').innerHTML='<p class="empty">✅ No hay textos por corregir.</p>';return}
 $('#m').innerHTML=p.map(r=>'<div class="card" id="c'+r.fila+'"><b>'+esc(r.codigo)+'</b> · '+esc(r.titulo)+' <span class="mu">· '+fmt(r.fecha)+' · calentamiento '+pill(+r.nota)+'</span><div class="txt">'+esc(r.texto)+'</div><span class="mu">'+r.texto.split(/\\s+/).filter(Boolean).length+' palabras</span><div class="filters" style="margin-top:8px"><input placeholder="Nota (p. ej. 8 o 3/4)" size="14" class="n"><input placeholder="Comentario para el alumno" style="flex:1;min-width:220px" class="k"><button class="save" data-f="'+r.fila+'">Guardar</button></div></div>').join('');
 document.querySelectorAll('button.save').forEach(b=>b.onclick=()=>{const c=b.closest('.card'),n=c.querySelector('.n').value.trim(),k=c.querySelector('.k').value.trim();if(!n){c.querySelector('.n').focus();return}b.disabled=true;b.textContent='Guardando…';
  google.script.run.withSuccessHandler(()=>{const r=D.filas.find(x=>x.fila==b.dataset.f);r.notaProfe=n;r.comentario=k;c.style.opacity=.4;b.textContent='✓ Guardado'}).withFailureHandler(e=>{b.disabled=false;b.textContent='Guardar';alert(e.message)}).guardarEvaluacion(+b.dataset.f,n,k)})}
function todo(){let f=D.filas.filter(r=>(!F.act||r.actividad===F.act)&&(!F.tema||r.tema===F.tema)&&(!F.cod||r.codigo===F.cod));
 f=f.slice().sort((a,b)=>{const x=a[SORT.k],y=b[SORT.k];return (x>y?1:x<y?-1:0)*SORT.d});
 const opt=(id,arr,v,l)=>'<select id="'+id+'"><option value="">'+l+'</option>'+arr.map(a=>'<option'+(a===v?' selected':'')+'>'+esc(a)+'</option>').join('')+'</select>';
 const cols=[['fecha','Fecha'],['codigo','Código'],['actividad','Actividad'],['titulo','Ejercicio'],['nota','Nota'],['ppm','PPM'],['notaProfe','Nota profe'],['comentario','Comentario']];
 $('#m').innerHTML='<div class="filters">'+opt('fa',uniq(D.filas.map(r=>r.actividad)),F.act,'Todas las actividades')+opt('ft',uniq(D.filas.filter(r=>!F.act||r.actividad===F.act).map(r=>r.tema)),F.tema,'Todos los temas')+opt('fc',uniq(D.filas.map(r=>r.codigo)),F.cod,'Todos los alumnos')+'<span class="mu">'+f.length+' intentos</span></div><div class="card" style="overflow:auto;max-height:70vh"><table><tr>'+cols.map(([k,l])=>'<th data-k="'+k+'">'+l+(SORT.k===k?(SORT.d>0?' ▲':' ▼'):'')+'</th>').join('')+'</tr>'+f.map(r=>'<tr><td>'+fmt(r.fecha)+'</td><td>'+esc(r.codigo)+'</td><td>'+esc(r.actividad)+'</td><td>'+esc(r.titulo)+'</td><td>'+pill(+r.nota)+'</td><td>'+esc(r.ppm)+'</td><td>'+esc(r.notaProfe)+'</td><td>'+esc(r.comentario)+'</td></tr>').join('')+'</table></div>';
 $('#fa').onchange=e=>{F.act=e.target.value;F.tema='';render()};$('#ft').onchange=e=>{F.tema=e.target.value;render()};$('#fc').onchange=e=>{F.cod=e.target.value;render()};
 document.querySelectorAll('th[data-k]').forEach(t=>t.onclick=()=>{SORT={k:t.dataset.k,d:SORT.k===t.dataset.k?-SORT.d:1};render()})}
load();
</script></body></html>`;

// ---------- Panel visual dentro de la hoja ----------
const HOJA_PANEL = '📊 Panel';
const HOJA_MAPA = '🧩 Mapa';
const HOJA_DATOS = 'Datos del panel';
const HOJA_PANEL_MATES = '➗ Panel mates';
const HOJA_RES_MATES = '➗ Resultados mates';
// Una actividad es de matemáticas si su nombre contiene alguna de estas palabras.
const ES_MATES = /matem|multiplic|divisi/i;
const NIVELES = [
  { n: '⭐ Avanzado', min: 90, fondo: '#cfe5ff', color: '#1d6fd6' },
  { n: '🟢 Conseguido', min: 80, fondo: '#d7f0dc', color: '#2a9d3f' },
  { n: '🟡 En proceso', min: 60, fondo: '#fff1c2', color: '#d99a00' },
  { n: '🔴 Necesita apoyo', min: 0, fondo: '#fbd5d5', color: '#d62828' }
];
const SIN_ACTIVIDAD = { n: '⚪ Sin actividad', fondo: '#eceff4', color: '#b8bfcc' };

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 Panel').addItem('Actualizar el panel', 'actualizarPanel').addToUi();
  try { actualizarPanel(); } catch (e) {}
}

function nivelDe_(nota) {
  if (nota === '' || nota == null) return SIN_ACTIVIDAD;
  for (let i = 0; i < NIVELES.length; i++) if (nota >= NIVELES[i].min) return NIVELES[i];
  return NIVELES[NIVELES.length - 1];
}

function media_(a) { return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : ''; }

// Hace todas las cuentas. «dia» convierte una fecha en texto aaaa-mm-dd.
function calculaPanel_(filas, codigos, ahora, dia) {
  const nuevo = () => ({ intentos: 0, semana: 0, mejor: {}, ppm: '', ultimo: '', porCorregir: 0 });
  const al = {}, orden = [];
  codigos.forEach(c => { if (!al[c]) { al[c] = nuevo(); orden.push(c); } });
  const hace7 = ahora.getTime() - 7 * 864e5, porDia = {}, intentosAct = {};
  let porCorregir = 0;
  filas.forEach(f => {
    const cod = limpiaCodigo(f[1]);
    if (!cod) return;
    if (!al[cod]) { al[cod] = nuevo(); orden.push(cod); }
    const a = al[cod], nota = Number(f[8]) || 0, act = String(f[2] || 'Sin nombre');
    const fecha = f[0] instanceof Date ? f[0] : new Date(f[0]);
    const clave = [f[2], f[3], f[4], f[5]].join('|');
    a.intentos++;
    intentosAct[act] = (intentosAct[act] || 0) + 1;
    if (!a.mejor[clave] || nota > a.mejor[clave].nota) a.mejor[clave] = { nota: nota, act: act };
    if (Number(f[10]) && (a.ppm === '' || Number(f[10]) > a.ppm)) a.ppm = Number(f[10]);
    if (String(f[13] || '') !== '' && String(f[15]) === '') { a.porCorregir++; porCorregir++; }
    if (!isNaN(fecha.getTime())) {
      if (fecha.getTime() >= hace7) a.semana++;
      if (a.ultimo === '' || fecha > a.ultimo) a.ultimo = fecha;
      const k = dia(fecha);
      porDia[k] = (porDia[k] || 0) + 1;
    }
  });
  const acts = Object.keys(intentosAct).sort(), notasAct = {};
  acts.forEach(x => notasAct[x] = []);
  const alumnos = orden.map(c => {
    const a = al[c], mejores = Object.keys(a.mejor).map(k => a.mejor[k]), porAct = {};
    mejores.forEach(m => { (porAct[m.act] = porAct[m.act] || []).push(m.nota); notasAct[m.act].push(m.nota); });
    const mediasAct = {};
    Object.keys(porAct).forEach(x => mediasAct[x] = media_(porAct[x]));
    const nota = media_(mejores.map(m => m.nota));
    return { codigo: c, nota: nota, nivel: nivelDe_(nota), intentos: a.intentos, ejercicios: mejores.length,
      superados: mejores.filter(m => m.nota >= 80).length, semana: a.semana, ppm: a.ppm, ultimo: a.ultimo,
      porCorregir: a.porCorregir, porAct: mediasAct };
  });
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(ahora.getTime() - i * 864e5), k = dia(d);
    dias.push([k.slice(8, 10) + '/' + k.slice(5, 7), porDia[k] || 0]);
  }
  const conNota = alumnos.filter(a => a.nota !== '');
  return {
    alumnos: alumnos, acts: acts, dias: dias,
    actividades: acts.map(x => [x, media_(notasAct[x]), intentosAct[x]]),
    niveles: NIVELES.concat([SIN_ACTIVIDAD]).map(n => [n.n, alumnos.filter(a => a.nivel === n).length]),
    kpis: {
      intentos: filas.length, nota: media_(conNota.map(a => a.nota)),
      activos: alumnos.filter(a => a.semana > 0).length, total: alumnos.length,
      superados: alumnos.reduce((s, a) => s + a.superados, 0), ejercicios: alumnos.reduce((s, a) => s + a.ejercicios, 0),
      porCorregir: porCorregir
    }
  };
}

function hojaLimpia_(ss, nombre) {
  let h = ss.getSheetByName(nombre);
  const nueva = !h;
  if (nueva) h = ss.insertSheet(nombre);
  h.getCharts().forEach(c => h.removeChart(c));
  const f = h.getFilter();
  if (f) f.remove();
  h.clear();
  return { hoja: h, nueva: nueva };
}

function actualizarPanel() {
  const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), ahora = new Date();
  const r = ss.getSheetByName(HOJA_RESULTADOS), n = r ? r.getLastRow() : 0;
  const filas = n > 1 ? r.getRange(2, 1, n - 1, COLUMNAS.length).getValues() : [];
  const hc = ss.getSheetByName(HOJA_CODIGOS);
  const codigos = hc && hc.getLastRow() > 1
    ? hc.getRange(2, 1, hc.getLastRow() - 1, 1).getValues().map(x => limpiaCodigo(x[0])).filter(String) : [];
  const dia = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const esMates = f => ES_MATES.test(String(f[2]));
  const mates = filas.filter(esMates);
  const P = calculaPanel_(filas.filter(f => !esMates(f)), codigos, ahora, dia);
  const M = calculaPanel_(mates, codigos, ahora, dia);

  const D = hojaLimpia_(ss, HOJA_DATOS).hoja;
  datosGraficas_(D, P, 1);
  datosGraficas_(D, M, 11);
  D.hideSheet();

  const pp = hojaLimpia_(ss, HOJA_PANEL), pm = hojaLimpia_(ss, HOJA_PANEL_MATES);
  pintaPanel_(pp.hoja, '📊 Seis actividades diarias · Panel de la clase (español y ciencias)', P, D, 1, ahora, tz);
  pintaPanel_(pm.hoja, '➗ Matemáticas · Panel de la clase', M, D, 11, ahora, tz);
  pintaMapa_(hojaLimpia_(ss, HOJA_MAPA).hoja, P);

  // --- Resultados de matemáticas, del más reciente al más antiguo ---
  const rm = hojaLimpia_(ss, HOJA_RES_MATES), h = rm.hoja;
  const CAB = ['Fecha', 'Código', 'Actividad', 'Nº', 'Ficha o ejercicio', 'Aciertos', 'Total', 'Nota (%)', 'Nivel', 'Detalle'];
  h.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1d6fd6');
  if (mates.length) {
    const orden = mates.slice().sort((a, b) => (b[0] instanceof Date ? b[0].getTime() : 0) - (a[0] instanceof Date ? a[0].getTime() : 0));
    h.getRange(2, 2, orden.length, 1).setNumberFormat('@');
    h.getRange(2, 10, orden.length, 1).setNumberFormat('@');
    h.getRange(2, 1, orden.length, CAB.length).setValues(orden.map(f => [f[0], limpiaCodigo(f[1]), f[2], f[4], f[5], f[6], f[7], f[8], nivelDe_(Number(f[8]) || 0).n, f[9]]));
    h.getRange(2, 1, orden.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    h.getRange(2, 9, orden.length, 1).setBackgrounds(orden.map(f => [nivelDe_(Number(f[8]) || 0).fondo]));
    h.getRange(1, 1, orden.length + 1, CAB.length).createFilter();
  } else {
    h.getRange(2, 1).setValue('Todavía no hay resultados de matemáticas.');
  }
  h.setFrozenRows(1);
  h.setColumnWidth(3, 240);
  h.setColumnWidth(5, 260);
  h.setColumnWidth(9, 150);
  h.setColumnWidth(10, 320);

  if (pp.nueva) { ss.setActiveSheet(pp.hoja); ss.moveActiveSheet(1); }
  if (pm.nueva) { ss.setActiveSheet(pm.hoja); ss.moveActiveSheet(2); }
  if (rm.nueva) { ss.setActiveSheet(h); ss.moveActiveSheet(3); }
  if (pp.nueva) ss.setActiveSheet(pp.hoja);
}

// Datos para las gráficas, en la pestaña oculta. c0 = primera columna que ocupa.
function datosGraficas_(D, P, c0) {
  D.getRange(1, c0, 1, 2).setValues([['Nivel', 'Alumnos']]);
  D.getRange(2, c0, P.niveles.length, 2).setValues(P.niveles);
  D.getRange(1, c0 + 3, 1, 3).setValues([['Actividad', 'Nota media (%)', 'Intentos']]);
  if (P.actividades.length) D.getRange(2, c0 + 3, P.actividades.length, 3).setValues(P.actividades);
  D.getRange(1, c0 + 7, 1, 2).setValues([['Día', 'Intentos']]);
  D.getRange(2, c0 + 7, P.dias.length, 1).setNumberFormat('@');
  D.getRange(2, c0 + 7, P.dias.length, 2).setValues(P.dias);
}

function pintaPanel_(p, titulo, P, D, c0, ahora, tz) {
  const k = P.kpis;
  p.getRange('A1').setValue(titulo).setFontSize(18).setFontWeight('bold');
  p.getRange('A2').setValue('Actualizado el ' + Utilities.formatDate(ahora, tz, 'dd/MM/yyyy') + ' a las ' + Utilities.formatDate(ahora, tz, 'HH:mm') +
    '. Se actualiza solo al abrir la hoja; también con el menú 📊 Panel → Actualizar el panel.').setFontColor('#5b6476');
  p.getRange(4, 1, 1, 5).setValues([['Intentos', 'Nota media de la clase', 'Alumnos activos (7 días)', 'Ejercicios superados (≥ 80 %)', 'Textos por corregir']])
    .setFontColor('#5b6476').setBackground('#f3f5fa').setHorizontalAlignment('center').setWrap(true);
  p.getRange(5, 1, 1, 5).setNumberFormat('@')
    .setValues([[k.intentos, k.nota === '' ? '—' : k.nota + ' %', k.activos + ' de ' + k.total, k.superados + ' de ' + k.ejercicios, k.porCorregir]])
    .setFontSize(22).setFontWeight('bold').setBackground('#f3f5fa').setHorizontalAlignment('center');
  if (k.nota !== '') p.getRange(5, 2).setFontColor(nivelDe_(k.nota).color);
  if (k.porCorregir > 0) p.getRange(5, 5).setFontColor('#d62828');

  const CAB = ['Código', 'Nivel', 'Nota media (%)', 'Progreso', 'Intentos', 'Ejercicios distintos', 'Superados (≥ 80 %)',
    'Intentos esta semana', 'Mejor velocidad lectora', 'Último intento', 'Textos por corregir'];
  const F0 = 7;
  p.getRange(F0, 1, 1, CAB.length).setValues([CAB]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1d6fd6')
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  const A = P.alumnos;
  if (A.length) {
    const barra = a => a.nota === '' ? '' : '█'.repeat(Math.round(a.nota / 10)) + '░'.repeat(10 - Math.round(a.nota / 10));
    p.getRange(F0 + 1, 1, A.length, 1).setNumberFormat('@');
    p.getRange(F0 + 1, 1, A.length, CAB.length).setValues(A.map(a => [a.codigo, a.nivel.n, a.nota, barra(a), a.intentos,
      a.ejercicios, a.superados, a.semana, a.ppm, a.ultimo, a.porCorregir || '']))
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    p.getRange(F0 + 1, 1, A.length, 1).setFontWeight('bold');
    p.getRange(F0 + 1, 2, A.length, 1).setBackgrounds(A.map(a => [a.nivel.fondo])).setFontWeight('bold').setHorizontalAlignment('left');
    p.getRange(F0 + 1, 3, A.length, 1).setFontWeight('bold');
    p.getRange(F0 + 1, 4, A.length, 1).setFontColors(A.map(a => [a.nivel.color])).setHorizontalAlignment('left');
    p.getRange(F0 + 1, 8, A.length, 1).setFontColors(A.map(a => [a.semana ? '#1d2433' : '#d62828']));
    p.getRange(F0 + 1, 10, A.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    p.getRange(F0 + 1, 11, A.length, 1).setFontColor('#d62828').setFontWeight('bold');
    p.getRange(F0, 1, A.length + 1, CAB.length).createFilter();
  } else {
    p.getRange(F0 + 1, 1).setValue('Todavía no hay alumnos ni resultados. Escribe los códigos en la pestaña «Códigos».');
  }
  const fl = F0 + Math.max(A.length, 1) + 2;
  p.getRange(fl, 1).setValue('Niveles (nota media del mejor intento de cada ejercicio)').setFontWeight('bold');
  const ley = NIVELES.map((x, i) => [x.n, (i ? x.min + ' – ' + (NIVELES[i - 1].min - 1) : x.min + ' – 100') + ' %']).concat([[SIN_ACTIVIDAD.n, 'Todavía no ha hecho nada']]);
  p.getRange(fl + 1, 1, ley.length, 2).setValues(ley);
  p.getRange(fl + 1, 1, ley.length, 1).setBackgrounds(NIVELES.concat([SIN_ACTIVIDAD]).map(x => [x.fondo]));
  p.setFrozenRows(0);
  p.setColumnWidths(1, 5, 150);
  p.setColumnWidths(6, 6, 125);
  p.setRowHeight(F0, 42);
  p.setHiddenGridlines(true);

  const grafica = (tipo, rangos, fila, col, titulo, alto, opciones) => {
    let g = p.newChart().setChartType(tipo);
    rangos.forEach(x => { g = g.addRange(x); });
    g = g.setNumHeaders(1).setPosition(fila, col, 0, 0).setOption('title', titulo).setOption('width', 520).setOption('height', alto);
    Object.keys(opciones).forEach(o => { g = g.setOption(o, opciones[o]); });
    p.insertChart(g.build());
  };
  const todos = NIVELES.concat([SIN_ACTIVIDAD]);
  if (A.length) grafica(Charts.ChartType.BAR, [p.getRange(F0, 1, A.length + 1, 1), p.getRange(F0, 3, A.length + 1, 1)], 1, 13,
    'Nota media por alumno (%)', Math.max(320, 60 + A.length * 22), { legend: { position: 'none' }, colors: ['#1d6fd6'], hAxis: { minValue: 0, maxValue: 100 } });
  grafica(Charts.ChartType.PIE, [D.getRange(1, c0, P.niveles.length + 1, 2)], 1, 19, 'Niveles de la clase', 300,
    { pieHole: 0.45, colors: todos.map(x => x.color) });
  if (P.actividades.length) grafica(Charts.ChartType.COLUMN, [D.getRange(1, c0 + 3, P.actividades.length + 1, 2)], 16, 19,
    'Nota media por actividad (%)', 300, { legend: { position: 'none' }, colors: ['#2a9d3f'], vAxis: { minValue: 0, maxValue: 100 } });
  grafica(Charts.ChartType.COLUMN, [D.getRange(1, c0 + 7, P.dias.length + 1, 2)], 31, 19,
    'Intentos por día (últimos 14 días)', 300, { legend: { position: 'none' }, colors: ['#d9730d'], vAxis: { minValue: 0 } });
}

function pintaMapa_(m, P) {
  const A = P.alumnos;
  m.getRange(1, 1, 1, P.acts.length + 1).setValues([['Código'].concat(P.acts)]).setFontWeight('bold').setFontColor('#ffffff')
    .setBackground('#1d6fd6').setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
  if (A.length) {
    m.getRange(2, 1, A.length, 1).setNumberFormat('@').setValues(A.map(a => [a.codigo])).setFontWeight('bold');
    if (P.acts.length) m.getRange(2, 2, A.length, P.acts.length)
      .setValues(A.map(a => P.acts.map(x => x in a.porAct ? a.porAct[x] : '')))
      .setBackgrounds(A.map(a => P.acts.map(x => x in a.porAct ? nivelDe_(a.porAct[x]).fondo : '#ffffff')))
      .setHorizontalAlignment('center');
  }
  m.getRange(A.length + 3, 1).setValue('Cada casilla es la nota media (%) del alumno en esa actividad, con su mejor intento de cada ejercicio. En blanco: todavía no la ha hecho.').setFontColor('#5b6476');
  m.setFrozenRows(1);
  m.setFrozenColumns(1);
  m.setRowHeight(1, 60);
  if (P.acts.length) m.setColumnWidths(2, P.acts.length, 120);

}

function limpiaCodigo(c) { return String(c || '').trim().toUpperCase().slice(0, 12); }
// Evita que un texto empiece por = + - @ y la hoja lo trate como fórmula.
function texto(v, max) { const s = String(v == null ? '' : v).slice(0, max); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function salida(t) { return ContentService.createTextOutput(t); }
