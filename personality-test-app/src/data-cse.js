(function (global) {
  'use strict';
  global.AppData = global.AppData || {};
  global.AppData.cse = {
    id: 'cse',
    name: '核心自我评价',
    intro: '核心自我评价反映你对自己价值与能力的整体看法，与自尊、自我效能、情绪稳定性和控制感密切相关，是自我认知的深层指标。',
    minutes: 3,
    scaleType: 'single',
    dimensions: [
      { id: 'cse', name: '核心自我评价' }
    ],
    items: [
      { d: 'cse', text: '我有信心能获得人生中应得的成功', r: false },
      { d: 'cse', text: '有时候我觉得自己很沮丧', r: true },
      { d: 'cse', text: '当我努力时，我通常能成功', r: false },
      { d: 'cse', text: '有时当我失败时，我觉得自己毫无价值', r: true },
      { d: 'cse', text: '我能把事情顺利完成', r: false },
      { d: 'cse', text: '有时候我觉得自己无法掌控自己的工作', r: true },
      { d: 'cse', text: '总体来说，我对自己感到满意', r: false },
      { d: 'cse', text: '我常常怀疑自己的能力', r: true },
      { d: 'cse', text: '我能决定自己人生中发生的事情', r: false },
      { d: 'cse', text: '我觉得自己无法掌控职业上的成功', r: true },
      { d: 'cse', text: '我有能力处理自己遇到的大多数问题', r: false },
      { d: 'cse', text: '很多时候我感觉前途渺茫', r: true }
    ],
    interpretation: {
      cse: {
        high: '你的核心自我评价较高：你总体上信任自己的价值与能力，面对任务更自信、更少内耗。',
        mid: '你的核心自我评价居中：你大多数时候相信自己，但在具体挫折面前也会产生自我怀疑。',
        low: '你的核心自我评价偏低：你可能常常自我审视、对外界评价敏感，这份敏锐也让你更早发现自己的不足。'
      }
    },
    advice: {
      cse: {
        high: [
          '你的自信是宝贵的资源：主动迎接有挑战性的目标，让自信转化为实绩。',
          '保持谦逊的校准：请信任的人给你反馈，避免自信变成盲区。'
        ],
        low: [
          '用"小赢"积累自我证据：每天完成一件小事并记录它，事实比感觉更有说服力。',
          '把自我批评改成自我教练：问自己"如果是朋友遇到同样的事，我会怎么劝他"。',
          '区分"事实"与"感觉"：感觉差不等于做得差，用数据（完成的事、别人的反馈）来校正判断。'
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
