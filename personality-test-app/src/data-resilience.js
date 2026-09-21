(function (global) {
  'use strict';
  global.AppData = global.AppData || {};
  global.AppData.resilience = {
    id: 'resilience',
    name: '心理韧性',
    intro: '心理韧性衡量你在压力、挫折和逆境之后恢复与反弹的能力。高韧性的人更能把困难转化成成长的养分。',
    minutes: 2,
    scaleType: 'single',
    dimensions: [
      { id: 'resilience', name: '心理韧性' }
    ],
    items: [
      { d: 'resilience', text: '我倾向于从挫折中迅速恢复过来', r: false },
      { d: 'resilience', text: '我很难熬过压力事件', r: true },
      { d: 'resilience', text: '压力过去后，我通常很快就能恢复', r: false },
      { d: 'resilience', text: '遇到不顺心的事，我往往要花很长时间才能缓过来', r: true },
      { d: 'resilience', text: '我通常能轻松渡过难关', r: false },
      { d: 'resilience', text: '我往往需要很久才能从生活中的挫折中振作起来', r: true }
    ],
    interpretation: {
      resilience: {
        high: '你的心理韧性较高：面对压力和挫折，你能较快恢复并把注意力放回行动上，是抗压能力较强的类型。',
        mid: '你的心理韧性居中：你能应对一般压力，但遭遇重大挫折时也会需要一段时间调整和恢复。',
        low: '你的心理韧性偏低：压力对你影响较大，恢复需要更长时间，但也意味着你对自己和他人有更细腻的觉察。'
      }
    },
    advice: {
      resilience: {
        high: [
          '把这种复原力用在更有挑战的目标上：主动承担需要长期坚持的事情。',
          '别忘记示弱也是力量：让信任的人知道你也会累，关系会更真实。'
        ],
        low: [
          '把大压力拆成小步骤：先处理能控制的一小部分，行动会自然降低焦虑。',
          '建立你的"恢复清单"：睡眠、运动、倾诉、放松，压力一来就按清单执行。',
          '挫折后先接纳情绪，再复盘行动：允许自己休息一天，比强迫振作更有效。'
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
