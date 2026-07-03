/* panorama.js — the window into 360° images.
   Wraps an equirectangular (panoramic) image around the viewer using WebGL,
   and lets you look around by dragging with a mouse or a finger.
   Exposes a tiny API on window.PanoViewer: show(image), hide(), isActive(). */

(() => {
  "use strict";

  const canvas = document.getElementById("pano");
  let gl = null, program = null, texture = null;
  let uFront, uRight, uUp, uTan;
  let active = false;
  let yaw = 0, pitch = 0, fov = 75;
  let dragging = false, lastX = 0, lastY = 0, lastMove = 0;
  let rafId = null;

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vNdc;
    void main() {
      vNdc = aPos;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform vec3 uFront, uRight, uUp;
    uniform vec2 uTan;
    varying vec2 vNdc;
    void main() {
      vec3 d = normalize(uFront + vNdc.x * uTan.x * uRight + vNdc.y * uTan.y * uUp);
      float u = atan(d.z, d.x) / 6.28318530718 + 0.5;
      float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359;
      gl_FragColor = texture2D(uTex, vec2(u, v));
    }`;

  function initGL() {
    gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) return false;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);

    // one full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uFront = gl.getUniformLocation(program, "uFront");
    uRight = gl.getUniformLocation(program, "uRight");
    uUp = gl.getUniformLocation(program, "uUp");
    uTan = gl.getUniformLocation(program, "uTan");
    return true;
  }

  function setTexture(source) {
    if (!gl && !initGL()) return false;
    if (texture) gl.deleteTexture(texture);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // panorama sizes are rarely powers of two, so clamp + linear filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return true;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(now) {
    if (!active) return;
    // gentle auto-drift when the user isn't dragging
    if (!dragging && now - lastMove > 3000) yaw += 0.00006 * 16;

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const front = [cp * cy, sp, cp * sy];
    const right = [-sy, 0, cy];
    const up = [
      front[1] * right[2] - front[2] * right[1],
      front[2] * right[0] - front[0] * right[2],
      front[0] * right[1] - front[1] * right[0],
    ];
    const aspect = canvas.width / canvas.height;
    const tanY = Math.tan((fov * Math.PI) / 360);

    gl.uniform3fv(uFront, front);
    gl.uniform3fv(uRight, right);
    gl.uniform3fv(uUp, up);
    gl.uniform2f(uTan, tanY * aspect, -tanY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    rafId = requestAnimationFrame(render);
  }

  // ---- drag to look around (mouse + touch via pointer events)
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const k = (fov / 75) * 0.0032;
    yaw += (e.clientX - lastX) * k;
    pitch += (e.clientY - lastY) * k;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    lastX = e.clientX;
    lastY = e.clientY;
    lastMove = performance.now();
  });
  const endDrag = () => { dragging = false; lastMove = performance.now(); };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => { if (active) resize(); });

  window.PanoViewer = {
    show(imageOrCanvas) {
      resize();
      if (!setTexture(imageOrCanvas)) return false;
      yaw = 0; pitch = 0;
      active = true;
      canvas.classList.remove("hidden");
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
      return true;
    },
    hide() {
      active = false;
      cancelAnimationFrame(rafId);
      canvas.classList.add("hidden");
    },
    isActive: () => active,
  };
})();
