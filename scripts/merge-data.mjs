#!/usr/bin/env node
// data/ 폴더 안의 질문 초안 파일들을 실제로 앱이 쓰는 data/questions.json에 자동으로
// 병합하는 스크립트. 2026-09-07부로 꼬리질문 기능은 완전히 제거되었으므로, 이 스크립트도
// 더 이상 public/data/follow_ups.txt를 다루지 않는다.
//
// 사용법: npm run merge-data
// 자세한 설명: HowToInputData.md

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'data')
const MAIN_QUESTIONS_PATH = path.join(DATA_DIR, 'questions.json')

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
      if (!q.topicCategory) {
        skipped.push({
          file,
          id: q.id,
          reason: 'topicCategory 없음 — 체크박스 화면에 안 나옴(lib/questionBank.ts의 TOPIC_CATEGORIES 참고)',
        })
        continue
      }
      main.questions.push({
        id: q.id,
        category: q.category,
        topicCategory: q.topicCategory,
        expectedDurationSec: q.expectedDurationSec ?? 60,
        textJa: q.textJa,
        ...(q.textKo ? { textKo: q.textKo } : {}),
        ...(q.group ? { group: q.group } : {}),
        ...(q.track ? { track: q.track } : {}),
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

// ── 실행 & 리포트 ──────────────────────────────────────────
function main() {
  console.log('data/ 폴더를 스캔해서 questions.json에 자동 병합합니다...\n')

  const q = mergeQuestions()

  console.log(`[질문] 스캔한 초안 파일: ${q.draftFiles.length}개`)
  for (const file of q.draftFiles) console.log(`  - ${rel(file)}`)
  console.log(`[질문] 새로 추가됨: ${q.added.length}개`)
  for (const a of q.added) console.log(`  + ${a.id}  (${rel(a.file)})`)
  if (q.skipped.length > 0) {
    console.log(`[질문] 건너뜀: ${q.skipped.length}개`)
    for (const s of q.skipped) console.log(`  - ${s.id ?? '(?)'}  (${rel(s.file)}) — ${s.reason}`)
  }

  console.log('\n완료. data/questions.json이 갱신되었는지 git diff로 확인 후 커밋하세요.')
  console.log(
    '참고: data/Question/{日本,Software,半導体}/*.md 는 사람이 보기 쉬운 카테고리별 질문 목록(참고 자료)입니다 — 자동으로 갱신되지 않으니 새 질문을 추가했다면 해당 카테고리 파일도 함께 손으로 갱신해주세요.'
  )
}

main()
