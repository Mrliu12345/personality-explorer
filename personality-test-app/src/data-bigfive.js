(function (global) {
  'use strict';
  global.AppData = global.AppData || {};
  global.AppData.bigFive = {
    id: 'bigFive',
    name: '大五人格',
    intro: '大五人格是心理学界公认度最高的特质模型，从开放性、尽责性、外向性、宜人性、情绪稳定性五个维度描绘你的性格轮廓。适合用于自我认知与个人发展定位。',
    minutes: 8,
    scaleType: 'multi', // multi=雷达图多维度，single=单维总分
    dimensions: [
      { id: 'extraversion', name: '外向性' },
      { id: 'agreeableness', name: '宜人性' },
      { id: 'conscientiousness', name: '尽责性' },
      { id: 'neuroticism', name: '情绪稳定性' },
      { id: 'openness', name: '开放性' }
    ],
    // d=维度 id，r=true 表示反向计分（5 点量表中选 5 记 1 分）
    items: [
      { d: 'extraversion', text: '我是聚会的灵魂人物', r: false },
      { d: 'extraversion', text: '我不太爱说话', r: true },
      { d: 'extraversion', text: '我在人群中感到自在', r: false },
      { d: 'extraversion', text: '我更喜欢独处', r: true },
      { d: 'extraversion', text: '我很容易结交新朋友', r: false },
      { d: 'extraversion', text: '在社交场合我会退缩', r: true },
      { d: 'extraversion', text: '我喜欢成为众人关注的焦点', r: false },
      { d: 'extraversion', text: '我很少主动和别人搭话', r: true },
      { d: 'extraversion', text: '我精力充沛、充满活力', r: false },
      { d: 'extraversion', text: '我觉得自己比较安静沉默', r: true },

      { d: 'agreeableness', text: '我会关心别人的感受', r: false },
      { d: 'agreeableness', text: '我对别人的事不太上心', r: true },
      { d: 'agreeableness', text: '我愿意花时间帮助别人', r: false },
      { d: 'agreeableness', text: '我对他人的不幸不太在意', r: true },
      { d: 'agreeableness', text: '我能体会到别人的心情', r: false },
      { d: 'agreeableness', text: '我对别人的问题不感兴趣', r: true },
      { d: 'agreeableness', text: '我会让别人感到自在', r: false },
      { d: 'agreeableness', text: '我容易与他人发生争执', r: true },
      { d: 'agreeableness', text: '我待人温和友善', r: false },
      { d: 'agreeableness', text: '我有时会冷落别人', r: true },

      { d: 'conscientiousness', text: '我总是为事情提前做好准备', r: false },
      { d: 'conscientiousness', text: '我常常随手乱放东西', r: true },
      { d: 'conscientiousness', text: '我很在意把事情做好', r: false },
      { d: 'conscientiousness', text: '我做事常常拖到最后一刻', r: true },
      { d: 'conscientiousness', text: '我做事有条理、按计划进行', r: false },
      { d: 'conscientiousness', text: '我经常忘记把东西放回原处', r: true },
      { d: 'conscientiousness', text: '我会立刻完成该做的事', r: false },
      { d: 'conscientiousness', text: '我做事有时不太认真', r: true },
      { d: 'conscientiousness', text: '我遵守自己定下的计划和规则', r: false },
      { d: 'conscientiousness', text: '我常在最后一刻才匆忙完成事情', r: true },

      { d: 'neuroticism', text: '我容易感到压力', r: false },
      { d: 'neuroticism', text: '我大部分时间心情平静', r: true },
      { d: 'neuroticism', text: '我很容易感到焦虑', r: false },
      { d: 'neuroticism', text: '我很少感到沮丧', r: true },
      { d: 'neuroticism', text: '我会因为小事而心烦', r: false },
      { d: 'neuroticism', text: '我的情绪比较稳定', r: true },
      { d: 'neuroticism', text: '我经常感到情绪低落', r: false },
      { d: 'neuroticism', text: '我不太容易生气', r: true },
      { d: 'neuroticism', text: '我容易紧张不安', r: false },
      { d: 'neuroticism', text: '我很少感到忧郁', r: true },

      { d: 'openness', text: '我喜欢探索新事物', r: false },
      { d: 'openness', text: '我不太有想象力', r: true },
      { d: 'openness', text: '我对抽象的想法感兴趣', r: false },
      { d: 'openness', text: '我更喜欢按老办法做事', r: true },
      { d: 'openness', text: '我经常冒出创造性的想法', r: false },
      { d: 'openness', text: '我不太喜欢思考深奥的问题', r: true },
      { d: 'openness', text: '我欣赏艺术和自然之美', r: false },
      { d: 'openness', text: '我对新奇的体验没什么兴趣', r: true },
      { d: 'openness', text: '我的好奇心很强', r: false },
      { d: 'openness', text: '我的兴趣爱好比较狭窄', r: true }
    ],
    interpretation: {
      extraversion: {
        high: '你的外向性较高：喜欢与人打交道，在社交中汲取能量，天生适合需要沟通与协作的环境。',
        mid: '你的外向性居中：既能与人愉快相处，也需要独处充电，社交节奏由你灵活掌控。',
        low: '你的外向性偏低：你更享受安静和深度思考，独处能让你恢复能量，社交不在于多而在于精。'
      },
      agreeableness: {
        high: '你的宜人性较高：你体贴、信任他人，善于合作，是团队中天然的黏合剂。',
        mid: '你的宜人性居中：你既愿意合作，也会在必要时坚持自己的立场，分寸拿捏得当。',
        low: '你的宜人性偏低：你更看重原则与效率，敢于直言，不轻易被他人的期待左右。'
      },
      conscientiousness: {
        high: '你的尽责性较高：自律、有条理、可靠，习惯把事情计划好并坚持执行。',
        mid: '你的尽责性居中：你在大事上靠谱，也能接受适度的灵活与随性，张弛有度。',
        low: '你的尽责性偏低：你更随性灵活、讨厌条条框框，擅长在开放环境中迸发灵感。'
      },
      neuroticism: {
        high: '你的情绪敏感性较高：你感受强烈、容易觉察风险与细节，但也会更容易紧张焦虑。',
        mid: '你的情绪稳定性居中：多数时候能保持平稳，遇到压力时会有波动但能恢复。',
        low: '你的情绪稳定性较高：你遇事冷静、抗压能力强，不容易被外界干扰打乱节奏。'
      },
      openness: {
        high: '你的开放性较高：好奇心强、想象力丰富，乐于接受新观念和新体验，思维活跃。',
        mid: '你的开放性居中：你既愿意尝试新鲜事物，也重视经验与惯例，务实而有弹性。',
        low: '你的开放性偏低：你偏好熟悉、具体和可预期的事物，专注与踏实是你的优势。'
      }
    },
    advice: {
      extraversion: {
        high: [
          '发挥连接者的优势：主动承担需要沟通、协调与表达的角色，你会如鱼得水。',
          '注意给自己留出独处时间，避免过度依赖外部刺激而透支精力。',
          '在人际中练习倾听多于表达，让交流更有深度。'
        ],
        low: [
          '接受并珍惜自己的节奏：深度工作与一对一的交流更适合你，不必强迫自己成为"热闹的人"。',
          '有意识地在重要场合迈出一步（如主动问候、表达观点），每次一点点即可。',
          '选择安静但需要专业深度的岗位或任务，把内向变成专注的优势。'
        ]
      },
      agreeableness: {
        high: [
          '你的合作与共情是稀缺资源：适合团队协作、服务他人、建立信任的工作。',
          '学会说"不"：为重要的事设好边界，避免因过度迎合而委屈自己。',
          '在冲突中练习直接表达感受，而不是一味回避。'
        ],
        low: [
          '你的直率与原则性是优势：适合需要客观判断、坚持标准的场景。',
          '练习在表达观点前先复述对方的立场，减少不必要的对抗感。',
          '有意识地维护关键关系：合作中多给一次信任，往往能换来更长远的支持。'
        ]
      },
      conscientiousness: {
        high: [
          '你是执行力的标杆：适合制定计划、推进项目、精细管理的角色。',
          '警惕完美主义消耗：给任务设定"足够好"的标准，避免在细节上过度停留。',
          '定期留白：计划表里为自己预留弹性时间，接纳意外的发生。'
        ],
        low: [
          '你的灵活与随性适合探索期和创新任务：快速试错是你的天然优势。',
          '用外部工具补足自律：清单、提醒、截止日，把"随性"装进框架里。',
          '把重要事项拆成小的即时动作，减少"开始"的心理门槛。'
        ]
      },
      neuroticism: {
        high: [
          '你的敏感让你更早察觉风险与情绪变化，这是感知力强的体现。',
          '建立情绪急救包：深呼吸、运动、倾诉，在压力刚出现时就启动调节。',
          '减少信息过载，给大脑设置"下班时间"，避免睡前反复反刍。'
        ],
        low: [
          '你的稳定是团队的定海神针：危机时人们会本能地看向你。',
          '适度警觉：过于放松时提醒自己复核关键细节，别让从容变成疏忽。',
          '主动关心身边情绪波动大的伙伴，你的稳定能成为他人的依靠。'
        ]
      },
      openness: {
        high: [
          '你的好奇心适合需要创意、跨界与探索的领域：写作、设计、研究、新产品。',
          '给灵感设置产出通道：把想法快速落地成小作品，避免只停留在空想。',
          '用"聚焦"平衡发散：选一个方向深耕一段时间，让兴趣变成能力。'
        ],
        low: [
          '你的专注与务实让你在熟悉领域越做越精，这是难以替代的价值。',
          '用微小的新体验拓宽视野：换一条路回家、尝试一道新菜、读一本陌生领域的书。',
          '不必追逐流行，找到自己真正在意的一两件事深入下去即可。'
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
