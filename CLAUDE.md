# Builder Pipeline

## Project Overview

1인 빌더를 위한 올인원 자동화 툴킷. 실제 빌딩을 제외한 모든 잡다한 작업(앱스토어 배포 준비, 아이콘 생성, 메타데이터 관리 등)을 명령어 하나로 처리한다.

## Architecture

- **Monorepo**: pnpm workspace (`packages/*`, `apps/*`)
- **Runtime**: Node.js >= 20
- **Package Manager**: pnpm (latest)
- **Language**: TypeScript

### Directory Structure

```
packages/       # 핵심 기능 패키지 (라이브러리)
  core/         # 공유 유틸, 타입, config loader
  icon-gen/     # 아이콘 생성 및 리사이징
  ...           # 필요에 따라 패키지 추가

apps/           # 유저 대면 인터페이스
  cli/          # CLI entry point (나중에 npm publish)
  dashboard/    # 웹 대시보드 (TBD)
  ...
```

- `packages/*` — 플랫폼 독립적인 핵심 기능. 각 패키지는 `apps/` 에서 가져다 쓸 수 있도록 설계.
- `apps/*` — 실제 사용자가 접하는 인터페이스. packages 의 기능을 조합해서 제공.

### Platform Compatibility

런타임 호환성은 **두 가지 레이어**로 관리한다:

#### 1. `exports` 조건으로 실제 차단 (enforcement)

`package.json` 의 `exports` 필드에 조건부 export 를 사용한다. **이것이 실제로 잘못된 import 를 빌드 타임에 차단하는 메커니즘이다.**

```jsonc
// nodejs-only 패키지 → "node" 조건만, "default" 없음
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "node": "./dist/index.js"
    }
  }
}

// universal 패키지 → "default" 사용
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

- `"node"` 조건만 있으면 Vite/webpack/esbuild 등 브라우저 번들러에서 resolve 실패 → **빌드 에러**
- `"default"` 는 모든 환경에서 resolve 가능

#### 2. `bp.runtime` 메타데이터 (documentation)

사람이 읽는 보조 정보로 `package.json` 에 명시:

```jsonc
{
  "bp": {
    "runtime": "nodejs", // "nodejs" | "web" | "universal"
  },
}
```

| runtime     | exports 조건     | 의미                                         | 예시                         |
| ----------- | ---------------- | -------------------------------------------- | ---------------------------- |
| `nodejs`    | `"node"` only    | Node.js 전용 (fs, child_process 등 사용)     | icon-gen, appstore           |
| `web`       | `"browser"` only | 브라우저 전용 (DOM, Web API 사용)            | dashboard 용 UI 유틸         |
| `universal` | `"default"`      | 어디서든 동작 (순수 로직, 플랫폼 API 미사용) | core, validators, formatters |

## Environment Variables

- 루트 `.env` 파일로 로컬 개발 환경 구성 (git ignored)
- `.env.sample` 을 항상 최신 상태로 유지할 것
- **새로운 env 변수를 추가할 때 반드시 `.env.sample` 도 함께 업데이트**

## Conventions

### Code Style

- TypeScript strict mode
- ESM (import/export) only — no CommonJS
- 함수 단위로 export, 내부 barrel export 지양 (단, 패키지 entrypoint `src/index.ts` 는 public API 정의용으로 허용)
- 에러 핸들링은 호출부에서 (throw early, catch late)
- Prettier 로 포맷팅 (`pnpm format` / `pnpm format:check`)

### Git

- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- 커밋 메시지는 영어로

### Adding a New Package (`packages/`)

1. `packages/<name>/` 디렉토리 생성
2. `package.json` 에 `"name": "@builder-pipeline/<name>"` 설정
3. `"bp": { "runtime": "..." }` 필드 추가
4. `"exports"` 에 런타임에 맞는 조건 설정 (`"node"` only / `"default"`)
5. TypeScript + ESM 설정
6. root `pnpm-workspace.yaml` 는 이미 `packages/*` 로 잡혀있으므로 수정 불필요

### Adding a New App (`apps/`)

1. `apps/<name>/` 디렉토리 생성
2. `package.json` 에 `"name": "@builder-pipeline/<name>-app"` 설정 (또는 CLI 면 `@builder-pipeline/cli`)
3. `packages/*` 의 기능을 workspace dependency 로 참조 (`"@builder-pipeline/icon-gen": "workspace:*"`)

### AI / Script 활용

- **Vercel AI SDK** (`ai` 패키지) 를 사용하여 AI 기능을 통합
- `@builder-pipeline/core` 에 `getImageModel()`, (향후) `getTextModel()` 등 모델 리졸버를 두고 프로젝트 전체에서 재사용
- 사용자가 `.env` 에서 `IMAGE_PROVIDER` 를 설정하면 core 가 해당 프로바이더의 모델을 반환
- 지원 프로바이더: **Google** (기본값), **OpenAI**, 향후 **Anthropic** (텍스트 전용)
- 외부 CLI 도구(ImageMagick, ffmpeg 등) 래핑 시 `execa` 등으로 감싸서 에러 핸들링

## Reminders for Claude

- `.env.sample` 에 정의된 환경 변수 목록을 항상 최신으로 유지해라. 새 변수가 생기면 `.env.sample` 에 추가하고, 제거되면 삭제해라.
- 새 패키지를 만들 때 `@builder-pipeline/` scope 를 사용해라.
- 패키지 생성 시 `"bp": { "runtime": "..." }` 필드와 `"exports"` 조건을 반드시 올바르게 설정해라. nodejs 전용이면 `"node"` 조건만, universal 이면 `"default"` 를 사용해라.
- `packages/` 는 라이브러리, `apps/` 는 유저 대면 인터페이스. 이 경계를 지켜라.
- 코드를 작성할 때 AI 및 외부 도구 활용을 적극적으로 고려해라 — 이 프로젝트의 핵심 가치다.
