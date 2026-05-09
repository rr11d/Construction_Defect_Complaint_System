import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

const STATUS_COLORS = {
  '접수': '#f39c12',
  '검토중': '#2980b9',
  '보수중': '#8e44ad',
  '처리완료': '#27ae60',
  '반려': '#c0392b'
};

// 저장된 구조화 데이터만 있어도 카드 미리보기를 만들 수 있도록 변환
function formatReportPreview(report) {
  if (report.analysis_result) {
    return report.analysis_result;
  }

  const analysis = report.analysis_json || {};
  const repairMethods = Array.isArray(analysis.repairMethods)
    ? analysis.repairMethods.join(', ')
    : '';

  return [
    `하자 유형: ${report.defect_type || analysis.defectType || '미분류'}`,
    `심각도: ${report.severity_score ?? analysis.severityScore ?? '미정'}`,
    `예상 처리 기간: ${report.expected_processing_days ?? analysis.expectedProcessingDays ?? '미정'}일`,
    repairMethods ? `권장 보수 방법: ${repairMethods}` : ''
  ].filter(Boolean).join('\n');
}

function ConstructionChatbot() {
  // --- 1. 상태 관리 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [authData, setAuthData] = useState({ userid: '', password: '', name: '' });
  // 공통 상태
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentImageBase64, setCurrentImageBase64] = useState(null);
  // 사용자용 상태
  const [reports, setReports] = useState([]);
  // 관리자용 상태
  const [allReports, setAllReports] = useState([]);

  // 페이지 로드 시 로그인 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    const id = localStorage.getItem('userId');
    const savedRole = localStorage.getItem('userRole');

    if (!token) return;

    setIsLoggedIn(true);
    setUser({ name, id });
    setRole(savedRole);

    if (savedRole === 'admin') {
      fetchAllReports();
    } else {
      fetchMyReports(id);
    }
  }, []);

  // --- 2. 데이터 가져오기 API ---

  // [사용자용] 내 민원 접수 내역 가져오기
  const fetchMyReports = async (userId) => {
    try {
      const targetId = userId || user?.id;
      const res = await axios.get(`${API_BASE_URL}/api/my-reports/${targetId}`);
      setReports(res.data);
    } catch (error) {
      console.error('Failed to load reports', error);
    }
  };

  // [관리자용] 전체 민원 접수 내역 가져오기
  const fetchAllReports = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/all-reports`);
      setAllReports(res.data);
    } catch (error) {
      console.error('Failed to load admin reports', error);
    }
  };

  // [관리자용] 민원 처리 상태 업데이트
  const updateStatus = async (id, newStatus) => {
    try {
      await axios.put(`${API_BASE_URL}/api/report-status/${id}`, { status: newStatus });
      alert(`상태가 [${newStatus}]로 변경되었습니다.`);
      fetchAllReports();
    } catch (error) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  // --- 3. 인증 로직 (로그인/회원가입) ---
  const handleAuth = async () => {
    const url = authView === 'login' ? '/api/login' : '/api/signup';

    try {
      const res = await axios.post(`${API_BASE_URL}${url}`, authData);

      if (authView === 'signup') {
        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        setAuthView('login');
        return;
      }

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userName', res.data.name);
      localStorage.setItem('userId', res.data.id);
      localStorage.setItem('userRole', res.data.role);

      setUser({ name: res.data.name, id: res.data.id });
      setRole(res.data.role);
      setIsLoggedIn(true);

      if (res.data.role === 'admin') {
        fetchAllReports();
      } else {
        fetchMyReports(res.data.id);
      }
    } catch (error) {
      alert(error.response?.data?.error || '오류가 발생했습니다.');
    }
  };

  // 로그아웃 시 세션 및 화면 상태 초기화
  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
    setRole(null);
    setMessages([]);
    setReports([]);
    setAllReports([]);
    setPreview(null);
    setCurrentImageBase64(null);
  };

  // --- 4. 사용자 전용 기능 (이미지 업로드/AI 분석/DB 저장) ---

  // 이미지 업로드 후 미리보기와 base64 데이터 생성
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.src = loadEvent.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setCurrentImageBase64(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  };

  // AI 채팅 요청
  // [개선] 화면용 텍스트와 구조화된 JSON 응답을 함께 보관
  const sendMessage = async () => {
    if (!input && !currentImageBase64) return;

    setLoading(true);
    const userMessage = { role: 'user', content: input || '사진을 분석해주세요.' };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/chat`, {
        messages: updatedMessages,
        image: currentImageBase64
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.result,
          structuredResult: res.data.structuredResult || null
        }
      ]);
    } catch (error) {
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // [개선] 기존 분석 텍스트와 함께 구조화된 분석 결과도 DB로 저장
  const saveToDB = async (assistantMessage) => {
    const structured = assistantMessage.structuredResult || {};

    try {
      await axios.post(`${API_BASE_URL}/api/register-report`, {
        user_id: user.id,
        analysis_result: assistantMessage.content,
        analysis_text: assistantMessage.content,
        structured_analysis: structured,
        defect_type: structured.defectType,
        severity_score: structured.severityScore,
        estimated_repair_cost: structured.estimatedRepairCost,
        expected_processing_days: structured.expectedProcessingDays,
        actual_processing_days: structured.actualProcessingDays,
        image_data: currentImageBase64
      });

      alert('민원이 정상적으로 접수되었습니다.');
      fetchMyReports();
    } catch (error) {
      alert('DB 저장에 실패했습니다.');
    }
  };

  // --- 5. UI 분기 조건문 ---

  // [1] 로그인/회원가입 화면
  if (!isLoggedIn) {
    return (
      <div style={{ padding: '50px', maxWidth: '400px', margin: 'auto' }}>
        <h2>{authView === 'login' ? '로그인' : '회원가입'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {authView === 'signup' && (
            <input
              placeholder="이름"
              onChange={(event) => setAuthData({ ...authData, name: event.target.value })}
            />
          )}
          <input
            placeholder="아이디"
            onChange={(event) => setAuthData({ ...authData, userid: event.target.value })}
          />
          <input
            type="password"
            placeholder="비밀번호"
            onChange={(event) => setAuthData({ ...authData, password: event.target.value })}
          />
          <button onClick={handleAuth}>
            {authView === 'login' ? '로그인' : '가입하기'}
          </button>
          <p
            onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}
            style={{ cursor: 'pointer', textAlign: 'center', color: 'blue' }}
          >
            {authView === 'login'
              ? '계정이 없으신가요? 회원가입'
              : '이미 계정이 있나요? 로그인'}
          </p>
        </div>
      </div>
    );
  }

  // [2] 관리자 화면
  if (role === 'admin') {
    return (
      <div style={{ padding: '20px', maxWidth: '1000px', margin: 'auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '2px solid red',
            paddingBottom: '10px'
          }}
        >
          <h2>관리자 대시보드</h2>
          <button onClick={handleLogout}>로그아웃</button>
        </header>
        <p>접수된 건설 하자 민원의 처리 현황을 관리합니다.</p>

        <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead style={{ backgroundColor: '#f4f4f4' }}>
            <tr>
              <th>번호</th>
              <th>작성자</th>
              <th>사진</th>
              <th>하자 유형</th>
              <th>분석 요약</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {allReports.map((report) => (
              <tr key={report.id} style={{ textAlign: 'center' }}>
                <td>{report.id}</td>
                <td>{report.user_name}</td>
                <td>
                  <img src={report.image_data || report.image_url} width="60" alt="하자" />
                </td>
                <td>{report.defect_type || report.analysis_json?.defectType || '미분류'}</td>
                <td style={{ fontSize: '12px', textAlign: 'left', padding: '5px' }}>
                  {formatReportPreview(report).substring(0, 80)}...
                </td>
                <td style={{ fontWeight: 'bold', color: STATUS_COLORS[report.status] || '#f39c12' }}>
                  {report.status}
                </td>
                <td>
                  <button onClick={() => updateStatus(report.id, '보수중')}>보수중</button>
                  <button onClick={() => updateStatus(report.id, '처리완료')}>완료</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // [3] 일반 사용자 화면
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #ddd',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '80px' }} />
          <h2 style={{ margin: 0 }}>{user.name}님의 건설 하자 진단 챗봇</h2>
        </div>
        <button onClick={handleLogout}>로그아웃</button>
      </header>

      <div
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid #eee',
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '10px'
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '10px',
                borderRadius: '10px',
                backgroundColor: msg.role === 'user' ? '#007bff' : '#f1f1f1',
                color: msg.role === 'user' ? '#fff' : '#000',
                maxWidth: '80%',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.content}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => saveToDB(msg)}
                  style={{ display: 'block', marginTop: '10px', fontSize: '12px', cursor: 'pointer' }}
                >
                  민원 접수
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <p>AI가 분석 중입니다...</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="file" onChange={handleImageUpload} accept="image/*" />
          {preview && (
            <img
              src={preview}
              alt="preview"
              style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <input
            style={{ flex: 1, padding: '10px' }}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="질문을 입력하세요."
            onKeyPress={(event) => event.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} disabled={loading} style={{ padding: '0 20px' }}>
            전송
          </button>
        </div>
      </div>

      <div style={{ borderTop: '2px solid #333', paddingTop: '20px' }}>
        <h3>나의 하자 접수 내역 ({reports.length}건)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginTop: '15px' }}>
          {reports.length === 0 ? (
            <p style={{ color: '#888' }}>아직 접수된 내역이 없습니다.</p>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                style={{
                  display: 'flex',
                  gap: '15px',
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <img
                  src={report.image_data || report.image_url}
                  alt="하자"
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '5px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                    <span>접수 번호: #{report.id}</span>
                    <span>{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                  <div
                    style={{
                      fontWeight: 'bold',
                      margin: '5px 0',
                      color: STATUS_COLORS[report.status] || '#f39c12'
                    }}
                  >
                    상태: {report.status}
                  </div>
                  <div style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap' }}>
                    {formatReportPreview(report)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ConstructionChatbot;
