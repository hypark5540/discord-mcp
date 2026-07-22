# AI에게 설치를 맡기는 가이드

ChatGPT, Claude, Cursor, Gemini 또는 코딩 에이전트가 현재 환경을 확인하고 Discord
MCP `0.1.1`을 설치하도록 요청할 때 사용할 수 있는 안내입니다. 에이전트가 파일을
편집할 수 있어도 비밀 입력만큼은 사용자가 클라이언트의 keychain UI나 안전한
환경변수 경로에서 직접 완료해야 합니다.

## 복사해서 사용할 프롬프트

```text
Discord MCP @hypark5540/discord-mcp@0.1.1을 이 클라이언트에 설치해줘.

1. 현재 클라이언트가 무엇인지 먼저 확인하고 공식 방식 하나만 선택해:
   - Cursor: README의 공식 cursor:// MCP install link
   - Claude Desktop: GitHub Release의 discord-mcp-0.1.1.mcpb
   - Gemini CLI: gemini-extension.json을 v0.1.1 tag에서 설치
   - ChatGPT Desktop/Codex: ~/.codex/config.toml의 local stdio MCP 설정
   - 기타: npx -y @hypark5540/discord-mcp@0.1.1 stdio 설정
2. 패키지 버전은 latest가 아니라 반드시 0.1.1으로 고정해.
3. Discord Bot Token을 프롬프트, 명령 인자, Git 파일, 설치 URL, 로그에 쓰지 마.
   Claude/Gemini에서는 sensitive keychain 입력을 사용하고, Cursor/Codex에서는
   DISCORD_TOKEN 환경변수 참조만 설정해. 비밀 입력이 필요하면 나에게 UI에서
   직접 입력하라고 안내하고 멈춰.
4. DISCORD_ENABLE_WRITES, DISCORD_ENABLE_DELETES,
   DISCORD_ALLOW_UNRESTRICTED_WRITES는 모두 false로 시작해.
5. 설치 설정을 보여 주고 내가 확인한 뒤 적용해. 보안 확인을 건너뛰는 trust,
   consent, yolo 옵션은 사용하지 마.
6. 재시작 후 MCP initialize와 tools/list를 확인하고, 읽기 도구 7개가 보이며
   쓰기/삭제 도구가 보이지 않는지 검증해. 실제 토큰 값은 출력하지 마.
7. ChatGPT 웹처럼 local stdio를 지원하지 않는 환경이면 우회 배포하지 말고,
   지원되지 않는 이유와 필요한 remote MCP 구성을 설명해.
```

## 에이전트가 선택해야 할 설치 경로

| 감지한 환경 | 우선 경로 | 사용자에게 남는 작업 |
| --- | --- | --- |
| Cursor | 공식 Add to Cursor deep link | 환경변수로 Token 제공, 설치 확인 |
| Claude Desktop | SHA-256/내용을 확인한 `.mcpb` 열기 | sensitive Token 입력 |
| Gemini CLI | pinned Git tag extension 설치 | keychain Token 입력, 재시작 |
| ChatGPT Desktop / Codex | 공유 TOML에 stdio server 등록 | 안전한 프로세스 환경 제공 |
| Claude Code / 기타 | pinned npx server 설정 | 클라이언트 secret store 선택 |

클라이언트별 정확한 설정과 공식 문서 링크는 [clients.md](./clients.md), 비밀 회전과
권한 제한은 [secrets.md](./secrets.md)에 있습니다.

## 완료 판정

설치는 다음 조건을 모두 만족해야 완료입니다.

- 실행 명령이 정확히 고정된 릴리스 또는 MCPB의 포함 번들을 사용함
- Token 원문이 설치 설정, 링크, shell history, 저장소 diff, 로그에 없음
- MCP `initialize`, `tools/list`, `resources/list`가 성공함
- 초기 도구 목록에는 읽기 도구만 있음
- `discord_get_bot`이 허용 설정을 반환함
- 실제 사용 전에 guild/channel allowlist를 검토함

에이전트에게 광범위한 시스템 권한이나 Discord 관리자 권한을 줄 필요는 없습니다.
설치 도중 그런 권한을 요구하면 중단하고 설정을 다시 확인하세요.
