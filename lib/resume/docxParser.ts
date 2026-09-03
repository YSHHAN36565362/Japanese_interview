import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import type { ParsedResume, ParsedResumeCareer } from './types'

// K-Move 고정 워드 양식 전용 파서. 양식이 임의라면 이 파서는 쓰지 않는다(resume_upload_feature_plan.md 참고).
// mammoth 같은 범용 docx→HTML 변환기를 쓰지 않고, word/document.xml의 표 구조를 직접 순회한다 —
// 워드 버전별 태그 직렬화 차이에 정규식 문자열 매칭보다 안전하기 때문에 fast-xml-parser를 쓴다.

export class ResumeTemplateError extends Error {
  missingSections?: string[]
  constructor(message: string, missingSections?: string[]) {
    super(message)
    this.name = 'ResumeTemplateError'
    this.missingSections = missingSections
  }
}

type XmlNode = Record<string, unknown>

function tagOf(node: XmlNode): string | undefined {
  return Object.keys(node).find((k) => k !== ':@')
}

// w:p/w:r/w:t/w:tab/w:br를 임의 깊이로 재귀 순회하며 텍스트를 모은다. w:p 경계마다 줄바꿈을 넣어
// 자기소개서처럼 여러 문단인 답변도 구분할 수 있게 한다.
function collectText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ''
  let out = ''
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as XmlNode
    if ('#text' in n) {
      out += String(n['#text'])
      continue
    }
    const tag = tagOf(n)
    if (!tag) continue
    if (tag === 'w:tab') {
      out += '\t'
      continue
    }
    if (tag === 'w:br' || tag === 'w:cr') {
      out += '\n'
      continue
    }
    const children = n[tag]
    if (Array.isArray(children)) {
      out += collectText(children)
      if (tag === 'w:p') out += '\n'
    }
  }
  return out
}

// 임의 깊이에서 tagName과 일치하는 모든 노드의 children 배열을 모은다(전체 문서에서 w:tr 전부 찾기용).
function collectTag(nodes: unknown, tagName: string, out: unknown[][] = []): unknown[][] {
  if (!Array.isArray(nodes)) return out
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as XmlNode
    const tag = tagOf(n)
    if (!tag) continue
    if (tag === tagName) out.push(n[tag] as unknown[])
    collectTag(n[tag], tagName, out)
  }
  return out
}

// 한 단계 아래 직계 자식 중 tagName만 모은다(행의 직속 셀만 갖고 싶을 때 — 중첩 표 오염 방지).
function directChildrenTag(nodes: unknown, tagName: string): unknown[][] {
  if (!Array.isArray(nodes)) return []
  const out: unknown[][] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as XmlNode
    const tag = tagOf(n)
    if (tag === tagName) out.push(n[tag] as unknown[])
  }
  return out
}

const normalizeWs = (s: string) => s.replace(/\s+/g, '')
const flatten = (s: string) => s.replace(/\s+/g, ' ').trim()

interface Row {
  cells: string[] // 라벨/컬럼 매칭용(한 줄로 정규화)
  rawCells: string[] // 자소서 답변용(문단 줄바꿈 보존)
}

function buildRows(docBody: unknown): Row[] {
  const trChildrenList = collectTag(docBody, 'w:tr')
  return trChildrenList.map((trChildren) => {
    const tcList = directChildrenTag(trChildren, 'w:tc')
    const rawCells = tcList.map((tc) => collectText(tc).trim())
    return { rawCells, cells: rawCells.map(flatten) }
  })
}

function findNextNonEmpty(cells: string[], startIdx: number): string | null {
  for (let i = startIdx; i < cells.length; i++) {
    if (cells[i]) return cells[i]
  }
  return null
}

// ---- 인적사항: 라벨 앵커 스캔 ----
const PERSONAL_LABEL_MAP: Record<string, keyof ParsedResume['personal']> = {
  '漢字': 'nameKanji',
  'カタカナ': 'nameKana',
  '英文': 'nameRomaji',
  '英語': 'nameRomaji',
  '趣味': 'hobby',
  '特技': 'hobby',
  '希望職種': 'desiredJob',
  '希望業務': 'desiredJob',
  '希望勤務': 'desiredDuty',
}
const REQUIRED_PERSONAL_LABELS = ['名前', '生年月日', '性別']

function extractPersonal(rows: Row[]): ParsedResume['personal'] {
  const personal: ParsedResume['personal'] = {}
  for (const row of rows) {
    for (let i = 0; i < row.cells.length; i++) {
      const cellRaw = row.cells[i]
      if (!cellRaw) continue
      const label = cellRaw.replace(/[:：]\s*$/, '')
      const field = PERSONAL_LABEL_MAP[label]
      if (field) {
        const value = findNextNonEmpty(row.cells, i + 1)
        if (value && !personal[field]) personal[field] = value
        continue
      }
      const inline = cellRaw.match(/^(.+?)[:：]\s*(.+)$/)
      if (inline) {
        const inlineField = PERSONAL_LABEL_MAP[inline[1].trim()]
        if (inlineField && inline[2].trim() && !personal[inlineField]) {
          personal[inlineField] = inline[2].trim()
        }
      }
    }
  }
  return personal
}

function countRequiredPersonalLabels(rows: Row[]): number {
  const found = new Set<string>()
  for (const row of rows) {
    for (const cellRaw of row.cells) {
      const label = cellRaw.replace(/[:：]\s*$/, '')
      if (REQUIRED_PERSONAL_LABELS.includes(label)) found.add(label)
    }
  }
  return found.size
}

// ---- 헤더 행 + 포지셔널 데이터 행 (학력/자격증/경력/기술표 공용) ----
interface ColumnSpec {
  key: string
  keywords: string[]
}

// 문서에 나오는 모든 헤더+포지셔널 표(학력/자격증/경력/기술표)의 헤더 키워드를 모아둔다.
// 데이터 행을 모으다가 이 키워드에 2개 이상 걸리는 행을 만나면 "다음 표의 헤더"로 보고 멈춘다 —
// 그렇지 않으면 표 사이에 빈 행이 없을 때 경력 표 추출이 바로 다음 기술표까지 삼켜버린다.
const KNOWN_HEADER_KEYWORDS = [
  '期間', '勤務先', '会社名', '企業名', '職場', '部署', '職位', '役職', '業務内容', '業務',
  '区分', '製品', '機種', '使用水準', '水準', '活用',
  '入学', '卒業', '学校', '教育機関', '専攻', '学位', '資格', '取得',
]

function isHeaderLikeRow(row: Row, minMatches = 2): boolean {
  const matches = row.cells.filter((c) => c && KNOWN_HEADER_KEYWORDS.some((k) => c.includes(k))).length
  return matches >= minMatches
}

function extractHeaderTable(rows: Row[], columns: ColumnSpec[], minMatches = 2) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const colIndex: Record<string, number> = {}
    let matches = 0
    for (const col of columns) {
      const idx = row.cells.findIndex((c) => col.keywords.some((k) => c.includes(k)))
      if (idx >= 0) {
        colIndex[col.key] = idx
        matches++
      }
    }
    if (matches < Math.min(minMatches, columns.length)) continue

    const dataRows: Record<string, string>[] = []
    for (let d = r + 1; d < rows.length; d++) {
      const dataRow = rows[d]
      if (isHeaderLikeRow(dataRow)) break
      const rec: Record<string, string> = {}
      let anyValue = false
      for (const col of columns) {
        const idx = colIndex[col.key]
        const val = idx != null ? dataRow.cells[idx] ?? '' : ''
        rec[col.key] = val
        if (val) anyValue = true
      }
      if (!anyValue) break
      dataRows.push(rec)
    }
    return { headerRowIndex: r, dataRows }
  }
  return null
}

function extractCareers(rows: Row[]): ParsedResumeCareer[] {
  const table = extractHeaderTable(rows, [
    { key: 'period', keywords: ['期間'] },
    { key: 'company', keywords: ['勤務先', '会社名', '企業名', '職場'] },
    { key: 'department', keywords: ['部署', '職位', '役職'] },
    { key: 'duties', keywords: ['業務内容', '業務'] },
  ])
  if (!table) return []

  return table.dataRows
    .filter((r) => r.company)
    .map((r) => {
      const career: ParsedResumeCareer = { company: r.company }
      if (r.department) career.department = r.department
      if (r.duties) career.duties = r.duties
      const period = (r.period ?? '').split(/[~〜]/).map((p) => p.trim())
      if (period[0]) career.startYm = period[0]
      if (period[1]) career.endYm = period[1]
      return career
    })
}

function extractTechStack(rows: Row[]): string[] {
  const table = extractHeaderTable(rows, [
    { key: 'category', keywords: ['区分'] },
    { key: 'product', keywords: ['製品', '機種'] },
    { key: 'usage', keywords: ['活用'] },
  ])
  if (!table) return []

  const seen = new Set<string>()
  const stack: string[] = []
  for (const r of table.dataRows) {
    if (!r.product || !r.usage) continue
    const key = r.product.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    stack.push(r.product)
  }
  return stack
}

// ---- 자기소개서: 헤더 행(단독 셀) 바로 다음 행이 답변 ----
const ESSAY_SECTIONS: { key: keyof ParsedResume['essays']; pattern: string }[] = [
  { key: 'growth', pattern: '成長過程' },
  { key: 'personality', pattern: '性格の長所' },
  { key: 'whyJapan', pattern: '日本に就職したい理由' },
  { key: 'whyProgram', pattern: '研修に参加した理由' },
  { key: 'aspiration', pattern: '抱負・計画' },
]

function extractEssays(rows: Row[]): { essays: ParsedResume['essays']; foundHeaders: number } {
  const essays: ParsedResume['essays'] = {
    growth: '',
    personality: '',
    whyJapan: '',
    whyProgram: '',
    aspiration: '',
  }
  let foundHeaders = 0

  for (const section of ESSAY_SECTIONS) {
    const headerIdx = rows.findIndex((row) => {
      const nonEmpty = row.cells.filter(Boolean)
      if (nonEmpty.length !== 1) return false
      const normalized = normalizeWs(nonEmpty[0]).replace(/[*＊]/g, '')
      return normalized.includes(section.pattern)
    })
    if (headerIdx === -1) continue
    foundHeaders++

    const answerRow = rows[headerIdx + 1]
    if (!answerRow) continue
    const answer = answerRow.rawCells.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    essays[section.key] = answer
  }

  return { essays, foundHeaders }
}

export async function parseResumeDocx(input: Buffer | ArrayBuffer): Promise<ParsedResume> {
  let xml: string
  try {
    const zip = await JSZip.loadAsync(input)
    const documentXmlFile = zip.file('word/document.xml')
    if (!documentXmlFile) throw new Error('no document.xml')
    xml = await documentXmlFile.async('string')
  } catch {
    throw new ResumeTemplateError('올바른 .docx 파일이 아닙니다.')
  }

  let parsed: unknown
  try {
    const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false })
    parsed = parser.parse(xml)
  } catch {
    throw new ResumeTemplateError('올바른 .docx 파일이 아닙니다.')
  }

  const rows = buildRows(parsed)

  const fullText = normalizeWs(collectText(parsed))
  if (!fullText.includes('自己紹介')) {
    throw new ResumeTemplateError('K-Move 이력서 양식이 아닌 것 같습니다.', ['自己紹介'])
  }

  const { essays, foundHeaders } = extractEssays(rows)
  if (foundHeaders < 4) {
    const missing = ESSAY_SECTIONS.filter((s) => !essays[s.key] && foundHeaders < ESSAY_SECTIONS.length).map(
      (s) => s.pattern
    )
    throw new ResumeTemplateError(
      'K-Move 이력서 양식이 아니거나 자기소개서 항목을 인식할 수 없습니다.',
      missing
    )
  }
  if (Object.values(essays).every((v) => !v)) {
    throw new ResumeTemplateError('양식은 맞지만 자기소개서 내용이 비어 있습니다. 작성 후 다시 업로드해주세요.')
  }

  const personal = extractPersonal(rows)
  if (countRequiredPersonalLabels(rows) < REQUIRED_PERSONAL_LABELS.length) {
    throw new ResumeTemplateError('다른 종류의 문서인 것 같습니다.')
  }

  const careers = extractCareers(rows)
  const techStack = extractTechStack(rows)

  return { personal, careers, techStack, essays }
}
