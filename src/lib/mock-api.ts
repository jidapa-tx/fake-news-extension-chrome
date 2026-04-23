import type { AnalysisResult, VerdictLevel, Reference } from './types'

const MOCK_SCENARIOS = {
  danger: {
    verdict: 'อันตราย' as VerdictLevel,
    score: 8,
    confidence: 92,
    supporting: 5,
    opposing: 89,
    unchecked: 6,
    reasons: [
      '⚠ พบการรายงานว่าเป็นข่าวปลอมจากหน่วยงานตรวจสอบข้อเท็จจริงหลายแห่ง',
      '⚠ โดเมนเว็บไซต์ต้นทางมีอายุน้อยกว่า 30 วัน',
      '! ตรวจพบรูปแบบการโพสต์พร้อมกันจากหลายบัญชี (14 บัญชี)',
      '⚠ ข้อมูลขัดแย้งกับแหล่งข่าวระดับสากลที่น่าเชื่อถือ',
    ],
    references: [
      {
        id: '1',
        sourceName: 'Cofact Thailand',
        url: 'https://cofact.org',
        stance: 'คัดค้าน',
        excerpt: 'ข้อมูลนี้เป็นเท็จ มีการตรวจสอบแล้วพบว่าเป็นข่าวปลอมที่ถูกสร้างขึ้นโดยเจตนา',
        date: '2024-01-10',
        credibility: 88,
        type: 'FACT_CHECKER',
      },
      {
        id: '2',
        sourceName: 'BBC Thai',
        url: 'https://bbc.com/thai',
        stance: 'คัดค้าน',
        excerpt: 'BBC Thai รายงานว่าข้อมูลดังกล่าวไม่มีมูลความจริง แหล่งต้นทางไม่น่าเชื่อถือ',
        date: '2024-01-09',
        credibility: 97,
        type: 'TRUSTED_MEDIA',
      },
      {
        id: '3',
        sourceName: 'ศูนย์ต่อต้านข่าวปลอม',
        url: 'https://www.antifakenewscenter.com',
        stance: 'คัดค้าน',
        excerpt: 'ศูนย์ต่อต้านข่าวปลอมได้ตรวจสอบและยืนยันว่าข้อมูลนี้เป็นข่าวปลอม',
        date: '2024-01-10',
        credibility: 90,
        type: 'GOV',
      },
    ] as Reference[],
  },
  suspicious: {
    verdict: 'น่าสงสัย' as VerdictLevel,
    score: 32,
    confidence: 78,
    supporting: 25,
    opposing: 60,
    unchecked: 15,
    reasons: [
      '⚠ ไม่พบแหล่งข่าวที่น่าเชื่อถือยืนยันข้ออ้างนี้',
      '⚠ มีการใช้คำที่กระตุ้นอารมณ์มากผิดปกติ',
      '? ตัวเลขและสถิติที่อ้างไม่สามารถตรวจสอบแหล่งที่มาได้',
      '! พบการแพร่กระจายผ่านกลุ่ม LINE และ Facebook อย่างรวดเร็ว',
    ],
    references: [
      {
        id: '1',
        sourceName: 'AFP Fact Check Thailand',
        url: 'https://factcheck.afp.com/thai',
        stance: 'คัดค้าน',
        excerpt: 'ไม่พบหลักฐานสนับสนุนข้ออ้างนี้ จากการตรวจสอบแหล่งข้อมูลหลายแห่ง',
        date: '2024-01-15',
        credibility: 95,
        type: 'FACT_CHECKER',
      },
      {
        id: '2',
        sourceName: 'Reuters',
        url: 'https://reuters.com',
        stance: 'เป็นกลาง',
        excerpt: 'Reuters ยังไม่สามารถยืนยันข้อมูลนี้ได้ในขณะนี้ กำลังติดตามสถานการณ์',
        date: '2024-01-13',
        credibility: 98,
        type: 'TRUSTED_MEDIA',
      },
    ] as Reference[],
  },
  uncertain: {
    verdict: 'ไม่แน่ใจ' as VerdictLevel,
    score: 51,
    confidence: 55,
    supporting: 40,
    opposing: 35,
    unchecked: 25,
    reasons: [
      '? ข้อมูลบางส่วนถูกต้อง แต่บางส่วนถูกบิดเบือน',
      '? ยังไม่มีหลักฐานเพียงพอที่จะสรุปได้ชัดเจน',
      '⚠ AI มีความมั่นใจต่ำในการวิเคราะห์ครั้งนี้ กรุณาตรวจสอบเพิ่มเติม',
    ],
    references: [
      {
        id: '1',
        sourceName: 'ไทยรัฐ',
        url: 'https://thairath.co.th',
        stance: 'เป็นกลาง',
        excerpt: 'ไทยรัฐรายงานข้อมูลบางส่วนที่สอดคล้อง แต่ยังมีรายละเอียดที่ต้องติดตาม',
        date: '2024-01-12',
        credibility: 82,
        type: 'TRUSTED_MEDIA',
      },
    ] as Reference[],
  },
  likely_true: {
    verdict: 'ค่อนข้างจริง' as VerdictLevel,
    score: 74,
    confidence: 85,
    supporting: 68,
    opposing: 18,
    unchecked: 14,
    reasons: [
      '✓ แหล่งข่าวที่น่าเชื่อถือหลายแห่งรายงานในทิศทางเดียวกัน',
      '✓ ข้อมูลสอดคล้องกับเอกสารและรายงานที่มีอยู่',
      '? ยังมีรายละเอียดบางส่วนที่ยังไม่ได้รับการยืนยัน',
    ],
    references: [
      {
        id: '1',
        sourceName: 'มติชน',
        url: 'https://matichon.co.th',
        stance: 'ยืนยัน',
        excerpt: 'มติชนรายงานและยืนยันข้อมูลดังกล่าวจากแหล่งข่าวที่เชื่อถือได้',
        date: '2024-01-16',
        credibility: 85,
        type: 'TRUSTED_MEDIA',
      },
      {
        id: '2',
        sourceName: 'ไทยพีบีเอส',
        url: 'https://thaipbs.or.th',
        stance: 'ยืนยัน',
        excerpt: 'ไทยพีบีเอสได้รายงานและยืนยันข้อมูลนี้จากหน่วยงานที่เกี่ยวข้อง',
        date: '2024-01-15',
        credibility: 90,
        type: 'TRUSTED_MEDIA',
      },
    ] as Reference[],
  },
  verified: {
    verdict: 'ยืนยันแล้ว' as VerdictLevel,
    score: 92,
    confidence: 95,
    supporting: 85,
    opposing: 8,
    unchecked: 7,
    reasons: [
      '✓ แหล่งข่าวระดับสากลหลายแห่งรายงานในทิศทางเดียวกัน',
      '✓ มีเอกสารและหลักฐานสนับสนุนชัดเจน',
      '✓ ข้อมูลได้รับการยืนยันจากหน่วยงานทางการ',
    ],
    references: [
      {
        id: '1',
        sourceName: 'BBC',
        url: 'https://bbc.com',
        stance: 'ยืนยัน',
        excerpt: 'รายงานได้รับการยืนยันจาก BBC ซึ่งมีแหล่งข้อมูลตรงจากผู้เกี่ยวข้อง',
        date: '2024-01-16',
        credibility: 98,
        type: 'TRUSTED_MEDIA',
      },
      {
        id: '2',
        sourceName: 'AP News',
        url: 'https://apnews.com',
        stance: 'ยืนยัน',
        excerpt: 'AP News ยืนยันข้อมูลนี้จากแหล่งข้อมูลหลักหลายแห่ง',
        date: '2024-01-16',
        credibility: 98,
        type: 'TRUSTED_MEDIA',
      },
    ] as Reference[],
  },
}

function pickScenario(query: string) {
  const q = query.toLowerCase()
  if (q.includes('จริง') || q.includes('ยืนยัน') || q.includes('true')) return MOCK_SCENARIOS.verified
  if (q.includes('ปลอม') || q.includes('fake') || q.includes('อันตราย')) return MOCK_SCENARIOS.danger
  if (q.includes('สงสัย') || q.includes('แชร์')) return MOCK_SCENARIOS.suspicious
  // deterministic pseudo-random based on query length
  const scenarios = [MOCK_SCENARIOS.suspicious, MOCK_SCENARIOS.danger, MOCK_SCENARIOS.uncertain, MOCK_SCENARIOS.likely_true]
  return scenarios[query.length % scenarios.length]
}

export async function analyzeContent(query: string, imageUrl?: string): Promise<AnalysisResult> {
  await new Promise(r => setTimeout(r, 1200 + Math.random() * 600))

  const scenario = pickScenario(query)

  return {
    id: `mock-${Date.now()}`,
    query: query.slice(0, 100),
    ...(imageUrl ? { imageUrl } : {}),
    verdict: scenario.verdict,
    score: scenario.score,
    confidence: scenario.confidence,
    supporting: scenario.supporting,
    opposing: scenario.opposing,
    unchecked: scenario.unchecked,
    reasons: scenario.reasons,
    references: scenario.references,
    analyzedAt: new Date().toISOString(),
  }
}
