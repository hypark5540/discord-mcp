# Discord MCP

<!-- mcp-name: io.github.hypark5540/discord-mcp -->

[![CI](https://github.com/hypark5540/discord-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hypark5540/discord-mcp/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/hypark5540/discord-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/hypark5540/discord-mcp)
[![CodeQL](https://github.com/hypark5540/discord-mcp/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/hypark5540/discord-mcp/actions/workflows/codeql.yml)
[![Deploy](https://github.com/hypark5540/discord-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/hypark5540/discord-mcp/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/%40hypark5540%2Fdiscord-mcp?logo=npm)](https://www.npmjs.com/package/@hypark5540/discord-mcp)
[![PyPI](https://img.shields.io/pypi/v/hypark-discord-mcp?logo=pypi)](https://pypi.org/project/hypark-discord-mcp/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hypark5540/discord-mcp/blob/main/LICENSE)

Discord 서버와 채널을 읽고, 명시적으로 허용한 경우에만 메시지를 보내는 로컬
[Model Context Protocol](https://modelcontextprotocol.io/) 서버입니다.

- TypeScript + MCP SDK v1
- 로컬 `stdio` 전송
- Discord REST API v10 (`Gateway` 연결 불필요)
- 서버/채널 allowlist
- 기본 read-only
- 멘션 알림 강제 차단
- 자기 봇이 작성한 메시지만 수정/삭제

TypeScript 구현 하나를 npm, PyPI, OCI 이미지와 Claude Desktop MCPB로 배포합니다. PyPI 패키지도 서버를
Python으로 다시 구현하거나 실행할 때 `npx @latest`를 호출하지 않고, 릴리스와 함께
고정된 같은 JS 코드를 wheel 내부에서 실행합니다.

```text
TypeScript source
  ├─ esbuild → bundle/discord-mcp.cjs
  │              ├─ npm (npx / pnpm / Yarn / bunx)
  │              ├─ PyPI wheel (uvx / pipx / pip launcher)
  │              ├─ GHCR image (Docker)
  │              └─ MCPB (Claude Desktop one-click bundle)
  └─ server.json → MCP Registry에서 npm / PyPI / OCI 좌표를 한 항목으로 연결
```

네 배포 산출물은 동일한 서버 번들을 사용하며, 번들에 실제 포함된 의존성의 라이선스 원문과
결정적인 CycloneDX 1.6 SBOM도 esbuild metafile에서 함께 생성합니다. 따라서 같은
릴리스 버전이 패키지 매니저별로 서로 다른 전이 의존성을 다시 해석하지 않습니다.

## 제공 기능

읽기 도구는 기본으로 노출됩니다.

| 도구 | 설명 |
| --- | --- |
| `discord_get_bot` | 봇 계정과 현재 안전 설정 확인 |
| `discord_list_guilds` | 봇이 참여한 서버 목록 조회 |
| `discord_get_guild` | 서버 메타데이터 조회 |
| `discord_list_channels` | 서버의 채널 목록 조회 |
| `discord_get_channel` | 채널 메타데이터 조회 |
| `discord_get_messages` | 채널 메시지 최대 100개 조회 |
| `discord_get_message` | 단일 메시지 조회 |

`DISCORD_ENABLE_WRITES=true`일 때 다음 도구가 추가됩니다.

| 도구 | 설명 |
| --- | --- |
| `discord_send_message` | 일반 메시지 또는 답글 전송 |
| `discord_edit_own_message` | 이 봇이 직접 작성한 메시지만 수정 |

`DISCORD_ENABLE_DELETES=true`까지 설정하면
`discord_delete_own_message`가 추가됩니다. 삭제 호출에는 `confirm: true`도
필요합니다.

MCP resource도 함께 제공합니다.

- `discord://bot`
- `discord://guilds`
- `discord://guilds/{guild_id}`
- `discord://guilds/{guild_id}/channels`
- `discord://channels/{channel_id}`
- `discord://channels/{channel_id}/messages/{message_id}`

## 1. Discord 봇 준비

1. [Discord Developer Portal](https://discord.com/developers/applications)에서
   Application을 만들고 **Bot** 메뉴에서 봇을 생성합니다.
2. Bot Token을 발급합니다. 토큰은 비밀번호와 같으므로 코드나 Git에 넣지
   마세요.
3. 일반 채널의 메시지 본문을 읽으려면 Bot 메뉴의 **Message Content Intent**를
   활성화합니다. REST로 메시지를 읽을 때도 이 설정이 적용됩니다.
4. OAuth2 URL Generator에서 `bot` scope를 선택하고 테스트 서버에 초대합니다.

권장 최소 권한:

- 읽기: `View Channels`, `Read Message History`
- 메시지 전송도 사용할 때: `Send Messages`
- thread에 전송할 때: `Send Messages in Threads`
- voice channel의 텍스트 타임라인을 읽을 때: `Connect`

`Administrator`, `Manage Messages`, `Mention Everyone` 권한은 필요하지 않습니다.
채널별 permission overwrite가 서버 권한보다 우선하므로, 특정 채널이 보이지
않으면 해당 채널 권한도 확인하세요.

## 2. 설치

권장 런타임은 Node.js 22 이상입니다. 배포 채널에 따라 다음 명령을 사용할 수
있습니다. 재현 가능한 MCP 설정을 위해 `latest` 대신 정확한 버전을 고정하세요.

| 채널 | 실행 명령 | 필요한 런타임 |
| --- | --- | --- |
| npm / npx | `npx -y @hypark5540/discord-mcp@0.1.1` | Node.js 22+ |
| pnpm | `pnpm dlx --package=@hypark5540/discord-mcp@0.1.1 discord-mcp` | Node.js 22+ |
| Yarn | `yarn dlx -p @hypark5540/discord-mcp@0.1.1 discord-mcp` | Node.js 22+ |
| Bun 패키지 실행기 | `bunx --package @hypark5540/discord-mcp@0.1.1 discord-mcp` | Bun + Node.js 22+ |
| PyPI / uvx | `uvx --from hypark-discord-mcp==0.1.1 discord-mcp` | Python 3.9+ + Node.js 22+ |
| PyPI / pipx | `pipx run --spec hypark-discord-mcp==0.1.1 discord-mcp` | Python 3.9+ + Node.js 22+ |
| Docker / GHCR | 아래 `docker run` 예시 | Docker |
| Claude Desktop MCPB | GitHub Release의 `discord-mcp-0.1.1.mcpb` | Claude Desktop |
| MCP Registry | `io.github.hypark5540/discord-mcp` | 클라이언트가 선택한 패키지에 따름 |

`bunx`는 npm 패키지 설치 프런트엔드로 지원합니다. Node shebang을 그대로 실행하며
Bun 자체 런타임을 강제하는 `bunx --bun` 모드는 지원 범위가 아닙니다.

전역 설치는 기존 `discord-mcp` 명령이 없는 격리된 환경에서만 다음처럼 사용할 수
있습니다.

```bash
npm install --global @hypark5540/discord-mcp@0.1.1
pip install hypark-discord-mcp==0.1.1
hypark-discord-mcp --version
```

npm과 Python 채널 모두 고유한 `hypark-discord-mcp` 명령 alias를 제공합니다.
제3자의 기존 npm/PyPI 패키지도 `discord-mcp`라는 전역 명령을 설치하므로, 전역
설치 과정 자체가 충돌할 수 있습니다. 평소에는 격리된 npx/uvx 실행을 권장하고,
전역으로 설치했다면 고유 alias를 사용하세요.
Python 패키지는 Node를 내장하지 않으며, 필요하면
`DISCORD_MCP_NODE=/path/to/node`로 실행 파일을 지정할 수 있습니다.

Docker에서는 `-i`로 stdio를 유지하고 `-t`는 사용하지 않습니다.

```bash
docker run --rm -i \
  -e DISCORD_TOKEN \
  -e DISCORD_ENABLE_WRITES=false \
  ghcr.io/hypark5540/discord-mcp:0.1.1
```

## 3. 클라이언트 원터치 연결

### Cursor

아래 공식 버튼은 정확히 고정된 npm 패키지를 stdio MCP 서버로 등록합니다. 실제
토큰은 링크에 들어 있지 않고 `${env:DISCORD_TOKEN}`을 참조하므로, Cursor를
시작하는 환경에 먼저 안전하게 설정하세요.

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.png)](cursor://anysphere.cursor-deeplink/mcp/install?name=discord-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBoeXBhcms1NTQwL2Rpc2NvcmQtbWNwQDAuMS4xIl0sImVudiI6eyJESVNDT1JEX1RPS0VOIjoiJHtlbnY6RElTQ09SRF9UT0tFTn0iLCJESVNDT1JEX0VOQUJMRV9XUklURVMiOiJmYWxzZSIsIkRJU0NPUkRfRU5BQkxFX0RFTEVURVMiOiJmYWxzZSIsIkRJU0NPUkRfQUxMT1dfVU5SRVNUUklDVEVEX1dSSVRFUyI6ImZhbHNlIn19)

PyPI처럼 `cursor://` 링크를 제거하는 페이지에서 보고 있다면
[GitHub README의 Cursor 섹션](https://github.com/hypark5540/discord-mcp#cursor)에서 버튼을 누르세요.

### Claude Desktop

[Claude Desktop용 `discord-mcp-0.1.1.mcpb`를 다운로드](https://github.com/hypark5540/discord-mcp/releases/download/v0.1.1/discord-mcp-0.1.1.mcpb)한 뒤
파일을 열면 설치 화면이 나타납니다. Discord Bot Token은 MCPB 안에 저장되지 않고,
설치 화면의 sensitive 입력을 통해 운영체제 keychain/credential manager에
보관됩니다. 같은 릴리스의
[SHA-256 파일](https://github.com/hypark5540/discord-mcp/releases/download/v0.1.1/discord-mcp-0.1.1.mcpb.sha256)로
다운로드한 번들을 확인할 수 있습니다. GitHub CLI가 있으면
`gh attestation verify --repo hypark5540/discord-mcp discord-mcp-0.1.1.mcpb`로 릴리스
워크플로의 서명된 provenance도 검증할 수 있습니다.

### Gemini CLI

Gemini CLI는 저장소의 공식 Extension 매니페스트를 직접 설치할 수 있습니다.

```bash
gemini extensions install https://github.com/hypark5540/discord-mcp --ref=v0.1.1
```

설치 중 Token 설정은 `sensitive: true`이므로 시스템 keychain에 저장됩니다. 확인
화면을 건너뛰는 옵션은 사용하지 마세요.

### ChatGPT Desktop, Codex와 나머지 클라이언트

| 클라이언트 | 권장 연결 | 비밀 전달 |
| --- | --- | --- |
| ChatGPT Desktop / Codex CLI·IDE | 공유 `~/.codex/config.toml` local stdio 설정 | `env_vars = ["DISCORD_TOKEN"]` |
| Claude Code / 기타 stdio MCP | 고정 버전 npx 설정 | 클라이언트 secret store |
| ChatGPT 웹 | local stdio 미지원 | 별도의 hosted remote MCP 필요 |

정확한 설정은 [클라이언트별 가이드](https://github.com/hypark5540/discord-mcp/blob/main/docs/clients.md), keychain·환경변수와 토큰 회전은
[비밀 관리 가이드](https://github.com/hypark5540/discord-mcp/blob/main/docs/secrets.md)에 있습니다. ChatGPT, Claude, Cursor, Gemini 같은
에이전트에게 설치 자체를 맡길 때는 [AI 설치 프롬프트](https://github.com/hypark5540/discord-mcp/blob/main/docs/ai-install.md)를 그대로
사용할 수 있습니다.

## 4. 소스에서 실행

Node.js 22 이상이 필요합니다.

```bash
npm run deps:locked
cp .env.example .env
npm run build
```

`deps:locked`는 모든 의존성 설치 스크립트를 차단한 뒤, 잠금·검토된
`esbuild@0.28.1`만 명시적으로 재빌드합니다.

`.env`에서 최소한 토큰을 설정합니다.

```dotenv
DISCORD_TOKEN=your-bot-token
DISCORD_ENABLE_WRITES=false
DISCORD_ENABLE_DELETES=false
DISCORD_ALLOW_UNRESTRICTED_WRITES=false
```

직접 확인하려면 다음 명령을 실행할 수 있습니다.

```bash
npm start
```

`stdio`는 MCP 프레임 전용이므로 실행 후 일반 프롬프트가 나타나지 않는 것이
정상입니다. 상태 로그는 stderr에만 기록됩니다.

## 5. MCP 클라이언트 연결

npm 패키지를 실행하도록 등록하는 예시입니다. 클라이언트마다 설정 파일 위치는
다르지만 설정 형태는 대체로 다음과 같습니다.

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@hypark5540/discord-mcp@0.1.1"],
      "env": {
        "DISCORD_TOKEN": "<use-the-client-secret-store>",
        "DISCORD_ENABLE_WRITES": "false",
        "DISCORD_ALLOW_UNRESTRICTED_WRITES": "false",
        "DISCORD_ALLOWED_GUILD_IDS": "123456789012345678",
        "DISCORD_ALLOWED_CHANNEL_IDS": "234567890123456789"
      }
    }
  }
}
```

uvx를 선호하면 실행 부분만 다음처럼 바꿀 수 있습니다.

```json
{
  "command": "uvx",
  "args": ["--from", "hypark-discord-mcp==0.1.1", "discord-mcp"]
}
```

소스 빌드를 직접 연결할 때는 기존처럼 `command`를 `node`, `args`를
`["/absolute/path/to/discord-mcp/dist/index.js"]`로 지정합니다.

MCP 설정의 `env`가 `.env`보다 우선합니다. 다른 디렉터리에서 서버가 실행될 수
있으므로 MCP 클라이언트에서는 `env`에 토큰을 전달하는 방식을 권장합니다.
클라이언트가 native keychain이나 환경변수 참조를 지원하면 위 자리에는 토큰 원문을
저장하지 말고 그 기능을 우선 사용하세요.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DISCORD_TOKEN` | 필수 | Discord Bot Token |
| `DISCORD_BOT_TOKEN` | - | `DISCORD_TOKEN`의 호환 alias |
| `DISCORD_ENABLE_WRITES` | `false` | 전송/수정 도구 등록 |
| `DISCORD_ENABLE_DELETES` | `false` | 삭제 도구 등록. writes도 `true`여야 함 |
| `DISCORD_ALLOW_UNRESTRICTED_WRITES` | `false` | allowlist 없는 전체 채널 쓰기를 의도적으로 허용 |
| `DISCORD_ALLOWED_GUILD_IDS` | 비어 있음 | 쉼표 구분 서버 ID. 비우면 봇이 볼 수 있는 모든 서버 허용 |
| `DISCORD_ALLOWED_CHANNEL_IDS` | 비어 있음 | 쉼표 구분 채널 ID. 비우면 허용 서버의 모든 guild channel 허용 |
| `DISCORD_MAX_RESPONSE_CHARS` | `50000` | 직렬화된 tool/resource 결과 최대 문자 수 (`1000`~`200000`) |
| `DISCORD_MCP_NODE` | PATH의 `node` | PyPI 런처에서 사용할 Node.js 실행 파일 경로 |

서버 ID와 채널 ID는 Discord의 Developer Mode를 켠 뒤 **Copy ID**로 얻을 수
있습니다. 두 allowlist를 모두 설정하면 교집합만 허용됩니다. DM과 그룹 DM은
항상 거부됩니다. 읽기 모드에서는 allowlist가 모두 비어 있으면 봇이 접근할 수
있는 모든 guild channel을 읽을 수 있습니다. 쓰기 모드는 allowlist를 하나 이상
요구하며, 이 검사를 해제하려면 `DISCORD_ALLOW_UNRESTRICTED_WRITES=true`를 별도로
명시해야 합니다.

## 안전 설계

- Bot Token만 사용하며 사용자 토큰/self-bot을 지원하지 않습니다.
- 임의 Discord API endpoint를 호출하는 범용 도구가 없습니다.
- 쓰기와 삭제 도구는 시작 시 환경변수로 별도 활성화해야 합니다.
- 모든 전송/수정 요청은 `allowed_mentions: { parse: [] }`를 강제하므로
  `@everyone`, 역할, 사용자 문자열이 있어도 알림을 보내지 않습니다.
- 전송에는 Discord nonce 중복 방지를 적용합니다.
- 수정/삭제 전 작성자 ID를 검사하며 webhook 메시지와 다른 사용자의 메시지를
  거부합니다.
- Discord 메시지는 신뢰하지 않는 외부 데이터로 표시하며 응답을 로컬에
  저장하거나 캐시하지 않습니다.
- 다른 채널을 참조하는 Discord 답글/스레드 메타데이터는 본문을 제거해
  allowlist 경계를 우회하지 못하게 합니다.
- API 오류는 토큰, 요청 헤더, 원문 응답 body를 노출하지 않는 문구로 변환합니다.

Discord의 guild channel 목록 API는 봇이 실제로 `View Channel` 권한을 갖지 않은
채널의 이름이나 topic 같은 메타데이터도 반환할 수 있습니다. 민감한 서버에서는
guild allowlist만 두지 말고 channel allowlist도 함께 설정하세요. 채널 목록에는
일반 채널과 현재 active thread가 포함되며, archived thread는 ID로 직접 조회해야
합니다.

allowlist 없이도 실행할 수 있지만, 실제 사용 환경에서는 봇 전용 테스트 서버와
`DISCORD_ALLOWED_GUILD_IDS`, `DISCORD_ALLOWED_CHANNEL_IDS`를 함께 사용하는 것이
좋습니다.

## 개발

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run check
npm run build:mcpb
npm run verify:mcpb
npm run build:pypi
```

테스트는 실제 Discord 호출 없이 다음 항목을 검증합니다.

Vitest는 import 가능한 `src` 모듈에 대해 statements, branches, functions, lines를
파일별 100%로 강제합니다. 얇은 process bootstrap인 `src/index.ts`는 커버리지 계산
대신 컴파일 결과와 번들에 대한 실제 stdio handshake로 검증합니다. Codecov의
project/patch 상태도 허용 오차 없이 100%를 요구합니다.

- MCP initialize, tool/resource 목록과 호출
- feature flag에 따른 쓰기/삭제 도구 노출
- Snowflake, pagination cursor, 메시지 길이 검증
- guild/channel allowlist 선차단
- 타인 메시지 수정 거부와 삭제 확인
- 멘션 차단 및 nonce 적용
- 최대 응답 크기 제한
- 컴파일 결과와 PyPI용 번들의 실제 MCP initialize/tools handshake
- Claude MCPB의 공식 CLI pack/unpack/manifest 검증, 결정적 바이트와 stdio handshake
- npm, PyPI, MCP Registry, OCI 메타데이터의 버전 일치

CI는 Node.js 22/24에서 검사하고, 생성된 npm tarball과 Python wheel을 각각 깨끗한
환경에 설치한 뒤 stdio handshake를 다시 수행합니다. Python wheel 런처는
Ubuntu/Windows의 Python 3.9/3.14에서도 별도 확인합니다. MCPB도 독립적으로 두 번
빌드해 바이트가 같은지 확인하고, 공식 CLI로 다시 압축 해제한 서버를 실행합니다.
릴리스 준비와 OIDC
Trusted Publishing 설정은
[docs/releasing.md](https://github.com/hypark5540/discord-mcp/blob/main/docs/releasing.md)를
참고하세요.

## 개인정보와 보안 보고

이 서버는 telemetry를 보내거나 Discord 응답을 별도로 저장하지 않습니다. 로컬
MCP 클라이언트의 요청에 필요한 Discord REST 호출만 수행합니다. 데이터 흐름과
보관 범위는 [PRIVACY.md](https://github.com/hypark5540/discord-mcp/blob/main/PRIVACY.md), 취약점 비공개 제보 방법은
[SECURITY.md](https://github.com/hypark5540/discord-mcp/blob/main/SECURITY.md)를 확인하세요. 공개 issue나 로그에는 Bot Token을 절대
포함하지 마세요.

## 문제 해결

- **401 / 토큰 거부**: Bot 메뉴에서 토큰을 재발급하고 `DISCORD_TOKEN`을
  갱신하세요. `Bot ` 접두사는 직접 붙이지 않습니다.
- **403 / 권한 없음**: 채널의 `View Channel`, `Read Message History`, 필요 시
  `Send Messages`를 확인하세요.
- **메시지 내용이 비어 있음**: Developer Portal에서 Message Content Intent를
  활성화했는지 확인하세요.
- **쓰기 도구가 목록에 없음**: MCP 클라이언트 프로세스의
  `DISCORD_ENABLE_WRITES`가 문자열 `true`인지 확인하고 클라이언트를 재시작하세요.
- **allowlist 오류**: ID는 이름이나 URL이 아니라 17~20자리 숫자 문자열이어야
  합니다.

Discord의 공식 권한·intent·rate limit 세부사항은
[OAuth2 and Permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions),
[Gateway Intents](https://docs.discord.com/developers/events/gateway),
[Message Resource](https://docs.discord.com/developers/resources/message),
[Rate Limits](https://docs.discord.com/developers/topics/rate-limits)을 참고하세요.
