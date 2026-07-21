# 비밀과 권한 관리

Discord Bot Token은 비밀번호와 같습니다. 이 프로젝트는 사용자 token/self-bot을
지원하지 않으며, Bot Token을 소스 코드·Git·설치 링크·AI 프롬프트에 넣지 않는 것을
기본 원칙으로 삼습니다.

## 클라이언트별 권장 보관 방식

| 클라이언트 | 권장 방식 | 저장소에 들어가는 값 |
| --- | --- | --- |
| Claude Desktop MCPB | 설치 UI의 sensitive 입력 | 운영체제 keychain/credential manager |
| Gemini CLI Extension | sensitive extension setting | 시스템 keychain |
| Cursor | `${env:DISCORD_TOKEN}` 또는 비밀용 env file | 변수 참조만 |
| ChatGPT Desktop / Codex | `env_vars = ["DISCORD_TOKEN"]` | 변수 이름만 |
| 기타 MCP 클라이언트 | 클라이언트의 secret store | 클라이언트 구현에 따라 다름 |

Cursor 설치 URL의 `config` 값은 Base64 인코딩된 JSON입니다. 누구나 디코딩할 수
있으므로 실제 토큰을 넣으면 안 됩니다. 이 저장소의 공식 링크에는 토큰 참조만
있습니다.

Claude용 `.mcpb`에도 비밀은 들어 있지 않습니다. 매니페스트는
`${user_config.discord_token}`을 참조하며 Token 입력 하나만 `sensitive: true`로
선언합니다. Gemini 확장도 `DISCORD_TOKEN`을 sensitive setting으로 선언하므로
일반 `.env` 파일 대신 keychain 경로를 사용합니다.

## 최소 권한 순서

1. 별도 테스트 서버에 전용 봇을 초대합니다.
2. 처음에는 `View Channels`와 `Read Message History`만 허용합니다.
3. `DISCORD_ALLOWED_GUILD_IDS`와 `DISCORD_ALLOWED_CHANNEL_IDS`를 함께 설정합니다.
4. 읽기 동작을 확인한 뒤 필요한 경우에만 `DISCORD_ENABLE_WRITES=true`를 켭니다.
5. 삭제가 꼭 필요할 때만 `DISCORD_ENABLE_DELETES=true`를 추가합니다.
6. `DISCORD_ALLOW_UNRESTRICTED_WRITES=true`는 일반 사용에서 켜지 않습니다.

쓰기 도구를 켜도 멘션 알림은 차단되고, 수정과 삭제는 현재 봇이 작성한 메시지에만
허용됩니다. 삭제 호출은 추가로 `confirm: true`가 필요합니다.

## 유출이 의심될 때

1. Discord Developer Portal의 Bot 화면에서 즉시 Token을 재발급합니다.
2. Claude/Gemini keychain 항목 또는 클라이언트 환경변수를 새 값으로 갱신합니다.
3. 실행 중인 모든 MCP 클라이언트를 완전히 종료하고 다시 시작합니다.
4. Git 기록, CI 로그, shell history, 공유한 설정 파일과 AI 대화에 이전 값이 남았는지
   확인합니다.
5. 테스트 서버의 Audit Log와 봇이 작성한 메시지를 검토합니다.

토큰 값을 문제 해결 로그에 출력하지 마세요. 이 서버의 정상 로그와 오류 메시지는
토큰, Authorization header, Discord 원문 오류 body를 숨기도록 설계되어 있습니다.
서버 자체의 데이터 처리 범위는 [PRIVACY.md](../PRIVACY.md), 취약점 제보 방법은
[SECURITY.md](../SECURITY.md)를 확인하세요.
