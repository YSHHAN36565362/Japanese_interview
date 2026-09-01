#!/usr/bin/env node
// data/ 폴더 안의 초안 파일들을 실제로 앱이 쓰는 파일에 자동으로 병합하는 스크립트.
// - 질문 초안(*.json, questions[] 배열 포함)  → data/questions.json
// - 꼬리질문 초안(파일명에 follow up이 들어간 *.txt) → public/data/follow_ups.txt
//
// 사용법: npm run merge-data
// 자세한 설명: HowToInputData.md

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'data')
const MAIN_QUESTIONS_PATH = path.join(DATA_DIR, 'questions.json')
const FOLLOW_UPS_PATH = path.join(ROOT, 'public', 'data', 'follow_ups.txt')

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function rel(p) {
  return path.relative(ROOT, p)
}

// ── 질문 병합 ──────────────────────────────────────────────
function mergeQuestions() {
  const main = JSON.parse(readFileSync(MAIN_QUESTIONS_PATH, 'utf-8'))
  const existingIds = new Set(main.questions.map((q) => q.id))

  const draftFiles = walk(DATA_DIR).filter(
    (f) => f.endsWith('.json') && path.resolve(f) !== path.resolve(MAIN_QUESTIONS_PATH)
  )

  const added = []
  const skipped = []

  for (const file of draftFiles) {
    let json
    try {
      json = JSON.parse(readFileSync(file, 'utf-8'))
    } catch {
      skipped.push({ file, id: null, reason: 'JSON 파싱 실패 (문법 오류)' })
      continue
    }
    const candidates = Array.isArray(json.questions) ? json.questions : []
    for (const q of candidates) {
      if (!q || !q.id || !q.textJa || !q.category) {
        skipped.push({ file, id: q?.id ?? '(id 없음)', reason: 'id/category/textJa 중 누락된 값 있음' })
        continue
      }
      if (existingIds.has(q.id)) {
        skipped.push({ file, id: q.id, reason: 'questions.json에 이미 같은 id 존재' })
        continue
      }
      main.questions.push({
        id: q.id,
        category: q.category,
        expectedDurationSec: q.expectedDurationSec ?? 60,
        textJa: q.textJa,
        ...(Array.isArray(q.tags) && q.tags.length > 0 ? { tags: q.tags } : {}),
      })
      existingIds.add(q.id)
      added.push({ file, id: q.id })
    }
  }

  if (added.length > 0) {
    writeFileSync(MAIN_QUESTIONS_PATH, JSON.stringify(main, null, 2) + '\n', 'utf-8')
  }

  return { added, skipped, draftFiles }
}

// ── 꼬리질문 규칙 병합 ─────────────────────────────────────
function loadExistingFollowUpLines() {
  if (!existsSync(FOLLOW_UPS_PATH)) return new Set()
  const raw = readFileSync(FOLLOW_UPS_PATH, 'utf-8')
  return new Set(
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  )
}

function mergeFollowUps() {
  const existingLines = loadExistingFollowUpLines()
  const draftFiles = walk(DATA_DIR).filter(
    (f) => f.endsWith('.txt') && /follow.?up/i.test(path.basename(f))
  )

  const added = []

  for (const file of draftFiles) {
    const raw = readFileSync(file, 'utf-8')
    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length < 3) continue
      if (existingLines.has(line)) continue
      added.push({ file, line })
      existingLines.add(line)
    }
  }

  if (added.length > 0) {
    const current = existsSync(FOLLOW_UPS_PATH) ? readFileSync(FOLLOW_UPS_PATH, 'utf-8') : ''
    const base = current.replace(/\n+$/, '\n')
    const appendix = added.map((a) => a.line).join('\n') + '\n'
    writeFileSync(FOLLOW_UPS_PATH, (base ? base + '\n' : '') + appendix, 'utf-8')
  }

  return { added, draftFiles }
}

// ── 실행 & 리포트 ──────────────────────────────────────────
function main() {
  console.log('data/ 폴더를 스캔해서 questions.json / follow_ups.txt에 자동 병합합니다...\n')

  const q = mergeQuestions()
  const f = mergeFollowUps()

  console.log(`[질문] 스캔한 초안 파일: ${q.draftFiles.length}개`)
  for (const file of q.draftFiles) console.log(`  - ${rel(file)}`)
  console.log(`[질문] 새로 추가됨: ${q.added.length}개`)
  for (const a of q.added) console.log(`  + ${a.id}  (${rel(a.file)})`)
  if (q.skipped.length > 0) {
    console.log(`[질문] 건너뜀: ${q.skipped.length}개`)
    for (const s of q.skipped) console.log(`  - ${s.id ?? '(?)'}  (${rel(s.file)}) — ${s.reason}`)
  }

  console.log(`\n[꼬리질문] 스캔한 초안 파일: ${f.draftFiles.length}개`)
  for (const file of f.draftFiles) console.log(`  - ${rel(file)}`)
  console.log(`[꼬리질문] 새로 추가됨: ${f.added.length}개`)
  for (const a of f.added) console.log(`  + ${a.line}  (${rel(a.file)})`)

  console.log('\n완료. data/questions.json' + (f.added.length > 0 ? ' 과 public/data/follow_ups.txt' : '') + '가 갱신되었는지 git diff로 확인 후 커밋하세요.')
}

main()
