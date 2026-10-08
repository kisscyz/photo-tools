/* 全站隐私保护：照片仅保存在浏览器内存中，不上传、不保存、不记历史；
   用户下载后 24 小时内自动彻底删除本地照片数据。 */
(function () {
  'use strict';
  var urls = [];
  var timers = [];

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show';
    setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  function purge(silent) {
    urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    urls = [];
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
    var imgs = document.querySelectorAll('img[data-private]');
    for (var i = 0; i < imgs.length; i++) imgs[i].removeAttribute('src');
    if (!silent) toast('🔒 已按隐私承诺自动清除本地照片数据');
  }

  window.PhotoPrivacy = {
    // 登记本次会话产生的本地照片 URL
    track: function (url) { if (url) urls.push(url); },
    // 用户下载成功后调用：24 小时后自动彻底删除
    scheduleAutoDelete: function () {
      timers.forEach(function (t) { clearTimeout(t); });
      timers = [];
      timers.push(setTimeout(function () { purge(false); }, 24 * 3600 * 1000));
    },
    purge: purge
  };

  // 关闭 / 刷新页面时立即释放
  window.addEventListener('beforeunload', function () { purge(true); });
})();
