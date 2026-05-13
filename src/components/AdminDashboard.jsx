import { useEffect, useState } from 'react';
import AppShell from './AppShell.jsx';
import AnalysisSummary from './AnalysisSummary.jsx';
import ImagePreviewModal from './ImagePreviewModal.jsx';
import { getReportImageSrc, getReportSummary } from '../utils/report.js';
import { getStatusLabel, getStatusTone, STATUS_OPTIONS } from '../utils/status.js';

export default function AdminDashboard({ allReports, onLogout, onUpdateStatus }) {
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!selectedImage) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  return (
    <AppShell>
      <main className="page page-wide">
        <header className="topbar topbar-actions">
          <button className="button button-secondary" onClick={onLogout}>로그아웃</button>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1>관리자 민원 관리</h1>
            <p>접수된 건설 하자 민원의 처리 현황을 확인하고 상태를 변경합니다.</p>
          </div>
          <div className="metric-box">
            <span>전체 민원</span>
            <strong>{allReports.length}</strong>
          </div>
        </section>

        <section className="table-section" aria-label="전체 민원 목록">
          <div className="section-header">
            <h2>접수 목록</h2>
            <p>최근 접수 순으로 표시됩니다.</p>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>작성자</th>
                  <th>사진</th>
                  <th>하자 내용</th>
                  <th>분석 요약</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {allReports.length === 0 ? (
                  <tr>
                    <td className="empty-cell" colSpan="6">접수된 민원이 없습니다.</td>
                  </tr>
                ) : (
                  allReports.map((report) => {
                    const imageSrc = getReportImageSrc(report);
                    const imageCount = report.images?.length || (imageSrc ? 1 : 0);

                    return (
                      <tr key={report.id}>
                        <td>#{report.id}</td>
                        <td>{report.user_name}</td>
                        <td>
                          <button
                            className="image-thumb-button"
                            type="button"
                            disabled={!imageSrc}
                            onClick={() => setSelectedImage({ src: imageSrc, title: `#${report.id} 하자 사진` })}
                            aria-label={`#${report.id} 하자 사진 크게 보기`}
                          >
                            <img className="thumb thumb-small" src={imageSrc} alt="하자" />
                            {imageCount > 1 && <span className="image-count-badge">+{imageCount - 1}</span>}
                          </button>
                        </td>
                        <td className="defect-cell">{getReportSummary(report).defect}</td>
                        <td className="summary-cell">
                          <AnalysisSummary report={report} />
                        </td>
                        <td>
                          <label className={`status-select-wrap ${getStatusTone(report.status)}`}>
                            <select
                              className="status-select"
                              value={report.status}
                              onChange={(event) => onUpdateStatus(report.id, event.target.value)}
                              aria-label={`#${report.id} 상태 변경`}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {getStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <ImagePreviewModal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </AppShell>
  );
}
