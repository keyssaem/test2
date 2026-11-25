/**
 * 레벨과 목표 그림 정의.
 * - 그림은 직접 그린 SVG(public/targets)라 저작권 걱정이 없다.
 * - rubric(채점 요소)과 referencePrompt(모범 프롬프트)는 서버에서만 쓰고,
 *   그림을 다 풀기 전에는 학생에게 보내지 않는다.
 */

export type RubricItem = {
  id: string;
  label: string; // 교사·학생에게 보여줄 이름 (예: "색깔")
  keywords: string[]; // 오프라인 채점용 어간 목록
  hint: string; // 빠졌을 때 보여줄 팁
};

export type TargetImage = {
  id: string;
  src: string;
  alt: string; // 화면읽기용 (정답을 노출하지 않도록 일반적으로)
  referencePrompt: string;
  rubric: RubricItem[];
};

export type Level = {
  id: number;
  title: string;
  description: string;
  passThreshold: number; // 0~100
  maxAttempts: number;
  checklist: string[]; // 화면에 띄우는 힌트 체크리스트
  images: TargetImage[];
};

const color = (id: string, keywords: string[], hint = "무슨 색인지 말해 볼까요?"): RubricItem => ({
  id,
  label: "색깔",
  keywords,
  hint,
});

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "사물과 색깔",
    description: "하나의 사물과 그 색깔을 말해요.",
    passThreshold: 60,
    maxAttempts: 3,
    checklist: ["무엇이 보이나요?", "무슨 색인가요?"],
    images: [
      {
        id: "l1-apple",
        src: "/targets/l1-apple.svg",
        alt: "레벨 1 목표 그림 1",
        referencePrompt: "빨간 사과 한 개",
        rubric: [
          { id: "object", label: "사물", keywords: ["사과"], hint: "그림 한가운데 있는 과일의 이름은 뭘까요?" },
          color("color", ["빨간", "빨강", "붉은", "붉"]),
        ],
      },
      {
        id: "l1-balloon",
        src: "/targets/l1-balloon.svg",
        alt: "레벨 1 목표 그림 2",
        referencePrompt: "파란 풍선 하나",
        rubric: [
          { id: "object", label: "사물", keywords: ["풍선"], hint: "하늘로 둥실 떠오르는 이것은 뭘까요?" },
          color("color", ["파란", "파랑", "푸른"]),
        ],
      },
    ],
  },
  {
    id: 2,
    title: "사물과 장소",
    description: "무엇이 어디에 있는지 말해요.",
    passThreshold: 65,
    maxAttempts: 3,
    checklist: ["무엇이 보이나요?", "무슨 색인가요?", "어디에 있나요?"],
    images: [
      {
        id: "l2-beach-ball",
        src: "/targets/l2-beach-ball.svg",
        alt: "레벨 2 목표 그림 1",
        referencePrompt: "바닷가 모래사장 위에 있는 노란 공",
        rubric: [
          { id: "object", label: "사물", keywords: ["공"], hint: "모래 위에 놓인 둥근 물건은 뭘까요?" },
          color("color", ["노란", "노랑"]),
          { id: "place", label: "장소", keywords: ["모래", "해변", "바닷가", "바다", "해수욕"], hint: "여기는 어디일까요? 장소를 말해 보세요." },
        ],
      },
      {
        id: "l2-night-moon",
        src: "/targets/l2-night-moon.svg",
        alt: "레벨 2 목표 그림 2",
        referencePrompt: "깜깜한 밤하늘에 뜬 노란 보름달",
        rubric: [
          { id: "object", label: "사물", keywords: ["달"], hint: "하늘에 떠 있는 동그란 것은 뭘까요?" },
          color("color", ["노란", "노랑", "금색", "황금"]),
          { id: "place", label: "장소·때", keywords: ["밤", "하늘", "어두", "깜깜"], hint: "언제, 어디에 떠 있나요?" },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "위치 관계",
    description: "여러 사물이 서로 어디에 있는지 말해요.",
    passThreshold: 70,
    maxAttempts: 3,
    checklist: ["무엇이 보이나요? (2개 이상)", "무엇이 무엇의 위·아래·옆에 있나요?", "색깔도 말해 보세요."],
    images: [
      {
        id: "l3-cup-book",
        src: "/targets/l3-cup-book.svg",
        alt: "레벨 3 목표 그림 1",
        referencePrompt: "초록색 책 위에 놓인 하얀 컵",
        rubric: [
          { id: "obj1", label: "사물 1", keywords: ["컵", "머그", "잔"], hint: "위쪽에 있는 물건은 뭘까요?" },
          { id: "obj2", label: "사물 2", keywords: ["책"], hint: "아래에 깔린 물건은 뭘까요?" },
          { id: "relation", label: "위치", keywords: ["위", "올려", "올라", "놓인", "놓여"], hint: "컵과 책은 어떤 위치 관계인가요?" },
          color("color", ["초록", "녹색", "하얀", "흰"], "책이나 컵의 색깔을 말해 볼까요?"),
        ],
      },
      {
        id: "l3-tree-bench",
        src: "/targets/l3-tree-bench.svg",
        alt: "레벨 3 목표 그림 2",
        referencePrompt: "큰 나무 옆에 있는 갈색 나무 벤치",
        rubric: [
          { id: "obj1", label: "사물 1", keywords: ["나무"], hint: "키가 큰 초록색 식물은 뭘까요?" },
          { id: "obj2", label: "사물 2", keywords: ["벤치", "의자"], hint: "앉을 수 있는 물건이 있어요!" },
          { id: "relation", label: "위치", keywords: ["옆", "곁", "앞", "아래"], hint: "둘은 서로 어디에 있나요?" },
          color("color", ["갈색", "밤색", "초록", "녹색"], "벤치나 나무의 색깔을 말해 볼까요?"),
        ],
      },
    ],
  },
  {
    id: 4,
    title: "행동과 감정",
    description: "누가 무엇을, 어떤 기분으로 하는지 말해요.",
    passThreshold: 75,
    maxAttempts: 3,
    checklist: ["누가 있나요?", "무엇을 하고 있나요?", "기분이 어때 보이나요?", "어디에서 하나요?"],
    images: [
      {
        id: "l4-happy-dog",
        src: "/targets/l4-happy-dog.svg",
        alt: "레벨 4 목표 그림 1",
        referencePrompt: "초록 잔디밭에서 신나게 달리는 갈색 강아지",
        rubric: [
          { id: "who", label: "누가", keywords: ["강아지", "개", "멍멍"], hint: "주인공 동물은 누구일까요?" },
          { id: "action", label: "행동", keywords: ["달리", "달려", "뛰", "뛴", "뛰어"], hint: "무엇을 하고 있나요?" },
          { id: "feeling", label: "감정", keywords: ["신나", "신난", "즐거", "기쁜", "기뻐", "행복", "웃"], hint: "기분이 어때 보이나요?" },
          { id: "place", label: "장소", keywords: ["잔디", "풀밭", "공원", "들판", "마당"], hint: "어디에서 달리고 있나요?" },
        ],
      },
      {
        id: "l4-rain-kid",
        src: "/targets/l4-rain-kid.svg",
        alt: "레벨 4 목표 그림 2",
        referencePrompt: "비 오는 날 노란 우산을 쓰고 웃으며 걷는 아이",
        rubric: [
          { id: "who", label: "누가", keywords: ["아이", "어린이", "학생", "친구", "사람", "소녀", "소년"], hint: "그림 속 사람은 누구일까요?" },
          { id: "object", label: "물건", keywords: ["우산"], hint: "머리 위에 들고 있는 것은?" },
          { id: "action", label: "행동", keywords: ["걷", "걸어", "걸으", "산책"], hint: "무엇을 하고 있나요?" },
          { id: "weather", label: "날씨·기분", keywords: ["비", "빗", "웃", "행복", "즐거", "신나"], hint: "날씨나 기분을 말해 볼까요?" },
        ],
      },
    ],
  },
  {
    id: 5,
    title: "분위기와 화풍",
    description: "시간, 날씨, 그림 스타일까지 말해요.",
    passThreshold: 80,
    maxAttempts: 3,
    checklist: ["무엇이 보이나요?", "언제인가요? (아침·저녁·밤)", "어떤 색과 분위기인가요?", "어떤 그림 스타일인가요?"],
    images: [
      {
        id: "l5-sunset-sea",
        src: "/targets/l5-sunset-sea.svg",
        alt: "레벨 5 목표 그림 1",
        referencePrompt: "해 질 녘 주황빛 하늘 아래 잔잔한 바다 위의 작은 돛단배, 평화로운 분위기",
        rubric: [
          { id: "object", label: "사물", keywords: ["배", "돛"], hint: "바다 위에 떠 있는 것은?" },
          { id: "place", label: "장소", keywords: ["바다", "물결", "파도", "호수"], hint: "어디에 떠 있나요?" },
          { id: "time", label: "때", keywords: ["노을", "해질", "해 질", "저녁", "석양", "해가"], hint: "하루 중 언제일까요?" },
          { id: "mood", label: "색·분위기", keywords: ["주황", "오렌지", "붉은", "평화", "잔잔", "고요", "따뜻"], hint: "하늘 색이나 분위기를 말해 볼까요?" },
        ],
      },
      {
        id: "l5-pixel-castle",
        src: "/targets/l5-pixel-castle.svg",
        alt: "레벨 5 목표 그림 2",
        referencePrompt: "별이 빛나는 보라색 밤하늘 아래 서 있는 성, 픽셀아트 스타일",
        rubric: [
          { id: "object", label: "사물", keywords: ["성", "궁전", "캐슬"], hint: "가운데 있는 큰 건물은?" },
          { id: "time", label: "때", keywords: ["밤", "별"], hint: "하늘에 무엇이 반짝이나요?" },
          { id: "mood", label: "색", keywords: ["보라", "자주", "남색"], hint: "하늘은 무슨 색인가요?" },
          { id: "style", label: "화풍", keywords: ["픽셀", "도트", "게임", "네모", "8비트"], hint: "그림이 작은 네모로 그려졌어요. 어떤 스타일일까요?" },
        ],
      },
    ],
  },
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export const LAST_LEVEL = LEVELS[LEVELS.length - 1].id;
