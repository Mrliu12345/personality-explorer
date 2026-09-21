(function (global) {
  'use strict';
  var AppCore = {};

  /* ========== 工具 ========== */
  AppCore.utils = {
    clone: function (o) { return JSON.parse(JSON.stringify(o)); },
    now: function () { return Date.now(); },
    pad: function (n) { return n < 10 ? '0' + n : '' + n; },
    formatTime: function (ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + AppCore.utils.pad(d.getMonth() + 1) + '-' + AppCore.utils.pad(d.getDate()) +
        ' ' + AppCore.utils.pad(d.getHours()) + ':' + AppCore.utils.pad(d.getMinutes());
    },
    formatDate: function (ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + AppCore.utils.pad(d.getMonth() + 1) + '-' + AppCore.utils.pad(d.getDate());
    },
    // 简单防 XSS：转义文本（渲染用户输入的档案名等）
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };

  /* ========== 题库目录 ========== */
  AppCore.catalog = {
    list: function () {
      var data = global.AppData || {};
      return [data.bigFive, data.resilience, data.cse].filter(Boolean);
    },
    get: function (scaleId) {
      return (global.AppData || {})[scaleId] || null;
    },
    // 题库完整性校验：返回 {ok, errors[]}
    validate: function () {
      var errors = [];
      var scales = AppCore.catalog.list();
      if (scales.length !== 3) errors.push('应包含 3 个量表，实际 ' + scales.length);
      scales.forEach(function (s) {
        if (!s.id || !s.name || !s.intro) errors.push(s.id + ': 缺少元信息');
        if (!s.items || s.items.length === 0) errors.push(s.id + ': 无题目');
        s.items.forEach(function (it, i) {
          if (!it.d) errors.push(s.id + ' 第' + (i + 1) + '题缺少维度');
          if (!it.text) errors.push(s.id + ' 第' + (i + 1) + '题缺少题干');
          if (typeof it.r !== 'boolean') errors.push(s.id + ' 第' + (i + 1) + '题缺少反向标记');
          if (!s.dimensions.some(function (d) { return d.id === it.d; })) {
            errors.push(s.id + ' 第' + (i + 1) + '题维度非法: ' + it.d);
          }
        });
        s.dimensions.forEach(function (d) {
          var n = s.items.filter(function (it) { return it.d === d.id; }).length;
          if (n === 0) errors.push(s.id + ' 维度 ' + d.id + ' 无题目');
        });
        Object.keys(s.interpretation || {}).forEach(function (d) {
          var itp = s.interpretation[d];
          if (!itp.high || !itp.mid || !itp.low) errors.push(s.id + ' 维度 ' + d + ' 解读缺档位');
        });
        Object.keys(s.advice || {}).forEach(function (d) {
          var adv = s.advice[d];
          if (!adv.high || !adv.low || adv.high.length === 0 || adv.low.length === 0) {
            errors.push(s.id + ' 维度 ' + d + ' 建议缺失');
          }
        });
      });
      return { ok: errors.length === 0, errors: errors };
    }
  };

  /* ========== 路由解析（hash） ========== */
  // 支持：#/ 首页(档案选择)  #/profile 档案首页  #/scale/:scaleId 量表介绍
  //       #/quiz/:scaleId 答题  #/report/:attemptId 报告  #/history 历史  #/settings 设置  #/test 自测
  AppCore.router = {
    parse: function (hash) {
      var h = (hash || '').replace(/^#/, '');
      if (!h || h === '/') return { name: 'home' };
      var parts = h.split('/').filter(Boolean);
      if (parts.length === 0) return { name: 'home' };
      var name = parts[0];
      var known = ['home', 'profile', 'scale', 'quiz', 'report', 'history', 'settings', 'test'];
      if (known.indexOf(name) === -1) return { name: 'home' };
      var params = {};
      if (name === 'scale' && parts[1]) params.scaleId = parts[1];
      if (name === 'quiz' && parts[1]) params.scaleId = parts[1];
      if (name === 'report' && parts[1]) params.attemptId = Number(parts[1]);
      return { name: name, params: params };
    }
  };

  /* ========== 存储层（异步 adapter，Promise 风格） ========== */
  // adapter 接口（全部返回 Promise）：
  //   ready(), getAll(store), get(store,id), put(store,obj), remove(store,id), clear(store)
  AppCore.createMemoryAdapter = function () {
    var mem = {};
    return {
      ready: function () { return Promise.resolve(); },
      getAll: function (store) { return Promise.resolve(Array.from((mem[store] || []).values())); },
      get: function (store, id) {
        var arr = mem[store] || [];
        var found = null;
        arr.some(function (o) { if (o.id === id) { found = o; return true; } return false; });
        return Promise.resolve(found);
      },
      put: function (store, obj) {
        if (!mem[store]) mem[store] = [];
        var arr = mem[store];
        var i = -1;
        arr.some(function (o, idx) { if (o.id === obj.id) { i = idx; return true; } return false; });
        if (i >= 0) arr[i] = obj; else arr.push(obj);
        return Promise.resolve(obj);
      },
      remove: function (store, id) {
        if (mem[store]) mem[store] = mem[store].filter(function (o) { return o.id !== id; });
        return Promise.resolve();
      },
      clear: function (store) { mem[store] = []; return Promise.resolve(); }
    };
  };

  // store 方法全部返回 Promise
  AppCore.createStore = function (adapter) {
    var seq = { profile: 0, attempt: 0 };
    var store = {};

    function nextId(kind) { seq[kind] += 1; return seq[kind]; }
    function initSeq() {
      return adapter.getAll('profiles').then(function (ps) {
        ps.forEach(function (p) { if (p.id > seq.profile) seq.profile = p.id; });
        return adapter.getAll('attempts');
      }).then(function (as) {
        as.forEach(function (a) { if (a.id > seq.attempt) seq.attempt = a.id; });
      });
    }

    store.ready = function () {
      return Promise.resolve(adapter.ready()).then(initSeq);
    };

    // ---- profiles ----
    store.listProfiles = function () {
      return adapter.getAll('profiles').then(function (ps) {
        return ps.sort(function (a, b) {
          if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
          return a.id - b.id;
        });
      });
    };
    store.getProfile = function (id) { return adapter.get('profiles', id); };
    store.createProfile = function (name) {
      var n = String(name == null ? '' : name).trim();
      if (!n) return Promise.resolve({ ok: false, error: '档案名不能为空' });
      if (n.length > 20) return Promise.resolve({ ok: false, error: '档案名不能超过 20 字' });
      var p = { id: nextId('profile'), name: n, createdAt: AppCore.utils.now(), updatedAt: AppCore.utils.now() };
      return adapter.put('profiles', p).then(function () { return { ok: true, profile: p }; });
    };
    store.renameProfile = function (id, name) {
      var n = String(name == null ? '' : name).trim();
      if (!n) return Promise.resolve({ ok: false, error: '档案名不能为空' });
      if (n.length > 20) return Promise.resolve({ ok: false, error: '档案名不能超过 20 字' });
      return adapter.get('profiles', id).then(function (p) {
        if (!p) return { ok: false, error: '档案不存在' };
        p.name = n;
        p.updatedAt = AppCore.utils.now();
        return adapter.put('profiles', p).then(function () { return { ok: true, profile: p }; });
      });
    };
    store.deleteProfile = function (id) {
      return adapter.remove('profiles', id).then(function () {
        return adapter.getAll('attempts');
      }).then(function (all) {
        var dels = all.filter(function (a) { return a.profileId === id; }).map(function (a) { return adapter.remove('attempts', a.id); });
        return Promise.all(dels);
      }).then(function () { return { ok: true }; });
    };
    store.countAttemptsOfProfile = function (id) {
      return adapter.getAll('attempts').then(function (all) {
        return all.filter(function (a) { return a.profileId === id; }).length;
      });
    };

    // ---- attempts ----
    store.listAttempts = function (profileId) {
      return adapter.getAll('attempts').then(function (all) {
        if (profileId != null) all = all.filter(function (a) { return a.profileId === profileId; });
        return all.sort(function (a, b) {
          if (a.startedAt !== b.startedAt) return b.startedAt - a.startedAt;
          return b.id - a.id;
        });
      });
    };
    store.listCompletedAttempts = function (profileId) {
      return store.listAttempts(profileId).then(function (all) {
        return all.filter(function (a) { return a.status === 'completed'; });
      });
    };
    store.getAttempt = function (id) { return adapter.get('attempts', id); };
    store.createAttempt = function (profileId, scaleId) {
      return adapter.get('profiles', profileId).then(function (p) {
        if (!p) return { ok: false, error: '档案不存在' };
        var scale = AppCore.catalog.get(scaleId);
        if (!scale) return { ok: false, error: '量表不存在' };
        var a = {
          id: nextId('attempt'), profileId: profileId, scaleId: scaleId,
          status: 'draft', answers: [], currentIndex: 0,
          startedAt: AppCore.utils.now(), completedAt: null, result: null
        };
        return adapter.put('attempts', a).then(function () { return { ok: true, attempt: a }; });
      });
    };
    store.findDraft = function (profileId, scaleId) {
      return adapter.getAll('attempts').then(function (all) {
        var drafts = all.filter(function (a) {
          return a.profileId === profileId && a.scaleId === scaleId && a.status === 'draft';
        });
        drafts.sort(function (a, b) { return a.startedAt - b.startedAt; });
        return drafts.length ? drafts[drafts.length - 1] : null;
      });
    };
    store.saveAnswer = function (attemptId, qIndex, value) {
      return adapter.get('attempts', attemptId).then(function (a) {
        if (!a) return { ok: false, error: '测试不存在' };
        var scale = AppCore.catalog.get(a.scaleId);
        if (!scale) return { ok: false, error: '量表不存在' };
        if (qIndex < 0 || qIndex >= scale.items.length) return { ok: false, error: '题目序号非法' };
        if (value < 1 || value > 5) return { ok: false, error: '选项值非法' };
        a.answers = a.answers.filter(function (x) { return x.qIndex !== qIndex; });
        a.answers.push({ qIndex: qIndex, value: value });
        if (a.status === 'draft') a.currentIndex = Math.max(a.currentIndex, qIndex + 1);
        return adapter.put('attempts', a).then(function () { return { ok: true, attempt: a }; });
      });
    };
    store.completeAttempt = function (attemptId, result) {
      return adapter.get('attempts', attemptId).then(function (a) {
        if (!a) return { ok: false, error: '测试不存在' };
        a.status = 'completed';
        a.completedAt = AppCore.utils.now();
        a.result = result;
        return adapter.get('profiles', a.profileId).then(function (p) {
          if (p) { p.updatedAt = AppCore.utils.now(); return adapter.put('profiles', p); }
          return null;
        }).then(function () { return adapter.put('attempts', a); })
          .then(function () { return { ok: true, attempt: a }; });
      });
    };
    store.deleteAttempt = function (attemptId) {
      return adapter.remove('attempts', attemptId).then(function () { return { ok: true }; });
    };

    // ---- 数据管理 ----
    store.exportAll = function () {
      return Promise.all([adapter.getAll('profiles'), adapter.getAll('attempts')]).then(function (r) {
        return {
          app: 'personality-explorer',
          version: 1,
          exportedAt: AppCore.utils.now(),
          profiles: r[0],
          attempts: r[1]
        };
      });
    };
    store.clearAll = function () {
      return adapter.clear('profiles').then(function () { return adapter.clear('attempts'); })
        .then(function () { return { ok: true }; });
    };

    return store;
  };

  /* ========== 视图数据准备（纯函数，供 app 层渲染） ========== */
  // 档案首页：测试中心各量表状态
  AppCore.buildScaleCards = function (profileId, store) {
    return store.listAttempts(profileId).then(function (attempts) {
      return AppCore.catalog.list().map(function (scale) {
        var sAttempts = attempts.filter(function (a) { return a.scaleId === scale.id; });
        var completed = sAttempts.filter(function (a) { return a.status === 'completed'; });
        var hasDraft = sAttempts.some(function (a) { return a.status === 'draft'; });
        var lastCompleted = completed.length ? completed[0] : null;
        var state = hasDraft ? 'draft' : (completed.length ? 'done' : 'new');
        return {
          scale: scale,
          state: state,
          lastCompleted: lastCompleted,
          attemptsCount: completed.length
        };
      });
    });
  };

  // 档案首页：汇总数据（档案信息 + 最近完成报告 + 完成数量）
  AppCore.buildProfileHomeData = function (profile, store) {
    return store.listCompletedAttempts(profile.id).then(function (completed) {
      var last = completed.length ? completed[0] : null;
      var lastSeq = 0;
      if (last) {
        lastSeq = completed.filter(function (a) { return a.scaleId === last.scaleId; }).length;
      }
      return {
        profile: profile,
        lastReport: last,
        lastSeq: lastSeq,
        totalCompleted: completed.length
      };
    });
  };

  /* ========== 答题状态与计分 ========== */
  // 由 attempt 与 scale 推导当前答题状态
  AppCore.quizState = function (attempt, scale) {
    var answered = {};
    (attempt.answers || []).forEach(function (a) { answered[a.qIndex] = a.value; });
    var total = scale.items.length;
    var index = attempt.currentIndex;
    if (index >= total) index = total - 1;
    if (index < 0) index = 0;
    var allAnswered = Object.keys(answered).length === total;
    return {
      index: index,
      total: total,
      answered: answered,
      answeredCount: Object.keys(answered).length,
      isAnswered: answered[index] != null,
      currentValue: answered[index] != null ? answered[index] : null,
      allAnswered: allAnswered
    };
  };

  // 计分：5 点量表（1-5），反向题 6-v；维度原始分线性标准化到 0-100
  // answers: [{qIndex, value}]（value 1-5）
  AppCore.computeScores = function (scale, answers) {
    var map = {};
    (answers || []).forEach(function (a) { map[a.qIndex] = a.value; });
    var dims = scale.dimensions.map(function (d) {
      var min = 0, max = 0, sum = 0;
      scale.items.forEach(function (it, i) {
        if (it.d !== d.id) return;
        var v = map[i];
        if (v == null) v = 3; // 防御：缺失题按中立 3 处理
        var s = it.r ? (6 - v) : v;
        sum += s;
        min += 1;
        max += 5;
      });
      var pct = max === min ? 50 : Math.round(((sum - min) / (max - min)) * 100);
      pct = Math.max(0, Math.min(100, pct));
      return { id: d.id, name: d.name, raw: sum, pct: pct };
    });
    var scores = {};
    dims.forEach(function (d) { scores[d.id] = d.pct; });
    return { dims: dims, scores: scores, scaleId: scale.id };
  };

  /* ========== 报告数据构建 ========== */
  // 分档：>=66 high，34~65 mid，<=33 low
  AppCore.bandOf = function (pct) {
    if (pct >= 66) return 'high';
    if (pct <= 33) return 'low';
    return 'mid';
  };

  // 该测试是该量表第几次完成（从 1 开始）
  AppCore.attemptSeq = function (store, attempt) {
    return store.listCompletedAttempts(attempt.profileId).then(function (completed) {
      var same = completed.filter(function (a) { return a.scaleId === attempt.scaleId; });
      same.sort(function (a, b) {
        if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
        return a.id - b.id;
      });
      var seq = 0;
      same.some(function (a) { seq += 1; return a.id === attempt.id; });
      return seq;
    });
  };

  // 由 scale + result 生成完整报告展示数据
  AppCore.buildReportData = function (scale, result) {
    var dims = (result.dims || []).map(function (d) {
      var itp = scale.interpretation[d.id] || { high: '', mid: '', low: '' };
      var adv = scale.advice[d.id] || { high: [], low: [] };
      var band = AppCore.bandOf(d.pct);
      return {
        id: d.id, name: d.name, pct: d.pct, raw: d.raw, band: band,
        text: itp[band] || '',
        advice: band === 'mid' ? (d.pct >= 50 ? adv.high : adv.low) : adv[band]
      };
    });
    var radarData = dims.map(function (d) { return { name: d.name, value: d.pct }; });

    // 综合小结：单维量表与多维量表不同框架
    var summary = '';
    if (scale.scaleType === 'multi') {
      var sorted = dims.slice().sort(function (a, b) { return b.pct - a.pct; });
      var top = sorted[0];
      var bottom = sorted[sorted.length - 1];
      summary = '你的核心特质是「' + top.name + '」（' + top.pct + ' 分），这是你性格中最鲜明的部分，决定了你给人的第一印象与主要行为风格。' +
        '相对而言，你在「' + bottom.name + '」上得分偏低（' + bottom.pct + ' 分），这是你性格中较少显现的一面，也是成长空间所在。' +
        '人格没有好坏之分，各维度得分反映的是你更习惯、更舒适的行为方式；理解它们，是为了更好地接纳自己，并在需要时灵活调整。';
    } else {
      var d0 = dims[0];
      summary = '你的「' + scale.name + '」得分为 ' + d0.pct + ' 分，处于' + (d0.band === 'high' ? '较高' : (d0.band === 'low' ? '偏低' : '中等')) + '水平。' +
        d0.text + ' 这一结果不是固定标签，压力、睡眠、生活阶段都会影响当下的状态，可以过一段时间复测观察变化。';
    }

    return { scale: scale, dims: dims, radarData: radarData, summary: summary };
  };

  // 历史列表数据：时间倒序 + 每个测试的序号与量表信息
  AppCore.historyListData = function (profileId, store) {
    return store.listCompletedAttempts(profileId).then(function (list) {
      return Promise.all(list.map(function (a) {
        return AppCore.attemptSeq(store, a).then(function (seq) {
          return { attempt: a, seq: seq, scale: AppCore.catalog.get(a.scaleId) };
        });
      }));
    });
  };

  /* ========== 历史对比数据 ========== */
  // 对选中的若干 completed attempts（须同一量表）生成对比数据
  // 返回 {scale, dims, series:[{label,data,color}], deltas:[{name,diff,dir,value}]}
  AppCore.buildCompareData = function (attempts, store, colors) {
    var cols = colors || ['#5f8f7a', '#b07d62', '#7a9cc6', '#a97a9c'];
    return Promise.all(attempts.map(function (a) {
      var scale = AppCore.catalog.get(a.scaleId);
      var data = AppCore.buildReportData(scale, a.result);
      return Promise.all([{ a: a, data: data, scale: scale }, AppCore.attemptSeq(store, a)]);
    })).then(function (pairs) {
      var first = pairs[0][0];
      var dims = first.data.radarData.map(function (d) { return d.name; });
      var series = pairs.map(function (pair, idx) {
        var p = pair[0], seq = pair[1];
        return {
          label: '第' + seq + '次',
          data: p.data.radarData.map(function (d) { return d.value; }),
          color: cols[idx % cols.length],
          fill: 'rgba(0,0,0,0)'
        };
      });
      var deltas = [];
      if (pairs.length >= 2) {
        var cur = series[series.length - 1].data;
        var base = series[series.length - 2].data;
        dims.forEach(function (name, i) {
          var diff = cur[i] - base[i];
          deltas.push({
            name: name,
            diff: diff,
            dir: diff > 1 ? 'up' : (diff < -1 ? 'down' : 'flat'),
            value: cur[i]
          });
        });
      }
      return { scale: first.scale, dims: dims, series: series, deltas: deltas };
    });
  };

  /* ========== 导出：SVG 雷达图与独立 HTML 报告 ========== */
  // 生成 SVG 雷达图字符串（纯函数，用于 HTML 导出，静态可打印）
  AppCore.svgRadar = function (radarData, series, size) {
    var n = radarData.length;
    if (n < 3) return '';
    var esc = AppCore.utils.esc;
    var cx = size / 2, cy = size / 2, R = size * 0.32;
    function pt(i, r) {
      var ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    }
    function polyPts(f) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, R * f); pts.push(p[0] + ',' + p[1]); }
      return pts.join(' ');
    }
    var grid = [0.25, 0.5, 0.75, 1].map(function (f) {
      return '<polygon points="' + polyPts(f) + '" fill="none" stroke="#e4e0d8"/>';
    }).join('');
    var axes = radarData.map(function (_, i) {
      var p = pt(i, R);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#e4e0d8"/>';
    }).join('');
    var labels = radarData.map(function (l, i) {
      var p = pt(i, R * 1.18);
      return '<text x="' + p[0] + '" y="' + p[1] + '" font-size="13" text-anchor="middle" fill="#33302b">' + esc(l.name) + '</text>';
    }).join('');
    var polys = series.map(function (s) {
      var pts = s.data.map(function (v, i) {
        var p = pt(i, R * Math.max(0, Math.min(100, v)) / 100);
        return p[0] + ',' + p[1];
      }).join(' ');
      return '<polygon points="' + pts + '" fill="' + (s.fill || 'rgba(95,143,122,.25)') + '" stroke="' + s.color + '" stroke-width="2"/>';
    }).join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" xmlns="http://www.w3.org/2000/svg">' +
      grid + axes + polys + labels + '</svg>';
  };

  // 生成独立 HTML 报告（无外部依赖，可离线打开）
  AppCore.buildHtmlReport = function (opts) {
    var esc = AppCore.utils.esc;
    var scale = opts.scale, data = opts.data, profileName = opts.profileName || '',
      timeText = opts.timeText || '', seqText = opts.seqText || '';
    var radar = scale.scaleType === 'multi'
      ? '<div class="radar">' + AppCore.svgRadar(data.radarData, [{ data: data.radarData.map(function (d) { return d.value; }), color: '#5f8f7a', fill: 'rgba(95,143,122,.25)' }], 420) + '</div>'
      : '<div class="single">' + data.dims.map(function (d) {
        return '<div class="srow"><div class="sname">' + esc(d.name) + '</div><div class="sbar"><div class="sfill" style="width:' + d.pct + '%"></div></div><div class="sval">' + d.pct + ' 分</div></div>';
      }).join('') + '</div>';
    var dims = data.dims.map(function (d) {
      return '<div class="dim"><div class="dimhead"><span class="dimname">' + esc(d.name) + '</span><span class="dimscore">' + d.pct + ' 分</span></div>' +
        '<div class="bar"><div class="fill" style="width:' + d.pct + '%"></div></div>' +
        '<p class="desc">' + esc(d.text) + '</p>' +
        (d.advice.length ? '<ul class="advice">' + d.advice.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
    }).join('');
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + esc(scale.name) + '报告</title>' +
      '<style>' +
      'body{font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;background:#f6f4ef;color:#33302b;margin:0;padding:24px;line-height:1.6}' +
      '.wrap{max-width:640px;margin:0 auto}.head{text-align:center;padding:12px 0 8px}' +
      '.head h1{margin:0;font-size:26px}.head .meta{color:#8a857d;font-size:14px}' +
      '.radar{max-width:420px;margin:12px auto}' +
      '.single{max-width:420px;margin:14px auto}.srow{display:flex;align-items:center;gap:10px;margin:8px 0}' +
      '.sname{width:90px;font-size:14px;font-weight:600}.sbar{flex:1;height:10px;background:#eeeae1;border-radius:6px;overflow:hidden}' +
      '.sfill{height:100%;background:#5f8f7a;border-radius:6px}.sval{width:52px;text-align:right;font-size:14px;font-weight:700;color:#4a7462}' +
      '.dim{background:#fff;border:1px solid #e4e0d8;border-radius:12px;padding:14px 16px;margin:12px 0}' +
      '.dimhead{display:flex;justify-content:space-between}.dimname{font-weight:700}.dimscore{color:#4a7462;font-weight:700}' +
      '.bar{height:8px;background:#eeeae1;border-radius:6px;overflow:hidden;margin:8px 0}.fill{height:100%;background:#5f8f7a;border-radius:6px}' +
      '.desc{font-size:14px;margin:6px 0}.advice{margin:4px 0 0;padding-left:20px}.advice li{font-size:14px;margin:4px 0}' +
      '.summary{background:#e7efe9;border-radius:12px;padding:16px;font-size:15px;margin:14px 0}' +
      '.foot{text-align:center;color:#8a857d;font-size:12px;margin-top:20px}' +
      '</style></head><body><div class="wrap">' +
      '<div class="head"><h1>' + esc(scale.name) + '人格报告</h1><div class="meta">' + esc(profileName) + ' · ' + esc(timeText) + ' · ' + esc(seqText) + '</div></div>' +
      radar + dims +
      '<div class="summary">' + esc(data.summary) + '</div>' +
      '<p class="foot">本报告由「人格探索」基于你的作答生成，仅用于自我了解参考，不构成心理诊断。</p>' +
      '</div></body></html>';
  };

  global.AppCore = AppCore;
})(typeof window !== 'undefined' ? window : globalThis);
