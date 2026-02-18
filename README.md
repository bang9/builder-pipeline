# builder-pipeline

> All-in-one toolkit for solo builders — automate everything except the actual building.

앱을 만드는 건 당신의 몫. 그 외 나머지 잡일은 전부 여기서 처리합니다.

## What is this?

1인 빌더가 앱을 세상에 내놓기까지 필요한 **빌딩 외의 모든 작업**을 자동화하는 도구 모음입니다.

예를 들어 App Store 에 앱을 배포하려면:

- 앱 생성 (App Store Connect)
- 아이콘 이미지를 사이즈별로 추출
- 앱 설명, 키워드, 카테고리 작성
- 번들 ID 설정
- 스크린샷 생성
- ...

이런 작업들을 명령어 하나, 함수 하나로 끝낼 수 있도록 만듭니다.
AI와 스크립트 도구를 적극적으로 활용합니다.

## Getting Started

```bash
# 1. Clone
git clone https://github.com/bang9/builder-pipeline.git
cd builder-pipeline

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.sample .env
# Fill in your .env values

# 4. Run (TBD)
```

## Project Structure

```
builder-pipeline/
├── packages/
│   ├── core/        # Shared utilities, types, config loader
│   ├── cli/         # CLI entry point
│   ├── appstore/    # App Store automation
│   └── ...          # More packages as needed
├── .env.sample      # Environment variable template
├── pnpm-workspace.yaml
└── package.json
```

## Tech Stack

- **Runtime**: Node.js >= 20
- **Language**: TypeScript (ESM)
- **Package Manager**: pnpm (monorepo)

## License

MIT
