/* 图片转SVG：上传 → ImageTracer 矢量化 → 预览 → 下载 */
(function () {
  'use strict';

  var state = { img: null, svg: '', fileName: 'image' };
  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3000);
  }

  /* ---------- 上传 ---------- */
  var dz = $('dropzone'), fi = $('fileInput');
  dz.addEventListener('click', function () { fi.click(); });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fi.addEventListener('change', function () {
    if (fi.files[0]) handleFile(fi.files[0]);
    fi.value = '';
  });

  function handleFile(file) {
    if (!/^image\//.test(file.type)) { toast('请选择图片文件', true); return; }
    if (file.size > 10 * 1024 * 1024) { toast('图片超过 10MB，请压缩后重试', true); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.img = img;
      state.fileName = file.name.replace(/\.[^.]+$/, '') || 'image';
      $('origPreview').src = url;
      $('origBox').style.display = 'block';
      $('fileInfo').innerHTML = '<span class="ok">✔ 已上传</span> ' + escapeHtml(file.name) +
        ' · ' + img.naturalWidth + '×' + img.naturalHeight;
      $('step2').classList.add('done');
      convert();
    };
    img.onerror = function () { toast('图片读取失败，请换一张试试', true); };
    img.src = url;
  }

  /* ---------- 参数 ---------- */
  var colorRange = $('colorRange'), smoothRange = $('smoothRange'), detailToggle = $('detailToggle');
  var debounce = null;
  function onParam() {
    $('colorVal').textContent = colorRange.value + ' 色';
    $('smoothVal').textContent = smoothRange.value + '%';
    clearTimeout(debounce);
    debounce = setTimeout(function () { if (state.img) convert(); }, 350);
  }
  colorRange.addEventListener('input', onParam);
  smoothRange.addEventListener('input', onParam);
  detailToggle.addEventListener('change', onParam);

  /* ---------- 矢量化 ---------- */
  function convert() {
    if (typeof ImageTracer === 'undefined') {
      toast('矢量化组件加载失败，请检查网络后刷新页面', true);
      return;
    }
    var box = $('svgBox');
    box.innerHTML = '<span class="svg-empty">⏳ 正在矢量化，请稍候…</span>';
    $('dlBtn').disabled = true;

    // 异步执行，避免阻塞 UI
    setTimeout(function () {
      try {
        var img = state.img;
        var maxDim = 1024;
        var scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var h = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var imgd = ctx.getImageData(0, 0, w, h);

        var smooth = +smoothRange.value;      // 0-100
        var keep = detailToggle.checked;
        var opts = {
          numberofcolors: +colorRange.value,
          mincolorratio: 0.02,
          colorquantcycles: 3,
          ltres: 1 + (smooth / 100) * 8,
          qtres: 1 + (smooth / 100) * 8,
          pathomit: keep
            ? Math.max(2, 10 - (smooth / 100) * 8)
            : Math.max(8, 26 - (smooth / 100) * 18),
          blurradius: 0,
          blurdelta: 20
        };

        var svgstr = ImageTracer.imagedataToSVG(imgd, opts);
        // 让 SVG 自适应预览框
        svgstr = svgstr.replace(/<svg /, '<svg style="width:100%;height:auto;max-height:380px;" ');
        state.svg = svgstr;
        box.innerHTML = svgstr;
        var kb = (new Blob([svgstr]).size / 1024).toFixed(1);
        $('svgInfo').textContent = '文件大小：' + kb + 'KB · SVG 矢量格式';
        $('dlBtn').disabled = false;
        $('step3').classList.add('done');
      } catch (e) {
        console.error(e);
        box.innerHTML = '<span class="svg-empty">转换失败，请换一张图片试试</span>';
        toast('矢量化失败，请重试', true);
      }
    }, 60);
  }

  /* ---------- 下载 ---------- */
  $('dlBtn').addEventListener('click', function () {
    if (!state.svg) return;
    var blob = new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = state.fileName + '.svg';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
    toast('✔ SVG 文件已开始下载');
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
