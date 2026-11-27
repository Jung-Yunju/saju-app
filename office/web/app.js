/* 가상 사무실 — 대표 전용 화면 (O-02). React(createElement) + Phaser.
 * 모든 값은 신뢰하지 않는 데이터로 보고 textContent(React 텍스트 노드)로만 그린다. */
(function () {
  "use strict";

  /* ───────── 상수 ───────── */
  var STALE_MS = 30 * 60 * 1000;
  var TIMEOUT_MS = 10000;
  var ROOMS = [
    { id: "all", name: "전체" }, { id: "ceo", name: "대표실" }, { id: "dev", name: "개발실" },
    { id: "research", name: "연구실" }, { id: "design", name: "디자인실" },
    { id: "meeting", name: "회의실" }, { id: "lounge", name: "휴게실" }
  ];
  var ROSTER = [
    { id: "ceo", name: "대표", title: "대표", room: "ceo" },
    { id: "main", name: "총괄실장", title: "프로젝트 매니저", room: "ceo" },
    { id: "business-strategist", name: "사업기획 담당", title: "사업기획·마케팅", room: "ceo" },
    { id: "saju-engine-developer", name: "엔진 개발자", title: "사주엔진 개발", room: "dev" },
    { id: "frontend-developer", name: "프론트엔드 개발자", title: "프론트엔드", room: "dev" },
    { id: "backend-developer", name: "백엔드 개발자", title: "백엔드·서버", room: "dev" },
    { id: "qa-security-lead", name: "품질검증 담당", title: "품질검증·보안", room: "dev" },
    { id: "myeongri-research-director", name: "명리학 연구소장", title: "명리학 연구", room: "research" },
    { id: "personalization-researcher", name: "개인화 연구원", title: "개인화 분석", room: "research" },
    { id: "design-director", name: "디자인 실장", title: "디자인", room: "design" },
    { id: "content-writer", name: "콘텐츠 작가", title: "콘텐츠·캐릭터", room: "design" },
    { id: "guest", name: "외부 지원 인력", title: "임시(조사·검토 보조)", room: "lounge" }
  ];
  var STATUS = {
    awaiting_approval: { label: "승인 대기", cls: "wait", icon: "approval" },
    error: { label: "오류", cls: "err", icon: "error" },
    typing: { label: "코드 작성", cls: "work", icon: "typing" },
    research: { label: "자료 조사", cls: "work", icon: "research" },
    running: { label: "실행·테스트", cls: "work", icon: "running" },
    working: { label: "업무 중", cls: "work", icon: "working" },
    meeting: { label: "회의", cls: "done", icon: "meeting" },
    done: { label: "완료", cls: "done", icon: "done" },
    resting: { label: "휴식", cls: "gray", icon: "resting" },
    off: { label: "퇴근", cls: "gray", icon: null },
    unknown: { label: "상태 확인 불가", cls: "gray", icon: "unknown" }
  };
  var WORKING = { typing: 1, research: 1, running: 1, working: 1 };

  /* ───────── 예시 데이터 (office/fixtures/sample-state.json 내용) ───────── */
  /*SAMPLE_BEGIN*/
  var SAMPLE = {
   "schemaVersion": 1,
   "sample": true,
   "sampleNote": "예시 데이터 — 실제 업무 아님",
   "generatedAt": "2026-11-27T12:30:00.000Z",
   "staleAfterSec": 600,
   "source": {
    "eventCount": 84,
    "firstEventAt": "2026-11-26T05:00:00.000Z",
    "lastEventAt": "2026-11-27T12:29:40.000Z",
    "sessionActive": true,
    "period": {
     "from": "2026-11-26T15:00:00.000Z",
     "to": "2026-11-27T12:30:00.000Z",
     "timezone": "Asia/Seoul"
    }
   },
   "ceo": {
    "pendingApprovals": [
     {
      "at": "2026-11-27T12:20:00.000Z",
      "staff": "personalization-researcher",
      "tool": "Bash",
      "message": "명령 실행 승인 요청"
     }
    ],
    "boardApprovals": [
     {
      "cardId": "P9-09",
      "title": "예시 — 말투 문서",
      "item": "예시: 캐릭터 말투 승인",
      "status": "대표 승인 대기"
     },
     {
      "cardId": "P9-10",
      "title": "예시 — 운영 계획",
      "item": "예시: 일정 승인",
      "status": "대표 승인 대기"
     }
    ]
   },
   "staff": [
    {
     "id": "ceo",
     "name": "대표",
     "title": "대표",
     "room": "ceo",
     "tracked": false,
     "status": "off",
     "statusLabel": "추적 대상 아님",
     "statusSince": null,
     "rule": false,
     "location": "ceo",
     "task": null,
     "elapsedSec": null,
     "currentFile": null,
     "activity": [],
     "toolCounts": {},
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": []
    },
    {
     "id": "main",
     "name": "총괄실장",
     "title": "프로젝트 매니저",
     "room": "ceo",
     "status": "meeting",
     "statusLabel": "회의(규칙 기반)",
     "statusSince": "2026-11-27T12:29:00.000Z",
     "rule": true,
     "location": "meeting",
     "task": null,
     "elapsedSec": null,
     "currentFile": null,
     "activity": [
      {
       "at": "2026-11-27T11:40:05.000Z",
       "kind": "research",
       "tool": "Read",
       "file": "docs/board/tasks.json",
       "ok": true
      },
      {
       "at": "2026-11-27T11:50:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T11:55:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:00:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:05:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:10:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:12:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:14:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:15:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:16:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:29:00.000Z",
       "kind": "delegating",
       "tool": "Agent",
       "file": null,
       "ok": true
      }
     ],
     "toolCounts": {
      "Read": 1,
      "Agent": 10
     },
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-10",
       "title": "예시 — 운영 계획",
       "status": "대표 승인 대기",
       "progress": {
        "done": 3,
        "total": 3
       },
       "verification": "미검증",
       "issues": null,
       "approval": "예시: 일정 승인"
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [
      "P9-10 예시: 일정 승인"
     ],
     "sessions": []
    },
    {
     "id": "business-strategist",
     "name": "사업기획 담당",
     "title": "사업기획·마케팅",
     "room": "ceo",
     "status": "resting",
     "statusLabel": "휴식",
     "statusSince": "2026-11-27T12:15:00.000Z",
     "rule": false,
     "location": "lounge",
     "task": {
      "description": "예시: 비용 표 정리 P9-08",
      "cardId": "P9-08",
      "startedAt": "2026-11-27T11:55:02.000Z",
      "endedAt": "2026-11-27T12:05:00.000Z"
     },
     "elapsedSec": 598,
     "currentFile": null,
     "activity": [
      {
       "at": "2026-11-27T11:56:00.000Z",
       "kind": "research",
       "tool": "Read",
       "file": "docs/example/cost.md",
       "ok": true
      },
      {
       "at": "2026-11-27T12:00:00.000Z",
       "kind": "typing",
       "tool": "Write",
       "file": "docs/example/cost.md",
       "ok": true
      },
      {
       "at": "2026-11-27T12:04:30.000Z",
       "kind": "reporting",
       "tool": "SubagentHandback",
       "file": null,
       "ok": true
      }
     ],
     "toolCounts": {
      "Read": 1,
      "Write": 1,
      "SubagentHandback": 1
     },
     "filesTouched": 1,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [],
     "completed": [
      {
       "id": "P9-08",
       "title": "예시 — 비용 표 정리"
      }
     ],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 비용 표 정리 P9-08",
       "cardId": "P9-08",
       "startedAt": "2026-11-27T11:55:02.000Z",
       "endedAt": "2026-11-27T12:05:00.000Z"
      }
     ]
    },
    {
     "id": "saju-engine-developer",
     "name": "엔진 개발자",
     "title": "사주엔진 개발",
     "room": "dev",
     "status": "working",
     "statusLabel": "업무 중",
     "statusSince": "2026-11-27T12:27:00.000Z",
     "rule": false,
     "location": "dev",
     "task": {
      "description": "예시: 절기 계산 점검 P9-02",
      "cardId": "P9-02",
      "startedAt": "2026-11-27T12:10:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 1198,
     "currentFile": "src/example/solar-terms.ts",
     "activity": [
      {
       "at": "2026-11-27T12:15:00.000Z",
       "kind": "typing",
       "tool": "Edit",
       "file": "src/example/solar-terms.ts",
       "ok": true
      },
      {
       "at": "2026-11-27T12:25:00.000Z",
       "kind": "running",
       "tool": "Bash",
       "file": null,
       "ok": true
      }
     ],
     "toolCounts": {
      "Edit": 1,
      "Bash": 1
     },
     "filesTouched": 1,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-02",
       "title": "예시 — 절기 계산 점검",
       "status": "개발 중",
       "progress": {
        "done": 3,
        "total": 4
       },
       "verification": "미검증",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 절기 계산 점검 P9-02",
       "cardId": "P9-02",
       "startedAt": "2026-11-27T12:10:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "frontend-developer",
     "name": "프론트엔드 개발자",
     "title": "프론트엔드",
     "room": "dev",
     "status": "error",
     "statusLabel": "오류",
     "statusSince": "2026-11-27T12:29:20.000Z",
     "rule": false,
     "location": "dev",
     "task": {
      "description": "예시: 사무실 화면 P9-03",
      "cardId": "P9-03",
      "startedAt": "2026-11-27T12:16:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 838,
     "currentFile": "office/example/app.js",
     "activity": [
      {
       "at": "2026-11-27T12:25:00.000Z",
       "kind": "typing",
       "tool": "Write",
       "file": "office/example/app.js",
       "ok": true
      },
      {
       "at": "2026-11-27T12:29:15.000Z",
       "kind": "running",
       "tool": "Bash",
       "file": null,
       "ok": false
      }
     ],
     "toolCounts": {
      "Write": 1,
      "Bash": 1
     },
     "filesTouched": 1,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-03",
       "title": "예시 — 사무실 화면",
       "status": "수정 필요",
       "progress": {
        "done": 4,
        "total": 6
       },
       "verification": "미검증",
       "issues": "예시 문제: 모바일에서 버튼이 겹침",
       "approval": null
      }
     ],
     "completed": [],
     "errors": [
      {
       "at": "2026-11-27T12:29:20.000Z",
       "tool": "Bash",
       "message": "도구 실행 실패"
      }
     ],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 사무실 화면 P9-03",
       "cardId": "P9-03",
       "startedAt": "2026-11-27T12:16:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "backend-developer",
     "name": "백엔드 개발자",
     "title": "백엔드·서버",
     "room": "dev",
     "status": "typing",
     "statusLabel": "코드 작성",
     "statusSince": "2026-11-27T12:29:30.000Z",
     "rule": false,
     "location": "dev",
     "task": {
      "description": "예시: 결제 API 점검 P9-01",
      "cardId": "P9-01",
      "startedAt": "2026-11-27T12:29:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 58,
     "currentFile": "src/example/payment.ts",
     "activity": [
      {
       "at": "2026-11-27T12:29:10.000Z",
       "kind": "research",
       "tool": "Read",
       "file": "src/example/payment.ts",
       "ok": true
      },
      {
       "at": "2026-11-27T12:29:30.000Z",
       "kind": "typing",
       "tool": "Edit",
       "file": "src/example/payment.ts",
       "ok": true
      }
     ],
     "toolCounts": {
      "Read": 1,
      "Edit": 1
     },
     "filesTouched": 1,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-01",
       "title": "예시 — 결제 API 점검",
       "status": "개발 중",
       "progress": {
        "done": 2,
        "total": 5
       },
       "verification": "미검증",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 결제 API 점검 P9-01",
       "cardId": "P9-01",
       "startedAt": "2026-11-27T12:29:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "qa-security-lead",
     "name": "품질검증 담당",
     "title": "품질검증·보안",
     "room": "dev",
     "status": "running",
     "statusLabel": "실행·테스트",
     "statusSince": "2026-11-27T12:29:00.000Z",
     "rule": false,
     "location": "dev",
     "task": {
      "description": "예시: 테스트 실행 P9-07",
      "cardId": "P9-07",
      "startedAt": "2026-11-27T12:15:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 898,
     "currentFile": "[비공개 파일]",
     "activity": [
      {
       "at": "2026-11-27T12:18:00.000Z",
       "kind": "research",
       "tool": "Grep",
       "file": "[비공개 파일]",
       "ok": true
      },
      {
       "at": "2026-11-27T12:29:00.000Z",
       "kind": "running",
       "tool": "Bash",
       "file": null,
       "ok": true
      }
     ],
     "toolCounts": {
      "Grep": 1,
      "Bash": 1
     },
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-07",
       "title": "예시 — 테스트 실행",
       "status": "개발 중",
       "progress": {
        "done": 1,
        "total": 5
       },
       "verification": "미검증",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 테스트 실행 P9-07",
       "cardId": "P9-07",
       "startedAt": "2026-11-27T12:15:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "myeongri-research-director",
     "name": "명리학 연구소장",
     "title": "명리학 연구",
     "room": "research",
     "status": "research",
     "statusLabel": "자료 조사",
     "statusSince": "2026-11-27T12:29:10.000Z",
     "rule": false,
     "location": "research",
     "task": {
      "description": "예시: 고전 문헌 조사 P9-05",
      "cardId": "P9-05",
      "startedAt": "2026-11-27T12:14:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 958,
     "currentFile": "docs/example/classics.md",
     "activity": [
      {
       "at": "2026-11-27T12:20:00.000Z",
       "kind": "typing",
       "tool": "Write",
       "file": "docs/example/classics.md",
       "ok": true
      },
      {
       "at": "2026-11-27T12:29:10.000Z",
       "kind": "research",
       "tool": "WebSearch",
       "file": null,
       "ok": null
      }
     ],
     "toolCounts": {
      "Write": 1,
      "WebSearch": 1
     },
     "filesTouched": 1,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-05",
       "title": "예시 — 고전 문헌 조사",
       "status": "개발 중",
       "progress": {
        "done": 2,
        "total": 4
       },
       "verification": "미검증",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 고전 문헌 조사 P9-05",
       "cardId": "P9-05",
       "startedAt": "2026-11-27T12:14:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "personalization-researcher",
     "name": "개인화 연구원",
     "title": "개인화 분석",
     "room": "research",
     "status": "awaiting_approval",
     "statusLabel": "승인 대기",
     "statusSince": "2026-11-27T12:20:00.000Z",
     "rule": false,
     "location": "research",
     "task": {
      "description": "예시: 질문 분류 P9-04",
      "cardId": "P9-04",
      "startedAt": "2026-11-27T12:12:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 1078,
     "currentFile": "docs/example/questions.md",
     "activity": [
      {
       "at": "2026-11-27T12:15:00.000Z",
       "kind": "research",
       "tool": "Read",
       "file": "docs/example/questions.md",
       "ok": true
      },
      {
       "at": "2026-11-27T12:19:59.000Z",
       "kind": "running",
       "tool": "Bash",
       "file": null,
       "ok": null
      }
     ],
     "toolCounts": {
      "Read": 1,
      "Bash": 1
     },
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-04",
       "title": "예시 — 질문 분류",
       "status": "개발 중",
       "progress": {
        "done": 1,
        "total": 3
       },
       "verification": "미검증",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [
      "명령 실행 승인 요청 (Bash)"
     ],
     "sessions": [
      {
       "description": "예시: 질문 분류 P9-04",
       "cardId": "P9-04",
       "startedAt": "2026-11-27T12:12:02.000Z",
       "endedAt": null
      }
     ]
    },
    {
     "id": "design-director",
     "name": "디자인 실장",
     "title": "디자인",
     "room": "design",
     "status": "done",
     "statusLabel": "완료",
     "statusSince": "2026-11-27T12:27:00.000Z",
     "rule": false,
     "location": "design",
     "task": {
      "description": "예시: 사무실 그림 P9-06",
      "cardId": "P9-06",
      "startedAt": "2026-11-27T12:05:02.000Z",
      "endedAt": "2026-11-27T12:24:00.000Z"
     },
     "elapsedSec": 1138,
     "currentFile": null,
     "activity": [
      {
       "at": "2026-11-27T12:10:00.000Z",
       "kind": "typing",
       "tool": "Write",
       "file": "office/example/art.js",
       "ok": true
      },
      {
       "at": "2026-11-27T12:20:00.000Z",
       "kind": "typing",
       "tool": "Edit",
       "file": "office/example/art.js",
       "ok": true
      },
      {
       "at": "2026-11-27T12:23:50.000Z",
       "kind": "reporting",
       "tool": "SubagentHandback",
       "file": null,
       "ok": true
      }
     ],
     "toolCounts": {
      "Write": 1,
      "Edit": 1,
      "SubagentHandback": 1
     },
     "filesTouched": 1,
     "tokens": {
      "input": 1200,
      "output": 45000,
      "cacheRead": 900000,
      "cacheWrite": 30000,
      "total": 976200,
      "source": "hook"
     },
     "costUsdEstimate": {
      "usd": 1.23,
      "basis": "API 단가 환산 추정(구독 사용 — 실제 청구 아님) · 모델 미확인분은 Opus 단가 적용"
     },
     "cards": [
      {
       "id": "P9-06",
       "title": "예시 — 사무실 그림",
       "status": "검증 중",
       "progress": {
        "done": 3,
        "total": 3
       },
       "verification": "조건부 통과",
       "issues": null,
       "approval": null
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 사무실 그림 P9-06",
       "cardId": "P9-06",
       "startedAt": "2026-11-27T12:05:02.000Z",
       "endedAt": "2026-11-27T12:24:00.000Z"
      }
     ]
    },
    {
     "id": "content-writer",
     "name": "콘텐츠 작가",
     "title": "콘텐츠·캐릭터",
     "room": "design",
     "status": "off",
     "statusLabel": "퇴근",
     "statusSince": null,
     "rule": false,
     "location": "design",
     "task": null,
     "elapsedSec": null,
     "currentFile": null,
     "activity": [],
     "toolCounts": {},
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [
      {
       "id": "P9-09",
       "title": "예시 — 말투 문서",
       "status": "대표 승인 대기",
       "progress": {
        "done": 2,
        "total": 2
       },
       "verification": "미검증",
       "issues": null,
       "approval": "예시: 캐릭터 말투 승인"
      }
     ],
     "completed": [],
     "errors": [],
     "approvals": [
      "P9-09 예시: 캐릭터 말투 승인"
     ],
     "sessions": []
    },
    {
     "id": "guest",
     "name": "외부 지원 인력",
     "title": "임시(조사·검토 보조)",
     "room": "lounge",
     "status": "unknown",
     "statusLabel": "상태 확인 불가",
     "statusSince": "2026-11-27T12:20:00.000Z",
     "rule": false,
     "location": "lounge",
     "task": {
      "description": "예시: 자료 조사 보조",
      "cardId": null,
      "startedAt": "2026-11-27T12:00:02.000Z",
      "endedAt": null
     },
     "elapsedSec": 1798,
     "currentFile": null,
     "activity": [
      {
       "at": "2026-11-27T11:52:00.000Z",
       "kind": "research",
       "tool": "Grep",
       "file": "src/example",
       "ok": true
      },
      {
       "at": "2026-11-27T11:57:00.000Z",
       "kind": "reporting",
       "tool": "SubagentHandback",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:05:00.000Z",
       "kind": "research",
       "tool": "WebSearch",
       "file": null,
       "ok": true
      },
      {
       "at": "2026-11-27T12:10:00.000Z",
       "kind": "research",
       "tool": "Read",
       "file": "[외부 경로]",
       "ok": true
      }
     ],
     "toolCounts": {
      "Grep": 1,
      "SubagentHandback": 1,
      "WebSearch": 1,
      "Read": 1
     },
     "filesTouched": 0,
     "tokens": null,
     "costUsdEstimate": null,
     "cards": [],
     "completed": [],
     "errors": [],
     "approvals": [],
     "sessions": [
      {
       "description": "예시: 외부 검토 보조",
       "cardId": null,
       "startedAt": "2026-11-27T11:50:02.000Z",
       "endedAt": "2026-11-27T11:58:00.000Z"
      },
      {
       "description": "예시: 자료 조사 보조",
       "cardId": null,
       "startedAt": "2026-11-27T12:00:02.000Z",
       "endedAt": null
      }
     ],
     "headcount": 2,
     "activeCount": 0
    }
   ]
  };
  /*SAMPLE_END*/

  /* ───────── 안전한 값 변환 ───────── */
  function S(v, max) { return typeof v === "string" ? v.slice(0, max || 300) : ""; }
  function N(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function A(v, max) { return Array.isArray(v) ? v.slice(0, max || 50) : []; }
  function O(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function T(v) { var t = typeof v === "string" ? Date.parse(v) : NaN; return isNaN(t) ? null : t; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtTime(iso) {
    var t = T(iso); if (t == null) return "—";
    var d = new Date(t);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + "시간 " : "") + (h || m ? m + "분 " : "") + s + "초";
  }
  function fmtAgo(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 1) return "방금 전";
    if (m < 60) return m + "분 전";
    return Math.floor(m / 60) + "시간 " + (m % 60) + "분 전";
  }
  function num(n) { return typeof n === "number" ? n.toLocaleString("ko-KR") : "—"; }

  /* ───────── 상태 문서 → 화면 모델 ───────── */
  function shiftTimes(v, delta) {
    if (typeof v === "string") { return /^\d{4}-\d\d-\d\dT[\d:.]+Z?$/.test(v) && !isNaN(Date.parse(v)) ? new Date(Date.parse(v) + delta).toISOString() : v; }
    if (Array.isArray(v)) return v.map(function (x) { return shiftTimes(x, delta); });
    if (v && typeof v === "object") { var o = {}; Object.keys(v).forEach(function (k) { o[k] = shiftTimes(v[k], delta); }); return o; }
    return v;
  }
  function makeSample(now) {
    var g = T(SAMPLE.generatedAt) || now;
    return shiftTimes(SAMPLE, now - 60000 - g);
  }

  function normStaff(raw, base, forceUnknown) {
    raw = O(raw);
    var st = typeof raw.status === "string" && STATUS[raw.status] ? raw.status : (raw.status ? "unknown" : (forceUnknown ? "unknown" : "unknown"));
    var rawStatus = st;
    if (forceUnknown) st = "unknown";
    var task = raw.task && typeof raw.task === "object" ? {
      description: S(raw.task.description, 120), cardId: S(raw.task.cardId, 20) || null,
      startedAt: S(raw.task.startedAt, 40) || null, endedAt: S(raw.task.endedAt, 40) || null
    } : null;
    var tk = raw.tokens && typeof raw.tokens === "object" ? {
      input: N(raw.tokens.input), output: N(raw.tokens.output), cacheRead: N(raw.tokens.cacheRead),
      cacheWrite: N(raw.tokens.cacheWrite), total: N(raw.tokens.total), source: S(raw.tokens.source, 30)
    } : null;
    var cost = raw.costUsdEstimate && typeof raw.costUsdEstimate === "object" ? { usd: N(raw.costUsdEstimate.usd), basis: S(raw.costUsdEstimate.basis, 200) } : null;
    var untracked = raw.tracked === false || base.id === "ceo";
    if (untracked) { st = "off"; rawStatus = "off"; }
    return {
      untracked: untracked, location: S(raw.location, 20) || null, headcount: N(raw.headcount), activeCount: N(raw.activeCount),
      id: base.id, name: S(raw.name, 40) || base.name, title: S(raw.title, 60) || base.title, room: S(raw.room, 20) || base.room,
      status: st, rawStatus: rawStatus,
      statusLabel: untracked ? "추적 대상 아님" : forceUnknown ? STATUS.unknown.label : (S(raw.statusLabel, 30) || STATUS[st].label),
      rule: !forceUnknown && !untracked && (raw.rule === true || st === "meeting" && raw.rule !== false),
      statusSince: S(raw.statusSince, 40) || null, task: task, elapsedSec: N(raw.elapsedSec),
      currentFile: S(raw.currentFile, 200) || null,
      activity: A(raw.activity, 30).map(function (a) { a = O(a); return { at: S(a.at, 40), kind: S(a.kind, 20), tool: S(a.tool, 40), file: S(a.file, 200) || null, ok: typeof a.ok === "boolean" ? a.ok : null }; }),
      filesTouched: N(raw.filesTouched), tokens: tk, cost: cost,
      cards: A(raw.cards, 20).map(function (c) {
        c = O(c); var p = O(c.progress);
        return { id: S(c.id, 20), title: S(c.title, 120), status: S(c.status, 30), done: N(p.done), total: N(p.total), verification: S(c.verification, 120) || null, issues: S(c.issues, 300) || null, approval: S(c.approval, 200) || null };
      }),
      completed: A(raw.completed, 30).map(function (c) { c = O(c); return { id: S(c.id, 20), title: S(c.title, 120) }; }),
      errors: A(raw.errors, 20).map(function (e) { e = O(e); return { at: S(e.at, 40), tool: S(e.tool, 40), message: S(e.message, 200) }; }),
      approvals: A(raw.approvals, 20).map(function (x) { return S(typeof x === "string" ? x : (x && x.message), 200); })
    };
  }

  function derive(doc, forceUnknown) {
    var byId = {}, list = [];
    if (doc) A(doc.staff, 60).forEach(function (r) { if (r && typeof r.id === "string") byId[r.id] = r; });
    ROSTER.forEach(function (r) { list.push(normStaff(byId[r.id], r, forceUnknown)); delete byId[r.id]; });
    Object.keys(byId).slice(0, 12).forEach(function (id) {
      list.push(normStaff(byId[id], { id: S(id, 60), name: S(byId[id].name, 40) || S(id, 40), title: "", room: "lounge" }, forceUnknown));
    });
    var ceo = doc && !forceUnknown ? O(doc.ceo) : {};
    var pend = A(ceo.pendingApprovals, 30).map(function (p) { p = O(p); return { at: S(p.at, 40), staff: S(p.staff, 60), tool: S(p.tool, 40), message: S(p.message, 200) }; });
    var board = A(ceo.boardApprovals, 30).map(function (p) { p = O(p); return { cardId: S(p.cardId, 20), title: S(p.title, 120), item: S(p.item, 200), status: S(p.status, 40) }; });
    var present = 0, working = 0, waiting = 0;
    list.forEach(function (s) {
      if (s.untracked) return;
      if (s.status !== "off" && s.status !== "unknown") present++;
      if (WORKING[s.status]) working++;
      if (s.status === "awaiting_approval") waiting++;
    });
    return { staff: list, pending: pend, board: board, bell: forceUnknown ? 0 : Math.max(pend.length, waiting),
      summary: { present: present, working: working, waiting: forceUnknown ? 0 : Math.max(pend.length, waiting), known: !forceUnknown } };
  }

  /* ───────── 대체 그림(art.js·map.js가 없거나 일부 빠졌을 때) ───────── */
  function fbBuildArt() {
    var colors = ["#4b6cb7", "#b5651d", "#2e8b57", "#8e44ad", "#c0392b", "#16a085", "#d4a017", "#5d6d7e", "#e67e22", "#7f8c8d", "#2c7a9b", "#a04668"];
    var pal = { ".": null, k: "#1b1b24", s: "#f0c9a0", h: "#3a2a1c", w: "#f4f1ea" };
    var art = { tile: 16, palette: pal, characters: {}, cat: null, tiles: {}, icons: {}, fallback: true };
    function fig(B, o) {
      var g = [], i, j;
      for (i = 0; i < 24; i++) { g.push([]); for (j = 0; j < 16; j++) g[i].push("."); }
      function R(x, y, w, h, c) { for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) if (g[yy] && xx >= 0 && xx < 16) g[yy][xx] = c; }
      var dy = o.dy || 0;
      R(5, 1 + dy, 6, 2, "h"); R(5, 3 + dy, 6, 5, "s"); R(6, 5 + dy, 1, 1, "k"); R(9, 5 + dy, 1, 1, "k");
      R(4, 9 + dy, 8, o.sit ? 6 : 8, B);
      if (!o.sit) { R(3, 10 + dy, 1, 6, B); R(12, 10 + dy, 1, 6, B); R(5 + (o.l || 0), 17 + dy, 3, 6 - dy, "k"); R(8 - (o.l || 0), 17 + dy, 3, 6 - dy, "k"); }
      else { R(3 + (o.hand || 0), 12 + dy, 2, 2, "s"); R(11 - (o.hand || 0), 12 + dy, 2, 2, "s"); }
      return g.map(function (r) { return r.join(""); });
    }
    ROSTER.concat([{ id: "ceo" }]).forEach(function (r, i) {
      var B = String.fromCharCode(65 + i); pal[B] = colors[i % colors.length];
      art.characters[r.id] = { w: 16, h: 24, anims: {
        idle: { fps: 2, frames: [fig(B, {}), fig(B, { dy: 1 })] },
        walk: { fps: 6, frames: [fig(B, { l: 1 }), fig(B, {}), fig(B, { l: -1 }), fig(B, {})] },
        sit: { fps: 1, frames: [fig(B, { sit: 1, dy: 4 })] },
        type: { fps: 6, frames: [fig(B, { sit: 1, dy: 4, hand: 0 }), fig(B, { sit: 1, dy: 4, hand: 1 })] },
        read: { fps: 2, frames: [fig(B, { sit: 1, dy: 4, hand: 1 }), fig(B, { sit: 1, dy: 5, hand: 1 })] }
      } };
    });
    function cat(o) {
      var g = [], i, j; for (i = 0; i < 16; i++) { g.push([]); for (j = 0; j < 16; j++) g[i].push("."); }
      function R(x, y, w, h, c) { for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) if (g[yy] && g[yy][xx] !== undefined) g[yy][xx] = c; }
      var y = o.low ? 9 : 7;
      R(3, y, 9, 5, "k"); R(10, y - 3, 4, 4, "k"); R(10, y - 4, 1, 1, "k"); R(13, y - 4, 1, 1, "k"); R(11, y + 1, 2, 3, "w");
      R(4 + (o.p || 0), y + 5, 2, 1, "w"); R(9 - (o.p || 0), y + 5, 2, 1, "w"); R(1, y - 1 + (o.t || 0), 2, 1, "k");
      return g.map(function (r) { return r.join(""); });
    }
    art.cat = { w: 16, h: 16, anims: {
      idle: { fps: 2, frames: [cat({}), cat({ t: 1 })] }, walk: { fps: 5, frames: [cat({ p: 0 }), cat({ p: 1 })] },
      sit: { fps: 1, frames: [cat({})] }, sleep: { fps: 1, frames: [cat({ low: 1 })] }, groom: { fps: 2, frames: [cat({}), cat({ t: 1 })] }
    } };
    return art;
  }
  function fbMap() {
    var cols = 36, rows = 24, walk = [], i, j;
    for (i = 0; i < rows; i++) { var r = ""; for (j = 0; j < cols; j++) r += "."; walk.push(r); }
    return {
      fallback: true, cols: cols, rows: rows, layers: null, legend: {},
      rooms: [{ id: "ceo", name: "대표실", x: 1, y: 1, w: 10, h: 8 }, { id: "dev", name: "개발실", x: 12, y: 1, w: 14, h: 8 },
        { id: "research", name: "명리학 연구실", x: 27, y: 1, w: 8, h: 8 }, { id: "design", name: "디자인실", x: 1, y: 12, w: 10, h: 10 },
        { id: "meeting", name: "회의실", x: 12, y: 12, w: 12, h: 10 }, { id: "lounge", name: "휴게실", x: 25, y: 12, w: 10, h: 10 }],
      desks: {
        main: { x: 3, y: 4, facing: "up" }, "business-strategist": { x: 7, y: 4, facing: "up" },
        "saju-engine-developer": { x: 14, y: 4, facing: "up" }, "frontend-developer": { x: 17, y: 4, facing: "up" },
        "backend-developer": { x: 20, y: 4, facing: "up" }, "qa-security-lead": { x: 23, y: 4, facing: "up" },
        "myeongri-research-director": { x: 29, y: 4, facing: "up" }, "personalization-researcher": { x: 32, y: 4, facing: "up" },
        "design-director": { x: 3, y: 16, facing: "up" }, "content-writer": { x: 7, y: 16, facing: "up" }
      },
      spots: {
        meeting: [14, 16, 18, 20, 14, 16, 18, 20].map(function (x, k) { return { x: x, y: k < 4 ? 15 : 18 }; }),
        lounge: [27, 29, 31, 33, 27, 29, 31, 33].map(function (x, k) { return { x: x, y: k < 4 ? 15 : 18 }; }),
        ceoBell: { x: 9, y: 3 }, door: { x: 11, y: 10 }
      },
      walkable: walk, catRoutes: [[{ x: 27, y: 20 }, { x: 31, y: 20 }, { x: 33, y: 17 }, { x: 28, y: 14 }]]
    };
  }

  /* ───────── Phaser 장면 ───────── */
  function createOffice(el, bridge) {
    var ART = window.OFFICE_ART && window.OFFICE_ART.characters ? window.OFFICE_ART : null;
    var MAPR = window.OFFICE_MAP && window.OFFICE_MAP.rooms && window.OFFICE_MAP.walkable ? window.OFFICE_MAP : null;
    var FB = fbBuildArt();
    var map = MAPR || fbMap();
    var art = ART || FB;
    var TILE = art.tile || 16;
    var reduce = bridge.reduce;

    function charArt(id) { return (art.characters && art.characters[id]) || FB.characters[id] || FB.characters.guest; }
    function catArt() { return art.cat || FB.cat; }

    function drawFrame(scene, key, F, pal, w, h) {
      if (scene.textures.exists(key)) return;
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d");
      for (var y = 0; y < h; y++) {
        var row = String((F && F[y]) || "");
        for (var x = 0; x < w; x++) { var c = pal[row.charAt(x)]; if (c) { cx.fillStyle = c; cx.fillRect(x, y, 1, 1); } }
      }
      scene.textures.addCanvas(key, cv);
    }
    function pal() { return Object.assign({}, FB.palette, art.palette || {}); }

    function buildAnims(scene, prefix, spec, p) {
      var names = {};
      Object.keys(O(spec.anims)).forEach(function (an) {
        var a = spec.anims[an]; if (!a || !Array.isArray(a.frames) || !a.frames.length) return;
        var keys = [];
        a.frames.forEach(function (F, i) { var k = prefix + ":" + an + ":" + i; drawFrame(scene, k, F, p, spec.w || 16, spec.h || 16); keys.push({ key: k }); });
        scene.anims.create({ key: prefix + ":" + an, frames: keys, frameRate: a.fps || 4, repeat: -1 });
        names[an] = keys[0].key;
      });
      return names;
    }

    function iconTexture(scene, name) {
      var key = "i:" + name;
      if (scene.textures.exists(key)) return key;
      var spec = art.icons && art.icons[name];
      if (spec) {
        var F = spec.frames ? spec.frames[0] : spec;
        drawFrame(scene, key, F, pal(), spec.w || 12, spec.h || 12); return key;
      }
      var cv = document.createElement("canvas"); cv.width = 12; cv.height = 12; var c = cv.getContext("2d");
      var col = { typing: "#3b82f6", research: "#0ea5a4", running: "#16a34a", error: "#dc2626", approval: "#f59e0b", done: "#22c55e", unknown: "#8b8a99", zzz: "#6366f1", meeting: "#a855f7" }[name] || "#888";
      var glyph = { typing: "T", research: "R", running: ">", error: "!", approval: "B", done: "v", unknown: "?", zzz: "z", meeting: "M" }[name] || "";
      c.fillStyle = "#101020"; c.beginPath(); c.arc(6, 6, 6, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(6, 6, 5, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(glyph, 6, 6.5);
      scene.textures.addCanvas(key, cv); return key;
    }

    /* 길찾기(BFS) */
    function passable(x, y) {
      if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
      var row = map.walkable[y]; return !row || row.charAt(x) !== "#";
    }
    function bfs(a, b) {
      if (a.x === b.x && a.y === b.y) return [a];
      var q = [a], prev = {}, k = function (p) { return p.x + "," + p.y; };
      prev[k(a)] = null;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (q.length) {
        var c = q.shift();
        for (var i = 0; i < 4; i++) {
          var n = { x: c.x + dirs[i][0], y: c.y + dirs[i][1] }, nk = k(n);
          if (prev[nk] !== undefined) continue;
          if (!(n.x === b.x && n.y === b.y) && !passable(n.x, n.y)) continue;
          if (n.x < 0 || n.y < 0 || n.x >= map.cols || n.y >= map.rows) continue;
          prev[nk] = c;
          if (n.x === b.x && n.y === b.y) {
            var path = [n], cur = c; while (cur) { path.unshift(cur); cur = prev[k(cur)]; } return path;
          }
          q.push(n);
        }
      }
      return null;
    }
    function px(p) { return { x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE }; }

    function animForStatus(st, seated) {
      if (!seated) return "idle";
      if (st === "typing" || st === "running") return "type";
      if (st === "research") return "read";
      return "sit"; /* working·error·approval·done·unknown 은 일하는 동작 없이 앉아 있기만 한다 */
    }

    var SceneClass = class extends window.Phaser.Scene {
      constructor() { super("office"); this.ents = {}; this.first = true; this.catEnt = null; }
      create() {
        var self = this, cam = this.cameras.main, p = pal();
        cam.setBackgroundColor("#14172b");
        /* 타일 */
        Object.keys(O(art.tiles)).forEach(function (k) { var t = art.tiles[k]; drawFrame(self, "t:" + k, t.frames && t.frames[0], p, t.w || 16, t.h || 16); });
        if (map.layers && !map.fallback) {
          ["floor", "furniture"].forEach(function (ln, li) {
            A(map.layers[ln], 100).forEach(function (row, y) {
              for (var x = 0; x < row.length; x++) {
                var tk = map.legend[row.charAt(x)]; if (!tk || !self.textures.exists("t:" + tk)) continue;
                var tl = art.tiles[tk], im = self.add.image(x * TILE, y * TILE, "t:" + tk).setOrigin(0, 0);
                im.setDepth(li === 0 ? -1000 : y * TILE + TILE);
              }
            });
          });
        } else {
          var g = this.add.graphics().setDepth(-1000);
          var tone = { ceo: 0x3a2f4f, dev: 0x25365a, research: 0x2c4a45, design: 0x4a3355, meeting: 0x4d3b2a, lounge: 0x3d4a35 };
          g.fillStyle(0x1b1f36, 1).fillRect(0, 0, map.cols * TILE, map.rows * TILE);
          map.rooms.forEach(function (r) { g.fillStyle(tone[r.id] || 0x333333, 1).fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE); g.lineStyle(1, 0xc9a24b, 1).strokeRect(r.x * TILE + .5, r.y * TILE + .5, r.w * TILE - 1, r.h * TILE - 1); });
          Object.keys(map.desks).forEach(function (id) { var d = map.desks[id]; g.fillStyle(0x7a5230, 1).fillRect(d.x * TILE - 4, (d.y - 1) * TILE + 2, TILE + 8, TILE - 4); });
          g.setDepth(-999);
        }
        map.rooms.forEach(function (r) {
          /* 방 이름은 방 바로 위(아래 방은 위쪽 벽 줄) 벽 띠 한가운데에 둔다 — 가구와 겹치지 않는 줄 */
          var ly = r.y <= 1 ? 0 : (r.y - 1) * TILE;
          var lx = r.y <= 1 ? (r.x + r.w / 2) * TILE : r.x * TILE + 8;
          self.add.text(lx, ly + 8, r.name, { fontFamily: "system-ui,sans-serif", fontSize: "11px", fontStyle: "bold", color: "#f5e2a6", stroke: "#0f1430", strokeThickness: 3, resolution: 3 }).setOrigin(r.y <= 1 ? .5 : 0, .5).setDepth(9000);
        });
        /* 캐릭터 */
        this.ring = this.add.ellipse(0, 0, 20, 8, 0xffd54a, .55).setStrokeStyle(1, 0xffffff, .9).setVisible(false);
        this.bellFrames = [];
        var bt = art.tiles && art.tiles.bell;
        if (bt && bt.frames) bt.frames.forEach(function (F, i) { var k = "bell:" + i; drawFrame(self, k, F, p, bt.w || 16, bt.h || 16); self.bellFrames.push(k); });
        this.bellTile = this.bellFrames.length ? this.add.image(0, 0, this.bellFrames[0]).setOrigin(0, 0).setVisible(false) : null;
        this.bell = this.add.image(0, 0, iconTexture(this, "approval")).setOrigin(.5, 1).setDepth(9500).setVisible(false);
        this.bellTxt = this.add.text(0, 0, "", { fontFamily: "system-ui,sans-serif", fontSize: "9px", color: "#fff", backgroundColor: "#b3261e", padding: { x: 2, y: 0 }, resolution: 2 }).setDepth(9501).setVisible(false);
        ROSTER.concat(bridge.model ? bridge.model.staff.filter(function (s) { return !ROSTER.some(function (r) { return r.id === s.id; }); }) : []).forEach(function (r) { self.ensureEnt(r.id); });
        this.setupCat();
        this.scale.on("resize", function () { self.focus(bridge.room, false); });
        this.focus(bridge.room, false);
        bridge.scene = this;
        if (bridge.model) this.applyModel(bridge.model);
        this.setSelected(bridge.selected);
      }
      ensureEnt(id) {
        if (this.ents[id]) return this.ents[id];
        var spec = charArt(id), names = buildAnims(this, "c:" + id, spec, pal());
        var first = names.sit || names.idle || names[Object.keys(names)[0]];
        var sp = this.add.sprite(-100, -100, first).setOrigin(.5, 1).setVisible(false);
        var w = spec.w || 16, h = spec.h || 24;
        sp.setInteractive(new window.Phaser.Geom.Rectangle(-6, -6, w + 12, h + 12), window.Phaser.Geom.Rectangle.Contains);
        sp.input.cursor = "pointer";
        var ent = { id: id, sp: sp, h: h, spec: spec, icon: null, cur: null, tok: 0, hidden: true, seated: false, facing: "down", status: "unknown", target: null };
        ent.icon = this.add.image(0, 0, iconTexture(this, "unknown")).setOrigin(.5, 1).setVisible(false);
        sp.on("pointerup", function () { if (bridge.onSelect) bridge.onSelect(id); });
        this.ents[id] = ent; return ent;
      }
      play(sp, prefix, spec, an, flip) {
        var key = prefix + ":" + an;
        if (!this.anims.exists(key)) { key = prefix + ":" + (spec.anims.sit ? "sit" : "idle"); if (!this.anims.exists(key)) return; }
        sp.setFlipX(!!flip);
        sp.play(key, true);
        if (reduce) sp.anims.pause();
      }
      applyModel(model) {
        var self = this, meet = 0, lounge = 0;
        model.staff.forEach(function (s) {
          var e = self.ensureEnt(s.id), tgt = null, kind = "desk";
          e.status = s.status; e.unknownLook = s.status === "unknown";
          if (s.untracked || s.status !== "off") {
            var loc = s.location;
            if (s.status === "meeting") kind = "meeting"; else if (s.status === "resting") kind = "lounge";
            if (loc === "meeting" || loc === "lounge") kind = loc;
            if (s.untracked || s.id === "guest" || s.status === "unknown") kind = "desk";
            var desk = map.desks && map.desks[s.id];
            if (kind === "desk" && !desk) kind = "lounge";
            if (kind === "desk") tgt = { x: desk.x, y: desk.y, facing: desk.facing || "up", seated: true };
            else { var arr = A(map.spots && map.spots[kind], 20); var sp = arr.length ? arr[(kind === "meeting" ? meet++ : lounge++) % arr.length] : { x: 2, y: 2 }; tgt = { x: sp.x, y: sp.y, facing: "down", seated: true }; }
          }
          self.place(e, tgt, s);
        });
        var b = map.spots && map.spots.ceoBell;
        if (b && model.bell > 0) {
          var pp = px(b); this.bell.setPosition(pp.x, pp.y - TILE - 2).setVisible(true);
          if (this.bellTile) this.bellTile.setPosition(b.x * TILE, b.y * TILE).setDepth(b.y * TILE + TILE + 1).setVisible(true);
          this.bellTxt.setText(model.bell > 1 ? String(model.bell) : "").setPosition(pp.x + 2, pp.y - TILE - 14).setVisible(model.bell > 1);
          this.bellOn = true;
          if (!this.bellTween && !reduce) this.bellTween = this.tweens.add({ targets: this.bell, angle: { from: -14, to: 14 }, duration: 160, yoyo: true, repeat: -1, repeatDelay: 700 });
        } else { this.bellOn = false; this.bell.setVisible(false); this.bellTxt.setVisible(false); if (this.bellTile) this.bellTile.setVisible(false); }
        if (model.summary.known) this.first = false;
      }
      place(e, tgt, s) {
        var self = this, sp = e.sp;
        var dim = s.status === "unknown" && !s.untracked;
        e.sp.setAlpha(dim ? .5 : 1); if (dim) sp.setTint(0x9a9aa8); else sp.clearTint();
        var iname = s.untracked ? null : STATUS[s.status] && STATUS[s.status].icon;
        if (iname) { e.icon.setTexture(iconTexture(this, iname)); e.iconOn = true; } else e.iconOn = false;
        e.icon.setAlpha(s.status === "unknown" ? .85 : 1);
        if (!tgt) { e.tok++; this.tweens.killTweensOf(sp); sp.setVisible(false); e.icon.setVisible(false); e.hidden = true; e.cur = null; e.target = null; return; }
        var same = e.target && e.target.x === tgt.x && e.target.y === tgt.y;
        e.target = tgt;
        var anim = animForStatus(s.status, tgt.seated);
        var arrive = function () {
          e.seated = tgt.seated; e.cur = { x: tgt.x, y: tgt.y }; var pp = px(e.cur); sp.setPosition(pp.x, pp.y);
          self.play(sp, "c:" + e.id, e.spec, anim, false);
          if (s.status === "unknown") { sp.anims.stop(); }
        };
        if (same && !e.hidden && e.tok >= 0 && !e.moving) { arrive(); return; }
        var wasHidden = e.hidden; e.hidden = false; sp.setVisible(true);
        e.tok++; var tok = e.tok; this.tweens.killTweensOf(sp);
        var start = e.cur;
        if (this.first || reduce || (!start && !wasHidden)) { arrive(); return; }
        if (!start) start = map.spots && map.spots.door || { x: tgt.x, y: tgt.y };
        if (wasHidden) { var d = px(start); sp.setPosition(d.x, d.y); }
        else { var cp = { x: Math.round((sp.x - TILE / 2) / TILE), y: Math.round((sp.y - TILE) / TILE) }; start = cp; }
        var path = bfs({ x: start.x, y: start.y }, { x: tgt.x, y: tgt.y });
        if (!path || path.length < 2) { arrive(); return; }
        e.moving = true; e.seated = false;
        var step = function (i) {
          if (tok !== e.tok) return;
          if (i >= path.length) { e.moving = false; arrive(); return; }
          var a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
          var an = dy < 0 ? (e.spec.anims.walkUp ? "walkUp" : "walk") : dy > 0 ? "walk" : (e.spec.anims.walkSide ? "walkSide" : "walk");
          self.play(sp, "c:" + e.id, e.spec, an, dx < 0);
          var q = px(b);
          self.tweens.add({ targets: sp, x: q.x, y: q.y, duration: 210, ease: "Linear", onComplete: function () { e.cur = { x: b.x, y: b.y }; step(i + 1); } });
        };
        step(1);
      }
      setupCat() {
        var self = this, spec = catArt(), routes = A(map.catRoutes, 10).filter(function (r) { return Array.isArray(r) && r.length > 1; });
        if (!routes.length) return;
        var names = buildAnims(this, "cat", spec, pal());
        var route = routes[0], idx = 0, pos = route[0], pp = px(pos);
        var sp = this.add.sprite(pp.x, pp.y, names.sit || names.idle).setOrigin(.5, 1);
        this.catEnt = { sp: sp };
        var cat = function (an, flip) { var k = "cat:" + an; if (!self.anims.exists(k)) k = "cat:" + (names.sit ? "sit" : "idle"); sp.setFlipX(!!flip); sp.play(k, true); };
        if (reduce) { cat("sit"); sp.anims.pause(); return; }
        var loop = function () {
          var nxt = (idx + 1) % route.length, path = bfs(pos, route[nxt]) || [pos, route[nxt]], tok = {};
          var step = function (i) {
            if (i >= path.length) {
              idx = nxt; pos = route[nxt];
              var pose = ["sit", "sleep", "groom", "sit"][Math.floor(Math.random() * 4)];
              cat(pose); self.time.delayedCall(6000 + Math.random() * 6000, loop); return;
            }
            var a = path[i - 1], b = path[i], dx = b.x - a.x, q = px(b);
            cat(b.y !== a.y && dx === 0 ? "walk" : (spec.anims.walkSide ? "walkSide" : "walk"), dx < 0);
            self.tweens.add({ targets: sp, x: q.x, y: q.y, duration: 520, onComplete: function () { step(i + 1); } });
          };
          step(1);
        };
        cat("sit"); this.time.delayedCall(2500, loop);
      }
      setSelected(id) { this.selId = id || null; }
      focus(roomId, animate) {
        var cam = this.cameras.main, r = null;
        if (roomId && roomId !== "all") r = map.rooms.filter(function (x) { return x.id === roomId; })[0] || null;
        var reg = r ? { x: (r.x - 1) * TILE, y: (r.y - 1) * TILE, w: (r.w + 2) * TILE, h: (r.h + 2) * TILE } : { x: 0, y: 0, w: map.cols * TILE, h: map.rows * TILE };
        var W = this.scale.width, H = this.scale.height; if (!W || !H) return;
        var z = Math.min(W / reg.w, H / reg.h); z = z >= 1 ? Math.floor(z * 4) / 4 : z;
        var cx = reg.x + reg.w / 2, cy = reg.y + reg.h / 2;
        if (animate && !reduce) { cam.pan(cx, cy, 450, "Sine.easeInOut", true); cam.zoomTo(z, 450, "Sine.easeInOut", true); }
        else { cam.setZoom(z); cam.centerOn(cx, cy); }
      }
      update(time) {
        var self = this, sel = null, bob = reduce ? 0 : Math.sin(time / 300);
        Object.keys(this.ents).forEach(function (id) {
          var e = self.ents[id]; if (!e.sp.visible) { e.icon.setVisible(false); return; }
          e.sp.setDepth(e.sp.y + (e.seated ? 8 : 0));
          e.icon.setVisible(!!e.iconOn).setPosition(e.sp.x, e.sp.y - e.h - 2 + bob).setDepth(9400);
          if (id === self.selId) sel = e;
        });
        if (sel) this.ring.setVisible(true).setPosition(sel.sp.x, sel.sp.y - 1).setDepth(sel.sp.depth - 1); else this.ring.setVisible(false);
        if (this.catEnt) this.catEnt.sp.setDepth(this.catEnt.sp.y);
        if (this.bellTile && this.bellOn && this.bellFrames.length > 1) this.bellTile.setTexture(this.bellFrames[reduce ? 0 : (Math.floor(time / 350) % this.bellFrames.length)]);
      }
    };

    var game = new window.Phaser.Game({
      type: window.Phaser.AUTO, parent: el, backgroundColor: "#14172b", pixelArt: true, roundPixels: true, banner: false,
      audio: { noAudio: true }, disableContextMenu: true, scene: [SceneClass],
      scale: { mode: window.Phaser.Scale.RESIZE, width: el.clientWidth || 600, height: el.clientHeight || 400 }
    });
    return { game: game, usingArt: !!ART, usingMap: !!MAPR };
  }

  /* ───────── React 화면 ───────── */
  var R = window.React, RD = window.ReactDOM;
  if (!R || !RD) {
    var rootEl = document.getElementById("root");
    if (rootEl) rootEl.textContent = "화면 라이브러리(React)를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.";
    return;
  }
  var h = R.createElement;
  var useState = R.useState, useEffect = R.useEffect, useRef = R.useRef, useMemo = R.useMemo;
  function Chip(p) { var st = STATUS[p.status] || STATUS.unknown; return h("span", { className: "chip " + st.cls }, p.label || st.label); }

  function Stage(p) {
    var ref = useRef(null);
    var bridge = useRef({ model: null, selected: null, room: "all", onSelect: null, scene: null, reduce: false }).current;
    var errState = useState(null), err = errState[0], setErr = errState[1];
    bridge.onSelect = p.onSelect;
    useEffect(function () {
      var inst = null;
      try {
        bridge.reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        bridge.model = p.model; bridge.selected = p.selId; bridge.room = p.room;
        if (!window.Phaser) { setErr("그림 엔진(Phaser)을 불러오지 못했습니다. 아래 직원 목록은 그대로 쓸 수 있습니다."); return; }
        inst = createOffice(ref.current, bridge);
        window.__officeInfo = { usingArt: inst.usingArt, usingMap: inst.usingMap };
      } catch (e) { setErr("그림을 그리는 중 문제가 생겼습니다. 아래 직원 목록은 그대로 쓸 수 있습니다."); }
      return function () { if (inst) { bridge.scene = null; inst.game.destroy(true); } };
    }, []);
    useEffect(function () { bridge.model = p.model; if (bridge.scene) bridge.scene.applyModel(p.model); }, [p.model]);
    useEffect(function () { bridge.selected = p.selId; if (bridge.scene) bridge.scene.setSelected(p.selId); }, [p.selId]);
    useEffect(function () { bridge.room = p.room; if (bridge.scene) bridge.scene.focus(p.room, true); }, [p.room]);
    return h("div", { className: "stage", role: "img", "aria-label": "가상 사무실 그림. 같은 정보는 아래 직원 목록에서도 볼 수 있습니다.", ref: ref, id: "stage" },
      err ? h("div", { className: "msg" }, err) : null);
  }

  function Sec(title, children) { return [h("h3", { key: "t" }, title), h("div", { key: "c" }, children)]; }
  function Empty(t) { return h("p", { className: "empty" }, t); }

  function Detail(p) {
    var s = p.s, now = p.now, closeRef = useRef(null);
    useEffect(function () {
      var prev = document.activeElement;
      if (closeRef.current) closeRef.current.focus();
      return function () { if (prev && prev.focus && document.body.contains(prev)) prev.focus(); };
    }, [s.id]);
    var t = s.task, start = t ? T(t.startedAt) : null, end = t ? T(t.endedAt) : null, el = null, elNote = "";
    if (s.status === "unknown") { elNote = "상태를 확인할 수 없어 경과 시간을 계산하지 않습니다."; }
    else if (start != null) { el = ((end != null ? end : now) - start) / 1000; }
    else if (s.elapsedSec != null) { el = s.elapsedSec + (WORKING[s.status] && p.docAt ? (now - p.docAt) / 1000 : 0); }
    var tok = s.tokens;
    var pend = p.pending.filter(function (x) { return x.staff === s.id; });
    if (s.untracked) {
      return h("aside", { className: "side", role: "dialog", "aria-label": s.name + " 상세 정보", "aria-modal": "false" },
        h("div", { className: "side-head" }, h("div", null, h("h2", null, s.name), h("div", { className: "sub" }, s.title), h("div", { style: { marginTop: 6 } }, h(Chip, { status: "off", label: "추적 대상 아님" }))),
          h("button", { className: "close", onClick: p.onClose, ref: closeRef, "aria-label": "상세 패널 닫기 (Esc)" }, "닫기")),
        h("p", { className: "note" }, "대표는 업무 기록 수집 대상이 아닙니다. 자리에 앉아 있는 모습은 항상 정지 상태이며 실제 업무와 무관합니다."),
        Sec("승인 요청 (직원 → 대표)", p.pending.length ? h("ul", null, p.pending.map(function (x, i) { return h("li", { key: i }, fmtTime(x.at) + " · " + x.staff + " · " + x.tool + " · " + x.message); })) : Empty("대표 승인을 기다리는 직원 요청이 없습니다.")),
        Sec("현황판 승인 대기", p.board.length ? h("ul", null, p.board.map(function (x, i) { return h("li", { key: i }, x.cardId + " " + x.title + (x.item ? " — " + x.item : "") + (x.status ? " (" + x.status + ")" : "")); })) : Empty("현황판 승인 대기 항목이 없습니다.")));
    }
    return h("aside", { className: "side", role: "dialog", "aria-label": s.name + " 상세 정보", "aria-modal": "false" },
      h("div", { className: "side-head" },
        h("div", null, h("h2", null, s.name), h("div", { className: "sub" }, s.title || "직책 정보 없음"),
          h("div", { style: { marginTop: 6 } }, h(Chip, { status: s.status, label: s.statusLabel }),
            s.rule ? h("span", { className: "rule", style: { marginLeft: 8 } }, "규칙 기반 표시") : null,
            s.headcount ? h("span", { className: "sub", style: { marginLeft: 8 } }, "· 오늘 " + s.headcount + "명, 업무 중 " + (s.activeCount || 0) + "명") : null)),
        h("button", { className: "close", onClick: p.onClose, ref: closeRef, "aria-label": "상세 패널 닫기 (Esc)" }, "닫기")),
      s.status === "unknown" && s.rawStatus !== "unknown" ? h("p", { className: "note" }, "문서가 오래되어 상태를 확인할 수 없습니다. 마지막 기록 상태: " + (STATUS[s.rawStatus] || STATUS.unknown).label) : null,
      s.rule ? h("p", { className: "note" }, "회의 표시는 실제 기록이 아니라 규칙(직원 호출 직후·보고 검토)으로 추정한 값입니다.") : null,
      Sec("현재 업무", t ? h("dl", null,
        h("dt", null, "업무"), h("dd", null, t.description || "—"),
        h("dt", null, "카드"), h("dd", null, t.cardId || "—"),
        h("dt", null, "시작"), h("dd", null, fmtTime(t.startedAt)),
        h("dt", null, end != null ? "종료" : "경과"), h("dd", null, end != null ? fmtTime(t.endedAt) + (el != null ? " (소요 " + fmtDur(el) + ")" : "") : (el != null ? fmtDur(el) : (elNote || "—"))),
        h("dt", null, "현재 파일"), h("dd", { className: "mono" }, s.currentFile || "—")) : Empty("기록된 현재 업무가 없습니다.")),
      Sec("활동 로그", s.activity.length ? h("ul", null, s.activity.slice(0, 12).map(function (a, i) {
        return h("li", { key: i }, fmtTime(a.at) + " · " + (a.tool || a.kind || "활동") + (a.file ? " · " + a.file : "") + (a.ok === false ? " · 실패" : ""));
      })) : Empty("활동 기록이 없습니다.")),
      Sec("카드 진행률", s.cards.length ? s.cards.map(function (c, i) {
        var pct = c.total ? Math.round((c.done || 0) / c.total * 100) : 0;
        return h("div", { className: "card", key: i },
          h("strong", null, c.id + " " + c.title), h("div", { className: "sub" }, c.status || ""),
          c.total ? h("div", { className: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": c.total, "aria-valuenow": c.done || 0, "aria-label": c.id + " 진행률" }, h("i", { style: { width: pct + "%" } })) : null,
          c.total ? h("div", { className: "sub" }, (c.done || 0) + " / " + c.total + " 세부 작업 (" + pct + "%)") : null,
          c.verification ? h("div", null, "검증: " + c.verification) : null,
          c.issues ? h("div", null, "지적 사항: " + c.issues) : null);
      }) : Empty("담당 카드가 없습니다.")),
      Sec("완료한 업무", s.completed.length ? h("ul", null, s.completed.map(function (c, i) { return h("li", { key: i }, c.id + " " + c.title); })) : Empty("완료 기록이 없습니다.")),
      Sec("오류", s.errors.length ? h("ul", null, s.errors.map(function (e, i) { return h("li", { key: i }, fmtTime(e.at) + " · " + e.tool + " · " + e.message); })) : Empty("기록된 오류가 없습니다.")),
      Sec("토큰·비용 추정", tok ? h("dl", null,
        h("dt", null, "합계"), h("dd", null, num(tok.total) + " 토큰" + (tok.source ? " (" + tok.source + ")" : "")),
        h("dt", null, "입력/출력"), h("dd", null, num(tok.input) + " / " + num(tok.output)),
        h("dt", null, "캐시 읽기/쓰기"), h("dd", null, num(tok.cacheRead) + " / " + num(tok.cacheWrite)),
        h("dt", null, "비용 추정"), h("dd", null, s.cost && s.cost.usd != null ? "약 $" + s.cost.usd.toFixed(2) : "—"),
        h("dt", null, "근거"), h("dd", null, s.cost && s.cost.basis ? s.cost.basis : "근거 문구 없음")) : Empty("토큰 기록이 없습니다.")),
      Sec("검증 결과", (function () {
        var v = s.cards.filter(function (c) { return c.verification; });
        return v.length ? h("ul", null, v.map(function (c, i) { return h("li", { key: i }, c.id + ": " + c.verification); })) : Empty("검증 기록이 없습니다.");
      })()),
      Sec("대표 승인 요청", (function () {
        var items = [];
        pend.forEach(function (x) { items.push(fmtTime(x.at) + " · " + x.tool + " · " + x.message); });
        s.approvals.forEach(function (x) { if (x) items.push(x); });
        s.cards.forEach(function (c) { if (c.approval) items.push(c.id + ": " + c.approval); });
        return items.length ? h("ul", null, items.map(function (x, i) { return h("li", { key: i }, x); })) : Empty("대표 승인을 기다리는 요청이 없습니다.");
      })()));
  }

  function App() {
    var st = useState(Date.now()), now = st[0], setNow = st[1];
    var cs = useState({ kind: "loading" }), conn = cs[0], setConn = cs[1];
    var ds = useState(null), doc = ds[0], setDoc = ds[1];
    var ss = useState(null), sampleDoc = ss[0], setSampleDoc = ss[1];
    var sels = useState(null), selId = sels[0], setSelId = sels[1];
    var rs = useState(function () { try { var v = localStorage.getItem("office.roomTab"); return ROOMS.some(function (r) { return r.id === v; }) ? v : "all"; } catch (e) { return "all"; } }), room = rs[0], setRoom = rs[1];

    useEffect(function () { var t = setInterval(function () { setNow(Date.now()); }, 1000); return function () { clearInterval(t); }; }, []);
    useEffect(function () {
      var unsub = null, dead = false, got = false;
      var timer = setTimeout(function () { if (!got && !dead) setConn(function (c) { return c.kind === "loading" ? { kind: "timeout" } : c; }); }, TIMEOUT_MS);
      (async function () {
        try {
          if (!window.claude || typeof window.claude.use !== "function") { got = true; clearTimeout(timer); setConn({ kind: "none" }); return; }
          var db = await window.claude.use("db");
          if (dead) return;
          if (!db) { got = true; clearTimeout(timer); setConn({ kind: "none" }); return; }
          unsub = db.doc("office/state").onSnapshot(function (snap) {
            if (dead) return;
            var cache = !!(snap.metadata && snap.metadata.fromCache);
            if (!cache) { got = true; clearTimeout(timer); }
            if (!snap.exists) { setDoc(null); setConn({ kind: "empty", cache: cache }); return; }
            var d = snap.data();
            if (!d || d.schemaVersion !== 1 || !Array.isArray(d.staff)) { setDoc(null); setConn({ kind: "badschema" }); return; }
            setDoc(d); setSampleDoc(null); setConn({ kind: "ok", cache: cache });
          }, function (e) { if (!dead) { got = true; clearTimeout(timer); setConn({ kind: "error", code: e && e.code ? String(e.code) : "unknown" }); } });
        } catch (e) { if (!dead) { got = true; clearTimeout(timer); setConn({ kind: "error", code: e && e.code ? String(e.code) : "unknown" }); } }
      })();
      return function () { dead = true; clearTimeout(timer); if (unsub) unsub(); };
    }, []);
    useEffect(function () {
      function k(e) { if (e.key === "Escape") setSelId(null); }
      window.addEventListener("keydown", k); return function () { window.removeEventListener("keydown", k); };
    }, []);

    var active = sampleDoc || doc;
    var docAt = active ? T(active.generatedAt) : null;
    var stale = !active || docAt == null || now - docAt > STALE_MS;
    var model = useMemo(function () { return derive(active, stale); }, [active, stale]);
    var sel = selId ? model.staff.filter(function (s) { return s.id === selId; })[0] : null;
    // 예시 버튼을 눌렀거나, 들어온 문서 자체에 sample 표시가 있으면 반드시 예시 배너를 띄운다
    var isSample = !!sampleDoc || !!(doc && doc.sample === true);
    var noReal = conn.kind !== "ok";

    function pickRoom(id) { setRoom(id); try { localStorage.setItem("office.roomTab", id); } catch (e) { } }

    var banner = null;
    if (isSample) banner = null;
    else if (conn.kind === "loading") banner = { c: "", t: "수집 기록을 불러오는 중입니다…", d: "" };
    else if (conn.kind === "none") banner = { c: "warn", t: "수집 연결 안 됨", d: "이 환경에서는 업무 기록 저장소에 연결할 수 없어 모든 직원을 '상태 확인 불가'로 표시합니다." };
    else if (conn.kind === "timeout") banner = { c: "warn", t: "수집 문서 응답 없음", d: "10초 안에 응답이 없습니다. 연결을 계속 확인하며, 그동안 모든 직원은 '상태 확인 불가'로 표시합니다." };
    else if (conn.kind === "error") banner = { c: "bad", t: "수집 문서를 읽지 못했습니다 (" + conn.code + ")", d: "모든 직원을 '상태 확인 불가'로 표시합니다." };
    else if (conn.kind === "badschema") banner = { c: "bad", t: "알 수 없는 문서 형식", d: "상태 문서 형식(schemaVersion)이 달라 읽을 수 없습니다. 모든 직원을 '상태 확인 불가'로 표시합니다." };
    else if (conn.kind === "empty") banner = { c: "", t: "아직 수집된 기록이 없습니다 — 총괄실장이 작업 단계마다 갱신합니다", d: "기록이 생기기 전에는 아무도 일하는 모습으로 그리지 않고 모두 '상태 확인 불가'로 둡니다." };
    else if (stale) banner = { c: "warn", t: "마지막 갱신 " + (docAt != null ? fmtAgo(now - docAt) : "시각 불명"), d: "30분 넘게 갱신되지 않아 모든 직원을 '상태 확인 불가'로 표시합니다. 총괄실장이 다음 작업 단계에서 갱신합니다." };
    else if (conn.cache) banner = { c: "", t: "저장된 사본을 먼저 보여 주는 중", d: "서버 확인이 끝나면 자동으로 최신 값으로 바뀝니다." };

    var sm = model.summary, ago = docAt != null ? fmtAgo(Math.max(0, now - docAt)) : "기록 없음";
    function select(id) { setSelId(id); }

    return h(R.Fragment, null,
      isSample ? h("div", { className: "sample-bar", role: "status" }, h("span", null, "예시 화면 — 실제 업무가 아닙니다"),
        h("button", { onClick: function () { setSampleDoc(null); } }, "예시 끄기")) : null,
      h("div", { className: "wrap" },
        h("header", { className: "top" }, h("h1", null, "가상 사무실 (대표 전용)"),
          h("span", { className: "sub" }, "실제 기록에서 나온 상태만 보여 줍니다. 기록이 없으면 '상태 확인 불가'입니다.")),
        h("ul", { className: "summary", "aria-label": "오늘 요약" },
          h("li", null, h("span", { className: "k" }, "오늘 출근"), h("span", { className: "v" }, sm.known ? sm.present : "—", h("small", null, sm.known ? " 명" : ""))),
          h("li", null, h("span", { className: "k" }, "업무 중"), h("span", { className: "v" }, sm.known ? sm.working : "—", h("small", null, sm.known ? " 명" : ""))),
          h("li", { className: sm.waiting > 0 ? "alert" : "" }, h("span", { className: "k" }, "승인 대기 (대표 벨)"), h("span", { className: "v" }, sm.known ? sm.waiting : "—", h("small", null, sm.known ? " 건" : ""))),
          h("li", null, h("span", { className: "k" }, "마지막 갱신"), h("span", { className: "v", style: { fontSize: 18 } }, ago))),
        (function () {
          var src = active && active.source ? active.source : null, notes = [];
          if (src && src.period && src.period.from) notes.push("집계 기간: " + fmtTime(src.period.from) + " ~ " + fmtTime(src.period.to) + (src.period.timezone ? " (" + src.period.timezone + ")" : ""));
          if (src && src.backfill) notes.push("작업기록 보조 데이터 포함" + (src.backfill.note ? " — " + String(src.backfill.note).slice(0, 120) : ""));
          if (active && active.truncated) notes.push("일부 기록이 잘려 있을 수 있습니다.");
          return notes.length ? h("p", { className: "note", style: { margin: "0 0 10px" } }, notes.join(" · ")) : null;
        })(),
        banner ? h("div", { className: "banner " + banner.c, role: "status" }, h("b", null, banner.t), banner.d,
          noReal && !isSample && conn.kind !== "loading" ? h("div", null, h("button", { onClick: function () { setSampleDoc(makeSample(Date.now())); setSelId(null); } }, "예시 화면 보기")) : null) : null,
        h("div", { className: "layout" },
          h("main", null,
            h("div", { className: "tabs", role: "group", "aria-label": "방 선택(화면 확대)" },
              ROOMS.map(function (r) { return h("button", { key: r.id, "aria-pressed": room === r.id, onClick: function () { pickRoom(r.id); } }, r.name); })),
            h(Stage, { model: model, selId: selId, room: room, onSelect: select }),
            h("section", { className: "panel", "aria-label": "직원 목록" },
              h("h2", null, "직원 목록"),
              h("ul", { className: "slist" }, model.staff.map(function (s) {
                return h("li", { key: s.id }, h("button", { className: "srow", "aria-current": selId === s.id ? "true" : undefined, onClick: function () { select(s.id); } },
                  h("span", null, h("span", { className: "nm" }, s.name + (s.headcount ? " (오늘 " + s.headcount + "명)" : "")), h("span", { className: "tt" }, s.title)),
                  h(Chip, { status: s.status, label: s.statusLabel + (s.rule && s.statusLabel.indexOf("규칙") < 0 ? " (규칙 기반)" : "") })));
              })),
              h("p", { className: "note" }, "직원을 누르면 상세 정보가 열립니다. 캔버스 안의 캐릭터를 눌러도 같습니다.")),
            !stale && model.board.length ? h("section", { className: "panel", "aria-label": "대표 승인 대기" },
              h("h2", null, "현황판 승인 대기 " + model.board.length + "건"),
              (function () {
                function li(x, i) { return h("li", { key: i }, x.cardId + " " + x.title + (x.item ? " — " + x.item : "") + (x.status ? " (" + x.status + ")" : "")); }
                return [h("ul", { key: "a", style: { margin: 0, paddingLeft: 18 } }, model.board.slice(0, 5).map(li)),
                  model.board.length > 5 ? h("details", { key: "b", style: { marginTop: 6 } }, h("summary", { style: { cursor: "pointer", minHeight: 32 } }, "나머지 " + (model.board.length - 5) + "건 보기"), h("ul", { style: { margin: "6px 0 0", paddingLeft: 18 } }, model.board.slice(5).map(function (x, i) { return li(x, i + 5); }))) : null];
              })()) : null,
            h("section", { className: "panel", "aria-label": "도움말" },
              h("h2", null, "범례·도움말"),
              h("ul", { className: "legend" },
                ["typing", "research", "running", "working", "error", "awaiting_approval", "done", "resting", "unknown", "meeting"].map(function (k) {
                  return h("li", { key: k }, h(Chip, { status: k }), h("span", null, { typing: "책상에서 코드 작성", research: "책상에서 자료 조사", running: "실행·테스트", working: "모래시계(도구 기록은 잠시 없음)", resting: "찻잔(휴게실)", error: "붉은 느낌표", awaiting_approval: "벨 + 대표실 벨 흔들림", done: "체크 표시", unknown: "회색 반투명 + ?", meeting: "회의실(규칙 기반)" }[k]));
                })),
              h("p", { className: "note" }, "복자(턱시도 고양이)는 장식이며 업무와 무관합니다. 마음대로 돌아다니는 모습은 일과 아무 관계가 없습니다."),
              h("p", { className: "note" }, "실제 이벤트가 없으면 일하는 모습을 그리지 않습니다. 퇴근한 직원은 화면에서 자리를 비웁니다. 기록에는 파일 이름·도구 이름·시각만 있고 파일 내용이나 명령문은 담지 않습니다."))),
          sel ? h(Detail, { s: sel, now: now, pending: model.pending, board: model.board, docAt: docAt, onClose: function () { setSelId(null); } }) : null)));
  }

  window.OfficeApp = { sample: SAMPLE, makeSample: makeSample };
  RD.createRoot(document.getElementById("root")).render(h(App));
})();
