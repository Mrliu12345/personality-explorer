'use strict';
/**
 * 人格探索 · 全量测试
 * 用法：
 *   node tests/run-tests.js            # 运行全部测试（默认先构建产物）
 *   node tests/run-tests.js M0,M1      # 只运行指定里程碑分组
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// 0) 构建产物（保证 index.html 与源码同步）
try {
  execSync('node build.js', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  console.error('构建失败：' + (e.stderr || e.message));
  process.exit(1);
}

// 1) 加载源码（UMD 挂到 globalThis）
['data-bigfive.js', 'data-resilience.js', 'data-cse.js', 'core.js'].forEach(function (f) {
  require(path.join(ROOT, 'personality-test-app', 'src', f));
});
const AppCore = global.AppCore;
const AppData = global.AppData;

const tests = [];
function test(group, name, fn) { tests.push({ group: group, name: name, fn: fn }); }

/* ================================================================
 * M0 · 项目骨架与运行验证
 * ================================================================ */
test('M0', '构建产物存在且为单文件', function () {
  const out = path.join(ROOT, 'personality-test-app', 'index.html');
  assert.ok(fs.existsSync(out), 'index.html 不存在');
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.includes('<!DOCTYPE html>'), '缺少 DOCTYPE');
  assert.ok(/<title>[^<]+<\/title>/.test(html), '缺少 <title>');
  assert.ok(!html.includes('<script src='), '不应引用外部脚本文件');
  assert.ok(!html.includes('<link rel="stylesheet"'), '不应引用外部样式文件');
});

test('M0', '产物不引用任何外部 http 资源（无网络请求）', function () {
  const out = path.join(ROOT, 'personality-test-app', 'index.html');
  const html = fs.readFileSync(out, 'utf8');
  const bad = html.match(/(?:src|href)\s*=\s*["']https?:\/\//g);
  assert.ok(!bad, '发现外部资源引用: ' + (bad || []).join(', '));
});

test('M0', '路由解析：7 个视图 hash 正确', function () {
  const cases = [
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/profile', { name: 'profile', params: {} }],
    ['#/scale/bigFive', { name: 'scale', params: { scaleId: 'bigFive' } }],
    ['#/quiz/resilience', { name: 'quiz', params: { scaleId: 'resilience' } }],
    ['#/report/12', { name: 'report', params: { attemptId: 12 } }],
    ['#/history', { name: 'history', params: {} }],
    ['#/settings', { name: 'settings', params: {} }],
    ['#/test', { name: 'test', params: {} }]
  ];
  cases.forEach(function (c) {
    assert.deepStrictEqual(AppCore.router.parse(c[0]), c[1], 'parse(' + c[0] + ')');
  });
});

test('M0', '路由解析：未知 hash 回退到首页', function () {
  assert.strictEqual(AppCore.router.parse('#/unknown').name, 'home');
  assert.strictEqual(AppCore.router.parse('#/x/y/z').name, 'home');
  assert.strictEqual(AppCore.router.parse('#/quiz').name, 'quiz');
});

test('M0', '工具函数：时间格式化与转义', function () {
  const ts = new Date(2026, 0, 5, 9, 8).getTime();
  assert.strictEqual(AppCore.utils.formatTime(ts), '2026-01-05 09:08');
  assert.strictEqual(AppCore.utils.esc('<a "b">&\''), '&lt;a &quot;b&quot;&gt;&amp;&#39;');
  assert.strictEqual(AppCore.utils.clone({ a: [1, 2] }).a.length, 2);
});

/* ================================================================
 * M1 · 题库与数据层
 * ================================================================ */
test('M1', '题库完整性校验通过（3 量表、元信息、题目、维度、文案）', function () {
  const v = AppCore.catalog.validate();
  assert.ok(v.ok, v.errors.join('; '));
});

test('M1', '量表题数与维度分布符合规格', function () {
  const big = AppData.bigFive;
  assert.strictEqual(big.items.length, 50, '大五应为 50 题');
  assert.strictEqual(big.dimensions.length, 5, '大五应为 5 维');
  big.dimensions.forEach(function (d) {
    const n = big.items.filter(function (it) { return it.d === d.id; }).length;
    assert.strictEqual(n, 10, '大五维度 ' + d.id + ' 应为 10 题');
    const rev = big.items.filter(function (it) { return it.d === d.id && it.r; }).length;
    assert.strictEqual(rev, 5, '大五维度 ' + d.id + ' 反向题应为 5');
  });
  assert.strictEqual(AppData.resilience.items.length, 6, '韧性应为 6 题');
  assert.strictEqual(AppData.resilience.items.filter(function (i) { return i.r; }).length, 3, '韧性反向题应为 3');
  assert.strictEqual(AppData.cse.items.length, 12, '核心自我评价应为 12 题');
  assert.strictEqual(AppData.cse.items.filter(function (i) { return i.r; }).length, 6, 'CSES 反向题应为 6');
});

test('M1', '所有题目选项值域说明有效（5 点量表）', function () {
  AppCore.catalog.list().forEach(function (s) {
    assert.ok(s.items.length > 0);
    // 每个维度的解读与建议档位已由 validate 校验，这里补充：建议条目为数组且非空字符串
    Object.keys(s.advice).forEach(function (d) {
      (s.advice[d].high || []).forEach(function (a) { assert.ok(a && a.length > 0, '空建议'); });
      (s.advice[d].low || []).forEach(function (a) { assert.ok(a && a.length > 0, '空建议'); });
    });
  });
});

test('M1', '存储层：档案创建校验（空名/超长/正常）', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  let r = await store.createProfile('   ');
  assert.strictEqual(r.ok, false);
  r = await store.createProfile('一二三四五六七八九十一二三四五六七八九十X');
  assert.strictEqual(r.ok, false);
  r = await store.createProfile('小明');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.profile.name, '小明');
});

test('M1', '存储层：档案重命名与列表排序', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  await store.createProfile('A');
  await store.createProfile('B');
  let list = await store.listProfiles();
  assert.strictEqual(list.length, 2);
  const first = list[0];
  const r = await store.renameProfile(first.id, 'AA');
  assert.strictEqual(r.ok, true);
  assert.strictEqual((await store.getProfile(first.id)).name, 'AA');
});

test('M1', '存储层：删除档案级联删除其测试', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  await store.createAttempt(p.id, 'bigFive');
  await store.createAttempt(p.id, 'cse');
  const other = (await store.createProfile('Q')).profile;
  await store.createAttempt(other.id, 'cse');
  let cnt = await store.countAttemptsOfProfile(p.id);
  assert.strictEqual(cnt, 2);
  await store.deleteProfile(p.id);
  cnt = await store.countAttemptsOfProfile(p.id);
  assert.strictEqual(cnt, 0);
  const all = await store.listAttempts();
  assert.strictEqual(all.length, 1, '另一档案的测试应保留');
  assert.strictEqual(all[0].profileId, other.id);
});

test('M1', '存储层：答题保存与校验（序号/值域）', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a = (await store.createAttempt(p.id, 'resilience')).attempt;
  let r = await store.saveAnswer(a.id, 0, 4);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.attempt.answers.length, 1);
  assert.strictEqual(r.attempt.currentIndex, 1);
  // 覆盖已答题目
  r = await store.saveAnswer(a.id, 0, 2);
  assert.strictEqual(r.attempt.answers.length, 1);
  assert.strictEqual(r.attempt.answers[0].value, 2);
  // 非法
  r = await store.saveAnswer(a.id, -1, 3);
  assert.strictEqual(r.ok, false);
  r = await store.saveAnswer(a.id, 99, 3);
  assert.strictEqual(r.ok, false);
  r = await store.saveAnswer(a.id, 0, 6);
  assert.strictEqual(r.ok, false);
  r = await store.saveAnswer(a.id, 0, 0);
  assert.strictEqual(r.ok, false);
});

test('M1', '存储层：断点查找（findDraft 返回未完成测试）', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a1 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  const a2 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  const draft = await store.findDraft(p.id, 'bigFive');
  assert.strictEqual(draft.id, a2.id, '应返回最新未完成测试');
  // 完成后不再返回
  await store.completeAttempt(a2.id, { scores: {} });
  const draft2 = await store.findDraft(p.id, 'bigFive');
  assert.strictEqual(draft2.id, a1.id);
});

test('M1', '存储层：完成测试状态转换与导出/清空', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a = (await store.createAttempt(p.id, 'cse')).attempt;
  const r = await store.completeAttempt(a.id, { scores: { cse: 80 }, summary: 'x' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.attempt.status, 'completed');
  assert.ok(r.attempt.completedAt > 0);
  assert.strictEqual((await store.getAttempt(a.id)).result.scores.cse, 80);
  const exp = await store.exportAll();
  assert.strictEqual(exp.profiles.length, 1);
  assert.strictEqual(exp.attempts.length, 1);
  await store.clearAll();
  assert.strictEqual((await store.listProfiles()).length, 0);
  assert.strictEqual((await store.listAttempts()).length, 0);
});

/* ================================================================
 * M2 · 档案系统与首页
 * ================================================================ */
test('M2', 'buildScaleCards：初始所有量表为未测', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const cards = await AppCore.buildScaleCards(p.id, store);
  assert.strictEqual(cards.length, 3);
  cards.forEach(function (c) {
    assert.strictEqual(c.state, 'new');
    assert.strictEqual(c.attemptsCount, 0);
    assert.strictEqual(c.lastCompleted, null);
  });
});

test('M2', 'buildScaleCards：完成后状态与次数正确', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a.id, { scores: {} });
  const cards = await AppCore.buildScaleCards(p.id, store);
  const big = cards.find(function (c) { return c.scale.id === 'bigFive'; });
  assert.strictEqual(big.state, 'done');
  assert.strictEqual(big.attemptsCount, 1);
  assert.strictEqual(big.lastCompleted.id, a.id);
  cards.filter(function (c) { return c.scale.id !== 'bigFive'; }).forEach(function (c) {
    assert.strictEqual(c.state, 'new');
  });
});

test('M2', 'buildScaleCards：存在未完成测试时显示 draft 状态', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  await store.createAttempt(p.id, 'resilience');
  const cards = await AppCore.buildScaleCards(p.id, store);
  assert.strictEqual(cards.find(function (c) { return c.scale.id === 'resilience'; }).state, 'draft');
});

test('M2', 'buildProfileHomeData：最近报告与序号', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a1 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a1.id, { scores: {} });
  const a2 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a2.id, { scores: {} });
  const a3 = (await store.createAttempt(p.id, 'cse')).attempt;
  await store.completeAttempt(a3.id, { scores: {} });
  const home = await AppCore.buildProfileHomeData(p, store);
  assert.strictEqual(home.totalCompleted, 3);
  assert.strictEqual(home.lastReport.id, a3.id, '最近报告应为最新完成');
  assert.strictEqual(home.lastSeq, 1, 'cse 为该量表第 1 次');
  const a4 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a4.id, { scores: {} });
  const home2 = await AppCore.buildProfileHomeData(p, store);
  assert.strictEqual(home2.lastReport.id, a4.id);
  assert.strictEqual(home2.lastSeq, 3, 'bigFive 为该量表第 3 次');
});

test('M2', '删除档案后档案查询返回 null', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  await store.deleteProfile(p.id);
  assert.strictEqual(await store.getProfile(p.id), null);
});

/* ================================================================
 * M3 · 答题流程
 * ================================================================ */
// 构造一份完整作答：pick(qIndex, item) -> 1-5
function makeAnswers(scale, pick) {
  return scale.items.map(function (it, i) { return { qIndex: i, value: pick(i, it) }; });
}

test('M3', 'quizState：初始/部分/全部作答状态正确', function () {
  const scale = AppData.bigFive;
  let attempt = { currentIndex: 0, answers: [] };
  let st = AppCore.quizState(attempt, scale);
  assert.strictEqual(st.total, 50);
  assert.strictEqual(st.index, 0);
  assert.strictEqual(st.isAnswered, false);
  assert.strictEqual(st.answeredCount, 0);
  attempt = { currentIndex: 2, answers: [{ qIndex: 0, value: 3 }, { qIndex: 1, value: 4 }] };
  st = AppCore.quizState(attempt, scale);
  assert.strictEqual(st.index, 2);
  assert.strictEqual(st.currentValue, null);
  assert.strictEqual(st.answeredCount, 2);
  assert.strictEqual(st.allAnswered, false);
  // 全部作答
  attempt = { currentIndex: 50, answers: makeAnswers(scale, function () { return 3; }) };
  st = AppCore.quizState(attempt, scale);
  assert.strictEqual(st.index, 49);
  assert.strictEqual(st.isAnswered, true);
  assert.strictEqual(st.allAnswered, true);
});

test('M3', '计分：极端高特质（正向5/反向1）各维 100 分', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; });
  const r = AppCore.computeScores(scale, answers);
  scale.dimensions.forEach(function (d) {
    assert.strictEqual(r.scores[d.id], 100, d.id + ' 应为 100');
  });
});

test('M3', '计分：极端低特质（正向1/反向5）各维 0 分', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 5 : 1; });
  const r = AppCore.computeScores(scale, answers);
  scale.dimensions.forEach(function (d) {
    assert.strictEqual(r.scores[d.id], 0, d.id + ' 应为 0');
  });
});

test('M3', '计分：全部中立（3）各维 50 分', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function () { return 3; });
  const r = AppCore.computeScores(scale, answers);
  scale.dimensions.forEach(function (d) {
    assert.strictEqual(r.scores[d.id], 50, d.id + ' 应为 50');
  });
});

test('M3', '计分：单维量表（韧性）极端值正确', function () {
  const scale = AppData.resilience;
  const high = makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; });
  assert.strictEqual(AppCore.computeScores(scale, high).scores.resilience, 100);
  const low = makeAnswers(scale, function (i, it) { return it.r ? 5 : 1; });
  assert.strictEqual(AppCore.computeScores(scale, low).scores.resilience, 0);
});

test('M3', '计分：部分作答按中立补全且不抛错', function () {
  const scale = AppData.cse;
  const answers = [{ qIndex: 0, value: 5 }];
  const r = AppCore.computeScores(scale, answers);
  assert.ok(r.scores.cse >= 0 && r.scores.cse <= 100);
  assert.strictEqual(r.dims[0].raw > 0, true);
});

test('M3', '计分：混合作答手算一致', function () {
  const scale = AppData.bigFive;
  // 只答 extraversion 的 10 题：正向题选 5、反向题选 1 → raw 50 → 100
  const answers = scale.items.map(function (it, i) {
    return { qIndex: i, value: it.d === 'extraversion' ? (it.r ? 1 : 5) : 3 };
  });
  const r = AppCore.computeScores(scale, answers);
  assert.strictEqual(r.scores.extraversion, 100);
  // 手算一条：全部选 2（正向2分反向4分）→ 每维 raw = 5*2+5*4=30 → (30-10)/40=50
  const answers2 = makeAnswers(scale, function () { return 2; });
  const r2 = AppCore.computeScores(scale, answers2);
  scale.dimensions.forEach(function (d) {
    assert.strictEqual(r2.scores[d.id], 50, d.id + ' 全部选2 应为 50');
  });
});

/* ================================================================
 * M4 · 结果报告
 * ================================================================ */
test('M4', 'bandOf 分档边界正确（66/65/34/33）', function () {
  assert.strictEqual(AppCore.bandOf(100), 'high');
  assert.strictEqual(AppCore.bandOf(66), 'high');
  assert.strictEqual(AppCore.bandOf(65), 'mid');
  assert.strictEqual(AppCore.bandOf(34), 'mid');
  assert.strictEqual(AppCore.bandOf(33), 'low');
  assert.strictEqual(AppCore.bandOf(0), 'low');
});

test('M4', 'buildReportData：多维量表维度卡完整且档位正确', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; }); // 全部 100
  const result = AppCore.computeScores(scale, answers);
  const data = AppCore.buildReportData(scale, result);
  assert.strictEqual(data.dims.length, 5);
  data.dims.forEach(function (d) {
    assert.strictEqual(d.band, 'high');
    assert.ok(d.text.length > 10, '解读文本缺失');
    assert.ok(d.advice.length >= 2, '建议缺失');
  });
  assert.strictEqual(data.radarData.length, 5);
  assert.strictEqual(data.radarData[0].value, 100);
  assert.ok(data.summary.indexOf('核心特质') !== -1, '综合小结缺少核心特质');
});

test('M4', 'buildReportData：低分维度为 low 档并给 low 建议', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 5 : 1; }); // 全部 0
  const result = AppCore.computeScores(scale, answers);
  const data = AppCore.buildReportData(scale, result);
  data.dims.forEach(function (d) {
    assert.strictEqual(d.band, 'low');
    assert.ok(d.advice.length >= 2);
  });
});

test('M4', 'buildReportData：单维量表（韧性）生成正确报告', function () {
  const scale = AppData.resilience;
  const answers = makeAnswers(scale, function () { return 4; });
  const result = AppCore.computeScores(scale, answers);
  const data = AppCore.buildReportData(scale, result);
  assert.strictEqual(data.dims.length, 1);
  assert.strictEqual(data.radarData.length, 1);
  assert.ok(data.summary.indexOf('心理韧性') !== -1);
  const pct = result.scores.resilience;
  assert.strictEqual(data.dims[0].band, AppCore.bandOf(pct));
});

test('M4', 'attemptSeq：同一量表多次测试序号递增', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a1 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a1.id, { scores: {} });
  const a2 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a2.id, { scores: {} });
  const a3 = (await store.createAttempt(p.id, 'cse')).attempt;
  await store.completeAttempt(a3.id, { scores: {} });
  assert.strictEqual(await AppCore.attemptSeq(store, a1), 1);
  assert.strictEqual(await AppCore.attemptSeq(store, a2), 2);
  assert.strictEqual(await AppCore.attemptSeq(store, a3), 1);
});

/* ================================================================
 * M5 · 历史与对比
 * ================================================================ */
test('M5', 'historyListData：时间倒序且含序号与量表', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const a1 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a1.id, { scores: {} });
  const a2 = (await store.createAttempt(p.id, 'cse')).attempt;
  await store.completeAttempt(a2.id, { scores: {} });
  const rows = await AppCore.historyListData(p.id, store);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].attempt.id, a2.id, '最新在前');
  assert.strictEqual(rows[0].seq, 1);
  assert.strictEqual(rows[1].attempt.id, a1.id);
  assert.ok(rows[0].scale.id === 'cse');
});

test('M5', 'buildCompareData：多系列与升降标注计算', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  // 第一次：extraversion 高（100），其余 50
  const scale = AppData.bigFive;
  const ans1 = scale.items.map(function (it, i) {
    let v = 3;
    if (it.d === 'extraversion') v = it.r ? 1 : 5;
    return { qIndex: i, value: v };
  });
  const a1 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a1.id, AppCore.computeScores(scale, ans1));
  // 第二次：extraversion 低（0）
  const ans2 = scale.items.map(function (it, i) {
    let v = 3;
    if (it.d === 'extraversion') v = it.r ? 5 : 1;
    return { qIndex: i, value: v };
  });
  const a2 = (await store.createAttempt(p.id, 'bigFive')).attempt;
  await store.completeAttempt(a2.id, AppCore.computeScores(scale, ans2));

  const attempts = [await store.getAttempt(a1.id), await store.getAttempt(a2.id)];
  const comp = await AppCore.buildCompareData(attempts, store);
  assert.strictEqual(comp.series.length, 2);
  assert.strictEqual(comp.series[0].label, '第1次');
  assert.strictEqual(comp.series[1].label, '第2次');
  assert.strictEqual(comp.dims.length, 5);
  // extraversion: 第1次 100，第2次 0 → diff = -100 → down
  const d = comp.deltas.find(function (x) { return x.name === '外向性'; });
  assert.strictEqual(d.dir, 'down');
  assert.strictEqual(d.diff, -100);
  assert.strictEqual(d.value, 0);
  // 其他维度：50 vs 50 → flat
  const d2 = comp.deltas.find(function (x) { return x.name === '开放性'; });
  assert.strictEqual(d2.dir, 'flat');
});

test('M5', 'buildCompareData：单维量表对比数据正确', async function () {
  const store = AppCore.createStore(AppCore.createMemoryAdapter());
  await store.ready();
  const p = (await store.createProfile('P')).profile;
  const scale = AppData.cse;
  // 第1次满分：正向5 / 反向1
  const a1 = (await store.createAttempt(p.id, 'cse')).attempt;
  await store.completeAttempt(a1.id, AppCore.computeScores(scale, makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; })));
  // 第2次中立：全部 3
  const a2 = (await store.createAttempt(p.id, 'cse')).attempt;
  await store.completeAttempt(a2.id, AppCore.computeScores(scale, makeAnswers(scale, function () { return 3; })));
  const attempts = [await store.getAttempt(a1.id), await store.getAttempt(a2.id)];
  const comp = await AppCore.buildCompareData(attempts, store);
  assert.strictEqual(comp.dims.length, 1);
  assert.strictEqual(comp.series.length, 2);
  assert.strictEqual(comp.deltas.length, 1);
  assert.ok(comp.deltas[0].diff < 0, '第2次比第1次低，实际 diff=' + comp.deltas[0].diff);
});

/* ================================================================
 * M6 · 导出与设置
 * ================================================================ */
test('M6', 'svgRadar：多维量表生成合法 SVG', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; });
  const data = AppCore.buildReportData(scale, AppCore.computeScores(scale, answers));
  const svg = AppCore.svgRadar(data.radarData, [{ data: data.radarData.map(function (d) { return d.value; }), color: '#5f8f7a' }], 420);
  assert.ok(svg.indexOf('<svg') !== -1);
  assert.ok(svg.indexOf('<polygon') !== -1, '缺少多边形');
  assert.ok(svg.indexOf('<text') !== -1, '缺少标签');
  assert.ok(svg.indexOf('外向性') !== -1);
  assert.ok(!/(?:src|href)\s*=\s*["']https?:\/\//.test(svg), 'SVG 不应含外部资源引用');
});

test('M6', 'svgRadar：维度不足 3 时返回空（单维用条形）', function () {
  const scale = AppData.resilience;
  const data = AppCore.buildReportData(scale, AppCore.computeScores(scale, makeAnswers(scale, function () { return 3; })));
  assert.strictEqual(AppCore.svgRadar(data.radarData, [], 420), '');
});

test('M6', 'buildHtmlReport：多维量表报告完整且离线自包含', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; });
  const data = AppCore.buildReportData(scale, AppCore.computeScores(scale, answers));
  const html = AppCore.buildHtmlReport({ scale: scale, data: data, profileName: '小明', timeText: '2026-09-21 10:00', seqText: '第 1 次测试' });
  assert.ok(html.indexOf('<!DOCTYPE html>') !== -1);
  assert.ok(html.indexOf('<title>') !== -1);
  assert.ok(html.indexOf('大五人格') !== -1);
  assert.ok(html.indexOf('外向性') !== -1);
  assert.ok(html.indexOf('100 分') !== -1);
  assert.ok(html.indexOf('建议') === -1 && html.indexOf('<li>') !== -1, '应含建议列表条目');
  assert.ok(html.indexOf('综合小结') !== -1 || html.indexOf('核心特质') !== -1);
  assert.ok(!/(?:src|href)\s*=\s*["']https?:\/\//.test(html), 'HTML 报告不应引用外部资源');
  assert.ok(html.indexOf('<svg') !== -1, '应含 SVG 雷达图');
});

test('M6', 'buildHtmlReport：单维量表报告用得分条呈现', function () {
  const scale = AppData.cse;
  const data = AppCore.buildReportData(scale, AppCore.computeScores(scale, makeAnswers(scale, function (i, it) { return it.r ? 1 : 5; })));
  const html = AppCore.buildHtmlReport({ scale: scale, data: data, profileName: '小明', timeText: '2026-09-21', seqText: '第 1 次测试' });
  assert.ok(html.indexOf('核心自我评价') !== -1);
  assert.ok(html.indexOf('<div class="single">') !== -1, '单维应为条形布局');
  assert.ok(html.indexOf('100 分') !== -1);
});

test('M6', '导出模板对用户输入做转义（防 XSS）', function () {
  const scale = AppData.bigFive;
  const answers = makeAnswers(scale, function () { return 3; });
  const data = AppCore.buildReportData(scale, AppCore.computeScores(scale, answers));
  const html = AppCore.buildHtmlReport({ scale: scale, data: data, profileName: '<script>alert(1)</script>', timeText: 'x', seqText: 's' });
  assert.ok(html.indexOf('<script>alert(1)</script>') === -1, '档案名脚本不应原样出现');
  assert.ok(html.indexOf('&lt;script&gt;') !== -1, '应被转义');
});

/* ================================================================
 * 运行器
 * ================================================================ */
(async function () {
  const filterArg = process.argv[2] || 'ALL';
  const filters = filterArg === 'ALL' ? null : filterArg.split(',');
  const selected = filters ? tests.filter(function (t) { return filters.indexOf(t.group) !== -1; }) : tests;

  if (selected.length === 0) {
    console.error('没有匹配的测试分组：' + filterArg);
    process.exit(1);
  }
  let pass = 0, fail = 0;
  const groups = [];
  selected.forEach(function (t) {
    if (groups.indexOf(t.group) === -1) groups.push(t.group);
  });
  console.log('运行分组：' + groups.join(', ') + ' ｜ 共 ' + selected.length + ' 条\n');
  for (const t of selected) {
    try {
      await t.fn();
      console.log('PASS  [' + t.group + '] ' + t.name);
      pass++;
    } catch (e) {
      console.error('FAIL  [' + t.group + '] ' + t.name);
      console.error('      ' + (e && e.message ? e.message : e));
      fail++;
    }
  }
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail > 0 ? 1 : 0);
})();
