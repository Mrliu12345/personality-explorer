(function () {
  'use strict';

  var App = {};
  var AppState = { store: null, profileId: null, storageMode: 'indexeddb' };

  /* ========== 存储适配器（浏览器） ========== */
  App.createIndexedDBAdapter = function () {
    var DB_NAME = 'personality-explorer';
    var DB_VER = 1;
    var dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB 打开失败')); };
    });
    function tx(store, mode, fn) {
      return dbPromise.then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(store, mode);
          var s = t.objectStore(store);
          var r = null;
          try { r = fn(s); } catch (e) { reject(e); return; }
          t.oncomplete = function () { resolve(r && r.result !== undefined ? r.result : undefined); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error || new Error('事务中止')); };
        });
      });
    }
    return {
      ready: function () { return dbPromise.then(function () { return undefined; }); },
      getAll: function (store) {
        return tx(store, 'readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; });
      },
      get: function (store, id) {
        return tx(store, 'readonly', function (s) { return s.get(id); }).then(function (r) { return r || null; });
      },
      put: function (store, obj) { return tx(store, 'readwrite', function (s) { return s.put(obj); }); },
      remove: function (store, id) { return tx(store, 'readwrite', function (s) { return s.delete(id); }); },
      clear: function (store) { return tx(store, 'readwrite', function (s) { return s.clear(); }); }
    };
  };

  App.createLocalStorageAdapter = function () {
    function read(store) {
      try { return JSON.parse(localStorage.getItem('pe_' + store) || '[]'); } catch (e) { return []; }
    }
    function write(store, arr) { localStorage.setItem('pe_' + store, JSON.stringify(arr)); }
    return {
      ready: function () { return Promise.resolve(); },
      getAll: function (store) { return Promise.resolve(read(store)); },
      get: function (store, id) {
        var a = read(store);
        var found = null;
        a.some(function (o) { if (o.id === id) { found = o; return true; } return false; });
        return Promise.resolve(found);
      },
      put: function (store, obj) {
        var a = read(store);
        var i = -1;
        a.some(function (o, idx) { if (o.id === obj.id) { i = idx; return true; } return false; });
        if (i >= 0) a[i] = obj; else a.push(obj);
        write(store, a);
        return Promise.resolve(obj);
      },
      remove: function (store, id) { write(store, read(store).filter(function (o) { return o.id !== id; })); return Promise.resolve(); },
      clear: function (store) { write(store, []); return Promise.resolve(); }
    };
  };

  /* ========== 公共 UI ========== */
  App.toast = function (msg) {
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };

  App.confirmModal = function (opts) {
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
        '<h3>' + AppCore.utils.esc(opts.title || '确认') + '</h3>' +
        '<p>' + AppCore.utils.esc(opts.text || '') + '</p>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + AppCore.utils.esc(opts.confirmText || '确认') + '</button>' +
        '</div></div>';
      mask.addEventListener('click', function (e) {
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') { mask.remove(); resolve(true); }
        else if (act === 'cancel') { mask.remove(); resolve(false); }
        else if (e.target === mask) { mask.remove(); resolve(false); }
      });
      document.body.appendChild(mask);
    });
  };

  App.promptModal = function (opts) {
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
        '<h3>' + AppCore.utils.esc(opts.title || '输入') + '</h3>' +
        '<div class="field"><input class="text-input" maxlength="20" placeholder="' + AppCore.utils.esc(opts.placeholder || '') + '"></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" data-act="ok">' + AppCore.utils.esc(opts.okText || '确定') + '</button>' +
        '</div></div>';
      var input = mask.querySelector('input');
      input.focus();
      function submit() {
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        mask.remove();
        resolve(v);
      }
      mask.addEventListener('click', function (e) {
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') submit();
        else if (act === 'cancel') { mask.remove(); resolve(null); }
        else if (e.target === mask) { mask.remove(); resolve(null); }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') { mask.remove(); resolve(null); }
      });
      document.body.appendChild(mask);
    });
  };

  App.go = function (hash) { location.hash = hash; };

  App.selectProfile = function (id) {
    AppState.profileId = id;
    try { localStorage.setItem('pe_lastProfile', String(id)); } catch (e) { /* 忽略 */ }
    location.hash = '#/profile';
  };

  /* ========== 视图注册表（每个视图：html 与 bind） ========== */
  // 视图函数返回 Promise<HTML 字符串>；bind 在渲染后执行
  var VIEWS = {};

  VIEWS.home = {
    html: function () {
      return AppState.store.listProfiles().then(function (profiles) {
        var cards = profiles.map(function (p) {
          return '<div class="card profile-card" data-profile="' + p.id + '" role="button" tabindex="0">' +
            '<div class="avatar">' + AppCore.utils.esc(p.name.charAt(0)) + '</div>' +
            '<div class="info"><div class="name">' + AppCore.utils.esc(p.name) + '</div>' +
            '<div class="meta">创建于 ' + AppCore.utils.formatDate(p.createdAt) + '</div></div>' +
            '<span class="btn btn-ghost">进入</span></div>';
        }).join('');
        var body = profiles.length
          ? '<div class="card-title">选择档案</div><div class="card-sub">点击档案进入，每人独立保存测试记录</div>' + cards
          : '<div class="empty"><div style="font-size:18px;font-weight:700;margin-bottom:6px">欢迎使用人格探索</div>' +
            '<div style="font-size:14px">为每个人创建一个独立档案<br>测试记录互不干扰，刷新关闭都不丢失</div></div>';
        return '<div class="topbar"><div class="title">人格探索</div></div>' +
          '<div class="card" style="background:var(--primary-soft);border:none"><div style="font-size:14px">通过科学的性格测评，了解自己的特质，获得自我认知与个人发展建议。</div></div>' +
          body +
          '<button class="btn btn-primary btn-block btn-lg" id="btn-new-profile" style="margin-top:4px">新建档案</button>' +
          '<p class="privacy-note">数据仅存本机 · 无联网 · 无账号</p>';
      });
    },
    bind: function () {
      var btn = document.getElementById('btn-new-profile');
      if (btn) btn.addEventListener('click', function () {
        App.promptModal({ title: '新建档案', placeholder: '输入一个名字（如：小明）', okText: '创建' }).then(function (name) {
          if (name === null) return;
          AppState.store.createProfile(name).then(function (r) {
            if (!r.ok) { App.toast(r.error); return; }
            App.selectProfile(r.profile.id);
          });
        });
      });
      document.querySelectorAll('[data-profile]').forEach(function (el) {
        var pid = Number(el.getAttribute('data-profile'));
        el.addEventListener('click', function () { App.selectProfile(pid); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') App.selectProfile(pid); });
      });
    }
  };

  VIEWS.profile = {
    html: function () {
      var pid = AppState.profileId;
      if (!pid) { App.go('#/'); return Promise.resolve(''); }
      return AppState.store.getProfile(pid).then(function (p) {
        if (!p) { AppState.profileId = null; App.go('#/'); return ''; }
        return AppCore.buildScaleCards(pid, AppState.store).then(function (cards) {
          return AppCore.buildProfileHomeData(p, AppState.store).then(function (home) {
            var scaleCards = cards.map(function (c) {
              var s = c.scale;
              var tag, action;
              if (c.state === 'draft') {
                tag = '<span class="tag tag-warn">未完成</span>';
                action = '<button class="btn btn-primary" data-nav="quiz" data-scale="' + s.id + '">继续测试</button>';
              } else if (c.state === 'done') {
                tag = '<span class="tag tag-done">已测 ' + c.attemptsCount + ' 次</span>';
                action = '<button class="btn btn-primary" data-nav="scale" data-scale="' + s.id + '">再测一次</button>';
              } else {
                tag = '<span class="tag tag-new">未测</span>';
                action = '<button class="btn btn-primary" data-nav="scale" data-scale="' + s.id + '">开始测试</button>';
              }
              return '<div class="card scale-card"><div class="scale-head"><h3>' + AppCore.utils.esc(s.name) + '</h3>' + tag + '</div>' +
                '<div class="scale-intro">' + AppCore.utils.esc(s.intro) + '</div>' +
                '<div class="scale-meta">' + s.items.length + ' 题 · 约 ' + s.minutes + ' 分钟</div>' +
                '<div class="scale-actions">' + action + '</div></div>';
            }).join('');
            var lastHtml = home.lastReport ? (function () {
              var sc = AppCore.catalog.get(home.lastReport.scaleId);
              return '<div class="card"><div class="card-title">最近报告</div>' +
                '<div class="profile-card" style="padding:0"><div class="info"><div class="name">' + AppCore.utils.esc(sc ? sc.name : home.lastReport.scaleId) + '</div>' +
                '<div class="meta">' + AppCore.utils.formatTime(home.lastReport.completedAt) + ' · 第 ' + home.lastSeq + ' 次</div></div>' +
                '<button class="btn btn-ghost" data-nav="report" data-attempt="' + home.lastReport.id + '">查看</button></div></div>';
            })() : '';
            return '<div class="topbar"><button class="btn btn-ghost" id="btn-back-home">档案</button>' +
              '<div class="title">' + AppCore.utils.esc(p.name) + '</div>' +
              '<div class="topbar-actions"><button class="btn btn-ghost" id="btn-settings">设置</button></div></div>' +
              '<div class="card"><div class="card-title">测试中心</div><div class="card-sub">选择一项测评，开始了解自己</div>' + scaleCards + '</div>' +
              lastHtml +
              '<button class="btn btn-block btn-ghost" id="btn-history">查看全部历史</button>' +
              '<div class="card"><div class="card-title">档案管理</div><div class="scale-actions">' +
              '<button class="btn btn-ghost" id="btn-rename">重命名</button>' +
              '<button class="btn btn-danger" id="btn-delete">删除档案</button>' +
              '</div></div>' +
              '<p class="privacy-note">所有数据仅保存在这台电脑的浏览器中</p>';
          });
        });
      });
    },
    bind: function () {
      var pid = AppState.profileId;
      var btnBack = document.getElementById('btn-back-home');
      if (btnBack) btnBack.addEventListener('click', function () { location.hash = '#/'; });
      var btnSettings = document.getElementById('btn-settings');
      if (btnSettings) btnSettings.addEventListener('click', function () { location.hash = '#/settings'; });
      var btnHistory = document.getElementById('btn-history');
      if (btnHistory) btnHistory.addEventListener('click', function () { location.hash = '#/history'; });
      document.querySelectorAll('[data-nav]').forEach(function (el) {
        el.addEventListener('click', function () {
          var nav = el.getAttribute('data-nav');
          var scale = el.getAttribute('data-scale');
          var attempt = el.getAttribute('data-attempt');
          if (nav === 'scale' && scale) App.go('#/scale/' + scale);
          else if (nav === 'quiz' && scale) App.go('#/quiz/' + scale);
          else if (nav === 'report' && attempt) App.go('#/report/' + attempt);
        });
      });
      var btnRename = document.getElementById('btn-rename');
      if (btnRename) btnRename.addEventListener('click', function () {
        App.promptModal({ title: '重命名档案', placeholder: '输入新名字', okText: '保存' }).then(function (name) {
          if (name === null) return;
          AppState.store.renameProfile(pid, name).then(function (r) {
            if (!r.ok) { App.toast(r.error); return; }
            App.toast('已重命名');
            App.render();
          });
        });
      });
      var btnDelete = document.getElementById('btn-delete');
      if (btnDelete) btnDelete.addEventListener('click', function () {
        AppState.store.countAttemptsOfProfile(pid).then(function (n) {
          return App.confirmModal({
            title: '删除档案',
            text: '将删除「' + (document.querySelector('.topbar .title') || {}).textContent + '」及其全部 ' + n + ' 份测试记录，此操作不可恢复。',
            confirmText: '确认删除',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            return AppState.store.deleteProfile(pid).then(function () {
              AppState.profileId = null;
              try { localStorage.removeItem('pe_lastProfile'); } catch (e) { /* 忽略 */ }
              location.hash = '#/';
              App.toast('档案已删除');
            });
          });
        });
      });
    }
  };
  VIEWS.scale = {
    html: function (route) {
      var scale = AppCore.catalog.get(route.params.scaleId);
      var pid = AppState.profileId;
      if (!scale || !pid) { App.go('#/profile'); return Promise.resolve(''); }
      return AppState.store.getProfile(pid).then(function (p) {
        if (!p) { AppState.profileId = null; App.go('#/'); return ''; }
        return AppState.store.findDraft(pid, scale.id).then(function (draft) {
          return AppCore.buildScaleCards(pid, AppState.store).then(function (cards) {
            var card = cards.find(function (c) { return c.scale.id === scale.id; });
            var last = card && card.lastCompleted;
            var lastHtml = '';
            if (last) {
              lastHtml = '<div class="card"><div class="card-title">上次测试</div>' +
                '<div class="profile-card" style="padding:0"><div class="info"><div class="meta">' + AppCore.utils.formatTime(last.completedAt) + ' · 第 ' + card.attemptsCount + ' 次</div></div>' +
                '<button class="btn btn-ghost" data-nav="report" data-attempt="' + last.id + '">查看上次报告</button></div></div>';
            }
            var draftTip = draft ? '<div class="card-sub">你有一份未完成的测试，将从上次停下的地方继续。</div>' : '';
            return '<div class="topbar"><button class="btn btn-ghost" id="btn-scale-back">返回</button><div class="title">' + AppCore.utils.esc(scale.name) + '</div><div class="topbar-actions"></div></div>' +
              '<div class="card"><h2 style="margin:0 0 8px">' + AppCore.utils.esc(scale.name) + '</h2>' +
              '<div class="scale-intro">' + AppCore.utils.esc(scale.intro) + '</div>' +
              '<div class="scale-meta">' + scale.items.length + ' 题 · 约 ' + scale.minutes + ' 分钟 · 5 点同意度量表</div>' +
              draftTip +
              '<button class="btn btn-primary btn-lg btn-block" id="btn-start">' + (draft ? '继续上次测试' : '开始测试') + '</button></div>' +
              lastHtml +
              '<p class="privacy-note">测试结果仅用于自我了解参考，不构成心理诊断</p>';
          });
        });
      });
    },
    bind: function (route) {
      var btnBack = document.getElementById('btn-scale-back');
      if (btnBack) btnBack.addEventListener('click', function () { App.go('#/profile'); });
      var btnStart = document.getElementById('btn-start');
      if (btnStart) btnStart.addEventListener('click', function () { App.go('#/quiz/' + route.params.scaleId); });
      document.querySelectorAll('[data-nav="report"]').forEach(function (el) {
        el.addEventListener('click', function () {
          App.go('#/report/' + el.getAttribute('data-attempt'));
        });
      });
    }
  };

  function quizBodyHtml(scale, st) {
    var item = scale.items[st.index];
    var labels = { 1: '非常不同意', 2: '不同意', 3: '中立', 4: '同意', 5: '非常同意' };
    var opts = [1, 2, 3, 4, 5].map(function (v) {
      var sel = st.currentValue === v ? ' selected' : '';
      return '<button class="option' + sel + '" data-val="' + v + '"><span style="font-weight:800;margin-right:8px;display:inline-block;min-width:20px">' + v + '</span>' + labels[v] + '</button>';
    }).join('');
    var pct = st.total ? Math.round((st.answeredCount / st.total) * 100) : 0;
    var dim = scale.dimensions.filter(function (d) { return d.id === item.d; })[0];
    var dimName = dim ? dim.name : '';
    var isLast = st.index === st.total - 1;
    var nextBtn = isLast
      ? '<button class="btn btn-primary" id="btn-finish"' + (st.isAnswered ? '' : ' disabled') + '>完成并查看结果</button>'
      : '<button class="btn btn-primary" id="btn-next"' + (st.isAnswered ? '' : ' disabled') + '>下一题</button>';
    var prevBtn = '<button class="btn btn-ghost" id="btn-prev"' + (st.index > 0 ? '' : ' disabled') + '>上一题</button>';
    return '<div class="quiz-wrap">' +
      '<div class="quiz-progress-text">已完成 ' + st.answeredCount + '/' + st.total + ' 题（' + pct + '%）</div>' +
      '<div class="progress"><span style="width:' + pct + '%"></span></div>' +
      '<div class="quiz-dim-label">' + AppCore.utils.esc(dimName) + ' · 第 ' + (st.index + 1) + ' 题</div>' +
      '<div class="quiz-question">' + AppCore.utils.esc(item.text) + '</div>' +
      opts +
      '<div class="quiz-nav">' + prevBtn + nextBtn + '</div></div>';
  }

  function bindQuizBody(ctx) {
    var opts = document.querySelectorAll('#quiz-body .option');
    opts.forEach(function (el) {
      el.addEventListener('click', function () {
        var v = Number(el.getAttribute('data-val'));
        AppState.store.saveAnswer(ctx.attemptId, ctx.index, v).then(function (r) {
          if (!r.ok) { App.toast(r.error); return; }
          renderQuizBody();
        });
      });
    });
    var prev = document.getElementById('btn-prev');
    if (prev) prev.addEventListener('click', function () {
      if (ctx.index > 0) { ctx.index -= 1; renderQuizBody(); }
    });
    var next = document.getElementById('btn-next');
    if (next) next.addEventListener('click', function () {
      if (ctx.index < ctx.total - 1) { ctx.index += 1; renderQuizBody(); }
    });
    var fin = document.getElementById('btn-finish');
    if (fin) fin.addEventListener('click', function () {
      AppState.store.getAttempt(ctx.attemptId).then(function (a) {
        var scale = AppCore.catalog.get(a.scaleId);
        var st = AppCore.quizState(a, scale);
        if (!st.allAnswered) { App.toast('还有题目未作答'); return; }
        var result = AppCore.computeScores(scale, a.answers);
        result.answeredCount = a.answers.length;
        AppState.store.completeAttempt(a.id, result).then(function (r) {
          if (!r.ok) { App.toast(r.error); return; }
          AppState.quizCtx = null;
          App.go('#/report/' + a.id);
        });
      });
    });
  }

  function renderQuizBody() {
    var ctx = AppState.quizCtx;
    if (!ctx) return;
    var scale = AppCore.catalog.get(ctx.scaleId);
    AppState.store.getAttempt(ctx.attemptId).then(function (a) {
      var st = AppCore.quizState(a, scale);
      ctx.index = st.index;
      ctx.total = st.total;
      var body = document.getElementById('quiz-body');
      if (body) {
        body.innerHTML = quizBodyHtml(scale, st);
        bindQuizBody(ctx);
      }
    });
  }

  VIEWS.quiz = {
    html: function (route) {
      var scale = AppCore.catalog.get(route.params.scaleId);
      var pid = AppState.profileId;
      if (!scale || !pid) { App.go('#/profile'); return Promise.resolve(''); }
      return AppState.store.findDraft(pid, scale.id).then(function (d) {
        if (d) return d;
        return AppState.store.createAttempt(pid, scale.id).then(function (r) {
          if (!r.ok) { App.go('#/profile'); return null; }
          return r.attempt;
        });
      }).then(function (a) {
        if (!a) return '';
        var st = AppCore.quizState(a, scale);
        AppState.quizCtx = { attemptId: a.id, scaleId: scale.id, index: st.index, total: st.total };
        return '<div class="topbar"><button class="btn btn-ghost" id="btn-quiz-back">退出</button>' +
          '<div class="title">' + AppCore.utils.esc(scale.name) + '</div>' +
          '<div class="topbar-actions"><span class="tag">' + (st.index + 1) + '/' + st.total + '</span></div></div>' +
          '<div id="quiz-body">' + quizBodyHtml(scale, st) + '</div>' +
          '<p class="privacy-note">作答即时保存，可随时退出，下次继续</p>';
      });
    },
    bind: function () {
      var btnBack = document.getElementById('btn-quiz-back');
      if (btnBack) btnBack.addEventListener('click', function () { AppState.quizCtx = null; App.go('#/profile'); });
      bindQuizBody(AppState.quizCtx);
    }
  };
  // 雷达图（Canvas 自绘，支持多系列用于对比）
  App.drawRadar = function (canvas, series, labels) {
    var n = labels.length;
    if (n < 3 || series.length === 0) return;
    var dpr = window.devicePixelRatio || 1;
    var size = Math.min(canvas.width, 380);
    var cx = size / 2, cy = size / 2, R = size * 0.34;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    function pt(i, r) {
      var ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    }
    // 网格（25/50/75/100）
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var p = pt(i % n, R * f);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = '#e4e0d8';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    // 轴线
    for (var i = 0; i < n; i++) {
      var p = pt(i, R);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = '#e4e0d8';
      ctx.stroke();
    }
    // 数据系列
    series.forEach(function (s) {
      ctx.beginPath();
      var pts = [];
      for (var i = 0; i < n; i++) {
        var v = Math.max(0, Math.min(100, s.data[i]));
        var p = pt(i, R * v / 100);
        pts.push(p);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = s.fill || 'rgba(95,143,122,.25)';
      ctx.fill();
      ctx.strokeStyle = s.color || '#5f8f7a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 顶点标记
      if (series.length > 1) {
        ctx.fillStyle = s.color;
        pts.forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
    // 维度标签
    ctx.fillStyle = '#33302b';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach(function (l, i) {
      var p = pt(i, R * 1.2);
      ctx.fillText(l.name, p[0], p[1]);
    });
    // 单系列时标注数值
    if (series.length === 1) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#4a7462';
      series[0].data.forEach(function (v, i) {
        var p = pt(i, R * 0.78);
        ctx.fillText(v, p[0], p[1]);
      });
    }
  };

  // ===== 导出工具 =====
  App.downloadBlob = function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  };

  // 报告导出 PNG：绘制简化报告图（标题 + 雷达图/得分条 + 维度得分 + 免责）
  App.exportReportPng = function (attempt, scale, data, profileName) {
    var W = 640;
    var H = scale.scaleType === 'multi' ? 860 : 720;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f4ef';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#33302b';
    ctx.font = 'bold 26px "Microsoft YaHei",sans-serif';
    ctx.fillText(scale.name + '人格报告', W / 2, 56);
    ctx.font = '14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#8a857d';
    ctx.fillText(profileName + ' · ' + AppCore.utils.formatTime(attempt.completedAt), W / 2, 84);
    if (scale.scaleType === 'multi') {
      var rc = document.createElement('canvas');
      rc.width = 380; rc.height = 380;
      App.drawRadar(rc, [{ data: data.radarData.map(function (d) { return d.value; }), color: '#5f8f7a', fill: 'rgba(95,143,122,.25)' }], data.radarData);
      ctx.drawImage(rc, (W - 380) / 2, 110, 380, 380);
    } else {
      ctx.textAlign = 'left';
      var y = 150;
      data.dims.forEach(function (d) {
        ctx.font = '600 16px "Microsoft YaHei",sans-serif';
        ctx.fillStyle = '#33302b';
        ctx.fillText(d.name, 90, y);
        ctx.fillStyle = '#eeeae1';
        ctx.fillRect(200, y - 12, 340, 14);
        ctx.fillStyle = '#5f8f7a';
        ctx.fillRect(200, y - 12, 340 * d.pct / 100, 14);
        ctx.font = '700 16px "Microsoft YaHei",sans-serif';
        ctx.fillStyle = '#4a7462';
        ctx.textAlign = 'right';
        ctx.fillText(d.pct + ' 分', 560, y);
        ctx.textAlign = 'left';
        y += 48;
      });
    }
    // 维度得分表（multi 时补列）
    if (scale.scaleType === 'multi') {
      ctx.textAlign = 'left';
      var yy = 540;
      ctx.font = '600 16px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#33302b';
      data.dims.forEach(function (d) {
        ctx.fillText(d.name + '：' + d.pct + ' 分', 90, yy);
        yy += 30;
      });
      ctx.font = '13px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#8a857d';
      ctx.fillText('人格探索 · 数据仅存本机 · 仅用于自我了解参考，不构成心理诊断', W / 2, H - 24);
    } else {
      ctx.textAlign = 'center';
      ctx.font = '13px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#8a857d';
      ctx.fillText('人格探索 · 数据仅存本机 · 仅用于自我了解参考，不构成心理诊断', W / 2, H - 24);
    }
    var url = c.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = scale.name + '-报告-' + AppCore.utils.formatDate(attempt.completedAt) + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 400);
    return Promise.resolve(true);
  };

  // 报告导出独立 HTML
  App.exportReportHtml = function (attempt, scale, data, profileName, seq) {
    var html = AppCore.buildHtmlReport({
      scale: scale,
      data: data,
      profileName: profileName,
      timeText: AppCore.utils.formatTime(attempt.completedAt),
      seqText: '第 ' + seq + ' 次测试'
    });
    App.downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), scale.name + '-报告-' + AppCore.utils.formatDate(attempt.completedAt) + '.html');
    return Promise.resolve(true);
  };

  VIEWS.report = {
    html: function (route) {
      var aid = route.params.attemptId;
      if (!aid || !AppState.store) { App.go('#/profile'); return Promise.resolve(''); }
      return AppState.store.getAttempt(aid).then(function (a) {
        if (!a || !a.result) { App.go('#/profile'); return ''; }
        var scale = AppCore.catalog.get(a.scaleId);
        if (!scale) { App.go('#/profile'); return ''; }
        var data = AppCore.buildReportData(scale, a.result);
        return Promise.all([
          AppState.store.getProfile(a.profileId),
          AppCore.attemptSeq(AppState.store, a)
        ]).then(function (r) {
          var p = r[0], seq = r[1];
          var radarHtml = scale.scaleType === 'multi'
            ? '<div class="radar-wrap"><canvas id="radar" width="380" height="380"></canvas></div>' : '';
          var dimHtml = data.dims.map(function (d) {
            return '<div class="dim-card"><div class="dim-head"><span class="dim-name">' + AppCore.utils.esc(d.name) + '</span>' +
              '<span class="dim-score">' + d.pct + ' 分</span></div>' +
              '<div class="dim-bar"><span style="width:' + d.pct + '%"></span></div>' +
              '<div class="dim-desc">' + AppCore.utils.esc(d.text) + '</div>' +
              (d.advice.length ? '<ul class="advice-list">' + d.advice.map(function (x) { return '<li>' + AppCore.utils.esc(x) + '</li>'; }).join('') + '</ul>' : '') +
              '</div>';
          }).join('');
          return '<div class="topbar"><button class="btn btn-ghost" id="btn-report-back">返回</button>' +
            '<div class="title">' + AppCore.utils.esc(scale.name) + '报告</div><div class="topbar-actions"></div></div>' +
            '<div class="report-head"><h2>' + AppCore.utils.esc(scale.name) + '</h2>' +
            '<div class="meta">' + AppCore.utils.esc(p ? p.name : '') + ' · ' + AppCore.utils.formatTime(a.completedAt) + ' · 第 ' + seq + ' 次测试</div></div>' +
            radarHtml +
            dimHtml +
            '<div class="card"><div class="card-title">综合小结</div><div class="summary-box">' + AppCore.utils.esc(data.summary) + '</div></div>' +
            '<div class="card"><div class="card-title">操作</div><div class="scale-actions">' +
            '<button class="btn btn-primary" data-nav="scale" data-scale="' + scale.id + '">再测一次</button>' +
            '<button class="btn btn-ghost" id="btn-export-png">导出 PNG</button>' +
            '<button class="btn btn-ghost" id="btn-export-html">导出 HTML</button>' +
            '<button class="btn btn-ghost" id="btn-report-home">返回档案</button></div></div>' +
            '<p class="privacy-note">本报告基于你的作答生成，仅用于自我了解参考，不构成心理诊断</p>';
        });
      });
    },
    bind: function (route) {
      var aid = route.params.attemptId;
      var canvas = document.getElementById('radar');
      if (canvas && aid) {
        AppState.store.getAttempt(aid).then(function (a) {
          if (!a || !a.result) return;
          var scale = AppCore.catalog.get(a.scaleId);
          var data = AppCore.buildReportData(scale, a.result);
          App.drawRadar(canvas, [{ data: data.radarData.map(function (d) { return d.value; }), color: '#5f8f7a', fill: 'rgba(95,143,122,.25)' }], data.radarData);
        });
      }
      var btnBack = document.getElementById('btn-report-back');
      if (btnBack) btnBack.addEventListener('click', function () { App.go('#/profile'); });
      var btnHome = document.getElementById('btn-report-home');
      if (btnHome) btnHome.addEventListener('click', function () { App.go('#/profile'); });
      var btnPng = document.getElementById('btn-export-png');
      var btnHtml = document.getElementById('btn-export-html');
      if (btnPng || btnHtml) {
        AppState.store.getAttempt(aid).then(function (a) {
          if (!a || !a.result) return;
          var scale = AppCore.catalog.get(a.scaleId);
          var data = AppCore.buildReportData(scale, a.result);
          return Promise.all([AppState.store.getProfile(a.profileId), AppCore.attemptSeq(AppState.store, a)]).then(function (r) {
            var pname = r[0] ? r[0].name : '', seq = r[1];
            if (btnPng) btnPng.addEventListener('click', function () {
              App.exportReportPng(a, scale, data, pname).then(function () { App.toast('已导出 PNG 图片'); });
            });
            if (btnHtml) btnHtml.addEventListener('click', function () {
              App.exportReportHtml(a, scale, data, pname, seq).then(function () { App.toast('已导出 HTML 报告'); });
            });
          });
        });
      }
      document.querySelectorAll('[data-nav="scale"]').forEach(function (el) {
        el.addEventListener('click', function () {
          App.go('#/scale/' + el.getAttribute('data-scale'));
        });
      });
    }
  };
  function renderCompare(comp) {
    var html = '<div class="card"><div class="card-title">对比 · ' + AppCore.utils.esc(comp.scale.name) + '</div>';
    var multi = comp.dims.length >= 3;
    if (multi) html += '<div class="radar-wrap"><canvas id="cmp-radar" width="380" height="380"></canvas></div>';
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin:8px 0">' + comp.series.map(function (s) {
      return '<span style="font-size:13px;display:inline-flex;align-items:center"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:' + s.color + ';margin-right:5px"></span>' + AppCore.utils.esc(s.label) + '</span>';
    }).join('') + '</div>';
    if (!multi) {
      comp.series.forEach(function (s) {
        html += '<div class="card-sub" style="margin-top:10px">' + AppCore.utils.esc(s.label) + '：' + s.data[0] + ' 分</div>' +
          '<div class="dim-bar"><span style="width:' + s.data[0] + '%;background:' + s.color + '"></span></div>';
      });
    }
    if (comp.deltas.length) {
      html += '<div class="card-sub" style="margin-top:10px">与上一次相比（最新 − 上次）：</div>';
      comp.deltas.forEach(function (d) {
        var cls = d.dir === 'up' ? 'delta-up' : (d.dir === 'down' ? 'delta-down' : 'delta-flat');
        var mark = d.dir === 'up' ? '↑ ' + d.diff : (d.dir === 'down' ? '↓ ' + Math.abs(d.diff) : '— 持平');
        html += '<div class="profile-card" style="padding:7px 0;border-bottom:1px solid var(--line)"><div class="info"><span style="font-weight:600;font-size:14px">' + AppCore.utils.esc(d.name) + '</span></div>' +
          '<div class="meta">' + d.value + ' 分 <span class="' + cls + '">' + mark + '</span></div></div>';
      });
    }
    html += '</div>';
    var area = document.getElementById('compare-area');
    if (area) area.innerHTML = html;
    if (multi) {
      var c = document.getElementById('cmp-radar');
      if (c) App.drawRadar(c, comp.series.map(function (s) {
        return { data: s.data, color: s.color, fill: 'rgba(0,0,0,0)' };
      }), comp.dims.map(function (n) { return { name: n }; }));
    }
  }

  VIEWS.history = {
    html: function () {
      var pid = AppState.profileId;
      if (!pid) { App.go('#/'); return Promise.resolve(''); }
      return AppCore.historyListData(pid, AppState.store).then(function (rows) {
        if (!rows.length) {
          return '<div class="topbar"><button class="btn btn-ghost" id="btn-history-back">返回</button><div class="title">历史记录</div><div class="topbar-actions"></div></div>' +
            '<div class="empty">还没有测试记录<br>完成一次测试后，历史会显示在这里</div>';
        }
        var items = rows.map(function (r) {
          return '<div class="card history-item">' +
            '<label style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer">' +
            '<input type="checkbox" class="cmp-cb" data-attempt="' + r.attempt.id + '" data-scale="' + r.attempt.scaleId + '">' +
            '<div class="info" style="min-width:0"><div class="name">' + AppCore.utils.esc(r.scale ? r.scale.name : r.attempt.scaleId) + '</div>' +
            '<div class="meta">' + AppCore.utils.formatTime(r.attempt.completedAt) + ' · 第 ' + r.seq + ' 次</div></div></label>' +
            '<button class="btn btn-ghost" data-nav="report" data-attempt="' + r.attempt.id + '">查看</button></div>';
        }).join('');
        return '<div class="topbar"><button class="btn btn-ghost" id="btn-history-back">返回</button><div class="title">历史记录</div><div class="topbar-actions"></div></div>' +
          '<div class="card"><div class="card-title">全部历史</div><div class="card-sub">勾选 2 份或以上同一量表的报告，可对比变化</div>' +
          items + '</div>' +
          '<button class="btn btn-primary btn-block" id="btn-compare" disabled>对比所选</button>' +
          '<div id="compare-area"></div>' +
          '<p class="privacy-note">所有数据仅保存在这台电脑的浏览器中</p>';
      });
    },
    bind: function () {
      var btnBack = document.getElementById('btn-history-back');
      if (btnBack) btnBack.addEventListener('click', function () { App.go('#/profile'); });
      document.querySelectorAll('[data-nav="report"]').forEach(function (el) {
        el.addEventListener('click', function () {
          App.go('#/report/' + el.getAttribute('data-attempt'));
        });
      });
      var cmpBtn = document.getElementById('btn-compare');
      var selection = {};
      function refreshCompareBtn() {
        if (!cmpBtn) return;
        var ids = Object.keys(selection);
        var scales = {};
        ids.forEach(function (id) { scales[selection[id]] = true; });
        var ok = ids.length >= 2 && Object.keys(scales).length === 1;
        cmpBtn.disabled = !ok;
      }
      document.querySelectorAll('.cmp-cb').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var id = Number(cb.getAttribute('data-attempt'));
          var scale = cb.getAttribute('data-scale');
          if (cb.checked) selection[id] = scale; else delete selection[id];
          refreshCompareBtn();
        });
      });
      if (cmpBtn) cmpBtn.addEventListener('click', function () {
        var ids = Object.keys(selection).map(Number);
        if (ids.length < 2) { App.toast('请至少勾选 2 份报告'); return; }
        var scales = {};
        ids.forEach(function (id) { scales[selection[id]] = true; });
        if (Object.keys(scales).length !== 1) { App.toast('请选择同一量表的报告进行对比'); return; }
        AppState.store.getAttempt(ids[0]).then(function (firstA) {
          var scaleId = firstA.scaleId;
          var tasks = ids.map(function (id) { return AppState.store.getAttempt(id); });
          return Promise.all(tasks).then(function (attempts) {
            attempts = attempts.filter(function (a) { return a && a.scaleId === scaleId && a.status === 'completed'; });
            if (attempts.length < 2) { App.toast('所选报告不完整'); return; }
            return AppCore.buildCompareData(attempts, AppState.store).then(function (comp) {
              renderCompare(comp);
              var area = document.getElementById('compare-area');
              if (area) area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          });
        });
      });
    }
  };
  VIEWS.settings = {
    html: function () {
      var pid = AppState.profileId;
      var namePromise = pid ? AppState.store.getProfile(pid).then(function (p) { return p ? p.name : ''; }) : Promise.resolve('');
      return namePromise.then(function (pname) {
        return '<div class="topbar"><button class="btn btn-ghost" id="btn-settings-back">返回</button><div class="title">设置</div><div class="topbar-actions"></div></div>' +
          '<div class="card"><div class="card-title">隐私说明</div>' +
          '<div style="font-size:14px">所有测试数据（档案、作答、报告）只保存在<b>这台电脑的浏览器</b>中：不联网、不上传、无账号、无追踪。关闭浏览器或重启电脑，数据仍然保留。删除档案或清除数据后不可恢复，操作前请确认。</div></div>' +
          '<div class="card"><div class="card-title">数据管理</div><div class="card-sub">当前档案：' + AppCore.utils.esc(pname || '（无）') + '</div><div class="scale-actions">' +
          '<button class="btn btn-primary" id="btn-export-all">导出全部数据（JSON）</button>' +
          '<button class="btn btn-danger" id="btn-delete-profile">删除当前档案</button>' +
          '<button class="btn btn-danger" id="btn-clear-all">清除全部数据</button>' +
          '</div></div>' +
          '<div class="card"><div class="card-title">关于</div><div style="font-size:14px">' +
          '<p style="margin:4px 0">版本：1.0（本地单文件应用）</p>' +
          '<p style="margin:4px 0">量表来源：大五人格采用 IPIP（国际人格项目库）公共条目；心理韧性参考 Brief Resilience Scale（BRS，Smith et al., 2008）公开条目；核心自我评价参考 Core Self-Evaluations Scale（CSES，Judge et al., 2003）公开条目，均为中文化表述。</p>' +
          '<p style="margin:4px 0">结果仅用于自我了解与个人发展参考，不构成心理诊断。</p></div></div>';
      });
    },
    bind: function () {
      var btnBack = document.getElementById('btn-settings-back');
      if (btnBack) btnBack.addEventListener('click', function () { App.go('#/profile'); });
      var btnExport = document.getElementById('btn-export-all');
      if (btnExport) btnExport.addEventListener('click', function () {
        AppState.store.exportAll().then(function (data) {
          App.downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), '人格探索-全部数据备份-' + AppCore.utils.formatDate(AppCore.utils.now()) + '.json');
          App.toast('已导出全部数据备份');
        });
      });
      var btnDelProfile = document.getElementById('btn-delete-profile');
      if (btnDelProfile) btnDelProfile.addEventListener('click', function () {
        var pid = AppState.profileId;
        if (!pid) { App.toast('当前没有档案'); return; }
        AppState.store.getProfile(pid).then(function (p) {
          return AppState.store.countAttemptsOfProfile(pid).then(function (n) {
            return App.confirmModal({
              title: '删除当前档案',
              text: '将删除档案「' + (p ? p.name : '') + '」及其全部 ' + n + ' 份测试记录，此操作不可恢复。',
              confirmText: '确认删除',
              danger: true
            }).then(function (ok) {
              if (!ok) return;
              return AppState.store.deleteProfile(pid).then(function () {
                AppState.profileId = null;
                try { localStorage.removeItem('pe_lastProfile'); } catch (e) { /* 忽略 */ }
                location.hash = '#/';
                App.toast('档案已删除');
              });
            });
          });
        });
      });
      var btnClear = document.getElementById('btn-clear-all');
      if (btnClear) btnClear.addEventListener('click', function () {
        App.confirmModal({
          title: '清除全部数据',
          text: '将删除本机保存的所有档案与测试记录，此操作不可恢复。建议先导出备份。',
          confirmText: '确认清除',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          AppState.store.clearAll().then(function () {
            AppState.profileId = null;
            try { localStorage.removeItem('pe_lastProfile'); } catch (e) { /* 忽略 */ }
            location.hash = '#/';
            App.toast('已清除全部数据');
          });
        });
      });
    }
  };
  VIEWS.test = {
    html: function () { return Promise.resolve('<div class="empty">自测模式（开发中）</div>'); },
    bind: function () {}
  };

  /* ========== 路由渲染 ========== */
  App.render = function () {
    var route = AppCore.router.parse(location.hash);
    var v = VIEWS[route.name] || VIEWS.home;
    return Promise.resolve(v.html(route)).then(function (html) {
      var app = document.getElementById('app');
      if (app) app.innerHTML = html;
      window.scrollTo(0, 0);
      try { v.bind(route); } catch (e) { /* 绑定失败不阻断展示 */ }
    });
  };

  /* ========== 初始化 ========== */
  App.init = function () {
    function bootWith(adapter, mode) {
      var store = AppCore.createStore(adapter);
      return store.ready().then(function () {
        AppState.store = store;
        AppState.storageMode = mode;
        // 恢复上次使用的档案
        try { AppState.profileId = Number(localStorage.getItem('pe_lastProfile')) || null; } catch (e) { AppState.profileId = null; }
        if (AppState.profileId) {
          return store.getProfile(AppState.profileId).then(function (p) {
            if (!p) AppState.profileId = null;
          });
        }
        return null;
      });
    }
    var idb = null;
    if (window.indexedDB) {
      try { idb = App.createIndexedDBAdapter(); } catch (e) { idb = null; }
    }
    var boot = idb ? bootWith(idb, 'indexeddb').catch(function () {
      return bootWith(App.createLocalStorageAdapter(), 'localStorage');
    }) : bootWith(App.createLocalStorageAdapter(), 'localStorage');

    return boot.then(function () {
      window.addEventListener('hashchange', App.render);
      if (!location.hash) location.hash = '#/';
      App.render();
      return { store: AppState.store, storageMode: AppState.storageMode };
    });
  };

  window.App = App;
  window.AppState = AppState;

  // 启动应用
  App.init();
})();
