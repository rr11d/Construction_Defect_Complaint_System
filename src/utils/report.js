import { API_BASE_URL } from '../api/client.js';

function getFirstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return value || '';
}

export function getReportImageSrc(report, imageIndex = 0) {
  const image = report.images?.[imageIndex];
  const imageSource = image?.image_url || report.image_url || report.image_data;

  if (!imageSource) {
    return '';
  }

  if (imageSource.startsWith('data:') || imageSource.startsWith('http')) {
    return imageSource;
  }

  return `${API_BASE_URL}${imageSource}`;
}

export function getReportSummary(report) {
  const analysis = report.analysis_json || {};
  const relatedLaws = normalizeTextList(analysis.relatedLaws);
  const repairMethods = normalizeTextList(analysis.repairMethods);

  return {
    defect: getFirstValue(report.defect_type, analysis.defectContent, analysis.defectType, '미분류'),
    severity: getFirstValue(report.severity_score, analysis.severityScore, '미정'),
    expectedSolution: getFirstValue(analysis.expectedSolution, repairMethods, analysis.summary, '검토 필요'),
    processingMethod: getFirstValue(analysis.processingMethod, '관리자 검토 후 처리'),
    laws: getFirstValue(relatedLaws, '확인 필요')
  };
}

export function formatReportPreview(report) {
  const summary = getReportSummary(report);

  return [
    `하자 내용: ${summary.defect}`,
    `심각도: ${summary.severity}`,
    `예상 해결 방법: ${summary.expectedSolution}`,
    `처리 방법: ${summary.processingMethod}`,
    `관련 법규: ${summary.laws}`
  ].join('\n');
}
