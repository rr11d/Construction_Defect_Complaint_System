# AI 건설 하자 민원 응대 및 관리 시스템

사진 기반 AI 분석으로 건설 하자 민원을 접수하고, 사용자와 관리자가 처리 상태를 확인할 수 있는 민원 관리 시스템입니다.

사용자는 하자 사진과 민원 설명을 등록해 AI 분석을 요청하고, 분석 결과를 바탕으로 민원을 접수합니다. 관리자는 접수된 민원의 사진, 접수 정보, AI 분석 요약을 확인하고 처리 상태를 변경할 수 있습니다.

## 사용자 기능

### 민원 접수

하자 사진을 여러 장 등록하고, 민원인이 확인한 문제 상황을 설명으로 입력합니다. 이후 AI 분석을 실행해 하자 내용, 심각도, 예상 해결 방법, 처리 방법, 관련 법규를 확인한 뒤 접수 정보를 입력합니다.

![사용자 민원 접수](media/user-complaint-create.png)

### 내 민원 조회 및 상세 확인

사용자가 접수한 민원 목록과 상세 내용을 확인할 수 있습니다. 각 민원은 하자 내용을 요약한 제목과 처리 상태로 표시되며, 상세 영역에서 사진, 위치, 하자 부위, 긴급도, 사용자 설명, AI 분석 결과를 함께 확인할 수 있습니다.

![사용자 민원 상세](media/user-complaint-detail.png)

## 관리자 기능

### 전체 민원 관리

관리자는 전체 민원을 최근 접수 순서로 조회합니다. 목록에서는 접수 번호, 작성자, 사진, 요약 제목, 처리 상태를 한눈에 확인할 수 있습니다.

![관리자 민원 목록](media/admin-complaint-list.png)

### 민원 상세 보기

관리자는 민원 상세 화면에서 첨부 사진, 접수자 정보, 위치 정보, 연락처, 사용자 설명을 확인합니다. 민원 상태는 `접수대기`, `검토중`, `보수중`, `처리완료` 중 하나로 변경할 수 있습니다.

![관리자 민원 상세](media/admin-complaint-detail.png)

### AI 분석 요약

AI 분석 결과는 하자 내용, 심각도, 예상 해결 방법, 처리 방법, 관련 법규로 구분해 표시합니다. 민원 정보와 AI 분석 내용을 분리해 중복 표시를 줄였습니다.

![관리자 AI 분석 요약](media/admin-ai-analysis-summary.png)

## 주요 구현 내용

- React 기반 사용자 대시보드와 관리자 대시보드 분리
- Express API 서버와 MySQL 데이터베이스 연동
- OpenAI API 기반 이미지 분석 요청
- AI 분석 결과 JSON 필드 통일
- 여러 장 이미지 업로드 지원
- 이미지 파일 서버 저장 및 DB 경로 저장
- 사용자 민원 접수, 조회, 상세 보기, 삭제
- 관리자 전체 민원 조회, 상세 보기, 상태 변경
- 민원 상태값 통일: `접수대기`, `검토중`, `보수중`, `처리완료`

## 기술 스택

- Frontend: React, Vite
- Backend: Node.js, Express
- Database: MySQL
- AI: OpenAI API
- Auth: JWT, bcrypt
- Image Upload: multer, sharp

## 실행 방법

### 패키지 설치

```bash
npm install
```

### 환경변수 설정

`.env.example`을 참고해 `.env` 파일을 생성합니다.

```env
PORT=3000
SECRET_KEY=change-this-secret
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=construction_defect
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o
ADMIN_USERID=test
ADMIN_PASSWORD=1111
ADMIN_NAME=관리자
```

### DB 준비

```bash
npm run setup:db
```

### 개발 서버 실행

```bash
npm run dev
```

실행 주소:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://localhost:3000`

## 주요 API

- `POST /api/signup`
- `POST /api/login`
- `POST /api/chat`
- `POST /api/register-report`
- `GET /api/my-reports/:user_id`
- `GET /api/admin/all-reports`
- `PUT /api/report-status/:id`
- `DELETE /api/reports/:id`

## 검증 명령

```bash
node --check server.js
npm run build
```
