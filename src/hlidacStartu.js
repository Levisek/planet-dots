// Hlídač startu: chybu ukáže na obrazovce a pošle ji GETem na /chyba
// (404, ale zůstane v přístupovém logu nginxu). Když se start do 25 s
// nedokončí (main.js nastaví __dotsReady), ohlásí, že visí.
(function () {
  var sent = 0;
  window.__hlasChybu = function (msg) {
    msg = String(msg).slice(0, 600);
    if (sent++ < 5) try { fetch('./chyba?m=' + encodeURIComponent(msg)); } catch (e) {}
    var el = document.getElementById('chybaStartu');
    if (!el) {
      el = document.createElement('pre');
      el.id = 'chybaStartu';
      el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;margin:0;padding:8px;' +
        'background:#300;color:#fbb;font:12px monospace;white-space:pre-wrap;border:1px solid #a33';
      document.body.appendChild(el);
    }
    el.textContent += msg + '\n';
  };
  window.addEventListener('error', function (e) {
    __hlasChybu('chyba: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    __hlasChybu('promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason));
  });
  window.addEventListener('webglcontextlost', function () {
    __hlasChybu('WebGL kontext ztracen (' + (window.__dotsStage || '') + ')');
  }, true);
  setTimeout(function () {
    if (!window.__dotsReady) __hlasChybu('start visí: ' + (window.__dotsStage || 'main.js se nespustil'));
  }, 25000);
})();
