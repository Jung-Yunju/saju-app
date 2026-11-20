import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // 1. 테스트 유저
  await prisma.user.upsert({
    where: { id: "test-user" },
    update: {},
    create: { id: "test-user", name: "김테스트", email: "test@example.com" }
  })

  // 2. 테스트 주문
  await prisma.order.upsert({
    where: { orderId: "test-order-001" },
    update: {},
    create: {
      id: "test-order-001",
      userId: "test-user",
      orderId: "test-order-001",
      amount: 19900,
      status: "PAID",
    }
  })

  // 3. 기존 테스트 풀이 삭제 후 재삽입
  await prisma.reading.deleteMany({ where: { id: "test-reading-001" } })

  const reading = await prisma.reading.create({
    data: {
      id: "test-reading-001",
      userId: "test-user",
      orderId: "test-order-001",
      readingType: "BASIC",
      name: "김테스트",
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 10,
      gender: "M",
      calType: "SOLAR",
      status: "COMPLETE",
      sajuInput: { year: 1990, month: 5, day: 15, hour: 10, gender: "M" },
      claims: { claims: [] },
      userAnswers: {},
      fullReading: {
        reliability_note: "테스트용 풀이입니다.",
        quote: "목(木)의 기운처럼, 위로 뻗어나가는 것이 당신의 본성입니다.",
        parts: [
          {
            title: "타고난 나",
            chapters: [
              {
                key: "타고난 성격",
                title: "고집스럽지만 따뜻한 사람",
                sub: "당신의 본성",
                chips: [{ letter: "甲", element: "목", label: "갑목" }],
                body: [
                  "**갑목(甲木)** 일간을 가진 당신은 큰 나무처럼 위로 뻗어나가려는 기질이 강합니다.",
                  "한번 정한 방향은 쉽게 꺾이지 않는 고집이 있지만, 그 뿌리에는 따뜻한 마음이 자리합니다.",
                  "주변 사람들에게는 믿음직스럽고 성실한 사람으로 보입니다."
                ],
                todo: "나무가 햇빛을 찾듯, 당신도 자신만의 방향을 먼저 정하세요.",
                ask: "지금 가장 위로 뻗고 싶은 방향은 어디인가요?"
              },
              {
                key: "감정 패턴",
                title: "속으로 삭히는 감정",
                sub: "당신의 내면",
                chips: [{ letter: "己", element: "토", label: "기토" }],
                body: [
                  "감정을 겉으로 드러내지 않고 혼자 삭히는 편입니다.",
                  "오래 참다가 한꺼번에 터지는 패턴이 반복될 수 있습니다.",
                  "가까운 사람에게 먼저 말을 거는 연습이 도움이 됩니다."
                ],
                todo: "오늘 느끼는 감정 하나를 글로 적어보세요.",
                ask: "지금 말하지 못하고 있는 감정이 있나요?"
              }
            ]
          },
          {
            title: "돈과 직업",
            chapters: [
              {
                key: "재물 운",
                title: "꾸준함이 재산이 되는 사람",
                sub: "돈의 흐름",
                chips: [{ letter: "庚", element: "금", label: "경금" }],
                body: [
                  "한 번에 큰돈을 버는 스타일보다는 꾸준히 모아가는 스타일입니다.",
                  "충동구매나 투기적 투자보다 안정적인 저축이 더 잘 맞습니다.",
                  "30대 중반 이후부터 재물이 쌓이기 시작하는 흐름입니다."
                ],
                todo: "올해 저축 목표 금액을 구체적으로 정해보세요.",
                ask: "지금 돈이 새고 있는 구멍이 있다면 어디일까요?"
              }
            ]
          }
        ],
        forks: [
          {
            question: "지금 가장 고민되는 것은?",
            options: [
              { label: "직장/커리어", reading: "목(木)의 기운이 강한 당신에게 커리어는 성장의 무대입니다." },
              { label: "연애/결혼", reading: "관계에서 먼저 다가가는 것을 어려워하지만, 한번 맺은 인연은 오래갑니다." }
            ]
          }
        ],
        years: [
          { year: 2024, stem: "甲", branch: "辰", reading: "새로운 시작의 해입니다." },
          { year: 2025, stem: "乙", branch: "巳", reading: "지난해 시작한 일이 결실을 맺기 시작합니다." },
          { year: 2026, stem: "丙", branch: "午", reading: "화(火)의 기운이 강해져 사람들과의 관계가 활발해집니다." }
        ],
        review: [
          { question: "이 풀이에서 가장 공감된 부분은?", placeholder: "자유롭게 적어보세요" }
        ],
        closing: {
          points: [
            { title: "핵심 키워드", text: "성장·꾸준함·따뜻함" },
            { title: "올해 집중할 것", text: "방향을 정하고 흔들리지 않기" }
          ],
          last_words: "갑목처럼, 천천히 그러나 반드시 위로 자라는 삶을 응원합니다."
        }
      }
    }
  })

  console.log("✓ 테스트 풀이 생성:", reading.id)
  console.log("→ http://localhost:3001/reading/" + reading.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
