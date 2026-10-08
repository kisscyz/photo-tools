/* ICO图标制作：上传 → 选尺寸 → 生成标准.ico（含PNG内嵌） */
(function () {
  'use strict';

  var ALL_SIZES = [512, 256, 128, 64, 32, 16];
  var SUB = { 512: '最高清', 16: '标签图标' };
  var state = { img: null, fileName: 'icon' };

  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3000);
  }

  /* ---------- 尺寸复选框 ---------- */
  var checkList = $('checkList');
  var boxes = {};
  ALL_SIZES.forEach(function (s) {
    var label = document.createElement('label');
    label.className = 'check-item';
    label.innerHTML = '<input type="checkbox" checked data-size="' + s + '">' +
      '<span class="px">' + s + 'PX</span>' +
      (SUB[s] ? '<span class="sub">' + SUB[s] + '</span>' : '');
    checkList.appendChild(label);
    var input = label.querySelector('input');
    boxes[s] = input;
    input.addEventListener('change', renderPreviews);
  });
  function selectedSizes() {
    return ALL_SIZES.filter(function (s) { return boxes[s].checked; });
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
    if (file.size > 5 * 1024 * 1024) { toast('图片超过 5MB，请压缩后重试', true); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.img = img;
      state.fileName = file.name.replace(/\.[^.]+$/, '') || 'icon';
      $('origPreview').src = url;
      $('origBox').style.display = 'block';
      $('fileInfo').innerHTML = '<span class="ok">✔ 已上传</span> ' + escapeHtml(file.name) +
        ' · ' + img.naturalWidth + '×' + img.naturalHeight;
      $('step1').classList.add('done');
      $('step2').classList.add('done');
      $('genBtn').disabled = false;
      renderPreviews();
    };
    img.onerror = function () { toast('图片读取失败，请换一张试试', true); };
    img.src = url;
  }

  /* ---------- 缩放绘制 ---------- */
  function drawTo(size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    var iw = state.img.naturalWidth, ih = state.img.naturalHeight;
    var scale = Math.min(size / iw, size / ih);
    var dw = Math.max(1, Math.round(iw * scale)), dh = Math.max(1, Math.round(ih * scale));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(state.img, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
    return c;
  }

  function renderPreviews() {
    var box = $('icoPreviews');
    box.innerHTML = '';
    if (!state.img) {
      box.innerHTML = '<span class="svg-empty">上传图片后在此预览各尺寸效果</span>';
      return;
    }
    var sizes = selectedSizes();
    if (!sizes.length) {
      box.innerHTML = '<span class="svg-empty">请至少勾选一个尺寸</span>';
      return;
    }
    sizes.forEach(function (s) {
      var c = drawTo(s);
      var wrap = document.createElement('div');
      wrap.className = 'ico-prev';
      var th = document.createElement('div');
      th.className = 'thumb';
      var show = document.createElement('canvas');
      var d = Math.min(s, 84);
      show.width = d; show.height = d;
      show.style.width = d + 'px'; show.style.height = d + 'px';
      show.getContext('2d').drawImage(c, 0, 0, d, d);
      th.appendChild(show);
      wrap.appendChild(th);
      var lab = document.createElement('small');
      lab.textContent = s + 'PX';
      wrap.appendChild(lab);
      box.appendChild(wrap);
    });
  }

  /* ---------- 生成标准 ICO ---------- */
  function canvasToBuffer(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        var r = new FileReader();
        r.onload = function () { resolve(new Uint8Array(r.result)); };
        r.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }

  function buildIco(pngList) {
    var n = pngList.length;
    var headerSize = 6 + 16 * n;
    var total = headerSize;
    pngList.forEach(function (p) { total += p.data.length; });
    var buf = new ArrayBuffer(total);
    var v = new DataView(buf);
    v.setUint16(0, 0, true);      // reserved
    v.setUint16(2, 1, true);      // type: icon
    v.setUint16(4, n, true);      // count
    var offset = headerSize;
    pngList.forEach(function (p, i) {
      var o = 6 + 16 * i;
      v.setUint8(o, p.size === 256 ? 0 : p.size); // width (0 = 256)
      v.setUint8(o + 1, p.size === 256 ? 0 : p.size);
      v.setUint8(o + 2, 0);      // color count
      v.setUint8(o + 3, 0);      // reserved
      v.setUint16(o + 4, 1, true);  // planes
      v.setUint16(o + 6, 32, true); // bit count
      v.setUint32(o + 8, p.data.length, true);
      v.setUint32(o + 12, offset, true);
      new Uint8Array(buf, offset, p.data.length).set(p.data);
      offset += p.data.length;
    });
    return new Blob([buf], { type: 'image/x-icon' });
  }

  $('genBtn').addEventListener('click', function () {
    if (!state.img) return;
    var sizes = selectedSizes();
    if (!sizes.length) { toast('请至少勾选一个尺寸', true); return; }
    var btn = $('genBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 正在生成…';
    Promise.all(sizes.map(function (s) {
      return canvasToBuffer(drawTo(s)).then(function (data) { return { size: s, data: data }; });
    })).then(function (list) {
      var blob = buildIco(list);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = state.fileName + '.ico';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
      $('step3').classList.add('done');
      toast('✔ .ico 文件已开始下载（' + sizes.join('/') + 'PX）');
    }).catch(function (e) {
      console.error(e);
      toast('生成失败，请重试', true);
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = '⬇ 生成并下载 .ico 文件';
    });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
