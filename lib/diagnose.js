(function(){
  // 一次性的自检：只看桌面壳那块全屏底板到底有没有被打开。
  // 打开了 -> 什么都不做，窗口标题保持原样，谁也看不出来。
  // 还压着 -> 把颜色和层级写进标题，外面读得到。
  var box = { v: 'DeepSeek Harness' };
  var hooked = false;
  try {
    Object.defineProperty(document, 'title', {
      configurable: true,
      enumerable: true,
      get: function(){ return box.v },
      set: function(){ /* swallow framework writes */ }
    });
    hooked = true;
  } catch (e) {}

  function frameInfo(){
    var f = document.querySelector('[data-windows-titlebar] .BynINW_frame')
         || document.querySelector('.BynINW_frame');
    if (!f) return 'NO-FRAME';
    var cs = getComputedStyle(f);
    var r = f.getBoundingClientRect();
    return 'frame-bg=' + cs.backgroundColor + ' size=' + Math.round(r.width) + 'x' + Math.round(r.height);
  }

  function go(){
    var info;
    try { info = frameInfo(); } catch (e) { info = 'ERR ' + e.message; }

    var opaque = info.indexOf('rgba(0, 0, 0, 0)') === -1 && info.indexOf('transparent') === -1;

    if (!opaque){
      // 已经透了：标题交还原样，收工。
      box.v = 'DeepSeek Harness';
      return;
    }

    // 还压着：分段播放，让外面读得到。
    var b = getComputedStyle(document.body);
    var text = 'FRAME-STILL-OPAQUE \u00b6 ' + info
      + ' \u00b6 attach=' + String(b.backgroundAttachment).slice(0, 40)
      + ' \u00b6 bgimg-len=' + String(b.backgroundImage || '').length
      + ' \u00b6 hooked=' + hooked;
    try { fetch('http://127.0.0.1:39177/diag', { method: 'POST', mode: 'no-cors', body: text }); } catch (e) {}

    var chunks = [];
    for (var i = 0; i < text.length; i += 80) chunks.push(text.slice(i, i + 80));
    chunks.push('END(' + chunks.length + ')');
    var idx = 0;
    function tick(){
      box.v = 'ELYX[' + idx + '] ' + chunks[idx];
      idx = (idx + 1) % chunks.length;
    }
    tick();
    setInterval(tick, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(go, 2200); });
  else setTimeout(go, 2200);
})();
