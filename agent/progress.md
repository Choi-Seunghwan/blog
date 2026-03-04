# 블로그 구축 작업 내역

> 마지막 업데이트: 2026-03-04

## 프로젝트 개요

- **목적**: Tistory → 개인 도메인 기반 독립 개발 블로그 이전
- **프레임워크**: Astro (v5.15.7)
- **테마**: Astro Terminal (터미널풍 / 모노스페이스 / 레트로 감성)
- **사이트명**: chuz.dev
- **프로젝트 경로**: `/Users/csh/project/blog`

---

## 완료된 작업

### 1. Astro Terminal 테마 초기 설정

- GitHub에서 `dennisklappe/astro-theme-terminal` 클론
- `npm install` 완료 (376 패키지)
- 개발 서버 실행 확인 (`npm run dev` → http://localhost:4321)

### 2. 개인 정보 커스터마이징

#### astro.config.mjs
- `site`: `https://chuz.dev`
- `base`: `/`

#### BaseLayout.astro (src/layouts/BaseLayout.astro)
- `<html lang="ko">` 한국어로 변경
- 로고 텍스트: `chuz.dev`
- 기본 description: `chuz.dev — 개발 블로그`
- 네비게이션 메뉴: About, Posts, Tags, Projects (4개)
- 푸터: `© 2026 chuz.dev :: Powered by Astro`
- 기존 Showcase, Rich Content, Code Examples 등 데모 메뉴 항목 제거

#### index.astro (src/pages/index.astro)
- 타이틀: `chuz.dev`
- 인사말: 터미널 명령어풍 (`$ whoami`)
- 본문: `개발자 chuz입니다. 이곳에서 개발하며 배운 것들을 기록합니다.`
- 하단에 포스트 목록 유지

#### about.astro (src/pages/about.astro)
- 제목: `$ cat about.md` (터미널풍)
- 구조: 자기소개 / Tech Stack / Contact 섹션
- 내용은 플레이스홀더(주석)로 비워둠 — 추후 채워야 함

#### projects.astro (src/pages/projects.astro) — 신규 생성
- 제목: `$ ls ~/projects` (터미널풍)
- 프로젝트 카드 템플릿 2개 (플레이스홀더)
- 추후 실제 프로젝트로 교체 필요

### 3. Mermaid 다이어그램 지원 추가

- `rehype-mermaid` 패키지 설치
- `astro.config.mjs`에 `rehypePlugins: [rehypeMermaid]` 설정 추가
- Markdown 코드블록에서 `mermaid` 언어로 다이어그램 작성 가능
- 빌드 시 SVG로 변환되어 정적 이미지로 렌더링

---

## 아직 진행하지 않은 작업

### 콘텐츠 관련
- [ ] 샘플 포스트 정리 (기존 데모 글 5개 삭제 또는 교체)
- [ ] 첫 번째 실제 포스트 작성
- [ ] About 페이지 실제 내용 채우기 (자기소개, 기술스택, 연락처)
- [ ] Projects 페이지 실제 프로젝트 정보 입력

### 색상/스타일 관련
- [ ] `src/styles/terminal.css` 색상 변수 커스터마이징 (배경, 텍스트, 강조색)
- [ ] 폰트 변경 검토 (`src/styles/fonts.css`)

### 배포 관련
- [ ] 배포 방식 결정 및 구성 (S3 + CloudFront 또는 다른 방식)
- [ ] 개인 도메인 (chuz.dev) 연결
- [ ] GitHub Actions 자동 배포 파이프라인 구성
- [ ] Git 저장소 초기화 및 원격 저장소 연결

### 운영 관련
- [ ] 발행 프로세스 설계 (Notion → Markdown → git push → 빌드 → 배포)
- [ ] favicon 교체

---

## 주요 파일 구조

```
/Users/csh/project/blog/
├── astro.config.mjs          # Astro 설정 (site URL, mermaid 플러그인)
├── content.config.ts         # 포스트 스키마 정의
├── package.json
├── public/                   # 정적 에셋 (favicon 등)
├── src/
│   ├── content/posts/        # 블로그 포스트 (Markdown)
│   ├── pages/
│   │   ├── index.astro       # 메인 페이지 ($ whoami)
│   │   ├── about.astro       # About 페이지 ($ cat about.md)
│   │   ├── projects.astro    # Projects 페이지 ($ ls ~/projects)
│   │   ├── 404.astro
│   │   ├── rss.xml.js
│   │   ├── posts/            # 포스트 목록/상세 페이지
│   │   └── tags/             # 태그 목록/필터 페이지
│   ├── layouts/
│   │   ├── BaseLayout.astro  # 기본 레이아웃 (메뉴, 푸터)
│   │   └── PostLayout.astro  # 포스트 레이아웃
│   ├── components/           # 재사용 컴포넌트
│   └── styles/
│       └── terminal.css      # 테마 변수 (색상, 폰트)
├── work.md                   # 블로그 이전 계획 문서
└── agent/                    # 작업 내역 공유 폴더
    └── progress.md           # 이 파일
```

---

## 기술 환경

| 항목 | 값 |
|------|-----|
| Node.js | v20.12.2 |
| npm | 10.5.0 |
| Astro | v5.15.7 |
| OS | macOS (Darwin 24.6.0) |
| 테마 원본 | github.com/dennisklappe/astro-theme-terminal |

---

## 참고 사항

- 개발 서버: `npm run dev` → http://localhost:4321
- 프로덕션 빌드: `npm run build` → `dist/` 디렉토리에 정적 파일 생성
- 글 작성: `src/content/posts/` 에 Markdown 파일 추가
- frontmatter 필수 필드: `title`, `pubDate`
- frontmatter 선택 필드: `description`, `tags`, `draft`, `updatedDate`, `author`, `image`
