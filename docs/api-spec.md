# Balruno Cloud API Specification

## Overview

클라우드 모드에서 사용하는 백엔드 API 스펙입니다.
자바(Spring Boot) 또는 다른 언어로 구현할 때 이 스펙을 따르면 됩니다.

## Base URL

```
Production: https://api.balruno.com
Development: http://localhost:8080
```

## Authentication

모든 API는 JWT Bearer 토큰 인증을 사용합니다.

```
Authorization: Bearer <access_token>
```

---

## 1. Auth API

### POST /api/auth/register
회원가입

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "사용자명"
}
```

**Response:** `201 Created`
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "사용자명",
  "createdAt": "2025-02-01T12:00:00Z"
}
```

### POST /api/auth/login
로그인

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "사용자명"
  }
}
```

### POST /api/auth/refresh
토큰 갱신

**Request:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "new-jwt-access-token",
  "expiresIn": 3600
}
```

### POST /api/auth/logout
로그아웃

**Response:** `204 No Content`

---

## 2. Projects API

### GET /api/projects
내 프로젝트 목록 조회

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": "project-uuid",
      "name": "게임 밸런스 시트",
      "description": "RPG 스탯 밸런싱",
      "createdAt": "2025-02-01T12:00:00Z",
      "updatedAt": "2025-02-01T14:30:00Z",
      "syncMode": "cloud",
      "isOwner": true,
      "collaboratorCount": 3
    }
  ]
}
```

### POST /api/projects
새 프로젝트 생성

**Request:**
```json
{
  "name": "새 프로젝트",
  "description": "설명 (선택)",
  "data": { /* Project 전체 데이터 */ }
}
```

**Response:** `201 Created`
```json
{
  "id": "project-uuid",
  "name": "새 프로젝트",
  "description": "설명",
  "createdAt": "2025-02-01T12:00:00Z",
  "updatedAt": "2025-02-01T12:00:00Z"
}
```

### GET /api/projects/:id
프로젝트 상세 조회 (전체 데이터 포함)

**Response:** `200 OK`
```json
{
  "id": "project-uuid",
  "name": "게임 밸런스 시트",
  "description": "RPG 스탯 밸런싱",
  "createdAt": "2025-02-01T12:00:00Z",
  "updatedAt": "2025-02-01T14:30:00Z",
  "data": {
    "sheets": [...],
    "folders": [...]
  },
  "version": 15
}
```

### PUT /api/projects/:id
프로젝트 전체 업데이트

**Request:**
```json
{
  "name": "수정된 이름",
  "description": "수정된 설명",
  "data": { /* Project 전체 데이터 */ },
  "baseVersion": 15
}
```

**Response:** `200 OK`
```json
{
  "id": "project-uuid",
  "version": 16,
  "updatedAt": "2025-02-01T15:00:00Z"
}
```

**Conflict:** `409 Conflict` (버전 충돌 시)
```json
{
  "error": "VERSION_CONFLICT",
  "message": "다른 사용자가 먼저 수정했습니다",
  "serverVersion": 16,
  "serverData": { /* 서버의 최신 데이터 */ }
}
```

### DELETE /api/projects/:id
프로젝트 삭제

**Response:** `204 No Content`

---

## 3. Sync API (실시간 동기화)

### PATCH /api/projects/:id/sync
부분 변경사항 동기화 (Operational Transform 스타일)

**Request:**
```json
{
  "baseVersion": 15,
  "operations": [
    {
      "type": "UPDATE_CELL",
      "path": "sheets[0].rows[5].cells.hp",
      "value": 150,
      "timestamp": 1706789012345
    },
    {
      "type": "ADD_ROW",
      "path": "sheets[0].rows",
      "index": 10,
      "value": { "id": "row-uuid", "cells": {} },
      "timestamp": 1706789012350
    },
    {
      "type": "DELETE_SHEET",
      "path": "sheets",
      "index": 2,
      "timestamp": 1706789012400
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "version": 16,
  "accepted": [0, 1, 2],
  "rejected": [],
  "serverOperations": [
    /* 다른 사용자가 보낸 operations (클라이언트가 아직 못 받은 것) */
  ]
}
```

### Operation Types

| Type | Description | Path Example |
|------|-------------|--------------|
| `UPDATE_CELL` | 셀 값 변경 | `sheets[0].rows[5].cells.hp` |
| `UPDATE_CELL_STYLE` | 셀 스타일 변경 | `sheets[0].rows[5].cellStyles.hp` |
| `ADD_ROW` | 행 추가 | `sheets[0].rows` |
| `DELETE_ROW` | 행 삭제 | `sheets[0].rows` |
| `ADD_COLUMN` | 컬럼 추가 | `sheets[0].columns` |
| `DELETE_COLUMN` | 컬럼 삭제 | `sheets[0].columns` |
| `UPDATE_COLUMN` | 컬럼 속성 변경 | `sheets[0].columns[2]` |
| `ADD_SHEET` | 시트 추가 | `sheets` |
| `DELETE_SHEET` | 시트 삭제 | `sheets` |
| `UPDATE_SHEET` | 시트 속성 변경 | `sheets[0]` |
| `ADD_FOLDER` | 폴더 추가 | `folders` |
| `DELETE_FOLDER` | 폴더 삭제 | `folders` |
| `UPDATE_FOLDER` | 폴더 속성 변경 | `folders[0]` |
| `ADD_STICKER` | 스티커 추가 | `sheets[0].stickers` |
| `DELETE_STICKER` | 스티커 삭제 | `sheets[0].stickers` |
| `UPDATE_STICKER` | 스티커 변경 | `sheets[0].stickers[0]` |

---

## 4. WebSocket API (실시간 협업)

### Connection

```
ws://localhost:8080/ws/projects/{projectId}?token={accessToken}
```

### Client → Server Messages

**Join Room:**
```json
{
  "type": "JOIN",
  "payload": {
    "userName": "사용자명",
    "userColor": "#FF5733"
  }
}
```

**Send Operation:**
```json
{
  "type": "OPERATION",
  "payload": {
    "baseVersion": 15,
    "operations": [...]
  }
}
```

**Update Presence (커서 위치, 선택 영역):**
```json
{
  "type": "PRESENCE",
  "payload": {
    "sheetId": "sheet-uuid",
    "selectedCell": { "rowId": "row-1", "columnId": "col-hp" },
    "selectedRange": null
  }
}
```

**Leave Room:**
```json
{
  "type": "LEAVE"
}
```

### Server → Client Messages

**User Joined:**
```json
{
  "type": "USER_JOINED",
  "payload": {
    "userId": "user-uuid",
    "userName": "다른사용자",
    "userColor": "#33FF57"
  }
}
```

**User Left:**
```json
{
  "type": "USER_LEFT",
  "payload": {
    "userId": "user-uuid"
  }
}
```

**Operation Broadcast:**
```json
{
  "type": "OPERATION",
  "payload": {
    "userId": "user-uuid",
    "version": 16,
    "operations": [...]
  }
}
```

**Presence Update:**
```json
{
  "type": "PRESENCE",
  "payload": {
    "userId": "user-uuid",
    "userName": "다른사용자",
    "userColor": "#33FF57",
    "sheetId": "sheet-uuid",
    "selectedCell": { "rowId": "row-1", "columnId": "col-hp" }
  }
}
```

**Current Users (접속 시 현재 접속자 목록):**
```json
{
  "type": "USERS",
  "payload": {
    "users": [
      {
        "userId": "user-uuid",
        "userName": "다른사용자",
        "userColor": "#33FF57",
        "sheetId": "sheet-uuid",
        "selectedCell": { "rowId": "row-1", "columnId": "col-hp" }
      }
    ]
  }
}
```

---

## 5. Collaboration API

### POST /api/projects/:id/collaborators
협업자 초대

**Request:**
```json
{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

**Response:** `201 Created`
```json
{
  "id": "collaborator-uuid",
  "email": "collaborator@example.com",
  "role": "editor",
  "status": "pending",
  "invitedAt": "2025-02-01T12:00:00Z"
}
```

### GET /api/projects/:id/collaborators
협업자 목록 조회

**Response:** `200 OK`
```json
{
  "collaborators": [
    {
      "id": "user-uuid",
      "email": "owner@example.com",
      "name": "소유자",
      "role": "owner",
      "status": "active"
    },
    {
      "id": "collaborator-uuid",
      "email": "collaborator@example.com",
      "name": "협업자",
      "role": "editor",
      "status": "active"
    }
  ]
}
```

### DELETE /api/projects/:id/collaborators/:userId
협업자 제거

**Response:** `204 No Content`

### Roles

| Role | Permissions |
|------|-------------|
| `owner` | 모든 권한 + 프로젝트 삭제 + 협업자 관리 |
| `editor` | 읽기 + 쓰기 |
| `viewer` | 읽기만 |

---

## 6. Error Responses

모든 에러는 다음 형식을 따릅니다:

```json
{
  "error": "ERROR_CODE",
  "message": "사람이 읽을 수 있는 메시지",
  "details": { /* 추가 정보 (선택) */ }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | 잘못된 요청 |
| 401 | `UNAUTHORIZED` | 인증 필요 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `VERSION_CONFLICT` | 버전 충돌 |
| 429 | `RATE_LIMITED` | 요청 과다 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 7. Rate Limits

| Endpoint | Limit |
|----------|-------|
| Auth APIs | 10 req/min |
| Project CRUD | 60 req/min |
| Sync API | 120 req/min |
| WebSocket | 100 msg/sec |

---

## Notes for Implementation

1. **Versioning**: 모든 프로젝트는 `version` 필드를 가지며, 변경 시마다 증가
2. **Conflict Resolution**: Last-Writer-Wins 방식, 같은 셀 동시 수정 시 나중 것이 이김
3. **Offline Support**: 클라이언트는 오프라인 시 로컬에 저장, 온라인 복귀 시 동기화
4. **WebSocket Reconnection**: 연결 끊김 시 자동 재연결, 놓친 operations 요청
