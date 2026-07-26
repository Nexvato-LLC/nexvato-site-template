/* Nexvato Site Template — WebGL effects layer.
   All effects: lazy (IntersectionObserver-gated), paused when offscreen/tab hidden,
   DPR-capped, with static fallbacks (canvas simply stays transparent over the
   static art if WebGL is unavailable or prefers-reduced-motion is set). */
window.SiteFX = (function () {
  const reduced = () =>
    window.__JAYS_FORCE_REDUCED === true ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 1.75);

  let _ok = null;
  function ok() {
    if (_ok !== null) return _ok;
    try {
      const c = document.createElement('canvas');
      _ok = !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { _ok = false; }
    return _ok;
  }

  /* Run start/stop callbacks based on viewport + tab visibility. */
  function gate(el, start, stop) {
    let visible = false, disposed = false;
    const sync = () => {
      if (disposed) return;
      if (visible && !document.hidden) start(); else stop();
    };
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting; sync();
    }, { rootMargin: '80px' });
    io.observe(el);
    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);
    return () => { disposed = true; io.disconnect(); document.removeEventListener('visibilitychange', onVis); stop(); };
  }

  function makeProgram(gl, vsSrc, fsSrc) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function sizeCanvas(canvas) {
    const d = dprCap();
    const w = Math.max(2, Math.round(canvas.clientWidth * d));
    const h = Math.max(2, Math.round(canvas.clientHeight * d));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  const noop = () => {};

  /* ============ 1. Hero living circle — liquid displacement ============ */
  function heroLiquid(canvas, imgSrc) {
    if (reduced() || !ok()) return noop;
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true }); } catch (e) { return noop; }
    if (!gl) return noop;

    const vs = `attribute vec2 a; varying vec2 v; void main(){ v=(a+1.0)*0.5; gl_Position=vec4(a,0.,1.);}`;
    const fs = `precision mediump float; varying vec2 v;
      uniform sampler2D t; uniform float u_time, u_ript, u_hover; uniform vec2 u_mouse;
      void main(){
        vec2 uv = vec2(v.x, 1.0 - v.y);
        float d = distance(uv, vec2(0.5));
        float ripple = exp(-u_ript*1.15) * 0.014 * sin(d*44.0 - u_ript*7.0);
        vec2 dir = normalize(uv - vec2(0.5) + 1e-4);
        uv += dir * ripple;
        vec2 mv = uv - u_mouse;
        float infl = smoothstep(0.38, 0.0, length(mv)) * u_hover;
        uv -= normalize(mv + 1e-4) * infl * 0.022;
        uv.x += sin(uv.y*9.0 + u_time*0.55) * 0.0022;
        uv.y += cos(uv.x*9.0 + u_time*0.45) * 0.0022;
        uv = clamp(uv, 0.002, 0.998);
        gl_FragColor = texture2D(t, uv);
      }`;
    let prog;
    try { prog = makeProgram(gl, vs, fs); } catch (e) { return noop; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uTime = U('u_time'), uRipt = U('u_ript'), uHover = U('u_hover'), uMouse = U('u_mouse');

    const tex = gl.createTexture();
    let texReady = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      texReady = true;
    };
    img.src = imgSrc;

    let raf = 0, t0 = 0, running = false, shown = false;
    let mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5, hover = 0, hoverTarget = 0;
    let frames = 0, fpsT = 0, killed = false;

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    };
    const onEnter = () => { hoverTarget = 1; };
    const onLeave = () => { hoverTarget = 0; };
    canvas.parentElement.addEventListener('pointermove', onMove);
    canvas.parentElement.addEventListener('pointerenter', onEnter);
    canvas.parentElement.addEventListener('pointerleave', onLeave);

    const frame = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!texReady) return;
      if (!t0) { t0 = now; fpsT = now; }
      const t = (now - t0) / 1000;
      /* FPS guard: if the first 2.5s average under ~22fps, bail to static art */
      frames++;
      if (!killed && now - fpsT > 2500) {
        if (frames / ((now - fpsT) / 1000) < 22) { killed = true; dispose(); return; }
        fpsT = now; frames = 0;
      }
      sizeCanvas(canvas);
      gl.viewport(0, 0, canvas.width, canvas.height);
      mx += (tx - mx) * 0.07; my += (ty - my) * 0.07;
      hover += (hoverTarget - hover) * 0.06;
      gl.uniform1f(uTime, t);
      gl.uniform1f(uRipt, t);
      gl.uniform1f(uHover, hover);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.style.opacity = '1'; }
    };
    const start = () => { if (running || killed) return; running = true; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const ungate = gate(canvas, start, stop);
    function dispose() {
      ungate(); stop();
      canvas.style.opacity = '0';
      canvas.parentElement && canvas.parentElement.removeEventListener('pointermove', onMove);
    }
    return dispose;
  }

  /* ============ 2/4. GPU point fields (hero dots + starfield) ============ */
  function pointsField(canvas, opts) {
    if (reduced() || !ok()) return noop;
    const o = Object.assign({
      count: 24,
      colors: ['#2e3192', '#c1272d'],
      size: [5, 26],          /* css px */
      speed: 6,               /* css px / s drift */
      repel: 90,              /* cursor repulsion radius, css px (0 = off) */
      parallax: 14,           /* max px shift from pointer, scaled by depth */
      twinkle: false,
    }, opts || {});
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: false }); } catch (e) { return noop; }
    if (!gl) return noop;

    const vs = `attribute vec2 a_pos; attribute float a_size; attribute vec3 a_col; attribute float a_alpha;
      uniform vec2 u_res; varying vec3 v_col; varying float v_alpha;
      void main(){
        vec2 c = a_pos / u_res * 2.0 - 1.0;
        gl_Position = vec4(c.x, -c.y, 0., 1.);
        gl_PointSize = a_size;
        v_col = a_col; v_alpha = a_alpha;
      }`;
    const fs = `precision mediump float; varying vec3 v_col; varying float v_alpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.42, d) * v_alpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(v_col, a);
      }`;
    let prog;
    try { prog = makeProgram(gl, vs, fs); } catch (e) { return noop; }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const hex = (h) => {
      const n = parseInt(h.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    const N = o.count;
    const P = [];
    const rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < N; i++) {
      const depth = rand(0.35, 1);
      P.push({
        x: Math.random(), y: Math.random(),
        vx: rand(-1, 1) * o.speed, vy: rand(-1, 1) * o.speed,
        depth,
        size: rand(o.size[0], o.size[1]) * depth,
        col: hex(o.colors[i % o.colors.length]),
        alpha: o.twinkle ? rand(0.35, 0.9) : rand(0.75, 1),
        tw: rand(0, Math.PI * 2),
        ox: 0, oy: 0,
      });
    }
    const stride = 7;
    const arr = new Float32Array(N * stride);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr.byteLength, gl.DYNAMIC_DRAW);
    const attr = (name, size, offset) => {
      const l = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride * 4, offset * 4);
    };
    attr('a_pos', 2, 0); attr('a_size', 1, 2); attr('a_col', 3, 3); attr('a_alpha', 1, 6);
    const uRes = gl.getUniformLocation(prog, 'u_res');

    let raf = 0, running = false, last = 0, shown = false;
    let px = -9999, py = -9999;   /* pointer in css px, canvas space */
    let plx = 0, ply = 0;         /* parallax target -1..1 */
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      plx = (px / r.width - 0.5) * 2; ply = (py / r.height - 0.5) * 2;
    };
    const onLeave = () => { px = py = -9999; };
    const host = canvas.parentElement;
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    const frame = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sizeCanvas(canvas);
      const d = dprCap();
      const W = canvas.width / d, H = canvas.height / d;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, W, H);
      for (let i = 0; i < N; i++) {
        const p = P[i];
        p.x += (p.vx * dt) / W; p.y += (p.vy * dt) / H;
        if (p.x < -0.06) p.x = 1.06; if (p.x > 1.06) p.x = -0.06;
        if (p.y < -0.06) p.y = 1.06; if (p.y > 1.06) p.y = -0.06;
        let cx = p.x * W + plx * o.parallax * p.depth;
        let cy = p.y * H + ply * o.parallax * p.depth;
        if (o.repel > 0) {
          const dx = cx - px, dy = cy - py;
          const dist = Math.hypot(dx, dy);
          let want = 0, wx = 0, wy = 0;
          if (dist < o.repel && dist > 0.001) {
            want = (1 - dist / o.repel) * 26;
            wx = (dx / dist) * want; wy = (dy / dist) * want;
          }
          p.ox += (wx - p.ox) * 0.08; p.oy += (wy - p.oy) * 0.08;
          cx += p.ox; cy += p.oy;
        }
        let a = p.alpha;
        if (o.twinkle) a = p.alpha * (0.65 + 0.35 * Math.sin(p.tw + now * 0.0006 * (0.5 + p.depth)));
        const k = i * stride;
        arr[k] = cx; arr[k + 1] = cy;
        arr[k + 2] = p.size * d;
        arr[k + 3] = p.col[0]; arr[k + 4] = p.col[1]; arr[k + 5] = p.col[2];
        arr[k + 6] = a;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
      gl.drawArrays(gl.POINTS, 0, N);
      if (!shown) { shown = true; canvas.style.opacity = '1'; }
    };
    const start = () => { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const ungate = gate(canvas, start, stop);
    return () => {
      ungate(); stop();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }

  /* ============ 3. PDP collectible viewer (three.js, lazy-loaded) ============ */
  let _threeP = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (!_threeP) {
      _threeP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return _threeP;
  }
  function viewer(canvas) {
    if (reduced() || !ok()) return noop;
    let disposed = false, inner = noop;
    loadThree().then(() => {
      if (!disposed && canvas.isConnected) inner = viewerImpl(canvas);
    }).catch(() => {});
    return () => { disposed = true; inner(); };
  }
  function viewerImpl(canvas) {
    if (!window.THREE) return noop;
    const THREE = window.THREE;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) { return noop; }
    renderer.setPixelRatio(dprCap());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 1.15, 7.4);
    camera.lookAt(0, 0.35, 0);

    /* Studio lighting: soft key + fill + gold rim */
    scene.add(new THREE.AmbientLight(0xf6e7c6, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(3.4, 5.4, 4.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdcdcf0, 0.35);
    fill.position.set(-4, 2, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe0b45e, 1.3);   /* gold rim-light */
    rim.position.set(-2.6, 3.2, -4.8);
    scene.add(rim);

    /* The collectible: gold star trophy on a navy pedestal */
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xc69749, metalness: 0.85, roughness: 0.28 });
    const goldDark = new THREE.MeshStandardMaterial({ color: 0xa97e34, metalness: 0.8, roughness: 0.4 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x1f3a5f, metalness: 0.15, roughness: 0.55 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf6e7c6, metalness: 0.05, roughness: 0.9 });

    const starShape = new THREE.Shape();
    const spikes = 5, R = 1.16, r = 0.48;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const star = new THREE.Mesh(
      new THREE.ExtrudeGeometry(starShape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3 }),
      gold
    );
    star.rotation.x = 0;
    star.position.set(0, 1.35, -0.15);
    star.castShadow = true;
    group.add(star);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.15, 24), goldDark);
    column.position.y = -0.35;
    column.castShadow = true;
    group.add(column);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.42, 48), navy);
    base.position.y = -1.12;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 12, 64), gold);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.92;
    group.add(trim);

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.05), cream);
    plaque.position.set(0, -1.06, 1.18);
    group.add(plaque);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 48),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.34;
    ground.receiveShadow = true;
    scene.add(ground);

    group.position.y = 0.32;
    scene.add(group);

    /* Drag to rotate + slow auto-spin at rest */
    let dragging = false, lastX = 0, vel = 0, rotY = -0.5, idleT = 0, shown = false;
    const onDown = (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      vel = dx * 0.006;
      rotY += vel;
      idleT = 0;
    };
    const onUp = () => { dragging = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.style.cursor = 'grab';

    let raf = 0, running = false, last = 0;
    const frame = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const size = Math.min(canvas.clientWidth, canvas.clientHeight) || canvas.clientWidth;
      const d = dprCap();
      const px = Math.round(canvas.clientWidth * d), pyy = Math.round(canvas.clientHeight * d);
      if (canvas.width !== px || canvas.height !== pyy) {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      }
      if (!dragging) {
        vel *= 0.94;
        rotY += vel;
        idleT += dt;
        if (idleT > 0.8) rotY += dt * 0.28;   /* slow auto-spin at rest */
      }
      group.rotation.y = rotY;
      group.position.y = 0.32 + Math.sin(now * 0.0008) * 0.04;
      renderer.render(scene, camera);
      if (!shown) { shown = true; canvas.style.opacity = '1'; }
    };
    const start = () => { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const ungate = gate(canvas, start, stop);
    return () => {
      ungate(); stop();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
    };
  }

  return {
    reduced, ok,
    heroLiquid,
    dots: (canvas, opts) => pointsField(canvas, Object.assign({
      count: 22, colors: ['#2e3192', '#c1272d', '#2e3192'], size: [5, 22], speed: 7, repel: 90, parallax: 16,
    }, opts || {})),
    starfield: (canvas) => pointsField(canvas, {
      count: 130, colors: ['#e0b45e', '#f6e7c6', '#c69749', '#f6e7c6'], size: [1.2, 2.8],
      speed: 2.2, repel: 0, parallax: 6, twinkle: true,
    }),
    viewer,
  };
})();
