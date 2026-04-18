import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeToggleLabel,
  localeToggleTitle,
  saveLocale
} from "./i18n.js";

const GUIDE_CONTENT = {
  en: {
    title: "GenericAlgoid | Guide",
    eyebrow: "Guide",
    heading: "How to read and play with the evolving world.",
    lead:
      "This page is a compact field manual for the simulation: world rules, behavior logic, gadgets, heredity, trait tags, and the best way to read the screen.",
    back: "Back to simulation",
    dev: "Developer page",
    overview: {
      title: "Visual map",
      lead:
        "The main page keeps the world central. Commands and longer stats stay behind hover buttons so the arena remains readable while the right rail summarizes who is winning.",
      labels: {
        controls: "Quick controls",
        world: "World",
        lineages: "Dominant lineages",
        stats: "Pinned stats",
        peeks: "Hover panels"
      },
      sideCards: [
        {
          title: "Command list",
          body: "Hover the Commands button to see the full key map. The world-edit keys stay the same: P, S, H, C, and L."
        },
        {
          title: "Detailed stats",
          body: "Only population, biodiversity entropy, and total material stay pinned. Hover Detailed stats for the rest."
        },
        {
          title: "World edits",
          body: "Hold a letter while clicking or dragging the world: P feeds, S plants springs, H sculpts terrain as you drag or hold, C deploys a custom lineage, and L charges lightning."
        }
      ]
    },
    gadgets: {
      title: "Three gadgets",
      lead:
        "Every body mounts only these three gadget roles. Reading them visually lets you predict how a lineage will fight before you inspect the numbers.",
      cards: [
        {
          kind: "melee",
          title: "Melee",
          body:
            "A forward blade. It wants contact, hits hardest at close range, and pairs well with bold, fast, risky bodies."
        },
        {
          kind: "ranged",
          title: "Ranged",
          body:
            "A launcher that trades burst for distance. It pressures from outside contact and often appears on watchful, mobile lineages."
        },
        {
          kind: "shield",
          title: "Shield",
          body:
            "A 120 degree arc that softens attacks from one side. It is strongest when the body keeps its facing organized."
        }
      ]
    },
    genetics: {
      title: "What the genome controls",
      lead:
        "A child copies its parent, mutates a little, and survives only if those mutations fit the current world. These inherited knobs feed directly into the ten visible trait tags, body color, and the way a lineage moves through the map.",
      tagTitle: "How the trait tags work",
      tagLead:
        "Dominant lineages shows only two tags per lineage. They are the two strongest summaries of that lineage’s inherited tendencies. Five tags describe what the lineage tends to prioritize, and five describe the kind of body that carries that behavior. Each tag keeps a fixed color, chosen by passing an exaggerated version of that trait through the same body-color palette logic.",
      bridgeTitle: "Parameter-to-tag map",
      bridgeLead:
        "Tags are not arbitrary labels. They appear when a few inherited knobs pull in the same direction strongly enough to create a clear behavioral or body-plan signature.",
      genes: [
        {
          kind: "motor",
          title: "Motor / speed",
          body: "More motor share means faster cruising, quicker turns, and more reach across the map."
        },
        {
          kind: "core",
          title: "Core / durability",
          body: "Core-heavy bodies stay substantial for longer and support brighter, sturdier body colors."
        },
        {
          kind: "gadgetMix",
          title: "Gadget mix",
          body: "Each slot becomes melee, ranged, or shield. This is the clearest source of a lineage’s combat silhouette."
        },
        {
          kind: "sense",
          title: "Sensing",
          body: "Higher sensing widens useful reactions to food and rivals, so the lineage behaves less blindly."
        },
        {
          kind: "cooperation",
          title: "Cooperation",
          body: "High cooperation strengthens Boids-style alignment and cohesion with same-species neighbors."
        },
        {
          kind: "behavior",
          title: "Behavior priorities",
          body:
            "Five inherited weights decide whether food, danger, prey, flocking, or plain cruising wins when several cues are visible at once."
        },
        {
          kind: "risk",
          title: "Encounter thresholds",
          body:
            "Approach and avoid thresholds decide which rivals feel edible, dangerous, or not worth reacting to."
        },
        {
          kind: "birth",
          title: "Birth threshold",
          body: "This is the material amount needed before automatic reproduction. Lower values feel earlier and more prolific."
        },
        {
          kind: "bud",
          title: "Bud fraction",
          body: "Bud fraction sets how much mass gets allocated into a child when reproduction fires."
        },
        {
          kind: "life",
          title: "Lifespan",
          body: "Long-lived bodies stay bright for longer; short-lived ones darken sooner and need faster turnover."
        },
        {
          kind: "shape",
          title: "Body shape",
          body: "Shape genes do not change combat directly, but they create lineage-specific blobs that make evolution easier to see."
        }
      ],
      tags: [
        { tone: "mint", label: "Forager", body: "Food priority dominates, so the lineage bends toward pellets and spring-fed zones quickly." },
        { tone: "violet", label: "Wary", body: "Danger priority and avoidance thresholds stay high, so threats override greed." },
        { tone: "warm", label: "Hunter", body: "Prey priority stays high enough that edible rivals pull motion more strongly than pellets or flocking." },
        { tone: "cool", label: "Flocker", body: "Flock priority plus cooperation makes same-species neighbors the strongest fallback motion." },
        { tone: "cool", label: "Cruiser", body: "Cruise priority is high, so the body keeps flowing straight when nothing more urgent wins." },
        { tone: "cool", label: "Sprinter", body: "Motor-heavy, light-framed bodies that turn movement into map coverage." },
        { tone: "violet", label: "Bulwark", body: "Core and shield investment make a lineage slow to break and easy to spot on the front line." },
        { tone: "warm", label: "Duelist", body: "Melee-heavy geometry and chase-biased thresholds favor direct contact fights." },
        { tone: "cool", label: "Skirmisher", body: "Ranged pressure, motion, and sensing create lineages that fight while staying mobile." },
        { tone: "warm", label: "Brooder", body: "Low birth threshold or large child share makes reproduction trigger early and often." }
      ],
      bridgeRows: [
        {
          inputs: ["Food", "Sense"],
          outputs: [
            { tone: "mint", label: "Forager" }
          ],
          body: "Food-first weights plus good sensing create lineages that visibly comb the map for pellets."
        },
        {
          inputs: ["Danger", "Avoid"],
          outputs: [
            { tone: "violet", label: "Wary" },
            { tone: "violet", label: "Bulwark" }
          ],
          body: "Danger-first lineages either pull back early or invest enough shield and core to survive pressure."
        },
        {
          inputs: ["Prey", "Weapons"],
          outputs: [
            { tone: "warm", label: "Hunter" },
            { tone: "warm", label: "Duelist" },
            { tone: "cool", label: "Skirmisher" }
          ],
          body: "Prey-first lineages split into contact duelists or ranged skirmishers depending on gadget mix."
        },
        {
          inputs: ["Flock", "Co-op"],
          outputs: [
            { tone: "cool", label: "Flocker" }
          ],
          body: "High flock weights only read clearly when cooperation is also high enough for same-species alignment to matter."
        },
        {
          inputs: ["Cruise", "Motor"],
          outputs: [
            { tone: "cool", label: "Cruiser" },
            { tone: "cool", label: "Sprinter" }
          ],
          body: "Cruise-heavy lineages hold course, and if motor is also high they read as long-range runners."
        },
        {
          inputs: ["Birth", "Bud"],
          outputs: [
            { tone: "warm", label: "Brooder" }
          ],
          body: "Reproduction tags show up when inherited birth mass and child share both lean toward rapid turnover."
        }
      ]
    },
    sections: {
      behavior: {
        title: "Behavior engine",
        lead:
          "Cells no longer follow one global fixed order. Each visible cue creates one candidate motion, and five inherited priority weights decide whether food, danger, prey, flocking, or cruising wins this frame.",
        priorities: [
          {
            tone: "mint",
            title: "Food drive",
            body: "Visible pellets pull the body toward free mass. Food-first lineages spend more of their life sweeping resource lanes."
          },
          {
            tone: "warm",
            title: "Danger drive",
            body: "A rival above the avoid threshold generates an escape vector. Wary lineages let this override almost everything else."
          },
          {
            tone: "cool",
            title: "Prey drive",
            body: "If a rival looks edible, the chase vector competes with food and danger. Hunter lineages let this win often."
          },
          {
            tone: "violet",
            title: "Flock drive",
            body: "Same-species neighbors generate Boids separation, alignment, and cohesion. Flocker lineages treat this as their default social motion."
          },
          {
            tone: "cool",
            title: "Cruise drive",
            body: "When nothing else wins, the body simply continues forward. Cruise-heavy lineages keep that inertial feel even in mixed situations."
          }
        ],
        items: [
          "Same-species neighbors never trigger friendly fire. They only contribute flocking vectors.",
          "Priority genes choose between the five drives; cooperation then changes how strongly the flock drive can matter.",
          "Sensing sets how far the reaction horizon reaches for food, danger, prey, and same-species neighbors.",
          "Encounter thresholds still matter: priority alone cannot make a target count as food, prey, or danger.",
          "Terrain does not replace decision logic. It only changes movement cost, so the same drive weights produce different routes on ridges and foothills.",
          "Because the world is toroidal, every drive reacts to the nearest wrapped distance, not naive screen distance."
        ]
      },
      rules: {
        title: "World rules",
        lead: "These rules explain most of the ecology you see on screen.",
        items: [
          "The world is a torus, so movement, sensing, and attacks all wrap through opposite edges.",
          "Each body carries 3 to 7 directional gadgets, and every slot is melee, ranged, or shield.",
          "Attacks reduce lifetime first. Material changes owner only after a target dies.",
          "Shields cover a 120 degree sector and soften damage instead of blocking perfectly.",
          "Springs create free mass, but pause whenever nearby pellets are already abundant.",
          "Old free mass decays away, so the map keeps circulating instead of filling forever.",
          "Reproduction is automatic once inherited birth threshold is crossed, and occasional speciation splits off visible new lineages.",
          "Terrain is continuous friction, not a hard wall: ridges bend traffic while foothills remain passable."
        ],
        tiles: [
          {
            kind: "torus",
            title: "Wrap",
            body: "Leaving one edge means re-entering from the opposite side."
          },
          {
            kind: "combat",
            title: "Combat",
            body: "Weapons cut lifetime first. Material changes hands after death."
          },
          {
            kind: "flock",
            title: "Flock",
            body: "Same-species cells align, cohere, and keep a little spacing."
          }
        ]
      },
      read: {
        title: "How to read the screen",
        lead: "The right rail works like a compressed ecosystem dashboard: four dominant-lineage cards, one share donut, and a tiny stat strip together tell you who is winning, how evenly the world is split, and what kind of bodies are doing it.",
        items: [
          "A dominant-lineage card bundles a live representative body, two inherited trait tags, raw count, diversity percentage, and a compact capability glyph.",
          "The lineage-share donut shows whether the top lineages dominate together or whether the population is widely spread.",
          "Only population, biodiversity entropy, and total material stay pinned all the time.",
          "Detailed stats is deliberately hidden behind hover so the world keeps maximum screen area.",
          "Body gradients come from the genome, so similar palettes usually mean genetic proximity.",
          "Bodies darken as lifetime runs low, which makes ageing waves visible without opening any menu."
        ],
        labels: {
          controls: "Quick controls",
          world: "World action",
          lineages: "Lineage strip",
          stats: "Pinned stats",
          peeks: "Hover panels"
        }
      },
      experiments: {
        title: "Experiment ideas",
        lead: "These setups tend to create visible ecological shifts very quickly.",
        items: [
          "Lay down a narrow food line and see whether one lineage starts patrolling it like a road.",
          "Place distant springs and watch whether separate flocking cultures emerge around them.",
          "Raise a low mountain ridge between resource zones and watch how patrol routes reroute around it.",
          "Erase a dominant cluster with lightning and observe which lineage fills the vacuum.",
          "Raise total material and compare whether diversity stays high or collapses into a few strong forms."
        ],
        cards: [
          {
            kind: "bait",
            title: "Bait line",
            body: "A thin feeding trail often produces patrol routes and ambush spots."
          },
          {
            kind: "springfield",
            title: "Twin springs",
            body: "Two distant fountains can split the arena into competing neighborhoods."
          },
          {
            kind: "reset",
            title: "Shock reset",
            body: "Lightning a dominant blob and watch the vacant niche refill."
          }
        ]
      }
    },
    notesTitle: "Notes",
    notes: [
      "Dominant lineages updates more slowly than the world view, so it stays cheaper to render.",
      "Lineage sample images refresh from a recent representative, so the miniatures stay closer to what is actually alive in the world.",
      "Only three metrics stay pinned on screen. Use the Detailed stats hover panel when you want the longer readout.",
      "The simulation is mostly client-side. If it feels heavy, lower population, lower total material, or reduce visible effects."
    ]
  },
  ja: {
    title: "GenericAlgoid | 解説",
    eyebrow: "解説",
    heading: "進化する世界の見方と遊び方",
    lead:
      "このページは、シミュレーションの図解マニュアルです。世界のルール、行動原理、ガジェット、遺伝、タグ、画面の読み方を、図版つきでまとめています。",
    back: "シミュレーションへ戻る",
    dev: "開発者ページ",
    overview: {
      title: "全体図",
      lead:
        "メイン画面は、世界を最優先に読むための配置です。コマンドや長い統計は必要なときだけホバーで出し、右側には優勢系統と最小限の統計だけを残しています。",
      labels: {
        controls: "クイック操作",
        world: "世界",
        lineages: "Dominant lineages",
        stats: "常設統計",
        peeks: "ホバー情報"
      },
      sideCards: [
        {
          title: "コマンド一覧",
          body: "コマンド一覧ボタンにマウスを乗せると、P / S / H / C / L を含む操作キーをまとめて見られます。"
        },
        {
          title: "詳細な統計",
          body: "画面に常設されるのは、個体数・多様性 entropy・総素材量だけです。残りは詳細な統計にまとめています。"
        },
        {
          title: "世界への介入",
          body: "文字キーを押しながらクリックやドラッグで世界に介入します。P はエサ、S は泉、H はドラッグや長押しで山、C は自作種、L は雷です。"
        }
      ]
    },
    gadgets: {
      title: "3つのガジェット",
      lead:
        "個体が持てるガジェットの役割はこの 3 種だけです。見た目だけで「どんな戦い方をする系統か」をだいたい読めるようにしています。",
      cards: [
        {
          kind: "melee",
          title: "近接",
          body:
            "前方へ突き出す刃。接触したときに強く、前へ出る速い個体や攻撃的な系統と相性がいいです。"
        },
        {
          kind: "ranged",
          title: "遠隔",
          body:
            "距離を取って撃つ発射器。接触前から圧力をかけやすく、感知が高い系統で目立ちやすいです。"
        },
        {
          kind: "shield",
          title: "防御",
          body:
            "一方向 120 度を守る扇形シールド。完全無効ではなく軽減ですが、向きを揃えた群れで特に効きます。"
        }
      ]
    },
    genetics: {
      title: "遺伝情報が決めること",
      lead:
        "子は親の遺伝子をほぼ引き継ぎ、少しだけ変異します。そして、その変異が今の世界で有利なら残ります。下の項目が、見た目と行動の大部分を決め、さらに 10 種類の特徴タグとして要約されます。",
      tagTitle: "特徴タグの読み方",
      tagLead:
        "優勢系統には各 lineage のタグが 2 つだけ表示されます。これはその系統の遺伝的傾向を強く要約した上位 2 つです。タグは「何を優先して動くか」の 5 種と、「どんな体でそれを実行するか」の 5 種に分かれています。色は lineage ごとではなくタグごとに固定で、その特徴が極端に強い個体を仮想的に作って、体色計算に通した結果を使っています。",
      bridgeTitle: "遺伝パラメータからタグへ",
      bridgeLead:
        "タグは飾りではありません。いくつかの遺伝パラメータが同じ方向へ強く寄ったとき、その系統の行動傾向や体つきを短い言葉で要約して表示しています。",
      genes: [
        {
          kind: "motor",
          title: "モーター / 速度",
          body: "モーター配分が大きいほど移動が軽くなり、地図全体に出やすくなります。"
        },
        {
          kind: "core",
          title: "コア / 頑丈さ",
          body: "コア配分が厚いほど、長く場に残りやすく、体色もどっしりした印象になりやすいです。"
        },
        {
          kind: "gadgetMix",
          title: "ガジェット構成",
          body: "各スロットが近接・遠隔・防御のどれになるかです。戦い方の輪郭がここで決まります。"
        },
        {
          kind: "sense",
          title: "感知",
          body: "感知が高いほど、エサや敵への反応が早くなり、動きが鈍く見えにくくなります。"
        },
        {
          kind: "cooperation",
          title: "協調性",
          body: "協調性が高いと、同種どうしで向きを揃え、群れとしてまとまりやすくなります。"
        },
        {
          kind: "behavior",
          title: "行動優先度",
          body:
            "エサ・危険・獲物・群れ・巡航の 5 候補のうち、どの行動を今フレームで採るかを決める遺伝重みです。"
        },
        {
          kind: "risk",
          title: "接近 / 回避閾値",
          body: "どの相手を獲物とみなし、どの相手を危険とみなすかを決める境界です。"
        },
        {
          kind: "birth",
          title: "出産閾値",
          body: "どれだけ素材を持てば自動繁殖するかです。低いほど早産で、多産になりやすいです。"
        },
        {
          kind: "bud",
          title: "分裂率",
          body: "繁殖時に子へどれだけ素材を切り分けるかです。大きいほど子が重く生まれます。"
        },
        {
          kind: "life",
          title: "寿命",
          body: "寿命が長い個体は長く明るいまま残り、短い個体は早く暗くなって世代交代します。"
        },
        {
          kind: "shape",
          title: "体の形",
          body: "形状遺伝子は戦闘性能には直結しませんが、系統差を目で追いやすくしてくれます。"
        }
      ],
      tags: [
        { tone: "mint", label: "採食家", body: "エサ優先度が高く、泉や遊離素材へすばやく寄っていく系統です。" },
        { tone: "violet", label: "用心深い", body: "危険優先度と回避閾値が高く、脅威を見たらまず距離を取る系統です。" },
        { tone: "warm", label: "狩猟型", body: "獲物優先度が高く、食えそうな相手が見えると追跡に寄る系統です。" },
        { tone: "cool", label: "群行型", body: "群れ優先度と協調性が高く、同種の流れに乗りやすい系統です。" },
        { tone: "cool", label: "巡航型", body: "巡航優先度が高く、何も勝たないときは直進を保ちやすい系統です。" },
        { tone: "cool", label: "俊足", body: "モーター寄りで、地図を広く速く使う軽量フレームの系統です。" },
        { tone: "violet", label: "重装型", body: "コアと防御が厚く、前線でも崩れにくい系統です。" },
        { tone: "warm", label: "接近戦", body: "近接寄りで、正面からの衝突と刺突を得意にする系統です。" },
        { tone: "cool", label: "遊撃型", body: "遠隔・感知・機動力が噛み合い、動きながら圧をかける系統です。" },
        { tone: "warm", label: "多産", body: "出産閾値が低いか分裂率が高く、早い周期で子を出しやすい系統です。" }
      ],
      bridgeRows: [
        {
          inputs: ["エサ", "感知"],
          outputs: [
            { tone: "mint", label: "採食家" }
          ],
          body: "エサ優先度と感知が揃うと、素材の筋や泉の周りを掃く採食家らしい動きになります。"
        },
        {
          inputs: ["危険", "回避"],
          outputs: [
            { tone: "violet", label: "用心深い" },
            { tone: "violet", label: "重装型" }
          ],
          body: "危険を優先する系統は、早逃げするか、そもそも防御とコアを厚くして圧に耐えるかに分かれます。"
        },
        {
          inputs: ["獲物", "武装"],
          outputs: [
            { tone: "warm", label: "狩猟型" },
            { tone: "warm", label: "接近戦" }
          ],
          body: "獲物優先度が高い系統は、近接なら接近戦、遠隔なら遊撃型として分かれます。"
        },
        {
          inputs: ["遠隔", "機動"],
          outputs: [
            { tone: "cool", label: "遊撃型" }
          ],
          body: "遠隔火力に機動力と感知が重なると、接触せずに圧をかけ続ける遊撃型になります。"
        },
        {
          inputs: ["群れ", "協調"],
          outputs: [
            { tone: "cool", label: "群行型" }
          ],
          body: "群れ優先度だけでなく協調性も高いと、同種に引かれて流れる群行型になります。"
        },
        {
          inputs: ["巡航", "速度"],
          outputs: [
            { tone: "cool", label: "巡航型" },
            { tone: "cool", label: "俊足" }
          ],
          body: "巡航優先度とモーターが高いと、刺激が薄い場所でも流れるように進み続けます。"
        },
        {
          inputs: ["出産閾値", "分裂率"],
          outputs: [
            { tone: "warm", label: "多産" }
          ],
          body: "出産閾値と分裂率がどちらも子を出しやすい側へ寄ると、多産タグが出ます。"
        }
      ]
    },
    sections: {
      behavior: {
        title: "個体の行動原理",
        lead:
          "個体は固定の優先順位表ではなく、エサ・危険・獲物・群れ・巡航という 5 つの行動候補に対する遺伝的な重みで、毎フレームの方針を決めます。",
        priorities: [
          {
            tone: "mint",
            title: "エサドライブ",
            body: "視界内の遊離素材へ向かう候補です。エサ優先度が高い系統ほどこの候補が勝ちやすくなります。"
          },
          {
            tone: "warm",
            title: "危険ドライブ",
            body: "危険判定された相手から離れる候補です。用心深い系統ではこれがほぼ最優先になります。"
          },
          {
            tone: "cool",
            title: "獲物ドライブ",
            body: "食えそうな相手へ詰める候補です。狩猟型の系統ではエサよりこちらが勝つこともあります。"
          },
          {
            tone: "violet",
            title: "群れドライブ",
            body: "同種に対する separation / alignment / cohesion です。群行型ではこれが平時の主軸になります。"
          },
          {
            tone: "cool",
            title: "巡航ドライブ",
            body: "どの刺激も勝たないときに今の向きを保つ候補です。巡航型では混雑時でも勝ちやすいです。"
          }
        ],
        items: [
          "同種どうしでは friendly fire が起きず、代わりに Boids 型の群れベクトルが働きます。",
          "優先度遺伝子が 5 候補の勝敗を決め、協調性はそのうち群れドライブの強さを押し上げます。",
          "感知半径が広いほど、エサ・敵・獲物・同種への反応が早い段階で起きます。",
          "接近閾値と回避閾値があるので、優先度が高くても、そもそも獲物や危険と判定されない相手には反応しません。",
          "山地は判断ロジックを変えるのではなく、移動コストを変えて経路だけを曲げます。",
          "世界はトーラスなので、視界判定も最短の巻き戻し距離で行われます。"
        ]
      },
      rules: {
        title: "世界のルール",
        lead: "このルールを押さえると、画面の出来事の大半が読み解けます。",
        items: [
          "世界はトーラスなので、移動・視界・攻撃のすべてが端をまたいでつながります。",
          "各個体は 3〜7 個の方向ガジェットを持ち、各スロットは近接・遠隔・防御のどれかです。",
          "攻撃はまず寿命を削り、素材が動くのは相手が死んだ後だけです。",
          "防御は 120 度の扇範囲からの攻撃を軽減しますが、完全無効ではありません。",
          "泉は遊離素材を生みますが、周囲に十分な素材がある間は自動で停止します。",
          "長く拾われない遊離素材は自然消滅するので、世界が素材塊だらけのまま固定されません。",
          "繁殖は閾値を超えた瞬間に自動で起き、ときどき visible lineage が枝分かれします。",
          "地形は壁ではなく減速場です。山頂ほど動きにくく、麓や谷が交通路になります。"
        ],
        tiles: [
          {
            kind: "torus",
            title: "トーラス",
            body: "端から出ると反対側へそのまま現れます。"
          },
          {
            kind: "combat",
            title: "戦闘",
            body: "寿命を削って倒し、その後で素材が回収されます。"
          },
          {
            kind: "flock",
            title: "群れ",
            body: "同種は向きを揃えつつ、少し距離も保ちます。"
          }
        ]
      },
      read: {
        title: "画面の見方",
        lead: "右側の情報は、生態系を読むための圧縮ダッシュボードです。上位 4 系統のカード、系統シェア円グラフ、最小限の常設統計をまとめて読むと、今どの系統がどのくらい優勢かが掴めます。",
        items: [
          "優勢系統カードには、代表個体サンプル、2つの遺伝特徴タグ、能力グリフ、個体数がまとめて入っています。",
          "系統シェア円グラフは、上位4系統とその他の占有率を示します。一強なのか、分散しているのかが一目でわかります。",
          "常設統計は、個体数・多様性 entropy・総素材量の 3 つだけです。",
          "長い統計は詳細な統計のホバーに、深い操作はメニューに追い出してあるので、世界の視認性を優先できます。",
          "体色グラデーションは遺伝情報由来なので、似た色どうしは遺伝的にも近いことが多いです。",
          "寿命が減ると個体は暗くなるので、老齢化の波が画面上で見分けられます。"
        ],
        labels: {
          controls: "クイック操作",
          world: "世界の出来事",
          lineages: "系統一覧",
          stats: "常設統計",
          peeks: "ホバー情報"
        }
      },
      experiments: {
        title: "遊び方の例",
        lead: "下のような配置は、比較的短時間で生態系の違いが見えやすくなります。",
        items: [
          "細長くエサを置いて、どの系統が巡回し始めるかを観察する。",
          "離れた場所に複数の泉を置いて、別々の群れ文化が育つかを見る。",
          "泉どうしのあいだに低い山脈を作って、交通路がどう曲がるかを見る。",
          "雷で優勢クラスタだけを消して、空いた生態的地位をどの系統が埋めるかを見る。",
          "総素材量を増やして、多様性が保たれるか、それとも少数系統に収束するかを比べる。"
        ],
        cards: [
          {
            kind: "bait",
            title: "エサの筋",
            body: "細いエサ場は巡回路や待ち伏せ地点を作りやすいです。"
          },
          {
            kind: "springfield",
            title: "二つの泉",
            body: "遠い泉どうしは、別々の勢力圏を生みやすいです。"
          },
          {
            kind: "reset",
            title: "雷リセット",
            body: "優勢群を崩すと、空いた地位に別系統が入り込みます。"
          }
        ]
      }
    },
    notesTitle: "補足",
    notes: [
      "Dominant lineages は世界ビューより低頻度で更新されるので、描画負荷を抑えています。",
      "系統サンプル画像は最近の代表個体から更新されるので、世界にいる本物とのズレを減らしています。",
      "画面に常設される統計は 3 項目だけです。長い統計は詳細な統計のホバーから読む想定です。",
      "計算の大半はブラウザ側で動いています。重いときは個体数や総素材量を下げると効きます。"
    ]
  }
};

const GUIDE_MOCK_TEXT = {
  en: {
    commandsButton: "Commands",
    commandChips: [
      "P drag feed",
      "S click spring",
      "H drag mountain",
      "C click custom",
      "L hold lightning"
    ],
    pop: "Pop",
    entropy: "Entropy",
    material: "Material",
    hover: "Hover",
    detailed: "Detailed stats",
    commands: "Commands",
    menu: "Menu",
    menuSummary: "focus · design · BGM · SFX",
    share: "Lineage share",
    others: "Others"
  },
  ja: {
    commandsButton: "コマンド一覧",
    commandChips: [
      "P ドラッグでエサ",
      "S クリックで泉",
      "H ドラッグで山",
      "C クリックで自作種",
      "L 長押しで雷"
    ],
    pop: "個体数",
    entropy: "多様性",
    material: "総素材",
    hover: "ホバー",
    detailed: "詳細な統計",
    commands: "コマンド",
    menu: "メニュー",
    menuSummary: "注目・設計・BGM・効果音",
    share: "系統シェア",
    others: "その他"
  }
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shipSvg(x, y, angle, color, scale = 1, dim = 1) {
  return `
    <g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" opacity="${dim}">
      <path d="M -18 -10 Q -4 -15 18 0 Q -4 15 -18 10 Q -12 0 -18 -10 Z" fill="${color}" />
      <ellipse cx="5" cy="0" rx="7.5" ry="4.8" fill="rgba(223,247,255,0.88)" />
      <path d="M -19 -6 L -28 0 L -19 6" fill="none" stroke="rgba(255,214,142,0.82)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M -3 0 L 16 0" fill="none" stroke="rgba(12,30,40,0.78)" stroke-width="2" stroke-linecap="round" />
    </g>
  `;
}

function pelletSvg(x, y, r = 5) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,236,170,0.95)" />`;
}

function springSvg(x, y, radius = 18, overloaded = false) {
  const outer = overloaded ? "rgba(255,181,110,0.34)" : "rgba(111,235,212,0.22)";
  const inner = overloaded ? "rgba(255,224,176,0.88)" : "rgba(192,255,245,0.88)";
  const core = overloaded ? "rgba(255,166,98,0.86)" : "rgba(111,235,212,0.92)";
  return `
    <g transform="translate(${x} ${y})">
      <circle r="${radius * 3.8}" fill="${outer}" />
      <circle r="${radius * 1.3}" fill="none" stroke="${core}" stroke-width="2.3" stroke-dasharray="5 7" />
      <circle r="${radius * 0.66}" fill="${inner}" />
      <circle r="${radius * 0.3}" fill="${core}" />
    </g>
  `;
}

function lightningPolyline(points, color, width, opacity = 1) {
  return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
}

function worldSceneSvg() {
  return `
    <svg class="guide-figure-svg" viewBox="0 0 820 500" role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="guide-world-glow" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="rgba(109,234,212,0.16)" />
          <stop offset="60%" stop-color="rgba(109,234,212,0.06)" />
          <stop offset="100%" stop-color="rgba(109,234,212,0)" />
        </radialGradient>
      </defs>
      <rect width="820" height="500" rx="22" fill="rgba(6,14,22,0.86)" />
      <path
        d="M0 354 C78 298 154 286 226 318 C304 352 380 366 452 336 C528 304 604 254 676 264 C740 272 786 302 820 332 V500 H0 Z"
        fill="rgba(120,85,56,0.2)"
      />
      <path
        d="M0 388 C92 334 170 324 242 354 C320 386 398 398 476 372 C556 346 632 292 706 296 C758 298 794 318 820 336"
        fill="none"
        stroke="rgba(194,154,108,0.16)"
        stroke-width="12"
        stroke-linecap="round"
      />
      <path
        d="M0 410 C104 360 180 350 256 380 C334 410 412 422 490 394 C570 366 646 316 720 320 C764 322 796 332 820 344"
        fill="none"
        stroke="rgba(220,186,142,0.12)"
        stroke-width="6"
        stroke-linecap="round"
      />
      <path d="M0 110 H820 M0 245 H820 M0 380 H820 M170 0 V500 M330 0 V500 M490 0 V500 M650 0 V500"
        stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <circle cx="608" cy="212" r="118" fill="url(#guide-world-glow)" />
      ${pelletSvg(176, 162, 6)}
      ${pelletSvg(212, 182, 5)}
      ${pelletSvg(244, 201, 4.5)}
      ${pelletSvg(278, 218, 5)}
      ${pelletSvg(312, 233, 5.5)}
      ${pelletSvg(350, 244, 4.8)}
      ${shipSvg(238, 258, -12, "#7fe1ff", 1.08)}
      ${shipSvg(402, 186, 22, "#f49f86", 0.94)}
      ${shipSvg(548, 330, -32, "#87ffcf", 1.12)}
      ${shipSvg(660, 260, 155, "#a3b8ff", 0.94, 0.86)}
      ${shipSvg(708, 104, 174, "#d7a7ff", 0.84, 0.62)}
      ${springSvg(606, 212, 18)}
      ${lightningPolyline("612,66 584,126 626,162 598,234 648,276", "rgba(105,219,255,0.34)", 18, 0.9)}
      ${lightningPolyline("612,66 584,126 626,162 598,234 648,276", "rgba(255,247,214,0.72)", 7.4)}
      ${lightningPolyline("612,66 584,126 626,162 598,234 648,276", "rgba(255,255,255,0.92)", 2.4)}
    </svg>
  `;
}

function buildOverviewScreen(labels, locale = "en") {
  const mockText = GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en;
  return `
    <div class="guide-screen-mock">
      <div class="guide-mock-toolbar">
        <div class="guide-toolbar-group">
          <span class="guide-toolbar-pill is-small">☰</span>
          <span class="guide-toolbar-pill">${escapeHtml(mockText.commandsButton)}</span>
        </div>
        <div class="guide-toolbar-group">
          <span class="guide-toolbar-pill">3.00x</span>
          <span class="guide-toolbar-pill">500</span>
          <span class="guide-toolbar-pill">40000</span>
        </div>
        <div class="guide-toolbar-group">
          <span class="guide-toolbar-pill is-small">fast</span>
          <span class="guide-toolbar-pill is-small">JP</span>
          <span class="guide-toolbar-pill is-small">dev</span>
          <span class="guide-toolbar-pill is-small">guide</span>
        </div>
        <div class="guide-toolbar-popover">
          ${mockText.commandChips
            .map((chip) => `<span class="guide-command-chip">${escapeHtml(chip)}</span>`)
            .join("")}
        </div>
        <span class="guide-callout guide-callout-controls">${escapeHtml(labels.controls)}</span>
        <span class="guide-callout guide-callout-peeks">${escapeHtml(labels.peeks)}</span>
      </div>
      <div class="guide-mock-body">
        <div class="guide-world-pane">
          ${worldSceneSvg()}
          <div class="guide-stage-stats">
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml(mockText.pop)}</span>
              <strong>537</strong>
            </div>
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml(mockText.entropy)}</span>
              <strong>6.19</strong>
            </div>
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml(mockText.material)}</span>
              <strong>40000</strong>
            </div>
            <div class="guide-stage-stat-mini guide-stage-stat-button">
              <span>${escapeHtml(mockText.hover)}</span>
              <strong>${escapeHtml(mockText.detailed)}</strong>
            </div>
            <div class="guide-stats-popover">
              <span>Lineages 89</span>
              <span>Free mass 8210</span>
              <span>Births 166</span>
              <span>Deaths 16</span>
            </div>
          </div>
          <span class="guide-callout guide-callout-world">${escapeHtml(labels.world)}</span>
          <span class="guide-callout guide-callout-stats">${escapeHtml(labels.stats)}</span>
        </div>
        <div class="guide-side-pane">
          <div class="guide-lineage-mini is-active">
            <span class="guide-lineage-sample guide-lineage-sample-a"></span>
            <div class="guide-lineage-meta">
              <strong>Wolf</strong>
              <span>28 cells</span>
              <div class="guide-lineage-tags">
                <span class="guide-lineage-tag is-warm">Hunter</span>
                <span class="guide-lineage-tag is-warm">Duelist</span>
              </div>
            </div>
            <span class="guide-lineage-chart"></span>
          </div>
          <div class="guide-lineage-mini">
            <span class="guide-lineage-sample guide-lineage-sample-b"></span>
            <div class="guide-lineage-meta">
              <strong>Dove</strong>
              <span>19 cells</span>
              <div class="guide-lineage-tags">
                <span class="guide-lineage-tag is-cool">Flocker</span>
                <span class="guide-lineage-tag is-mint">Forager</span>
              </div>
            </div>
            <span class="guide-lineage-chart is-cool"></span>
          </div>
          <div class="guide-lineage-mini">
            <span class="guide-lineage-sample guide-lineage-sample-c"></span>
            <div class="guide-lineage-meta">
              <strong>Fork</strong>
              <span>13 cells</span>
              <div class="guide-lineage-tags">
                <span class="guide-lineage-tag is-cool">Cruiser</span>
                <span class="guide-lineage-tag is-cool">Skirmisher</span>
              </div>
            </div>
            <span class="guide-lineage-chart is-warm"></span>
          </div>
          <div class="guide-lineage-mini">
            <span class="guide-lineage-sample guide-lineage-sample-d"></span>
            <div class="guide-lineage-meta">
              <strong>Lily</strong>
              <span>9 cells</span>
              <div class="guide-lineage-tags">
                <span class="guide-lineage-tag is-violet">Wary</span>
                <span class="guide-lineage-tag is-violet">Bulwark</span>
              </div>
            </div>
            <span class="guide-lineage-chart is-violet"></span>
          </div>
          <div class="guide-share-card">
            <div class="guide-share-head">
              <strong>${escapeHtml(mockText.share)}</strong>
              <span>Top 4</span>
            </div>
            <div class="guide-share-donut">
              <span>100</span>
            </div>
            <div class="guide-share-legend">
              <span><i class="is-a"></i>Wolf 28%</span>
              <span><i class="is-b"></i>Dove 19%</span>
              <span><i class="is-c"></i>Fork 13%</span>
              <span><i class="is-d"></i>Lily 9%</span>
              <span><i class="is-o"></i>${escapeHtml(mockText.others)} 31%</span>
            </div>
          </div>
          <div class="guide-peek-mini">
            <div class="guide-peek-row">
              <strong>${escapeHtml(mockText.commands)}</strong>
              <span>P / S / H / C / L</span>
            </div>
            <div class="guide-peek-row">
              <strong>${escapeHtml(mockText.menu)}</strong>
              <span>${escapeHtml(mockText.menuSummary)}</span>
            </div>
          </div>
          <span class="guide-callout guide-callout-lineages">${escapeHtml(labels.lineages)}</span>
        </div>
      </div>
    </div>
  `;
}

function buildGadgetVisual(kind) {
  if (kind === "melee") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 136" role="presentation" aria-hidden="true">
        <rect width="220" height="136" rx="18" fill="rgba(7,14,22,0.9)" />
        ${shipSvg(72, 70, -4, "#8be0ff", 0.96)}
        <path d="M96 68 L154 68" stroke="rgba(255,185,132,0.95)" stroke-width="7" stroke-linecap="round" />
        <path d="M142 58 L176 68 L142 78" fill="none" stroke="rgba(255,225,188,0.96)" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M118 54 L132 68 L118 82" fill="none" stroke="rgba(255,136,92,0.86)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="165" cy="68" r="28" fill="rgba(255,164,118,0.08)" />
      </svg>
    `;
  }
  if (kind === "ranged") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 136" role="presentation" aria-hidden="true">
        <rect width="220" height="136" rx="18" fill="rgba(7,14,22,0.9)" />
        ${shipSvg(64, 84, -10, "#96f0d7", 0.92)}
        <path d="M92 78 L126 62" stroke="rgba(109,235,212,0.4)" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="5 7" />
        <circle cx="140" cy="56" r="10" fill="rgba(114,232,255,0.9)" />
        <circle cx="140" cy="56" r="22" fill="rgba(114,232,255,0.14)" />
        <circle cx="140" cy="56" r="36" fill="rgba(114,232,255,0.06)" />
        ${shipSvg(174, 48, 170, "#f7a48e", 0.78, 0.78)}
      </svg>
    `;
  }
  return `
    <svg class="guide-figure-svg" viewBox="0 0 220 136" role="presentation" aria-hidden="true">
      <rect width="220" height="136" rx="18" fill="rgba(7,14,22,0.9)" />
      ${shipSvg(80, 68, 0, "#8de8d2", 0.94)}
      <path d="M112 40 A46 46 0 0 1 112 96" fill="none" stroke="rgba(111,235,212,0.96)" stroke-width="10" stroke-linecap="round" />
      <path d="M118 32 A58 58 0 0 1 118 104" fill="none" stroke="rgba(111,235,212,0.2)" stroke-width="18" stroke-linecap="round" />
      <path d="M118 44 A42 42 0 0 1 118 92" fill="none" stroke="rgba(214,255,247,0.84)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="4 6" />
      ${shipSvg(168, 68, 180, "#ffad90", 0.78, 0.78)}
    </svg>
  `;
}

function buildGenomeAtlasVisual(locale = "en") {
  const labels =
    locale === "ja"
      ? {
          body: "本体",
          bodyMeta: "コア・速度・形・寿命",
          combat: "戦闘",
          combatMeta: "近接・遠隔・防御・攻撃性",
          social: "社会",
          socialMeta: "感知・協調・接近・回避",
          reproduction: "繁殖",
          reproductionMeta: "出産閾値・分裂率"
        }
      : {
          body: "Body",
          bodyMeta: "core, motor, shape, lifespan",
          combat: "Combat",
          combatMeta: "melee, ranged, shield, risk",
          social: "Social",
          socialMeta: "sense, cooperation, chase, avoid",
          reproduction: "Reproduction",
          reproductionMeta: "birth threshold, bud fraction"
        };
  return `
    <svg class="guide-figure-svg" viewBox="0 0 760 250" role="presentation" aria-hidden="true">
      <rect width="760" height="250" rx="24" fill="rgba(7,14,22,0.9)" />
      <path d="M308 42 C356 92, 404 158, 452 208" fill="none" stroke="rgba(111,235,212,0.34)" stroke-width="8" stroke-linecap="round" />
      <path d="M452 42 C404 92, 356 158, 308 208" fill="none" stroke="rgba(255,176,132,0.26)" stroke-width="8" stroke-linecap="round" />
      <path d="M320 52 L440 52 M334 84 L426 84 M346 116 L414 116 M346 144 L414 144 M334 176 L426 176 M320 208 L440 208"
        stroke="rgba(233,244,255,0.56)" stroke-width="2.4" stroke-linecap="round" />
      <g>
        <rect x="54" y="48" width="156" height="58" rx="18" fill="rgba(116,226,255,0.1)" stroke="rgba(116,226,255,0.3)" />
        <text x="78" y="72" fill="rgba(231,243,239,0.9)" font-size="14" font-weight="700">${escapeHtml(labels.body)}</text>
        <text x="78" y="92" fill="rgba(206,219,230,0.8)" font-size="12">${escapeHtml(labels.bodyMeta)}</text>
      </g>
      <g>
        <rect x="548" y="48" width="156" height="58" rx="18" fill="rgba(255,173,132,0.1)" stroke="rgba(255,173,132,0.3)" />
        <text x="572" y="72" fill="rgba(231,243,239,0.9)" font-size="14" font-weight="700">${escapeHtml(labels.combat)}</text>
        <text x="572" y="92" fill="rgba(206,219,230,0.8)" font-size="12">${escapeHtml(labels.combatMeta)}</text>
      </g>
      <g>
        <rect x="54" y="152" width="156" height="58" rx="18" fill="rgba(145,238,196,0.1)" stroke="rgba(145,238,196,0.28)" />
        <text x="78" y="176" fill="rgba(231,243,239,0.9)" font-size="14" font-weight="700">${escapeHtml(labels.social)}</text>
        <text x="78" y="196" fill="rgba(206,219,230,0.8)" font-size="12">${escapeHtml(labels.socialMeta)}</text>
      </g>
      <g>
        <rect x="548" y="152" width="156" height="58" rx="18" fill="rgba(210,178,255,0.1)" stroke="rgba(210,178,255,0.26)" />
        <text x="572" y="176" fill="rgba(231,243,239,0.9)" font-size="14" font-weight="700">${escapeHtml(labels.reproduction)}</text>
        <text x="572" y="196" fill="rgba(206,219,230,0.8)" font-size="12">${escapeHtml(labels.reproductionMeta)}</text>
      </g>
    </svg>
  `;
}

function buildBehaviorScene(locale = "en") {
  const labels =
    locale === "ja"
      ? {
          food: "エサ",
          threat: "危険",
          prey: "獲物",
          flock: "同種"
        }
      : {
          food: "Food",
          threat: "Threat",
          prey: "Prey",
          flock: "Flock"
        };
  return `
    <svg class="guide-figure-svg" viewBox="0 0 360 250" role="presentation" aria-hidden="true">
      <rect width="360" height="250" rx="22" fill="rgba(7,14,22,0.9)" />
      <circle cx="182" cy="128" r="82" fill="rgba(111,235,212,0.05)" stroke="rgba(111,235,212,0.22)" stroke-width="2.4" stroke-dasharray="7 8" />
      ${shipSvg(180, 128, -12, "#8be0ff", 1.05)}
      ${pelletSvg(92, 70, 6)}
      ${pelletSvg(114, 84, 5)}
      ${pelletSvg(136, 92, 4.6)}
      <path d="M150 108 C132 96 122 86 106 78" fill="none" stroke="rgba(145,238,196,0.88)" stroke-width="4" stroke-linecap="round" />
      <path d="M148 106 L134 104 L142 118" fill="none" stroke="rgba(145,238,196,0.88)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${shipSvg(278, 82, 186, "#f39d88", 0.96)}
      <path d="M214 114 C232 104 246 98 264 94" fill="none" stroke="rgba(255,176,132,0.9)" stroke-width="4" stroke-linecap="round" />
      <path d="M214 114 L226 104 L228 120" fill="none" stroke="rgba(255,176,132,0.9)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${shipSvg(286, 182, 170, "#ffcf9b", 0.88, 0.84)}
      <path d="M214 144 C234 154 248 160 266 168" fill="none" stroke="rgba(114,232,255,0.9)" stroke-width="4" stroke-linecap="round" />
      <path d="M266 168 L252 168 L260 156" fill="none" stroke="rgba(114,232,255,0.9)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${shipSvg(116, 178, -18, "#8de8d2", 0.78)}
      ${shipSvg(152, 190, -14, "#8de8d2", 0.82)}
      <path d="M112 182 Q 150 156 184 162" fill="none" stroke="rgba(210,178,255,0.7)" stroke-width="3" stroke-dasharray="5 6" />
      <text x="66" y="56" fill="rgba(226,244,238,0.92)" font-size="12" font-weight="700">${escapeHtml(labels.food)}</text>
      <text x="286" y="58" fill="rgba(226,244,238,0.92)" font-size="12" font-weight="700">${escapeHtml(labels.threat)}</text>
      <text x="288" y="210" fill="rgba(226,244,238,0.92)" font-size="12" font-weight="700">${escapeHtml(labels.prey)}</text>
      <text x="72" y="210" fill="rgba(226,244,238,0.92)" font-size="12" font-weight="700">${escapeHtml(labels.flock)}</text>
    </svg>
  `;
}

function buildGeneVisual(kind) {
  if (kind === "motor") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        ${shipSvg(64, 56, -8, "#87e8ff", 0.9)}
        <path d="M24 82 C56 78, 94 70, 150 34" fill="none" stroke="rgba(111,235,212,0.36)" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 8" />
      </svg>
    `;
  }
  if (kind === "core") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <circle cx="90" cy="55" r="30" fill="rgba(255,182,132,0.2)" stroke="rgba(255,182,132,0.72)" stroke-width="5" />
        <circle cx="90" cy="55" r="14" fill="rgba(255,225,190,0.88)" />
      </svg>
    `;
  }
  if (kind === "gadgetMix") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <circle cx="90" cy="55" r="18" fill="rgba(75,159,188,0.28)" stroke="rgba(122,229,255,0.56)" />
        <path d="M90 55 L138 48" stroke="rgba(255,177,132,0.9)" stroke-width="5" stroke-linecap="round" />
        <circle cx="144" cy="44" r="8" fill="rgba(114,232,255,0.92)" />
        <path d="M90 55 A32 32 0 0 1 92 92" fill="none" stroke="rgba(111,235,212,0.88)" stroke-width="8" stroke-linecap="round" />
      </svg>
    `;
  }
  if (kind === "sense") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <circle cx="90" cy="55" r="14" fill="rgba(214,241,255,0.86)" />
        <circle cx="90" cy="55" r="34" fill="none" stroke="rgba(114,232,255,0.6)" stroke-width="3" stroke-dasharray="6 7" />
        <circle cx="90" cy="55" r="48" fill="none" stroke="rgba(114,232,255,0.24)" stroke-width="7" />
      </svg>
    `;
  }
  if (kind === "cooperation") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        ${shipSvg(48, 68, -16, "#8de8d2", 0.72)}
        ${shipSvg(92, 52, -12, "#8de8d2", 0.82)}
        ${shipSvg(136, 68, -8, "#8de8d2", 0.9)}
        <path d="M30 86 Q 90 20 150 86" fill="none" stroke="rgba(111,235,212,0.42)" stroke-width="3" stroke-dasharray="5 7" />
      </svg>
    `;
  }
  if (kind === "risk") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        ${shipSvg(42, 55, 0, "#ffae90", 0.78)}
        ${shipSvg(138, 55, 180, "#88e4ff", 0.78)}
        <path d="M70 55 L110 55" stroke="rgba(255,176,132,0.9)" stroke-width="4.5" stroke-linecap="round" />
        <path d="M110 55 L98 47 M110 55 L98 63" stroke="rgba(255,176,132,0.9)" stroke-width="3.8" stroke-linecap="round" />
      </svg>
    `;
  }
  if (kind === "birth") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <rect x="32" y="46" width="116" height="18" rx="9" fill="rgba(255,255,255,0.08)" />
        <rect x="32" y="46" width="52" height="18" rx="9" fill="rgba(111,235,212,0.88)" />
        <line x1="84" y1="34" x2="84" y2="76" stroke="rgba(255,236,170,0.94)" stroke-width="3" stroke-dasharray="5 4" />
      </svg>
    `;
  }
  if (kind === "bud") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <circle cx="72" cy="56" r="22" fill="rgba(121,229,255,0.22)" stroke="rgba(121,229,255,0.68)" stroke-width="4" />
        <circle cx="114" cy="56" r="14" fill="rgba(255,176,132,0.3)" stroke="rgba(255,176,132,0.8)" stroke-width="3" />
        <path d="M92 56 L100 56" stroke="rgba(255,245,220,0.92)" stroke-width="3" stroke-linecap="round" />
      </svg>
    `;
  }
  if (kind === "life") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
        <circle cx="90" cy="55" r="34" fill="rgba(255,224,176,0.12)" stroke="rgba(255,224,176,0.36)" stroke-width="4" />
        <path d="M90 55 L90 32" stroke="rgba(255,224,176,0.92)" stroke-width="4" stroke-linecap="round" />
        <path d="M90 55 L108 64" stroke="rgba(255,224,176,0.92)" stroke-width="4" stroke-linecap="round" />
      </svg>
    `;
  }
  return `
    <svg class="guide-figure-svg" viewBox="0 0 180 110" role="presentation" aria-hidden="true">
      <path d="M52 55 C52 30, 128 30, 128 55 C128 82, 52 82, 52 55 Z" fill="rgba(126,218,255,0.22)" stroke="rgba(126,218,255,0.66)" stroke-width="4" />
      <path d="M60 55 C60 40, 120 38, 120 55 C120 70, 60 72, 60 55 Z" fill="rgba(255,170,206,0.18)" />
      <path d="M72 34 C84 52, 96 22, 108 40" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  `;
}

function buildStepIcon(kind) {
  if (kind === "tune") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 112" role="presentation" aria-hidden="true">
        <rect x="18" y="28" width="52" height="24" rx="12" fill="rgba(118,228,211,0.18)" stroke="rgba(118,228,211,0.65)" />
        <rect x="78" y="28" width="40" height="24" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" />
        <rect x="126" y="28" width="36" height="24" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" />
        <line x1="30" y1="78" x2="150" y2="78" stroke="rgba(255,255,255,0.18)" stroke-width="6" stroke-linecap="round" />
        <circle cx="118" cy="78" r="12" fill="rgba(255,232,170,0.95)" />
      </svg>
    `;
  }
  if (kind === "feed") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 112" role="presentation" aria-hidden="true">
        <path d="M20 78 C52 62, 76 50, 108 38 S150 34, 162 30" fill="none" stroke="rgba(118,228,211,0.2)" stroke-width="10" stroke-linecap="round" />
        ${pelletSvg(34, 74, 5)}
        ${pelletSvg(56, 66, 4.5)}
        ${pelletSvg(78, 56, 4.2)}
        ${pelletSvg(104, 46, 4.8)}
        ${pelletSvg(130, 38, 4.3)}
        <path d="M122 70 L152 86 L136 50 Z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.34)" />
      </svg>
    `;
  }
  if (kind === "lightning") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 112" role="presentation" aria-hidden="true">
        ${shipSvg(46, 72, -8, "#88dfff", 0.9)}
        ${shipSvg(132, 42, 168, "#f9a58f", 0.86)}
        ${lightningPolyline("92,18 70,50 98,54 76,94 112,62 92,60", "rgba(105,219,255,0.28)", 16)}
        ${lightningPolyline("92,18 70,50 98,54 76,94 112,62 92,60", "rgba(255,248,216,0.8)", 6)}
        ${lightningPolyline("92,18 70,50 98,54 76,94 112,62 92,60", "rgba(255,255,255,0.95)", 2)}
      </svg>
    `;
  }
  if (kind === "spring") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 180 112" role="presentation" aria-hidden="true">
        ${springSvg(90, 62, 16)}
        ${pelletSvg(54, 34, 4.5)}
        ${pelletSvg(126, 26, 4.7)}
        ${pelletSvg(136, 90, 4.2)}
      </svg>
    `;
  }
  return `
    <svg class="guide-figure-svg" viewBox="0 0 180 112" role="presentation" aria-hidden="true">
      <rect x="18" y="18" width="144" height="76" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
      <rect x="26" y="28" width="72" height="26" rx="12" fill="rgba(110,231,210,0.15)" stroke="rgba(110,231,210,0.52)" />
      <rect x="26" y="60" width="72" height="14" rx="7" fill="rgba(255,255,255,0.08)" />
      <circle cx="132" cy="56" r="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" />
      <path d="M132 34 L142 48 L160 52 L146 62 L148 80 L132 70 L116 80 L118 62 L104 52 L122 48 Z" fill="rgba(111,235,212,0.82)" />
    </svg>
  `;
}

function buildRuleVisual(kind) {
  if (kind === "torus") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
        <rect x="40" y="24" width="140" height="84" rx="18" fill="rgba(9,17,27,0.82)" stroke="rgba(255,255,255,0.08)" />
        ${shipSvg(70, 68, 180, "#86e0ff", 0.78)}
        ${shipSvg(188, 68, 180, "#86e0ff", 0.78, 0.6)}
        <path d="M58 44 C34 44, 24 44, 24 68 C24 92, 34 92, 58 92" fill="none" stroke="rgba(111,235,212,0.76)" stroke-width="3" />
        <path d="M162 44 C186 44, 196 44, 196 68 C196 92, 186 92, 162 92" fill="none" stroke="rgba(111,235,212,0.76)" stroke-width="3" />
        <path d="M24 68 L30 60 L30 76 Z" fill="rgba(111,235,212,0.9)" />
        <path d="M196 68 L190 60 L190 76 Z" fill="rgba(111,235,212,0.9)" />
      </svg>
    `;
  }
  if (kind === "combat") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
        ${shipSvg(58, 70, 4, "#ffab8c", 0.92)}
        ${shipSvg(156, 68, 178, "#8de8d2", 0.98)}
        <path d="M84 66 L126 66" stroke="rgba(255,177,142,0.92)" stroke-width="5" stroke-linecap="round" />
        <path d="M144 38 A34 34 0 0 1 144 98" fill="none" stroke="rgba(111,235,212,0.92)" stroke-width="7" stroke-linecap="round" />
        <rect x="132" y="104" width="58" height="10" rx="5" fill="rgba(255,255,255,0.08)" />
        <rect x="132" y="104" width="22" height="10" rx="5" fill="rgba(255,154,114,0.88)" />
      </svg>
    `;
  }
  return `
    <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
      ${shipSvg(64, 78, -18, "#8de8d2", 0.82)}
      ${shipSvg(112, 62, -12, "#8de8d2", 0.88)}
      ${shipSvg(164, 84, -10, "#8de8d2", 0.9)}
      <path d="M38 36 L64 28" stroke="rgba(255,255,255,0.28)" stroke-width="2.4" stroke-linecap="round" />
      <path d="M92 24 L118 18" stroke="rgba(255,255,255,0.28)" stroke-width="2.4" stroke-linecap="round" />
      <path d="M142 46 L168 40" stroke="rgba(255,255,255,0.28)" stroke-width="2.4" stroke-linecap="round" />
      <path d="M50 98 Q 108 40 178 58" fill="none" stroke="rgba(111,235,212,0.44)" stroke-width="2.6" stroke-dasharray="5 6" />
    </svg>
  `;
}

function buildExperimentVisual(kind) {
  if (kind === "bait") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
        <rect width="220" height="132" rx="18" fill="rgba(7,14,22,0.9)" />
        <path d="M26 94 C58 82, 86 68, 118 56 S170 44, 194 36" fill="none" stroke="rgba(112,235,212,0.16)" stroke-width="9" stroke-linecap="round" />
        ${pelletSvg(40, 88, 4.6)}
        ${pelletSvg(60, 80, 4.2)}
        ${pelletSvg(84, 70, 4.4)}
        ${pelletSvg(108, 60, 4.3)}
        ${pelletSvg(132, 50, 4.3)}
        ${shipSvg(78, 92, -20, "#8be0ff", 0.86)}
        ${shipSvg(146, 46, 150, "#ffad8c", 0.82)}
      </svg>
    `;
  }
  if (kind === "springfield") {
    return `
      <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
        <rect width="220" height="132" rx="18" fill="rgba(7,14,22,0.9)" />
        ${springSvg(58, 66, 13)}
        ${springSvg(168, 54, 13)}
        ${shipSvg(92, 88, -24, "#8de8d2", 0.84)}
        ${shipSvg(136, 92, -18, "#8de8d2", 0.84)}
        ${shipSvg(140, 34, 162, "#9fb4ff", 0.84)}
        ${shipSvg(182, 86, 160, "#9fb4ff", 0.84)}
      </svg>
    `;
  }
  return `
    <svg class="guide-figure-svg" viewBox="0 0 220 132" role="presentation" aria-hidden="true">
      <rect width="220" height="132" rx="18" fill="rgba(7,14,22,0.9)" />
      ${shipSvg(72, 62, -8, "#8be0ff", 0.92)}
      ${shipSvg(108, 82, -16, "#8be0ff", 0.84)}
      ${shipSvg(150, 72, 166, "#ffae90", 0.88)}
      ${lightningPolyline("124,14 100,46 126,50 104,94 144,54 124,50", "rgba(104,219,255,0.28)", 16)}
      ${lightningPolyline("124,14 100,46 126,50 104,94 144,54 124,50", "rgba(255,247,214,0.78)", 6)}
      ${lightningPolyline("124,14 100,46 126,50 104,94 144,54 124,50", "rgba(255,255,255,0.92)", 2.2)}
    </svg>
  `;
}

function buildSectionPanel(section, visualMarkup) {
  const listMarkup = Array.isArray(section.items)
    ? `
        <ul class="guide-list">
          ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      `
    : "";
  return `
    <div class="guide-section-head">
      <p class="eyebrow">${escapeHtml(section.title)}</p>
      <p class="guide-section-lead">${escapeHtml(section.lead)}</p>
    </div>
    ${visualMarkup}
    ${listMarkup}
  `;
}

function buildGadgetsPanel(section) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-gadget-grid">
        ${section.cards
          .map(
            (card) => `
              <article class="guide-gadget-card">
                <div class="guide-gadget-visual">${buildGadgetVisual(card.kind)}</div>
                <strong>${escapeHtml(card.title)}</strong>
                <p>${escapeHtml(card.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `
  );
}

function buildGeneticsPanel(section) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-genome-atlas">
        ${buildGenomeAtlasVisual(document.documentElement.lang === "ja" ? "ja" : "en")}
      </div>
      <div class="guide-gene-grid">
        ${section.genes
          .map(
            (gene) => `
              <article class="guide-gene-card">
                <div class="guide-gene-visual">${buildGeneVisual(gene.kind)}</div>
                <strong>${escapeHtml(gene.title)}</strong>
                <p>${escapeHtml(gene.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `
  );
}

function buildTagsPanel(section) {
  return `
    <div class="guide-section-head">
      <p class="eyebrow">${escapeHtml(section.tagTitle)}</p>
      <p class="guide-section-lead">${escapeHtml(section.tagLead)}</p>
    </div>
    <div class="guide-trait-grid">
      ${section.tags
        .map(
          (tag) => `
            <article class="guide-trait-card">
              <div class="guide-trait-chip-row">
                <span class="guide-lineage-tag is-${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>
              </div>
              <p>${escapeHtml(tag.body)}</p>
            </article>
          `
        )
        .join("")}
    </div>
    <div class="guide-trait-panel guide-tag-bridge">
      <div class="guide-trait-head">
        <strong>${escapeHtml(section.bridgeTitle)}</strong>
        <p>${escapeHtml(section.bridgeLead)}</p>
      </div>
      <div class="guide-tag-bridge-grid">
        ${section.bridgeRows
          .map(
            (row) => `
              <article class="guide-tag-bridge-row">
                <div class="guide-tag-bridge-inputs">
                  ${row.inputs
                    .map((input) => `<span class="guide-gene-chip">${escapeHtml(input)}</span>`)
                    .join("")}
                </div>
                <span class="guide-tag-arrow" aria-hidden="true">→</span>
                <div class="guide-tag-bridge-outputs">
                  ${row.outputs
                    .map(
                      (tag) =>
                        `<span class="guide-lineage-tag is-${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`
                    )
                    .join("")}
                </div>
                <p>${escapeHtml(row.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildBehaviorPanel(section, locale) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-behavior-layout">
        <div class="guide-priority-stack">
          ${section.priorities
          .map(
            (step) => `
              <article class="guide-priority-card">
                <span class="guide-priority-badge is-${escapeHtml(step.tone)}"></span>
                <div class="guide-priority-copy">
                  <strong>${escapeHtml(step.title)}</strong>
                  <p>${escapeHtml(step.body)}</p>
                </div>
              </article>
            `
          )
          .join("")}
        </div>
        <div class="guide-behavior-scene">
          ${buildBehaviorScene(locale)}
        </div>
      </div>
    `
  );
}

function buildRulesPanel(section) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-rule-grid">
        ${section.tiles
          .map(
            (tile) => `
              <article class="guide-rule-tile">
                <div class="guide-rule-visual">${buildRuleVisual(tile.kind)}</div>
                <strong>${escapeHtml(tile.title)}</strong>
                <p>${escapeHtml(tile.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `
  );
}

function buildReadPanel(section, locale) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-read-layout">
        <div class="guide-read-main">
          <div class="guide-lineage-mini is-active">
            <span class="guide-lineage-sample guide-lineage-sample-a"></span>
            <div class="guide-lineage-meta">
              <strong>Wolf</strong>
              <span>28 cells · 14% diversity</span>
              <div class="guide-lineage-tags">
                <span class="guide-lineage-tag is-warm">${locale === "ja" ? "狩猟型" : "Hunter"}</span>
                <span class="guide-lineage-tag is-warm">${locale === "ja" ? "接近戦" : "Duelist"}</span>
              </div>
            </div>
            <span class="guide-lineage-chart"></span>
          </div>
          <div class="guide-read-stat-strip">
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).pop)}</span>
              <strong>537</strong>
            </div>
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).entropy)}</span>
              <strong>6.19</strong>
            </div>
            <div class="guide-stage-stat-mini">
              <span>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).material)}</span>
              <strong>40000</strong>
            </div>
          </div>
          <div class="guide-detail-card">
            <strong>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).detailed)}</strong>
            <div class="guide-share-legend">
              <span><i class="is-a"></i>Lineages 89</span>
              <span><i class="is-b"></i>Births 166</span>
              <span><i class="is-c"></i>Deaths 16</span>
              <span><i class="is-d"></i>Free mass 8210</span>
            </div>
          </div>
        </div>
        <div class="guide-read-side">
          <div class="guide-share-card">
            <div class="guide-share-head">
              <strong>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).share)}</strong>
              <span>Top 4</span>
            </div>
            <div class="guide-share-donut">
              <span>100</span>
            </div>
            <div class="guide-share-legend">
              <span><i class="is-a"></i>Wolf 28%</span>
              <span><i class="is-b"></i>Dove 19%</span>
              <span><i class="is-c"></i>Fork 13%</span>
              <span><i class="is-d"></i>Lily 9%</span>
              <span><i class="is-o"></i>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).others)} 31%</span>
            </div>
          </div>
          <div class="guide-peek-mini">
            <div class="guide-peek-row">
              <strong>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).commands)}</strong>
              <span>P / S / H / C / L</span>
            </div>
            <div class="guide-peek-row">
              <strong>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).menu)}</strong>
              <span>${escapeHtml((GUIDE_MOCK_TEXT[locale] ?? GUIDE_MOCK_TEXT.en).menuSummary)}</span>
            </div>
          </div>
        </div>
      </div>
    `
  );
}

function buildExperimentsPanel(section) {
  return buildSectionPanel(
    section,
    `
      <div class="guide-exp-grid">
        ${section.cards
          .map(
            (card) => `
              <article class="guide-exp-card">
                <div class="guide-exp-visual">${buildExperimentVisual(card.kind)}</div>
                <strong>${escapeHtml(card.title)}</strong>
                <p>${escapeHtml(card.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `
  );
}

function buildOverviewPanel(content, locale) {
  return `
    <div class="guide-overview-grid">
      <div class="guide-overview-main">
        <div class="guide-section-head">
          <p class="eyebrow">${escapeHtml(content.title)}</p>
          <p class="guide-section-lead">${escapeHtml(content.lead)}</p>
        </div>
        ${buildOverviewScreen(content.labels, locale)}
      </div>
      <div class="guide-overview-side">
        ${content.sideCards
          .map(
            (entry) => `
              <article class="guide-side-card">
                <strong>${escapeHtml(entry.title)}</strong>
                <p>${escapeHtml(entry.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function startGuidePage() {
  const localeToggleButton = document.getElementById("locale-toggle");
  if (!localeToggleButton) {
    return;
  }

  const backLink = document.getElementById("guide-back-link");
  const devLink = document.getElementById("guide-dev-link");
  const overview = document.getElementById("guide-overview");
  const sectionsContainer = document.getElementById("guide-sections");
  const gadgetsPanel = document.getElementById("guide-gadgets-panel");
  const geneticsPanel = document.getElementById("guide-genetics-panel");
  const tagsPanel = document.getElementById("guide-tags-panel");
  const behaviorPanel = document.getElementById("guide-behavior-panel");
  const rulesPanel = document.getElementById("guide-rules-panel");
  const readPanel = document.getElementById("guide-read-panel");
  const experimentsPanel = document.getElementById("guide-experiments-panel");
  const orderedPanels = [
    gadgetsPanel,
    geneticsPanel,
    tagsPanel,
    rulesPanel,
    behaviorPanel,
    readPanel,
    experimentsPanel
  ];

  let locale = loadLocale();
  let layoutFrame = 0;

  function localized() {
    return GUIDE_CONTENT[locale] ?? GUIDE_CONTENT.en;
  }

  function desiredGuideColumns() {
    const width = sectionsContainer?.clientWidth ?? window.innerWidth;
    if (width >= 1180) {
      return 2;
    }
    return 1;
  }

  function arrangeGuideSections() {
    if (!sectionsContainer) {
      return;
    }

    const columnCount = desiredGuideColumns();

    sectionsContainer.style.setProperty("--guide-column-count", String(columnCount));

    if (columnCount <= 1) {
      sectionsContainer.classList.remove("guide-sections--columns");
      sectionsContainer.replaceChildren(...orderedPanels);
      return;
    }

    const gap = 18;
    const columnWidth =
      (sectionsContainer.clientWidth - gap * Math.max(0, columnCount - 1)) / columnCount;
    const measureColumn = document.createElement("div");
    measureColumn.className = "guide-sections-column";
    measureColumn.style.position = "absolute";
    measureColumn.style.inset = "0 auto auto 0";
    measureColumn.style.visibility = "hidden";
    measureColumn.style.pointerEvents = "none";
    measureColumn.style.width = `${columnWidth}px`;
    sectionsContainer.classList.remove("guide-sections--columns");
    sectionsContainer.replaceChildren(measureColumn);

    const panelHeights = orderedPanels.map((panel) => {
      measureColumn.append(panel);
      return Math.max(panel.getBoundingClientRect().height, panel.scrollHeight, panel.offsetHeight);
    });

    const columnElements = Array.from({ length: columnCount }, () => {
      const column = document.createElement("div");
      column.className = "guide-sections-column";
      return column;
    });
    const columnHeights = Array(columnCount).fill(0);
    const distributedPanels = orderedPanels
      .map((panel, index) => ({
        panel,
        index,
        height: panelHeights[index],
        column: 0
      }))
      .sort((left, right) => right.height - left.height);

    distributedPanels.forEach((entry) => {
      const shortest = columnHeights.indexOf(Math.min(...columnHeights));
      entry.column = shortest;
      columnHeights[shortest] += entry.height + 18;
    });

    columnElements.forEach((columnElement, columnIndex) => {
      distributedPanels
        .filter((entry) => entry.column === columnIndex)
        .sort((left, right) => left.index - right.index)
        .forEach((entry) => {
          columnElement.append(entry.panel);
        });
    });

    sectionsContainer.classList.add("guide-sections--columns");
    sectionsContainer.replaceChildren(...columnElements);
  }

  function scheduleGuideLayout() {
    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      arrangeGuideSections();
    });
  }

  function applyLocale() {
    const content = localized();
    document.documentElement.lang = locale;
    document.title = content.title;

    localeToggleButton.textContent = localeToggleLabel(locale);
    localeToggleButton.title = localeToggleTitle(locale);
    localeToggleButton.setAttribute("aria-label", localeToggleTitle(locale));

    document.getElementById("guide-header-eyebrow").textContent = content.eyebrow;
    document.getElementById("guide-header-title").textContent = content.heading;
    document.getElementById("guide-header-lead").textContent = content.lead;
    backLink.textContent = content.back;
    devLink.textContent = content.dev;

    overview.innerHTML = buildOverviewPanel(content.overview, locale);
    gadgetsPanel.innerHTML = buildGadgetsPanel(content.gadgets);
    geneticsPanel.innerHTML = buildGeneticsPanel(content.genetics);
    tagsPanel.innerHTML = buildTagsPanel(content.genetics);
    rulesPanel.innerHTML = buildRulesPanel(content.sections.rules);
    behaviorPanel.innerHTML = buildBehaviorPanel(content.sections.behavior, locale);
    readPanel.innerHTML = buildReadPanel(content.sections.read, locale);
    experimentsPanel.innerHTML = buildExperimentsPanel(content.sections.experiments);
    scheduleGuideLayout();
  }

  localeToggleButton.addEventListener("click", () => {
    locale = saveLocale(locale === "ja" ? "en" : "ja");
    applyLocale();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === LOCALE_STORAGE_KEY) {
      locale = loadLocale();
      applyLocale();
    }
  });

  window.addEventListener("resize", scheduleGuideLayout);

  applyLocale();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", startGuidePage);
}
