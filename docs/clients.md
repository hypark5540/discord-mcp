# MCP 클라이언트 연결 가이드

이 문서는 Discord MCP `0.1.1`을 ChatGPT Desktop/Codex, Claude Desktop,
Cursor, Gemini CLI와 그 밖의 stdio MCP 클라이언트에 연결하는 방법을 정리합니다.
모든 방식은 기본 read-only이며, Discord Bot Token은 설치 링크나 저장소에 포함하지
않습니다.

공통 준비 사항은 다음과 같습니다.

- [Discord Developer Portal](https://discord.com/developers/applications)에서 만든
  봇의 Token
- npm 기반 설치에는 Node.js 22 이상
- 봇을 초대한 테스트 서버와 최소 Discord 권한
- 일반 메시지 본문을 읽을 경우 Message Content Intent

비밀을 입력하기 전 [secrets.md](./secrets.md)를 먼저 확인하세요.

## Cursor

README의 공식 **Add to Cursor** 버튼을 누르면 정확히 고정된
`@hypark5540/discord-mcp@0.1.1` stdio 설정이 설치됩니다. 링크 안에는 토큰 대신
`${env:DISCORD_TOKEN}` 참조만 들어 있습니다. Cursor를 시작하는 환경에
`DISCORD_TOKEN`을 안전하게 설정한 뒤 버튼을 사용하세요.

수동 설정은 사용자 설정 또는 프로젝트의 `.cursor/mcp.json`에 다음 server
항목을 추가합니다.

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@hypark5540/discord-mcp@0.1.1"],
      "env": {
        "DISCORD_TOKEN": "${env:DISCORD_TOKEN}",
        "DISCORD_ENABLE_WRITES": "false",
        "DISCORD_ENABLE_DELETES": "false"
      }
    }
  }
}
```

Cursor의 Base64 설치 링크는 설정을 운반할 뿐 암호화하지 않습니다. 링크에 실제
토큰을 넣지 마세요. 형식은 [Cursor MCP Install Links 공식 문서](https://cursor.com/docs/mcp/install-links)를
따릅니다.

## Claude Desktop

GitHub Release에서 `discord-mcp-0.1.1.mcpb`와 같은 이름의 `.sha256` 파일을 내려받아
SHA-256을 확인한 뒤, MCPB를 더블클릭하거나 Claude Desktop의 Extensions 화면으로
끌어 놓습니다. 설치 화면이 Discord Bot Token을
요청하며, `sensitive`로 선언된 토큰은 운영체제 keychain/credential manager에
보관됩니다. 번들 안에는 토큰 값이 없고 `${user_config.discord_token}` 참조만
있습니다.

GitHub CLI가 있으면 설치 전에 서명된 build provenance도 확인할 수 있습니다.

```bash
gh attestation verify --repo hypark5540/discord-mcp discord-mcp-0.1.1.mcpb
```

MCPB에는 다음 파일이 모두 포함되므로 별도의 npm 설치가 필요하지 않습니다.

```text
manifest.json
LICENSE
server/discord-mcp.cjs
server/THIRD_PARTY_NOTICES.txt
server/sbom.cdx.json
```

설치 후 설정 화면에서 allowlist와 쓰기 옵션을 조정할 수 있습니다. 처음에는 쓰기와
삭제를 모두 끈 상태로 확인하세요. 자세한 설치 흐름은
[Claude의 MCPB 공식 가이드](https://claude.com/docs/connectors/building/mcpb)를
참고하세요. MCPB는 Claude Desktop용이며 Claude 웹 또는 Claude Code의 설치
패키지와는 다릅니다.

## Gemini CLI

저장소의 `gemini-extension.json`을 사용하는 확장으로 설치합니다.

```bash
gemini extensions install https://github.com/hypark5540/discord-mcp --ref=v0.1.1
```

설치 확인 화면을 검토하고 Discord Bot Token 설정을 입력합니다. 매니페스트의
`sensitive: true` 설정 때문에 값은 시스템 keychain에 저장되고 MCP 서버 프로세스에
`DISCORD_TOKEN`으로 주입됩니다. 보안 검토를 건너뛰는 `--consent` 옵션은 권장하지
않습니다. 설정을 바꾸려면 다음 명령을 사용합니다.

```bash
gemini extensions config discord-mcp
```

Extension 설정에는 guild/channel allowlist, 쓰기·삭제 플래그, unrestricted-write
차단 해제와 응답 크기 제한도 함께 선언되어 있습니다. 비워 둔 선택 항목은 서버의
안전한 기본값(read-only, unrestricted writes 차단)을 사용합니다.

변경 사항은 Gemini CLI를 재시작한 뒤 적용됩니다. 형식과 보관 방식은
[Gemini CLI Extension Reference](https://geminicli.com/docs/extensions/reference/)를
따릅니다.

## ChatGPT Desktop와 Codex

ChatGPT Desktop의 로컬 MCP와 Codex CLI/IDE는 `~/.codex/config.toml`을 공유합니다.
토큰 값을 TOML에 직접 저장하지 않고, 실행 환경에 존재하는 변수 이름만 전달하려면
다음처럼 등록합니다.

```toml
[mcp_servers.discord]
command = "npx"
args = ["-y", "@hypark5540/discord-mcp@0.1.1"]
env_vars = ["DISCORD_TOKEN"]

[mcp_servers.discord.env]
DISCORD_ENABLE_WRITES = "false"
DISCORD_ENABLE_DELETES = "false"
DISCORD_ALLOW_UNRESTRICTED_WRITES = "false"
```

ChatGPT Desktop 또는 Codex를 시작한 프로세스 환경에 `DISCORD_TOKEN`이 있어야
합니다. 설정 후 앱이나 CLI 세션을 재시작하고 MCP 서버 목록에서 `discord`를
확인하세요. ChatGPT 웹은 로컬 `stdio` 프로세스나 이 파일을 읽지 않으므로 이
방식으로 연결할 수 없습니다. 웹용 연결에는 별도로 호스팅한 원격 MCP 서버와
ChatGPT 앱 구성이 필요합니다.

공식 설정 형식은 [OpenAI MCP 문서](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)를
참고하세요.

## Claude Code와 기타 stdio 클라이언트

Claude Code를 시작하는 환경에 `DISCORD_TOKEN`을 먼저 안전하게 설정한 뒤, 토큰을
명령행이나 설정 파일에 복사하지 않고 다음 명령으로 사용자 범위에 등록할 수 있습니다.

```bash
claude mcp add --scope user discord -- npx -y @hypark5540/discord-mcp@0.1.1
claude mcp get discord
```

MCPB 설치를 지원하지 않는 클라이언트에서는 다음 server 설정을 사용합니다.
클라이언트가 환경변수 참조 문법을 지원하지 않는다면 비밀 저장소나 클라이언트의
secret 입력 UI를 우선 사용하세요.

```json
{
  "command": "npx",
  "args": ["-y", "@hypark5540/discord-mcp@0.1.1"],
  "env": {
    "DISCORD_TOKEN": "<use-the-client-secret-store>",
    "DISCORD_ENABLE_WRITES": "false",
    "DISCORD_ENABLE_DELETES": "false"
  }
}
```

설치가 끝나면 먼저 도구 목록에 일곱 개의 읽기 도구가 있고 쓰기 도구는 없는지
확인한 뒤 `discord_get_bot`을 호출하세요. 이후 필요한 서버와 채널 ID를 allowlist로
제한하고, 정말 필요한 경우에만 쓰기를 켭니다.
