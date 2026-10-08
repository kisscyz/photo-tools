/* 智能证件照制作：上传 → AI去底色 → 换底色 → 选尺寸 → 下载 */
(function () {
  'use strict';

  var SIZES = [
    { key: '1inch',    name: '一寸',   mm: '25×35mm', w: 295, h: 413, tag: '常用' },
    { key: '2inch',    name: '二寸',   mm: '35×49mm', w: 413, h: 579 },
    { key: 'small1',   name: '小一寸', mm: '22×32mm', w: 260, h: 378 },
    { key: 'big1',     name: '大一寸', mm: '33×48mm', w: 390, h: 567 },
    { key: 'passport', name: '护照',   mm: '33×48mm', w: 390, h: 567 },
    { key: 'visa',     name: '签证',   mm: '35×45mm', w: 413, h: 531 }
  ];
  var COLORS = [
    { name: '大红',   hex: '#FF0000' },
    { name: '证件蓝', hex: '#0070C8' },
    { name: '白色',   hex: '#FFFFFF' },
    { name: '浅蓝',   hex: '#A9D6F5' },
    { name: '深蓝',   hex: '#000099' },
    { name: '天蓝',   hex: '#00A9E6' },
    { name: '浅灰',   hex: '#D9D9D9' }
  ];

  var state = {
    file: null, img: null,
    cutout: null,       // 去底色后的 canvas
    bg: '#0070C8', bgName: '证件蓝',
    size: SIZES[0],
    busy: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  function setStep(n) {
    for (var i = 1; i <= 4; i++) $('step' + i).classList.toggle('done', i <= n);
  }

  /* ---------- 渲染颜色 / 尺寸选项 ---------- */
  var swBox = $('swatches');
  COLORS.forEach(function (c, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (i === 1 ? ' sel' : '');
    b.innerHTML = '<span class="dot" style="background:' + c.hex + '"></span><span>' + c.name + '</span>';
    b.addEventListener('click', function () {
      state.bg = c.hex; state.bgName = c.name;
      Array.prototype.forEach.call(swBox.children, function (el) { el.classList.remove('sel'); });
      b.classList.add('sel');
      render();
    });
    swBox.appendChild(b);
  });
  // 自定义色也作为一个 swatch
  var customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'swatch';
  customBtn.id = 'customSwatch';
  customBtn.innerHTML = '<span class="dot" id="customDot" style="background:conic-gradient(#f55,#ff5,#5f5,#5ff,#55f,#f5f,#f55)"></span><span>自定义</span>';
  customBtn.addEventListener('click', function () { $('customColor').click(); });
  swBox.appendChild(customBtn);
  $('customColor').addEventListener('input', function (e) {
    state.bg = e.target.value; state.bgName = '自定义';
    $('customDot').style.background = e.target.value;
    Array.prototype.forEach.call(swBox.children, function (el) { el.classList.remove('sel'); });
    customBtn.classList.add('sel');
    render();
  });

  var grid = $('sizeGrid');
  SIZES.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-card' + (i === 0 ? ' sel' : '');
    b.innerHTML = '<b>' + s.name + '</b><small>' + s.mm + '<br>' + s.w + '×' + s.h + 'px</small>' +
      (s.tag ? '<span class="tag">' + s.tag + '</span>' : '');
    b.addEventListener('click', function () {
      state.size = s;
      Array.prototype.forEach.call(grid.children, function (el) { el.classList.remove('sel'); });
      b.classList.add('sel');
      setStep(3);
      render();
    });
    grid.appendChild(b);
  });

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
    if (file.size > 5 * 1024 * 1024) { toast('图片超过 5MB，请压缩后重试', true); return; }
    var url = URL.createObjectURL(file);
    PhotoPrivacy.track(url);
    var img = new Image();
    img.onload = function () {
      state.file = file; state.img = img; state.cutout = null;
      $('origPreview').src = url;
      $('origBox').style.display = 'block';
      $('fileInfo').innerHTML = '<span class="ok">✔ 已上传</span> ' + escapeHtml(file.name) +
        ' · ' + img.naturalWidth + '×' + img.naturalHeight + ' · ' + fmtSize(file.size);
      $('rmBtn').disabled = false;
      $('dlBtn').disabled = true;
      $('resultNote').style.display = 'none';
      $('resultImg').style.display = 'none';
      $('resultEmpty').style.display = 'block';
      setStep(1);
      toast('照片已上传，点击「AI 智能去底色」');
    };
    img.onerror = function () { toast('图片读取失败，请换一张试试', true); };
    img.src = url;
  }

  /* ---------- AI 去底色 ---------- */
  $('rmBtn').addEventListener('click', function () {
    if (!state.file || state.busy) return;
    state.busy = true;
    $('rmBtn').disabled = true;
    $('progress').classList.add('show');
    $('progressTip').classList.add('show');
    var bar = $('progressBar');

    import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm')
      .then(function (m) {
        return m.removeBackground(state.file, {
          progress: function (key, current, total) {
            var p = Math.round((current / total) * 100);
            bar.style.width = p + '%';
            var label = { 'fetch:onnx/model': '下载 AI 模型', 'compute:inference': 'AI 抠图中' }[key] || '处理中';
            $('progressTip').textContent = label + ' ' + p + '%';
          }
        });
      })
      .then(function (blob) { return blobToImage(blob); })
      .then(function (img) {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        state.cutout = c;
        state.busy = false;
        $('progress').classList.remove('show');
        $('progressTip').classList.remove('show');
        bar.style.width = '0';
        setStep(2);
        render();
        toast('✔ 去底色完成，选择底色和尺寸即可下载');
      })
      .catch(function (err) {
        console.error(err);
        state.busy = false;
        $('rmBtn').disabled = false;
        $('progress').classList.remove('show');
        $('progressTip').classList.add('show');
        $('progressTip').textContent = '去底色失败：可能是网络问题，点击按钮重试';
        toast('去底色失败，请检查网络后重试', true);
      });
  });

  function blobToImage(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      PhotoPrivacy.track(url);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  /* ---------- 合成预览 ---------- */
  function render() {
    if (!state.cutout) return;
    var s = state.size;
    var canvas = document.createElement('canvas');
    canvas.width = s.w; canvas.height = s.h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, s.w, s.h);
    var cw = state.cutout.width, ch = state.cutout.height;
    var scale = Math.min(s.w / cw, s.h / ch) * 0.94;
    var dw = cw * scale, dh = ch * scale;
    ctx.drawImage(state.cutout, (s.w - dw) / 2, (s.h - dh) / 2, dw, dh);

    var fmt = $('formatSel').value;
    $('resultImg').src = fmt === 'png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
    $('resultImg').style.display = 'block';
    $('resultEmpty').style.display = 'none';
    $('resultCap').textContent = s.name + ' · ' + s.mm + ' · ' + state.bgName + '底';
    $('resultNote').style.display = 'block';
    $('dlBtn').disabled = false;
    state._canvas = canvas;
    setStep(4);
  }
  $('formatSel').addEventListener('change', render);

  /* ---------- 下载 ---------- */
  $('dlBtn').addEventListener('click', function () {
    if (!state._canvas) return;
    var fmt = $('formatSel').value;
    var mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    state._canvas.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '证件照_' + state.size.name + '_' + state.bgName + '底.' + fmt;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
      PhotoPrivacy.scheduleAutoDelete();
      toast('✔ 证件照已开始下载');
    }, mime, 0.92);
  });

  function fmtSize(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.round(b / 1024) + 'KB';
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
