import React, { useEffect, useState } from 'react';
import api from './src/api/client.js';
import AuthView from './src/components/AuthView.jsx';
import AdminDashboard from './src/components/AdminDashboard.jsx';
import UserDashboard from './src/components/UserDashboard.jsx';
import Toast from './src/components/Toast.jsx';
import { getStatusLabel } from './src/utils/status.js';

function makeToast(message, type = 'info') {
  return { id: Date.now(), message, type };
}

function ConstructionChatbot() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [authData, setAuthData] = useState({ userid: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageStatus, setImageStatus] = useState('idle');
  const [imageError, setImageError] = useState('');
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast(makeToast(message, type));
  };

  const fetchMyReports = async (userId) => {
    try {
      const targetId = userId || user?.id;
      const res = await api.get(`/api/my-reports/${targetId}`);
      setReports(res.data);
    } catch (error) {
      showToast(error.response?.data?.error || '민원 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const fetchAllReports = async () => {
    try {
      const res = await api.get('/api/admin/all-reports');
      setAllReports(res.data);
    } catch (error) {
      showToast(error.response?.data?.error || '관리자 목록을 불러오지 못했습니다.', 'error');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    const id = localStorage.getItem('userId');
    const savedRole = localStorage.getItem('userRole');

    if (!token) return;

    setIsLoggedIn(true);
    setUser({ name, id: Number(id) });
    setRole(savedRole);

    if (savedRole === 'admin') {
      fetchAllReports();
    } else {
      fetchMyReports(id);
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.put(`/api/report-status/${id}`, { status: newStatus });
      showToast(`상태가 [${getStatusLabel(newStatus)}]로 변경되었습니다.`, 'success');
      fetchAllReports();
    } catch (error) {
      showToast(error.response?.data?.error || '상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleAuth = async () => {
    const url = authView === 'login' ? '/api/login' : '/api/signup';

    try {
      const res = await api.post(url, authData);

      if (authView === 'signup') {
        showToast('회원가입이 완료되었습니다. 로그인해 주세요.', 'success');
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
      showToast(error.response?.data?.error || '오류가 발생했습니다.', 'error');
    }
  };

  const clearImages = () => {
    selectedImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setSelectedImages([]);
    setImageStatus('idle');
    setImageError('');
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUser(null);
    setRole(null);
    setMessages([]);
    setReports([]);
    setAllReports([]);
    clearImages();
  };

  // 프론트에서는 미리보기와 AI 분석용 base64를 만들고, 저장은 최적화된 File 객체로 보낸다.
  const prepareImageFile = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 선택할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSide = 1280;
        const scaleSize = Math.min(1, maxSide / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scaleSize);
        canvas.height = Math.round(img.height * scaleSize);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.72);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('이미지를 변환하지 못했습니다.'));
            return;
          }

          const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'defect-photo';
          const optimizedFile = new File([blob], `${normalizedName}.jpg`, { type: 'image/jpeg' });

          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            preview: URL.createObjectURL(optimizedFile),
            base64,
            file: optimizedFile,
            width: canvas.width,
            height: canvas.height
          });
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      img.src = loadEvent.target.result;
    };
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

  const handleImageFiles = async (files) => {
    const imageFiles = files.filter(Boolean);
    if (imageFiles.length === 0) return;

    setImageStatus('processing');
    setImageError('');

    try {
      const prepared = await Promise.all(imageFiles.map(prepareImageFile));
      setSelectedImages((prev) => {
        const next = [...prev, ...prepared].slice(0, 10);
        if (next.length < prev.length + prepared.length) {
          showToast('이미지는 최대 10장까지 등록할 수 있습니다.', 'info');
        }
        return next;
      });
      setImageStatus('ready');
    } catch (error) {
      setImageStatus('error');
      setImageError(error.message);
      showToast(error.message, 'error');
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    handleImageFiles(files);
  };

  const removeImage = (imageId) => {
    setSelectedImages((prev) => {
      const target = prev.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.preview);
      const next = prev.filter((image) => image.id !== imageId);
      setImageStatus(next.length > 0 ? 'ready' : 'idle');
      return next;
    });
  };

  const sendMessage = async () => {
    if (!input && selectedImages.length === 0) return;
    if (imageStatus === 'processing') {
      showToast('이미지를 준비하는 중입니다. 잠시 후 다시 시도해 주세요.', 'info');
      return;
    }

    setLoading(true);
    const userMessage = { role: 'user', content: input || '사진을 분석해 주세요.' };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');

    try {
      const res = await api.post('/api/chat', {
        messages: updatedMessages,
        image: selectedImages[0]?.base64
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
      showToast(error.response?.data?.error || '분석 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 민원 접수는 multipart/form-data로 여러 이미지를 전송해 서버 저장 구조와 맞춘다.
  const saveToDB = async (assistantMessage) => {
    const structured = assistantMessage.structuredResult || {};

    if (selectedImages.length === 0) {
      showToast('민원 접수를 위해 하자 사진을 선택해 주세요.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('user_id', user.id);
    formData.append('analysis_result', assistantMessage.content);
    formData.append('analysis_text', assistantMessage.content);
    formData.append('structured_analysis', JSON.stringify(structured));
    selectedImages.forEach((image) => {
      formData.append('images', image.file);
    });

    try {
      await api.post('/api/register-report', formData);
      showToast('민원이 정상적으로 접수되었습니다.', 'success');
      fetchMyReports();
    } catch (error) {
      showToast(error.response?.data?.error || '민원 접수에 실패했습니다.', 'error');
    }
  };

  if (!isLoggedIn) {
    return (
      <>
        <AuthView
          authView={authView}
          authData={authData}
          setAuthView={setAuthView}
          setAuthData={setAuthData}
          onSubmit={handleAuth}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  if (role === 'admin') {
    return (
      <>
        <AdminDashboard allReports={allReports} onLogout={handleLogout} onUpdateStatus={updateStatus} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <>
      <UserDashboard
        user={user}
        messages={messages}
        reports={reports}
        loading={loading}
        selectedImages={selectedImages}
        imageStatus={imageStatus}
        imageError={imageError}
        input={input}
        setInput={setInput}
        onLogout={handleLogout}
        onImageUpload={handleImageUpload}
        onImageDrop={handleImageFiles}
        onRemoveImage={removeImage}
        onClearImages={clearImages}
        onSendMessage={sendMessage}
        onSaveReport={saveToDB}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

export default ConstructionChatbot;
