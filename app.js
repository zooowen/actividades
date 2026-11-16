// Seis actividades diarias · 5.º DLI
// Rutas:
//   (nada)            → panel de las seis actividades
//   ?p=palabras       → Trabajo con palabras (temas de gramática)
//   ?t=tema[&q=n]     → tema de gramática / ejercicio n
//   ?a=actividad[&i=n]→ actividad diaria / lectura n
// Si config.js tiene resultsUrl, envía código del alumno + nota a la hoja del profe (Apps Script).
// Si no, es solo práctica: recuerda en este navegador qué ejercicios se han superado.
(function () {
  const app = document.getElementById('app');
  const P = new URLSearchParams(location.search);
  const T = P.get('t'), Q = P.get('q'), ACT = P.get('a'), I = P.get('i');
  const CFG = window.TCP_CONFIG || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('tcp:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('tcp:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const ses = { get(k) { try { return sessionStorage.getItem('tcp:' + k) || ''; } catch (e) { return ''; } }, set(k, v) { try { sessionStorage.setItem('tcp:' + k, v); } catch (e) {} } };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).trim().toLowerCase().replace(/[.!?¡¿,;:"«»]/g, '').replace(/\s+/g, ' ');
  const words = s => (String(s).replace(/<[^>]+>/g, ' ').match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) || []).length;
  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const markDone = (key, n) => { const s = new Set(store.get('done:' + key) || []); s.add(n); store.set('done:' + key, [...s]); };

  const ACTIVIDADES = [
    { slug: 'leo-solo', titulo: 'Leo solo', ico: '📖', color: '#1d6fd6', sub: 'Lecturas con preguntas' },
    { slug: 'leo-con-alguien', titulo: 'Leo con alguien', ico: '👫', color: '#2a9d3f', sub: 'Lecturas en pareja' },
    { slug: 'trabajo-con-escritura', titulo: 'Trabajo con escritura', ico: '✍️', color: '#d62828', sub: 'Escribe y tu profe lo corrige' },
    { slug: 'escucho-la-lectura', titulo: 'Escucho la lectura', ico: '🎧', color: '#7a35b8', sub: 'Audios con preguntas' },
    { slug: 'leo-rapido', titulo: 'Leo rápido', ico: '⏱️', color: '#f77f00', sub: 'Lectura cronometrada' },
    { slug: 'palabras', titulo: 'Trabajo con palabras', ico: '🔤', color: '#0b8577', sub: 'Gramática y ortografía', href: '?p=palabras' }
  ];
  const LEVELS = { A1: 'A1 · Novice', A2: 'A2 · Intermediate Low', B1: 'B1 · Intermediate Mid–High', B2: 'B2 · Advanced', C1: 'C1', C2: 'C2' };
  const HOME = '<a class="back" href="./">← Volver a Seis actividades diarias</a>';

  const fail = () => { app.innerHTML = HOME + '<p>Esta actividad todavía no está lista. ¡Pronto!</p>'; };
  if (ACT) getJSON('data/act/' + encodeURIComponent(ACT) + '.json').then(d => I ? actItem(d, +I) : actList(d)).catch(fail);
  else if (T) getJSON('data/' + encodeURIComponent(T) + '.json').then(d => Q ? gramQuiz(d, +Q) : gramTopic(d)).catch(fail);
  else if (P.get('p') === 'palabras') palabras();
  else home();

  /* ---------- panel principal ---------- */
  function home() {
    document.title = 'Seis actividades diarias';
    app.innerHTML = `
      <div class="banner" style="background:#1d6fd6"><h1>🗓️ Seis actividades diarias</h1>
      <p>Cada día elegimos una actividad para practicar español a nuestro ritmo. Pulsa una tarjeta.</p></div>
      <div class="grid big">${ACTIVIDADES.map(a => `<a class="card" style="--c:${a.color}" href="${a.href || '?a=' + a.slug}"><span class="ico">${a.ico}</span><strong>${a.titulo}</strong><small>${a.sub}</small></a>`).join('')}</div>`;
  }

  /* ---------- Trabajo con palabras ---------- */
  function palabras() {
    document.title = 'Trabajo con palabras';
    getJSON('data/temas.json').then(list => Promise.all(list.map(t =>
      fetch('data/' + t.slug + '.json', { method: 'HEAD' }).then(r => (t.ready = r.ok, t)).catch(() => t)
    ))).then(list => {
      app.innerHTML = `${HOME}
        <div class="banner" style="background:#0b8577"><h1>🔤 Trabajo con palabras</h1>
        <p>Elige un tema, lee las reglas y practica. Cada ejercicio se corrige solo y puedes repetirlo las veces que quieras.</p></div>
        <div class="grid">${list.map(t => {
          const n = (store.get('done:' + t.slug) || []).length;
          return t.ready
            ? `<a class="card" style="--c:${t.color}" href="?t=${t.slug}"><span class="ico">${t.ico}</span><strong>${esc(t.tema)}</strong>${n ? `<span class="badge done">✓ ${n} superados</span>` : ''}</a>`
            : `<div class="card soon" style="--c:${t.color}"><span class="ico">${t.ico}</span><strong>${esc(t.tema)}</strong><span class="badge">Próximamente</span></div>`;
        }).join('')}</div>`;
    });
  }

  function gramTopic(d) {
    document.title = d.tema;
    const done = store.get('done:' + T) || [];
    let i = 0;
    const groups = d.grupos.map(([h, sub, count]) => {
      const cards = d.quizzes.slice(i, i + count).map((q, k) => {
        const n = i + k + 1;
        return `<a class="card" style="--c:${d.color}" href="?t=${T}&q=${n}"><small>Ejercicio ${n}</small><strong>${q[0].replace(/^.*?·\s*/, '')}</strong><small>${q[1]}</small>${q[3] ? `<span class="badge lvl">${LEVELS[q[3]] || q[3]}</span>` : ''}${done.includes(n) ? '<span class="badge done">✓ Superado</span>' : ''}</a>`;
      }).join('');
      i += count;
      return `<h2 class="group">${h}</h2><p class="sub">${sub}</p><div class="grid">${cards}</div>`;
    }).join('');
    app.innerHTML = `
      <a class="back" href="?p=palabras">← Volver a Trabajo con palabras</a>
      <div class="banner" style="background:${d.color}"><h1>${d.ico} ${d.tema}</h1><p>${d.intro}</p></div>
      <div class="rules"><h2>📌 Las reglas</h2><div class="rules-grid">${d.reglas.map(([e, t, h]) => `<div class="rule"><b>${e} ${t}</b>${h}</div>`).join('')}</div></div>
      ${groups}`;
  }

  function gramQuiz(d, n) {
    const q = d.quizzes[n - 1];
    if (!q) { location.search = '?t=' + T; return; }
    document.title = q[0];
    const next = n < d.quizzes.length ? `?t=${T}&q=${n + 1}` : null;
    app.innerHTML = `
      <a class="back" href="?t=${T}">← Volver a ${d.tema}</a>
      <div class="banner" style="background:${d.color}"><h1>${d.ico} ${q[0]}</h1><p>${q[1]}</p></div>
      <form class="player" style="--c:${d.color}" autocomplete="off">${codeBox()}${questionsHTML(q[2])}${actionsHTML()}</form>`;
    wire(app.querySelector('form'), q[2], {
      actividad: 'Trabajo con palabras', tema: d.tema, ejercicio: n, titulo: q[0],
      key: T, n, repeat: `?t=${T}&q=${n}`, next, back: `?t=${T}`
    });
  }

  /* ---------- actividades diarias ---------- */
  function actList(d) {
    document.title = d.titulo;
    const done = store.get('done:' + d.slug) || [];
    app.innerHTML = `${HOME}
      <div class="banner" style="background:${d.color}"><h1>${d.ico} ${d.titulo}</h1><p>${d.intro}</p></div>
      <div class="rules"><h2>📌 Cómo se hace</h2><div class="rules-grid">${d.pasos.map(([n, t]) => `<div class="rule"><b>${n}</b>${t}</div>`).join('')}</div></div>
      ${groupByLevel(d.items).map(([nivel, list]) => `<h2 class="group">${nivel} <small class="sub">· ${list.length} ${list.length === 1 ? 'actividad' : 'actividades'}</small></h2>
      <div class="grid">${list.map(([it, k]) => `<a class="card" style="--c:${d.color}" href="?a=${d.slug}&i=${k + 1}"><small>${k + 1}</small><strong>${it.titulo}</strong>${done.includes(k + 1) ? '<span class="badge done">✓ Hecho</span>' : ''}</a>`).join('')}</div>`).join('')}`;
  }

  function groupByLevel(items) {
    const g = [];
    items.forEach((it, k) => { let last = g[g.length - 1]; if (!last || last[0] !== it.nivel) g.push(last = [it.nivel, []]); last[1].push([it, k]); });
    return g;
  }

  function actItem(d, n) {
    const it = d.items[n - 1];
    if (!it) { location.search = '?a=' + d.slug; return; }
    document.title = it.titulo;
    const qs = it.preguntas, modo = d.modo;
    const textHTML = `<div class="texto">${(it.texto || []).map(p => `<p>${p}</p>`).join('')}</div>`;
    let top = '';
    if (modo === 'lectura' || modo === 'pareja') top = `<h2 class="group">📄 La lectura</h2>${textHTML}`;
    if (modo === 'ficha' && it.texto && it.texto.length) top = textHTML;
    if (modo === 'escritura') top = `<h2 class="group">📄 El modelo</h2>${textHTML}`;
    if (modo === 'audio') top = `<div class="audio">
        <button type="button" class="btn" data-play="1">▶️ Escuchar</button>
        <button type="button" class="btn alt" data-play="0.75">🐢 Más despacio</button>
        <button type="button" class="btn alt" data-stop>⏹️ Parar</button>
        <small class="voice-note"></small></div>
        <div class="texto hidden-text">${it.texto.map(p => `<p>${p}</p>`).join('')}</div>`;
    if (modo === 'cronometro') top = `<div class="lr">
        <div class="timer"><span class="intento">Intento 1 de 3</span>
          <button type="button" class="btn" data-start>▶️ Empezar</button>
          <span class="clock">0:00</span>
          <button type="button" class="btn alt" data-end hidden>🏁 He terminado</button>
          <span class="rec" hidden>🔴 Grabando</span></div>
        <div class="texto hidden-text big lr-text">${it.texto.map(p => `<p>${wrapWords(p)}</p>`).join('')}</div>
        <div class="review" hidden>
          <h3>🎧 Revisa tu lectura</h3>
          <p class="rv-audio"></p>
          <div class="asr-msg" hidden></div>
          <p>Escucha tu grabación y <b>pulsa en el texto las palabras que has leído mal</b> (saltadas, cambiadas o mal pronunciadas). Si te equivocas, vuelve a pulsarla.</p>
          <button type="button" class="btn" data-save>✔️ Guardar este intento</button> <span class="nerr">0 errores</span>
        </div>
        <table class="attempts" hidden><thead><tr><th>Intento</th><th>Tiempo</th><th>Palabras/min</th><th>Errores</th><th>Correctas/min</th></tr></thead><tbody></tbody></table>
        <div class="again" hidden><button type="button" class="btn alt" data-again>🔁 Otro intento</button></div>
        <div class="practice" hidden><h3>🗣️ Palabras para practicar</h3><p class="sub">Pulsa 🔊 para escucharlas y repítelas en voz alta.</p><div class="chips pw"></div></div>
      </div>`;
    const w = it.escribir;
    const writeHTML = w ? `<h2 class="group">✍️ Ahora escribe tú</h2>
        <div class="write"><p><b>${w.consigna}</b></p>
        <div class="chips">${w.ayuda.map(a => `<button type="button" class="chip">${esc(a)}</button>`).join('')}</div>
        <textarea name="texto" rows="10" spellcheck="true" lang="es" placeholder="Escribe aquí tu texto…"></textarea>
        <div class="wc"><span class="count">0 palabras</span> · mínimo ${w.min}</div>
        <details class="checklist" open><summary>✅ Lista de comprobación</summary><ul>${w.lista.map(l => `<li><label><input type="checkbox"> ${l}</label></li>`).join('')}</ul></details></div>` : '';
    const qTitle = modo === 'escritura' ? '🔥 Calentamiento' : '❓ Las preguntas';
    app.innerHTML = `
      <a class="back" href="?a=${d.slug}">← Volver a ${d.titulo}</a>
      <div class="banner" style="background:${d.color}"><h1>${d.ico} ${it.titulo}</h1><p>${it.nivel} · ${d.titulo}</p></div>
      <form class="player" style="--c:${d.color}" autocomplete="off">
        ${codeBox(modo === 'pareja')}
        ${top}
        <div class="qwrap"${modo === 'cronometro' ? ' hidden' : ''}><h2 class="group">${qTitle}</h2>${questionsHTML(qs)}</div>
        ${writeHTML}
        ${actionsHTML(w ? '📨 Comprobar y enviar' : '✅ Comprobar')}
      </form>`;
    const form = app.querySelector('form');
    const ctx = {
      actividad: d.titulo, tema: d.titulo, ejercicio: n, titulo: it.titulo, key: d.slug, n,
      repeat: `?a=${d.slug}&i=${n}`, next: n < d.items.length ? `?a=${d.slug}&i=${n + 1}` : null, back: `?a=${d.slug}`
    };
    if (modo === 'audio') wireAudio(form, it);
    if (modo === 'cronometro') wireTimer(form, it, ctx);
    if (w) wireWriting(form, w, ctx);
    wire(form, qs, ctx);
  }

  function wireAudio(form, it) {
    const note = form.querySelector('.voice-note');
    const synth = window.speechSynthesis;
    if (!synth) { note.textContent = 'Este navegador no puede leer en voz alta. Prueba con Chrome.'; return; }
    const pick = () => {
      const vs = synth.getVoices().filter(v => /^es/i.test(v.lang));
      return vs.find(v => /es-ES/i.test(v.lang) && /google|natural|neural/i.test(v.name)) || vs.find(v => /es-ES/i.test(v.lang)) || vs[0];
    };
    const plain = it.texto.map(p => p.replace(/<[^>]+>/g, ' ')).join('\n');
    form.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(plain);
      const v = pick(); if (v) u.voice = v; u.lang = v ? v.lang : 'es-ES';
      u.rate = +b.dataset.play * 0.95;
      synth.speak(u);
      note.textContent = v ? '' : 'No encuentro una voz en español en este ordenador.';
    }));
    form.querySelector('[data-stop]').addEventListener('click', () => synth.cancel());
    window.addEventListener('pagehide', () => synth.cancel());
  }

  // Compara las palabras del texto con lo que ha entendido el reconocimiento de voz.
  // Devuelve los índices de las palabras del texto que no se han leído (saltadas o cambiadas).
  function compareReading(textWords, heardText) {
    const nz = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zñ0-9]/g, '');
    const T = textWords.map(nz), H = (heardText.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) || []).map(nz).filter(Boolean);
    if (H.length < T.length * 0.3) return { ok: false, wrong: [] };
    const n = T.length, m = H.length;
    const D = Array.from({ length: n + 1 }, (_, i) => { const r = new Array(m + 1).fill(0); r[0] = i; return r; });
    for (let j = 0; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (T[i - 1] === H[j - 1] ? 0 : 1));
    const wrong = []; let i = n, j = m;
    while (i > 0) {
      if (j > 0 && D[i][j] === D[i - 1][j - 1] + (T[i - 1] === H[j - 1] ? 0 : 1)) { if (T[i - 1] !== H[j - 1]) wrong.push(i - 1); i--; j--; }
      else if (D[i][j] === D[i - 1][j] + 1) { wrong.push(i - 1); i--; }
      else j--;
    }
    // Si el alumno paró antes de terminar, las palabras finales no leídas no cuentan como error.
    let last = n - 1; const set = new Set(wrong);
    while (last >= 0 && set.has(last)) { set.delete(last); last--; }
    return { ok: true, wrong: [...set].sort((a, b) => a - b) };
  }
  window.__compareReading = compareReading;

  function wrapWords(p) {
    return p.replace(/<[^>]+>|([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)/g, (m, w) => w ? `<span class="w">${w}</span>` : m);
  }

  function speak(text, rate = 0.85) {
    const synth = window.speechSynthesis; if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = synth.getVoices().filter(v => /^es/i.test(v.lang));
    const v = vs.find(v => /es-ES/i.test(v.lang) && /google|natural|neural/i.test(v.name)) || vs.find(v => /es-ES/i.test(v.lang)) || vs[0];
    if (v) u.voice = v; u.lang = v ? v.lang : 'es-ES'; u.rate = rate;
    synth.speak(u);
  }

  // Leo rápido: hasta 3 intentos, grabación local (no se sube) y marcado de errores.
  function wireTimer(form, it, ctx) {
    const $ = q => form.querySelector(q);
    const clock = $('.clock'), txt = $('.lr-text'), start = $('[data-start]'), end = $('[data-end]'), rec = $('.rec');
    const review = $('.review'), table = $('.attempts'), again = $('.again'), nerr = $('.nerr');
    const total = words(it.texto.join(' '));
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
    const tries = []; const errWords = new Map();
    let t0 = 0, iv = null, secs = 0, recorder = null, chunks = [], stream = null, marking = false;
    ctx.lr = { tries, errWords };

    async function startRec() {
      try {
        if (!navigator.mediaDevices || !window.MediaRecorder) return;
        stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = []; recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
        recorder.start(); rec.hidden = false;
      } catch (e) { recorder = null; }
    }
    const stopRec = () => new Promise(res => {
      rec.hidden = true;
      if (!recorder || recorder.state === 'inactive') return res(null);
      recorder.onstop = () => res(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })));
      recorder.stop();
    });

    // Reconocimiento de voz: 'local' (en el propio ordenador, si Chrome lo permite), 'nube' (Google) o 'no'.
    const MODO = CFG.reconocimiento || 'local';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let asr = null, heard = [], listening = false, asrMode = '';
    async function asrAvailable() {
      if (!SR || MODO === 'no') return '';
      if (typeof SR.available === 'function') {
        try {
          const st = await SR.available({ langs: ['es-ES'], processLocally: true });
          if (st === 'available') return 'local';
          if ((st === 'downloadable' || st === 'downloading') && typeof SR.install === 'function') {
            try { if (await SR.install({ langs: ['es-ES'], processLocally: true })) return 'local'; } catch (e) {}
          }
        } catch (e) {}
      }
      return MODO === 'nube' ? 'nube' : '';
    }
    async function startASR() {
      heard = []; asrMode = await asrAvailable();
      if (!asrMode) return;
      try {
        asr = new SR(); asr.lang = 'es-ES'; asr.continuous = true; asr.interimResults = false; asr.maxAlternatives = 1;
        if (asrMode === 'local') asr.processLocally = true;
        asr.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard.push(e.results[i][0].transcript); };
        asr.onerror = () => {};
        asr.onend = () => { if (listening) { try { asr.start(); } catch (e) {} } };
        listening = true; asr.start();
      } catch (e) { asr = null; asrMode = ''; }
    }
    const stopASR = () => new Promise(res => {
      if (!asr) return res(null);
      listening = false;
      const done = () => res(heard.join(' '));
      asr.onend = done; setTimeout(done, 1500);
      try { asr.stop(); } catch (e) { done(); }
    });

    start.addEventListener('click', async () => {
      start.disabled = true;
      await startRec();
      await startASR();
      txt.classList.remove('hidden-text'); txt.querySelectorAll('.w.err').forEach(w => w.classList.remove('err'));
      start.hidden = true; start.disabled = false; end.hidden = false; again.hidden = true;
      t0 = Date.now();
      iv = setInterval(() => { clock.textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }, 250);
    });

    end.addEventListener('click', async () => {
      clearInterval(iv);
      secs = Math.max(1, (Date.now() - t0) / 1000); clock.textContent = fmt(secs);
      end.hidden = true;
      const [url, oido] = await Promise.all([stopRec(), stopASR()]);
      $('.rv-audio').innerHTML = url ? `<audio controls src="${url}"></audio>` : '<small>No se ha podido grabar (falta permiso para el micrófono). Puedes marcar los errores con ayuda de tu profe o de un compañero.</small>';
      const spans = [...txt.querySelectorAll('.w')];
      let msg = '';
      if (oido !== null && oido !== undefined) {
        const r = compareReading(spans.map(w => w.textContent), oido);
        if (r.ok) {
          r.wrong.forEach(i => spans[i].classList.add('err'));
          const list = [...new Set(r.wrong.map(i => spans[i].textContent.toLowerCase()))];
          msg = list.length
            ? `🤖 <b>He oído ${list.length === 1 ? 'una palabra que no has leído bien' : list.length + ' palabras que no has leído bien'}:</b> ${list.map(w => `<button type="button" class="chip" data-say="${esc(w)}">🔊 ${esc(w)}</button>`).join(' ')}<br><small>Están en rojo en el texto. Escucha tu grabación: si me he equivocado, pulsa la palabra para quitarla; si falta alguna, pulsa para añadirla.</small>`
            : '🤖 <b>¡No he oído ningún error!</b> <small>Escucha tu grabación por si se me ha escapado algo.</small>';
        } else msg = '🤖 <small>No he podido entender bien la grabación (¿había ruido o leíste muy bajito?). Marca tú los errores.</small>';
      } else if (MODO !== 'no') msg = '<small>El reconocimiento automático no está disponible en este ordenador. Marca tú los errores escuchando la grabación.</small>';
      $('.asr-msg').innerHTML = msg; $('.asr-msg').hidden = !msg;
      review.hidden = false; marking = true; txt.classList.add('marking');
      const n0 = txt.querySelectorAll('.w.err').length; nerr.textContent = n0 + (n0 === 1 ? ' error' : ' errores');
      review.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    txt.addEventListener('click', e => {
      const w = e.target.closest('.w'); if (!w || !marking) return;
      w.classList.toggle('err');
      const n = txt.querySelectorAll('.w.err').length; nerr.textContent = n + (n === 1 ? ' error' : ' errores');
    });

    $('[data-save]').addEventListener('click', () => {
      const errs = [...txt.querySelectorAll('.w.err')].map(w => w.textContent);
      marking = false; txt.classList.remove('marking'); review.hidden = true;
      const ppm = Math.round(total / (secs / 60)), pcpm = Math.round(Math.max(0, total - errs.length) / (secs / 60));
      tries.push({ secs: Math.round(secs), ppm, errores: errs.length, pcpm });
      errs.forEach(w => errWords.set(w.toLowerCase(), (errWords.get(w.toLowerCase()) || 0) + 1));
      const best = tries.reduce((b, t, i) => t.pcpm > tries[b].pcpm ? i : b, 0);
      ctx.ppm = tries[best].pcpm;
      table.hidden = false;
      table.querySelector('tbody').innerHTML = tries.map((t, i) => `<tr class="${i === best ? 'best' : ''}"><td>${i === best ? '🏆 ' : ''}${i + 1}</td><td>${fmt(t.secs)}</td><td>${t.ppm}</td><td>${t.errores}</td><td><b>${t.pcpm}</b></td></tr>`).join('');
      const prev = store.get('ppm:' + ctx.titulo);
      if (!prev || ctx.ppm > prev) store.set('ppm:' + ctx.titulo, ctx.ppm);
      if (errWords.size) {
        $('.practice').hidden = false;
        $('.pw').innerHTML = [...errWords.keys()].map(w => `<button type="button" class="chip" data-say="${esc(w)}">🔊 ${esc(w)}</button>`).join('');
      }
      if (tries.length < 3) {
        again.hidden = false;
        $('[data-again]').textContent = `🔁 Intento ${tries.length + 1} de 3`;
      }
      $('.intento').textContent = tries.length < 3 ? `Intento ${tries.length + 1} de 3` : '✅ 3 intentos hechos';
      clock.textContent = '0:00';
      $('.qwrap').hidden = false;
    });

    $('[data-again]').addEventListener('click', () => {
      again.hidden = true; start.hidden = false; txt.classList.add('hidden-text');
      form.querySelector('.timer').scrollIntoView({ behavior: 'smooth' });
    });
    $('.pw').addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say, 0.7); });
    $('.asr-msg').addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say, 0.7); });
    window.addEventListener('pagehide', () => { if (stream) stream.getTracks().forEach(t => t.stop()); });
  }

  function wireWriting(form, w, ctx) {
    const ta = form.querySelector('textarea'), count = form.querySelector('.count');
    const upd = () => { const n = words(ta.value); count.textContent = n + (n === 1 ? ' palabra' : ' palabras'); count.classList.toggle('okc', n >= w.min); };
    ta.addEventListener('input', upd);
    form.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      const s = ta.selectionStart || ta.value.length, add = c.textContent;
      const pre = ta.value.slice(0, s), sp = pre && !/\s$/.test(pre) ? ' ' : '';
      ta.value = pre + sp + add + ' ' + ta.value.slice(s); ta.focus(); upd();
    }));
    ctx.writing = { ta, min: w.min };
  }

  /* ---------- preguntas comunes ---------- */
  function codeBox(pair) {
    if (!CFG.resultsUrl) return '';
    return `<div class="who"><label>🪪 Tu código: <input class="txt code" name="codigo" required maxlength="12" value="${esc(ses.get('codigo'))}" placeholder="Ej.: JM07"></label>
      ${pair ? '<label>👫 Código de tu pareja: <input class="txt code" name="codigo2" maxlength="12" placeholder="Ej.: AR12"></label>' : ''}
      <small>Tu profe verá tu nota con este código.</small></div>`;
  }
  const questionsHTML = qs => qs.map((x, k) => `<div class="q" data-k="${k}"><span class="num">${k + 1}.</span>${x[1]}${widget(x, k)}<div class="fb"></div></div>`).join('');
  const actionsHTML = (label = '✅ Comprobar') => `<div class="actions"><button class="btn" type="submit">${label}</button><span class="score"></span></div>`;

  function wire(form, qs, ctx) {
    form.addEventListener('click', e => {
      const say = e.target.closest('.dict [data-say]');
      if (say) { e.preventDefault(); speak(say.dataset.say, +(say.dataset.rate || 0.85)); return; }
      const tile = e.target.closest('.order .tile');
      if (tile && !form.classList.contains('checked')) {
        e.preventDefault(); const box = tile.closest('.order');
        (tile.parentElement.classList.contains('tiles') ? box.querySelector('.built') : box.querySelector('.tiles')).appendChild(tile); return;
      }
      const wsCell = e.target.closest('.ws span');
      if (wsCell && !form.classList.contains('checked')) { e.preventDefault(); wsClick(wsCell); return; }
      const rs = e.target.closest('.order [data-reset]');
      if (rs && !form.classList.contains('checked')) { e.preventDefault(); const box = rs.closest('.order'); box.querySelectorAll('.built .tile').forEach(t => box.querySelector('.tiles').appendChild(t)); return; }
      const b = e.target.closest('.opt'); if (!b || form.classList.contains('checked')) return;
      e.preventDefault();
      const box = b.parentElement;
      if (box.dataset.multi) b.classList.toggle('sel');
      else { box.querySelectorAll('.opt').forEach(o => o.classList.remove('sel')); b.classList.add('sel'); }
    });
    form.addEventListener('input', e => {
      const inp = e.target.closest('.cw input'); if (!inp || !inp.value) return;
      inp.value = inp.value.toUpperCase();
      const all = [...inp.closest('.cw').querySelectorAll('input')], i = all.indexOf(inp);
      if (all[i + 1]) all[i + 1].focus();
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (form.classList.contains('checked')) return;
      const actions = form.querySelector('.actions');
      const warn = t => { actions.querySelector('.score').textContent = t; };
      const qwrap = form.querySelector('.qwrap');
      if (qwrap && qwrap.hidden) return warn('⏱️ Primero lee el texto y guarda al menos un intento.');
      const codes = [...new Set([...form.querySelectorAll('input.code')].map(c => c.value.trim().toUpperCase()).filter(Boolean))];
      const main = form.querySelector('input[name=codigo]');
      if (main && !main.value.trim()) { main.focus(); return warn('🪪 Escribe tu código.'); }
      let texto = '';
      if (ctx.writing) {
        texto = ctx.writing.ta.value.trim();
        if (words(texto) < ctx.writing.min) { ctx.writing.ta.focus(); return warn(`✍️ Tu texto necesita al menos ${ctx.writing.min} palabras. ¡Sigue escribiendo!`); }
      }
      if (main) { ses.set('codigo', codes[0]); form.querySelectorAll('input.code').forEach(c => c.disabled = true); }
      if (ctx.writing) ctx.writing.ta.readOnly = true;
      let ok = 0; const detalle = [];
      form.querySelectorAll('.q').forEach(el => {
        const k = +el.dataset.k, r = grade(qs[k], el); if (r) ok++; el.classList.add('done');
        const inp = el.querySelector('input.txt'); detalle.push((k + 1) + (r ? '✓' : '✗') + (inp && !r ? '(' + inp.value.trim() + ')' : ''));
      });
      form.classList.add('checked');
      form.querySelectorAll('[data-again],[data-start]').forEach(b => b.disabled = true);
      form.querySelectorAll('.hidden-text').forEach(t => t.classList.remove('hidden-text'));
      if (window.speechSynthesis) speechSynthesis.cancel();
      const need = Math.ceil(qs.length * 0.8), pass = ok >= need;
      if (pass) markDone(ctx.key, ctx.n);
      let sent = '';
      if (CFG.resultsUrl && codes.length) {
        sent = '<small class="sent">📨 Enviando…</small>';
        const msgs = [];
        const show = () => { const s = form.querySelector('.sent'); if (s) s.textContent = msgs.join(' '); };
        codes.forEach(codigo => {
          const body = JSON.stringify({ codigo, actividad: ctx.actividad, tema: ctx.tema, ejercicio: ctx.ejercicio, titulo: ctx.titulo,
            aciertos: ok, total: qs.length, detalle: detalle.join(' '), ppm: ctx.ppm || '', texto,
            intentos: ctx.lr ? ctx.lr.tries.map((t, i) => `${i + 1}) ${Math.floor(t.secs / 60)}:${String(t.secs % 60).padStart(2, '0')} · ${t.ppm} ppm · ${t.errores} err · ${t.pcpm} pcpm`).join(' | ') : '',
            errores: ctx.lr ? [...ctx.lr.errWords.keys()].join(', ') : '', pareja: codes.length > 1 ? codes.filter(c => c !== codigo).join(',') : '' });
          fetch(CFG.resultsUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body })
            .then(r => r.text())
            .then(t => { msgs.push(t === 'ok' ? `📨 Enviado (código ${codigo}).` : t === 'codigo-desconocido' ? `⚠️ El código ${codigo} no existe: revisa y repite.` : `⚠️ No se pudo guardar (${codigo}). Avisa a tu profe.`); show(); })
            .catch(() => { msgs.push(`⚠️ No se pudo enviar (${codigo}). Avisa a tu profe.`); show(); });
        });
      }
      const nextBtn = ctx.next ? `<a class="btn" href="${ctx.next}">Siguiente ➡️</a>` : `<a class="btn" href="${ctx.back}">🏁 Terminar</a>`;
      const extra = ctx.writing ? ' Tu texto ha llegado a tu profe.' : '';
      actions.innerHTML =
        `<span class="score">${pass ? '🎉' : '💪'} ${ok} de ${qs.length} ${pass ? '· ¡Superado!' : `· Necesitas ${need} para superarlo. ¡Inténtalo otra vez!`}${CFG.resultsUrl ? extra : ''}</span>
         <a class="btn alt" href="${ctx.repeat}">🔁 Repetir</a>${pass ? nextBtn : ''}${sent}`;
      actions.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ---------- Sopa de letras y crucigrama ----------
  const plainUp = w => String(w).toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'Ñ').replace(/[^A-ZÑ]/g, '');
  function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
  function wordSearchHTML(list, opt) {
    const words = list.map(plainUp), rnd = seeded(words.join());
    const n = opt.n || Math.max(10, Math.max(...words.map(w => w.length)) + 2);
    const dirs = opt.dirs || [[0, 1], [1, 0], [1, 1]];
    const g = Array.from({ length: n }, () => Array(n).fill(''));
    const placed = [];
    for (const w of words.slice().sort((a, b) => b.length - a.length)) {
      let done = false;
      for (let t = 0; t < 400 && !done; t++) {
        const [dr, dc] = dirs[Math.floor(rnd() * dirs.length)];
        const r0 = Math.floor(rnd() * n), c0 = Math.floor(rnd() * n);
        const r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
        if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
        let okp = true;
        for (let i = 0; i < w.length; i++) { const ch = g[r0 + dr * i][c0 + dc * i]; if (ch && ch !== w[i]) { okp = false; break; } }
        if (!okp) continue;
        for (let i = 0; i < w.length; i++) g[r0 + dr * i][c0 + dc * i] = w[i];
        placed.push(w); done = true;
      }
    }
    const AB = 'ABCDEFGHIJLMNÑOPRSTUVZ';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) g[r][c] = AB[Math.floor(rnd() * AB.length)];
    return `<div class="wsbox"><div class="ws" style="--n:${n}" data-words="${esc(placed.join(','))}">${g.map((row, r) => row.map((ch, c) => `<span data-r="${r}" data-c="${c}">${ch}</span>`).join('')).join('')}</div>
      <ul class="ws-words">${list.filter((w, i) => placed.includes(words[i])).map((w, i) => `<li data-w="${esc(plainUp(w))}">${esc(w)}</li>`).join('')}</ul></div>
      <small class="mu">Pulsa la primera y la última letra de cada palabra.</small>`;
  }
  function wsClick(cell) {
    const ws = cell.closest('.ws'); if (ws.classList.contains('locked')) return;
    const start = ws.querySelector('.start');
    if (!start) { cell.classList.add('start'); return; }
    start.classList.remove('start');
    const r0 = +start.dataset.r, c0 = +start.dataset.c, r1 = +cell.dataset.r, c1 = +cell.dataset.c;
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0), len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
    if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return;
    const cells = []; for (let i = 0; i < len; i++) cells.push(ws.querySelector(`[data-r="${r0 + dr * i}"][data-c="${c0 + dc * i}"]`));
    const w = cells.map(c => c.textContent).join(''), wr = w.split('').reverse().join('');
    const li = [...ws.parentElement.querySelectorAll('.ws-words li:not(.found)')].find(l => l.dataset.w === w || l.dataset.w === wr);
    if (li) { li.classList.add('found'); cells.forEach(c => c.classList.add('hit')); }
  }
  function crosswordHTML(pairs) {
    const items = pairs.map(([a, clue]) => ({ w: plainUp(a), clue })).sort((x, y) => y.w.length - x.w.length);
    const grid = new Map(), key = (r, c) => r + ',' + c, put = [];
    const can = (w, r, c, dir) => {
      for (let i = -1; i <= w.length; i++) {
        const rr = r + (dir ? i : 0), cc = c + (dir ? 0 : i), ch = grid.get(key(rr, cc));
        if (i === -1 || i === w.length) { if (ch) return false; continue; }
        if (ch && ch !== w[i]) return false;
        if (!ch) { const n1 = grid.get(key(rr + (dir ? 0 : 1), cc + (dir ? 1 : 0))), n2 = grid.get(key(rr - (dir ? 0 : 1), cc - (dir ? 1 : 0))); if (n1 || n2) return false; }
      }
      return true;
    };
    const place = (it, r, c, dir) => { for (let i = 0; i < it.w.length; i++) grid.set(key(r + (dir ? i : 0), c + (dir ? 0 : i)), it.w[i]); put.push(Object.assign(it, { r, c, dir })); };
    items.forEach((it, idx) => {
      if (!idx) return place(it, 0, 0, 0);
      for (const p of put) for (let i = 0; i < p.w.length; i++) for (let j = 0; j < it.w.length; j++) {
        if (it.placed || p.w[i] !== it.w[j]) continue;
        const dir = p.dir ? 0 : 1, r = p.r + (p.dir ? i : 0) - (dir ? j : 0), c = p.c + (p.dir ? 0 : i) - (dir ? 0 : j);
        if (can(it.w, r, c, dir)) { place(it, r, c, dir); it.placed = true; }
      }
      if (!it.placed) { const maxR = Math.max(...[...grid.keys()].map(k => +k.split(',')[0])); place(it, maxR + 2, 0, 0); }
    });
    const rs = [...grid.keys()].map(k => +k.split(',')[0]), cs = [...grid.keys()].map(k => +k.split(',')[1]);
    const r0 = Math.min(...rs), c0 = Math.min(...cs), R = Math.max(...rs) - r0 + 1, C = Math.max(...cs) - c0 + 1;
    const starts = new Map(); let num = 0;
    put.slice().sort((a, b) => a.r - b.r || a.c - b.c).forEach(p => { const k = key(p.r, p.c); if (!starts.has(k)) starts.set(k, ++num); p.n = starts.get(k); });
    let cells = '';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const ch = grid.get(key(r + r0, c + c0)), n = starts.get(key(r + r0, c + c0));
      cells += ch ? `<label class="cell">${n ? `<i>${n}</i>` : ''}<input maxlength="1" data-a="${ch}" autocomplete="off" autocapitalize="characters"></label>` : '<span class="cell empty"></span>';
    }
    const list = d => put.filter(p => p.dir === d).sort((a, b) => a.n - b.n).map(p => `<li><b>${p.n}.</b> ${p.clue} <small>(${p.w.length})</small></li>`).join('');
    return `<div class="cwbox"><div class="cw" style="--cols:${C}">${cells}</div><div class="clues"><h4>➡️ Horizontales</h4><ul>${list(0)}</ul><h4>⬇️ Verticales</h4><ul>${list(1)}</ul></div></div>`;
  }

  function widget(x, k) {
    const [ty, , ans] = x;
    if (ty === 'm' || ty === 'a')
      return `<div class="opts"${ty === 'a' ? ' data-multi="1"' : ''}>${shuffle(ans.map((a, i) => [a[0], i])).map(([t, i]) => `<button type="button" class="opt" data-i="${i}">${t}</button>`).join('')}</div>`;
    if (ty === 's') return `<div><input class="txt" type="text" name="s${k}" aria-label="Respuesta" spellcheck="false" autocapitalize="off"></div>`;
    if (ty === 'd') return `<div class="dict"><button type="button" class="btn alt sm" data-say="${esc(x[4])}">🔊 Escuchar</button><button type="button" class="btn alt sm" data-say="${esc(x[4])}" data-rate="0.6">🐢 Despacio</button>
      <input class="txt" type="text" name="s${k}" aria-label="Escribe lo que oyes" spellcheck="false" autocapitalize="off" autocomplete="off"></div>`;
    if (ty === 'o') {
      const tiles = shuffle(ans[0][0].replace(/[.!?¡¿,]/g, '').split(/\s+/).filter(Boolean));
      return `<div class="order"><div class="built" aria-live="polite"></div><div class="tiles">${tiles.map(t => `<button type="button" class="tile">${esc(t)}</button>`).join('')}</div><button type="button" class="btn alt sm" data-reset>↩️ Borrar</button></div>`;
    }
    if (ty === 'g') { // texto con huecos: {{opción|correcta*|opción}}
      let n = 0;
      return `<div class="gap">${String(x[4]).replace(/\{\{([^}]+)\}\}/g, (m, body) => {
        const opts = body.split('|').map(o => o.replace(/\*$/, ''));
        return `<select data-g="${n++}"><option value="">…</option>${shuffle(opts).map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
      })}</div>`;
    }
    if (ty === 'w') return wordSearchHTML(ans.map(a => a[0]), x[4] || {});
    if (ty === 'c') return crosswordHTML(ans);
    if (ty === 'x') {
      const rights = shuffle([...new Set(ans.map(a => a[1]))]);
      return `<div class="match">${ans.map((a, i) => `<span>${a[0]}</span><select data-i="${i}"><option value="">— elige —</option>${rights.map(r => `<option>${esc(r)}</option>`).join('')}</select>`).join('')}</div>`;
    }
    return '';
  }

  function grade(x, el) {
    const [ty, , ans, fb] = x;
    const fbEl = el.querySelector('.fb');
    let ok = false, sol = '';
    if (ty === 'm' || ty === 'a') {
      const opts = [...el.querySelectorAll('.opt')];
      opts.forEach(o => { const right = !!(ans[+o.dataset.i][1]); if (right) o.classList.add('right'); else if (o.classList.contains('sel')) o.classList.add('wrong'); });
      ok = opts.every(o => !!(ans[+o.dataset.i][1]) === o.classList.contains('sel'));
      sol = ans.filter(a => a[1]).map(a => a[0]).join(' · ');
    } else if (ty === 's' || ty === 'd') {
      const inp = el.querySelector('input.txt'); const v = norm(inp.value);
      ok = ans.some(a => norm(a[0]) === v); inp.classList.add(ok ? 'right' : 'wrong'); inp.disabled = true;
      sol = ans[0][0];
    } else if (ty === 'o') {
      const built = el.querySelector('.built'); const v = norm([...built.querySelectorAll('.tile')].map(t => t.textContent).join(' '));
      ok = ans.some(a => norm(a[0]) === v); built.classList.add(ok ? 'right' : 'wrong');
      el.querySelectorAll('.order button').forEach(b => b.disabled = true);
      sol = ans[0][0];
    } else if (ty === 'g') {
      const right = [...String(x[4]).matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1].split('|').find(o => /\*$/.test(o)).replace(/\*$/, ''));
      ok = true;
      el.querySelectorAll('.gap select').forEach(sel => { const r = sel.value === right[+sel.dataset.g]; sel.classList.add(r ? 'right' : 'wrong'); sel.disabled = true; if (!r) ok = false; });
      sol = right.join(' · ');
    } else if (ty === 'w') {
      const total = el.querySelectorAll('.ws-words li').length, found = el.querySelectorAll('.ws-words li.found').length;
      ok = found === total; sol = ans.map(a => a[0]).join(', ');
      el.querySelectorAll('.ws-words li:not(.found)').forEach(li => li.classList.add('missing'));
      el.querySelector('.ws').classList.add('locked');
    } else if (ty === 'c') {
      ok = true;
      el.querySelectorAll('.cw input').forEach(i => { const r = plainUp(i.value) === i.dataset.a; i.classList.add(r ? 'right' : 'wrong'); i.disabled = true; if (!r) ok = false; });
      sol = ans.map(a => a[0]).join(', ');
    } else if (ty === 'x') {
      ok = true;
      el.querySelectorAll('select').forEach(s => { const r = s.value === ans[+s.dataset.i][1]; s.classList.add(r ? 'right' : 'wrong'); s.disabled = true; if (!r) ok = false; });
      sol = ans.map(a => a[0] + ' → ' + a[1]).join(' · ');
    }
    fbEl.innerHTML = (ok ? '✅ ¡Bien! ' : `❌ Respuesta correcta: <span class="ans">${sol}</span>. `) + (fb || '');
    return ok;
  }
})();
