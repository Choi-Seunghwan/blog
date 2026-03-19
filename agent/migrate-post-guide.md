# Notion 문서 → 블로그 포스트 마이그레이션 가이드

> docs/ 폴더에 Notion export 문서가 추가되면, 이 가이드에 따라 블로그 포스트로 변환한다.

## 전체 흐름

```
docs/<문서 폴더>/
  ├── <문서명> <해시>.md        ← Notion export 원본
  └── <문서명>/                 ← 이미지 폴더
      ├── image.png
      └── 스크린샷_....png

    ↓ 변환

src/content/posts/<slug>.md     ← 블로그 포스트
public/images/posts/<slug>/     ← 이미지 (순번 파일명)
  ├── 1.png
  ├── 2.png
  └── 3.png
```

## 1. slug 결정

- 문서 제목을 영문 kebab-case로 변환
- 예: "LLM 가시성(Observability) & Tempo 트레이싱 PoC" → `llm-observability`
- 예: "쇼핑몰 프로젝트 개발 경험 정리" → `shopping-mall-project`

## 2. frontmatter 작성

파일 최상단에 아래 형식으로 작성:

```yaml
---
title: '문서 제목'
pubDate: YYYY-MM-DD
tags: ['tag1', 'tag2']
---
```

- `title`: 원본 문서의 `# 제목`을 그대로 사용
- `pubDate`: 문서 내에 작성일이 있으면 사용. 없으면 이미지 스크린샷 날짜 등에서 추정
- `tags`: 내용에 맞는 기술 키워드
- 선택 필드: `description`, `author`, `image`, `updatedDate`, `draft`

## 3. 본문 정리

### 제거할 항목
- `# 제목` 첫 줄 (frontmatter title로 이동했으므로)
- Notion 메타데이터 줄: `작성일:`, `작성자:`, `태그:` 등
- `\x08` (backspace) 같은 보이지 않는 특수문자

### 블록인용 수정
Notion export는 여러 줄 blockquote에서 첫 줄에만 `>`를 붙인다.
모든 연속 줄에 `> `를 추가해야 한다.

```markdown
# 잘못된 예 (Notion export)
> 첫 번째 줄
두 번째 줄
세 번째 줄

# 올바른 예
> 첫 번째 줄
> 두 번째 줄
> 세 번째 줄
```

## 4. 이미지 처리

### 이미지 복사 및 이름 변경
1. `public/images/posts/<slug>/` 폴더 생성
2. 원본 이미지를 등장 순서대로 순번 파일명으로 복사:
   - `image.png` → `1.png`
   - `스크린샷_2026-02-26_오후_2.51.56.png` → `2.png`
   - 확장자는 원본 유지 (png, jpg, jpeg 등)

### 이미지 경로 수정
Notion export의 URL-encoded 경로를 절대 경로로 변환:

```markdown
# 변경 전 (Notion export)
![alt](문서명%20해시/image.png)
![alt](%E1%84%89%E1%85%B3%E1%84%8F...png)

# 변경 후
![alt](/images/posts/<slug>/1.png)
![alt](/images/posts/<slug>/2.png)
```

### 주의: 괄호가 포함된 경로
Notion export 폴더명에 `()` 괄호가 있으면 markdown 이미지 문법 `![alt](url)`의 `)` 와 충돌한다.
순번 파일명으로 변환하면 이 문제가 해결된다.

## 5. Mermaid 다이어그램

````markdown ```mermaid```` 코드블록은 그대로 유지한다.
클라이언트사이드에서 자동으로 다이어그램으로 렌더링된다.

## 6. 커밋

포스트별로 개별 커밋:

```
git add src/content/posts/<slug>.md public/images/posts/<slug>/
git commit -m "post: <한글 제목>"
```

- Co-Authored-By 트레일러는 넣지 않는다.

## 7. 검증

- `pnpm dev` 실행 후 `http://localhost:4321/posts/<slug>/` 접속
- 이미지가 모두 표시되는지 확인
- blockquote가 올바르게 렌더링되는지 확인
- Mermaid 다이어그램이 렌더링되는지 확인

## 참고: 프로젝트 구조

```
src/content/posts/          ← 블로그 포스트 (.md)
public/images/posts/<slug>/ ← 포스트 이미지 (순번 파일명)
docs/                       ← Notion export 원본 (.gitignore 에 포함)
```

## 참고: frontmatter 스키마

```typescript
// src/content.config.ts
{
  title: z.string(),              // 필수
  pubDate: z.coerce.date(),       // 필수
  description: z.string().optional(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().optional(),
  image: z.string().optional(),
  externalLink: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
}
```
