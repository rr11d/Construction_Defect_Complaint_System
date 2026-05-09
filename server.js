const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

// 1. 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 2. MySQL 연결 설정
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 4. 공통 상태값 설정
const REPORT_STATUS = {
  RECEIVED: '접수',
  IN_REVIEW: '검토중',
  REPAIRING: '보수중',
  COMPLETED: '처리완료'
};

// 5. 공통 보조 함수

// 배열 필드가 비정상적으로 들어와도 안전하게 정리
function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

// 금액 문자열에서 숫자만 추출해 정수로 변환
function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);

  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

// 숫자형 입력을 정수로 변환
function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// DB JSON 문자열을 객체로 안전하게 변환
function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

// 구조화된 분석 결과를 기존 화면용 텍스트로 변환
function buildAnalysisText(analysis) {
  const repairMethods = normalizeArray(analysis.repairMethods).join(', ') || '정보 없음';
  const relatedLaws = normalizeArray(analysis.relatedLaws).join(', ') || '정보 없음';
  const estimatedCost = analysis.estimatedRepairCost !== null && analysis.estimatedRepairCost !== undefined
    ? `${analysis.estimatedRepairCost.toLocaleString('ko-KR')}원`
    : '미정';
  const expectedDays = analysis.expectedProcessingDays !== null && analysis.expectedProcessingDays !== undefined
    ? `${analysis.expectedProcessingDays}일`
    : '미정';

  return [
    `하자 유형: ${analysis.defectType || '미분류'}`,
    `심각도: ${analysis.severityScore ?? '미정'}`,
    `예상 보수 비용: ${estimatedCost}`,
    `예상 처리 기간: ${expectedDays}`,
    `권장 보수 방법: ${repairMethods}`,
    `관련 법규: ${relatedLaws}`,
    `상세 설명: ${analysis.summary || '설명 없음'}`
  ].join('\n');
}

// AI 응답 JSON을 DB 저장용 형식으로 정규화
function normalizeAnalysisPayload(payload = {}) {
  const normalized = {
    defectType: payload.defectType || '미분류',
    severityScore: Math.min(Math.max(parseInteger(payload.severityScore) ?? 0, 0), 10),
    estimatedRepairCost: parseCurrency(payload.estimatedRepairCost),
    expectedProcessingDays: parseInteger(payload.expectedProcessingDays),
    actualProcessingDays: parseInteger(payload.actualProcessingDays),
    repairMethods: normalizeArray(payload.repairMethods),
    relatedLaws: normalizeArray(payload.relatedLaws),
    summary: payload.summary || ''
  };

  return normalized;
}

// AI가 보낸 응답에서 JSON 객체만 추출
function extractAssistantJson(content) {
  if (typeof content !== 'string') {
    throw new Error('AI response content was empty.');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw error;
  }
}

// reports 조회 결과를 프론트 응답 형식으로 변환
function formatReportRow(row) {
  const analysisJson = safeJsonParse(row.analysis_json);

  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    defect_type: row.defect_type,
    severity_score: row.severity_score,
    estimated_repair_cost: row.estimated_repair_cost,
    expected_processing_days: row.expected_processing_days,
    actual_processing_days: row.actual_processing_days,
    analysis_result: row.analysis_text,
    analysis_json: analysisJson,
    image_data: row.image_data,
    image_url: row.image_url,
    status: row.status,
    received_at: row.received_at,
    processed_at: row.processed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// --- API 경로 시작 ---

// [기능 1] 회원가입 API (기본 role은 'user')
app.post('/api/signup', async (req, res) => {
  const { userid, password, name } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = "INSERT INTO users (userid, password, name, role) VALUES (?, ?, ?, 'user')";

    db.execute(query, [userid, hashedPassword, name], (err) => {
      if (err) {
        return res.status(500).json({ error: '아이디 중복 또는 DB 오류' });
      }

      res.json({ success: true, message: '회원가입이 완료되었습니다.' });
    });
  } catch (error) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// [기능 2] 로그인 API (role 정보 포함)
app.post('/api/login', (req, res) => {
  const { userid, password } = req.body;
  const query = 'SELECT * FROM users WHERE userid = ?';

  db.execute(query, [userid], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    const token = jwt.sign(
      { id: user.id, userid: user.userid, role: user.role },
      SECRET_KEY,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      name: user.name,
      id: user.id,
      role: user.role
    });
  });
});

// [기능 3] AI 채팅 API
// [개선] 자유 텍스트 대신 JSON 구조 응답을 받고, 화면용 텍스트도 함께 생성
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], image } = req.body;

    const systemPrompt = [
      '당신은 건설 하자 민원 분석 전문가입니다.',
      '반드시 하나의 JSON 객체만 응답하세요. 설명 문장, 코드블록, 마크다운은 금지입니다.',
      'JSON 형식은 아래 키를 정확히 사용하세요.',
      '{',
      '  "defectType": "string",',
      '  "severityScore": 1,',
      '  "estimatedRepairCost": 0,',
      '  "expectedProcessingDays": 0,',
      '  "actualProcessingDays": null,',
      '  "repairMethods": ["string", "string"],',
      '  "relatedLaws": ["string"],',
      '  "summary": "string"',
      '}',
      'severityScore는 1~10 정수, 금액과 일수는 숫자로 반환하세요.',
      '이미지와 질문을 함께 보고 가장 가능성 높은 값을 채우세요.'
    ].join('\n');

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    if (image && apiMessages.length > 1) {
      const lastIdx = apiMessages.length - 1;
      const originalText = apiMessages[lastIdx].content;
      apiMessages[lastIdx].content = [
        { type: 'text', text: originalText },
        { type: 'image_url', image_url: { url: image } }
      ];
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: apiMessages,
      max_tokens: 1000
    });

    const rawContent = completion.choices[0]?.message?.content;
    const parsedContent = extractAssistantJson(rawContent);
    const structuredResult = normalizeAnalysisPayload(parsedContent);
    const result = buildAnalysisText(structuredResult);

    res.json({
      result,
      structuredResult
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.' });
  }
});

// [기능 4] 하자 민원 접수 데이터 저장 API
// [개선] 분석 결과를 컬럼별 데이터 + analysis_json으로 함께 저장
app.post('/api/register-report', (req, res) => {
  const {
    user_id,
    image_data,
    image_url = null,
    analysis_result,
    analysis_text,
    structured_analysis,
    defect_type,
    severity_score,
    estimated_repair_cost,
    expected_processing_days,
    actual_processing_days
  } = req.body;

  const normalizedStructured = normalizeAnalysisPayload(
    structured_analysis || {
      defectType: defect_type,
      severityScore: severity_score,
      estimatedRepairCost: estimated_repair_cost,
      expectedProcessingDays: expected_processing_days,
      actualProcessingDays: actual_processing_days,
      summary: analysis_text || analysis_result || ''
    }
  );

  const finalAnalysisText = analysis_text || analysis_result || buildAnalysisText(normalizedStructured);

  const query = `
    INSERT INTO reports (
      user_id,
      defect_type,
      severity_score,
      estimated_repair_cost,
      expected_processing_days,
      actual_processing_days,
      analysis_text,
      analysis_json,
      image_data,
      image_url,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    user_id,
    normalizedStructured.defectType,
    normalizedStructured.severityScore,
    normalizedStructured.estimatedRepairCost,
    normalizedStructured.expectedProcessingDays,
    normalizedStructured.actualProcessingDays,
    finalAnalysisText,
    JSON.stringify(normalizedStructured),
    image_data || null,
    image_url,
    REPORT_STATUS.RECEIVED
  ];

  db.execute(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'DB 저장 실패', detail: err.message });
    }

    const historyQuery = `
      INSERT INTO report_status_history (report_id, status, changed_by, note)
      VALUES (?, ?, ?, ?)
    `;

    db.execute(
      historyQuery,
      [result.insertId, REPORT_STATUS.RECEIVED, user_id, '신고 최초 접수'],
      () => {
        res.json({ success: true, reportId: result.insertId });
      }
    );
  });
});

// [기능 5] 내 민원 접수 내역 조회 API
// [개선] 구조화된 분석 컬럼과 JSON 데이터를 함께 조회
app.get('/api/my-reports/:user_id', (req, res) => {
  const userId = req.params.user_id;
  const query = `
    SELECT
      id,
      user_id,
      defect_type,
      severity_score,
      estimated_repair_cost,
      expected_processing_days,
      actual_processing_days,
      analysis_text,
      analysis_json,
      image_data,
      image_url,
      status,
      received_at,
      processed_at,
      created_at,
      updated_at
    FROM reports
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.execute(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '목록 조회 실패' });
    }

    res.json(results.map(formatReportRow));
  });
});

// [기능 6] 관리자 전체 민원 내역 조회 API
app.get('/api/admin/all-reports', (req, res) => {
  const query = `
    SELECT
      r.id,
      r.user_id,
      r.defect_type,
      r.severity_score,
      r.estimated_repair_cost,
      r.expected_processing_days,
      r.actual_processing_days,
      r.analysis_text,
      r.analysis_json,
      r.image_data,
      r.image_url,
      r.status,
      r.received_at,
      r.processed_at,
      r.created_at,
      r.updated_at,
      u.name AS user_name
    FROM reports r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `;

  db.execute(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: '전체 목록 조회 실패' });
    }

    res.json(results.map(formatReportRow));
  });
});

// [기능 7] 관리자 하자 처리 상태 업데이트 API
// [개선] 처리 완료 시 처리일자/실제 처리기간을 함께 갱신하고 이력도 저장
app.put('/api/report-status/:id', (req, res) => {
  const reportId = req.params.id;
  const { status, changed_by = null, note = null } = req.body;

  const normalizedStatus = status || REPORT_STATUS.IN_REVIEW;
  const isCompleted = normalizedStatus === REPORT_STATUS.COMPLETED;

  const query = `
    UPDATE reports
    SET
      status = ?,
      processed_at = CASE WHEN ? THEN NOW() ELSE processed_at END,
      actual_processing_days = CASE
        WHEN ? THEN DATEDIFF(NOW(), received_at)
        ELSE actual_processing_days
      END
    WHERE id = ?
  `;

  db.execute(query, [normalizedStatus, isCompleted, isCompleted, reportId], (err) => {
    if (err) {
      return res.status(500).json({ error: '상태 업데이트 실패' });
    }

    const historyQuery = `
      INSERT INTO report_status_history (report_id, status, changed_by, note)
      VALUES (?, ?, ?, ?)
    `;

    db.execute(historyQuery, [reportId, normalizedStatus, changed_by, note], () => {
      res.json({ success: true, message: '상태가 변경되었습니다.' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
