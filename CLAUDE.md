# Builder Pipeline

## Project Overview

1인 빌더를 위한 올인원 자동화 툴킷. 실제 빌딩을 제외한 모든 잡다한 작업(앱스토어 배포 준비, 아이콘 생성, 메타데이터 관리 등)을 명령어 하나로 처리한다.

## Architecture

- **Monorepo**: pnpm workspace (`packages/*`)
- **Runtime**: Node.js >= 20
- **Package Manager**: pnpm (latest)
- **Language**: TypeScript

### Package Structure

```
packages/
  core/       # 공유 유틸, 타입, config loader
  cli/        # CLI entry point (나중에 npm publish)
  appstore/   # App Store 관련 자동화 (아이콘, 메타데이터, 스크린샷 등)
  ...         # 필요에 따라 패키지 추가
```

## Environment Variables

- 루트 `.env` 파일로 로컬 개발 환경 구성 (git ignored)
- `.env.sample` 을 항상 최신 상태로 유지할 것
- **새로운 env 변수를 추가할 때 반드시 `.env.sample` 도 함께 업데이트**

## Conventions

### Code Style
- TypeScript strict mode
- ESM (import/export) only — no CommonJS
- 함수 단위로 export, barrel export 지양
- 에러 핸들링은 호출부에서 (throw early, catch late)
- Prettier 로 포맷팅 (`pnpm format` / `pnpm format:check`)

### Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- 커밋 메시지는 영어로

### Adding a New Package
1. `packages/<name>/` 디렉토리 생성
2. `package.json` 에 `"name": "@builder-pipeline/<name>"` 설정
3. TypeScript + ESM 설정
4. 필요 시 root `pnpm-workspace.yaml` 는 이미 `packages/*` 로 잡혀있으므로 수정 불필요

### AI / Script 활용
- 반복적이고 기계적인 작업은 AI API 또는 스크립트로 자동화
- LLM 호출이 필요한 경우 `core` 패키지에 공통 클라이언트를 두고 재사용
- 외부 CLI 도구(ImageMagick, ffmpeg 등) 래핑 시 `execa` 등으로 감싸서 에러 핸들링

## Reminders for Claude

- `.env.sample` 에 정의된 환경 변수 목록을 항상 최신으로 유지해라. 새 변수가 생기면 `.env.sample` 에 추가하고, 제거되면 삭제해라.
- 새 패키지를 만들 때 `@builder-pipeline/` scope 를 사용해라.
- 코드를 작성할 때 AI 및 외부 도구 활용을 적극적으로 고려해라 — 이 프로젝트의 핵심 가치다.
