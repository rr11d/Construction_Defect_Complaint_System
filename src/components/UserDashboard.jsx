import { useState } from 'react';
import AppShell from './AppShell.jsx';
import { formatReportPreview, getReportImageSrc } from '../utils/report.js';
import { getStatusLabel, getStatusTone } from '../utils/status.js';

export default function UserDashboard({
  user,
  messages,
  reports,
  loading,
  selectedImages,
  imageStatus,
  imageError,
  input,
  setInput,
  onLogout,
  onImageUpload,
  onImageDrop,
  onRemoveImage,
  onClearImages,
  onSendMessage,
  onSaveReport
}) {
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDraggingImage(true);
  };

  const handleDragLeave = () => {
    setIsDraggingImage(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingImage(false);
    onImageDrop(Array.from(event.dataTransfer.files || []));
  };

  return (
    <AppShell>
      <main className="page">
        <header className="topbar topbar-actions">
          <button className="button button-secondary" onClick={onLogout}>로그아웃</button>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow">User dashboard</p>
            <h1>{user.name}님의 하자 진단</h1>
            <p>사진을 업로드하고 AI 분석 결과를 민원으로 접수하세요.</p>
          </div>
          <div className="metric-box">
            <span>내 민원</span>
            <strong>{reports.length}</strong>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="analysis-panel">
            <div className="section-header">
              <h2>AI 분석 요청</h2>
              <p>사진과 질문을 함께 보내면 분석 정확도가 좋아집니다.</p>
            </div>

            <div className="chat-window">
              {messages.length === 0 && (
                <div className="empty-state">
                  <strong>아직 분석 요청이 없습니다.</strong>
                  <span>하자 사진을 선택하고 질문을 입력해 주세요.</span>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`message-row message-${msg.role}`}>
                  <div className="message-bubble">
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <button className="button button-small button-primary save-button" onClick={() => onSaveReport(msg)}>
                        민원 접수
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && <p className="loading-text">AI가 분석 중입니다...</p>}
            </div>

            <div
              className={`upload-preview ${selectedImages.length > 0 ? 'has-image' : ''} ${isDraggingImage ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedImages.length > 0 ? (
                <>
                  <div className="upload-preview-grid">
                    {selectedImages.map((image, index) => (
                      <div className="upload-preview-tile" key={image.id}>
                        <img className="thumb upload-preview-image" src={image.preview} alt={`선택한 하자 사진 ${index + 1}`} />
                        <button type="button" onClick={() => onRemoveImage(image.id)} aria-label="사진 삭제">삭제</button>
                      </div>
                    ))}
                  </div>
                  <div className="upload-preview-body">
                    <strong>{selectedImages.length}장 선택됨</strong>
                    <span>
                      {imageStatus === 'processing' && '이미지를 준비하는 중입니다.'}
                      {imageStatus === 'ready' && '분석용 이미지 준비 완료'}
                      {imageStatus === 'error' && imageError}
                    </span>
                  </div>
                  <button className="button button-small button-secondary" type="button" onClick={onClearImages}>
                    전체 삭제
                  </button>
                </>
              ) : (
                <div className="upload-preview-empty">
                  <strong>선택된 사진이 없습니다.</strong>
                  <span>사진을 여러 장 선택하거나 이 영역에 끌어다 놓으세요.</span>
                </div>
              )}
            </div>

            <div className="composer">
              <label className="upload-box">
                <input type="file" onChange={onImageUpload} accept="image/*" capture="environment" multiple />
                <span>사진 선택</span>
              </label>
              <input
                className="composer-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="질문을 입력하세요"
                onKeyDown={(event) => event.key === 'Enter' && onSendMessage()}
              />
              <button className="button button-primary" onClick={onSendMessage} disabled={loading || imageStatus === 'processing'}>
                전송
              </button>
            </div>
          </div>

          <aside className="history-panel">
            <div className="section-header">
              <h2>접수 내역</h2>
              <p>나의 민원 처리 상태를 확인합니다.</p>
            </div>

            <div className="report-list">
              {reports.length === 0 ? (
                <div className="empty-state compact">
                  <strong>접수 내역 없음</strong>
                  <span>분석 후 민원을 접수하면 여기에 표시됩니다.</span>
                </div>
              ) : (
                reports.map((report) => (
                  <article className="report-item" key={report.id}>
                    <img className="thumb thumb-report" src={getReportImageSrc(report)} alt="하자" />
                    <div className="report-body">
                      <div className="report-meta">
                        <span>#{report.id}</span>
                        <span>{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      <span className={`status-badge ${getStatusTone(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                      <p>{formatReportPreview(report)}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
