import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, Loader2, Trash2, MessageSquare, Sparkles, LogOut, User, History, Lock, Link, Globe } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const RAGDocumentQA = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [file, setFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ragType, setRagType] = useState('basic');
  const [stats, setStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('rag_token');
    const savedUser = localStorage.getItem('rag_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
      loadHistory(savedToken);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAuthSubmit = async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body = authMode === 'login' 
        ? { username: authForm.username, password: authForm.password }
        : authForm;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Fallback
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Đăng nhập/đăng ký thất bại');
      }

      const data = await response.json();
      
      setToken(data.token);
      setCurrentUser({ username: data.username, email: data.email });
      setIsAuthenticated(true);
      
      localStorage.setItem('rag_token', data.token);
      localStorage.setItem('rag_user', JSON.stringify({ username: data.username, email: data.email }));
      
      loadHistory(data.token);
      
      setAuthForm({ username: '', email: '', password: '' });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'token': token 
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('rag_token');
      localStorage.removeItem('rag_user');
      setFile(null);
      setMessages([]);
      setHistory([]);
      setStats(null);
    }
  };

  const loadHistory = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/history`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'token': authToken 
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Load history error:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'token': token 
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const data = await response.json();
      setFile(uploadedFile);
      setStats(data);
      setUploadMode('file');
      
      setMessages([{
        type: 'system',
        content: `✅ Đã tải lên: ${data.source || data.filename}\n📊 ${data.chunks} chunks, ${data.word_count} từ\n${data.source_type === 'url' ? '🌐 Web URL' : '📄 File'}`
      }]);
    } catch (error) {
      setMessages([{
        type: 'error',
        content: `❌ ${error.message}`
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('url', urlInput.trim());

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'token': token 
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const data = await response.json();
      setFile({ name: data.source });
      setStats(data);
      setUploadMode('url');
      setUrlInput('');
      
      setMessages([{
        type: 'system',
        content: `✅ Đã tải lên: ${data.source}\n📊 ${data.chunks} chunks, ${data.word_count} từ\n🌐 Web URL`
      }]);
    } catch (error) {
      setMessages([{
        type: 'error',
        content: `❌ ${error.message}`
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || loading) return;

    const userQuestion = question.trim();
    setQuestion('');
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: userQuestion
    }]);

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'token': token
        },
        body: JSON.stringify({
          question: userQuestion,
          rag_type: ragType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Query failed');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
      
      loadHistory(token);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: `❌ ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await fetch(`${API_URL}/clear`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'token': token 
        }
      });
      setFile(null);
      setMessages([]);
      setStats(null);
      setUrlInput('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadMode('file');
    } catch (error) {
      console.error('Clear failed:', error);
    }
  };

  const ragMethods = [
    { value: 'basic', label: 'Basic RAG', desc: 'Tìm kiếm cơ bản', icon: '🔍' },
    { value: 'multi_query', label: 'Multi-Query', desc: 'Nhiều truy vấn', icon: '🔄' },
    { value: 'hyde', label: 'HyDE', desc: 'Giả thuyết văn bản', icon: '💡' }
  ];

  const getStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/status`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'token': token 
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
    return null;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl mb-4 shadow-2xl">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              RAG Document Q&A
            </h1>
            <p className="text-gray-600">AI-Powered Document Intelligence</p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Đăng nhập
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  authMode === 'register'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Đăng ký
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleAuthSubmit()}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleAuthSubmit()}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleAuthSubmit()}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {authError}
                </div>
              )}

              <button
                onClick={handleAuthSubmit}
                disabled={authLoading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                RAG Document Q&A
              </h1>
              <p className="text-gray-600">Xin chào, {currentUser?.username}!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-gray-700"
            >
              <History className="w-5 h-5" />
              Lịch sử
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-red-600"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Lịch sử hỏi đáp</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
                    <div className="text-xs text-gray-500 mb-2">
                      {new Date(item.created_at).toLocaleString('vi-VN')}
                    </div>
                    <div className="font-semibold text-gray-800 mb-2 line-clamp-2">
                      Q: {item.question}
                    </div>
                    <div className="text-sm text-gray-600 line-clamp-3 mb-2">
                      A: {item.answer}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.rag_type === 'basic' ? 'bg-blue-100 text-blue-800' :
                        item.rag_type === 'multi_query' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {item.rag_type}
                      </span>
                      <span className="flex items-center gap-1">
                        {item.source_type === 'url' ? <Globe className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {item.document_name}
                      </span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Chưa có lịch sử hỏi đáp
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!file ? (
          <div className="bg-white rounded-3xl shadow-2xl p-12 mb-8 border-2 border-dashed border-gray-200 hover:border-blue-400 transition-all">
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 p-4 rounded-xl font-semibold transition-all ${
                  uploadMode === 'file'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Upload className="w-6 h-6 inline mr-2" />
                Tải file lên
              </button>
              <button
                onClick={() => setUploadMode('url')}
                className={`flex-1 p-4 rounded-xl font-semibold transition-all ${
                  uploadMode === 'url'
                    ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Globe className="w-6 h-6 inline mr-2" />
                Web URL
              </button>
            </div>

            {uploadMode === 'file' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer group">
                  <div className="w-28 h-28 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all">
                    {uploading ? (
                      <Loader2 className="w-14 h-14 text-blue-600 animate-spin" />
                    ) : (
                      <Upload className="w-14 h-14 text-blue-600" />
                    )}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                    {uploading ? 'Đang xử lý...' : 'Tải lên tài liệu'}
                  </h3>
                  <p className="text-gray-500 text-center text-lg">
                    Hỗ trợ: TXT, Markdown, PDF<br />
                    <span className="text-sm text-gray-400">Click hoặc kéo thả file vào đây</span>
                  </p>
                </label>
              </>
            ) : (
              <div className="space-y-4">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUrlUpload()}
                  placeholder="https://example.com/article"
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  disabled={uploading}
                />
                <button
                  onClick={handleUrlUpload}
                  disabled={!urlInput.trim() || uploading}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang tải trang web...
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5" />
                      Phân tích URL
                    </>
                  )}
                </button>
                <div className="text-xs text-gray-500 text-center">
                  Hỗ trợ các trang web, bài viết, blog, documentation
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                        {stats?.source_type === 'url' ? (
                          <Globe className="w-7 h-7" />
                        ) : (
                          <FileText className="w-7 h-7" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl">{file.name || stats?.source}</h3>
                        <p className="text-white/90 text-sm">
                          {stats?.chunks} chunks • {stats?.word_count} từ •{' '}
                          <span className="capitalize">{stats?.source_type}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClearChat}
                      className="p-3 hover:bg-white/20 rounded-xl transition-colors"
                      title="Xóa tài liệu"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="h-[500px] overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <MessageSquare className="w-20 h-20 mb-4 opacity-50" />
                      <p className="text-xl">Bắt đầu đặt câu hỏi về tài liệu</p>
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`mb-6 ${msg.type === 'user' ? 'flex justify-end' : ''}`}>
                      {msg.type === 'system' && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-xl p-4 max-w-2xl">
                          <pre className="text-sm whitespace-pre-wrap font-sans">{msg.content}</pre>
                        </div>
                      )}
                      
                      {msg.type === 'error' && (
                        <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 text-red-700 max-w-2xl">
                          {msg.content}
                        </div>
                      )}
                      
                      {msg.type === 'user' && (
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-5 py-3 max-w-lg shadow-xl">
                          {msg.content}
                        </div>
                      )}
                      
                      {msg.type === 'assistant' && (
                        <div className="max-w-2xl">
                          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-lg">
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          </div>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                📚 Nguồn tham khảo ({msg.sources.length} đoạn):
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {msg.sources.slice(0, 3).map((source, i) => (
                                  <div key={i} className="text-xs bg-white p-2 rounded border text-gray-700 line-clamp-2">
                                    "{source}"
                                  </div>
                                ))}
                                {msg.sources.length > 3 && (
                                  <div className="text-xs text-gray-500 text-center">+{msg.sources.length - 3} nguồn khác</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex items-center gap-3 text-gray-500 bg-white rounded-2xl p-4 shadow-lg">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>AI đang phân tích và trả lời... (RAG: {ragType})</span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-6 bg-white border-t-2 border-gray-100">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="Đặt câu hỏi về tài liệu..."
                      className="flex-1 px-5 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      disabled={loading}
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!question.trim() || loading}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl flex items-center gap-3 font-semibold"
                    >
                      {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Send className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-end mt-3 text-xs text-gray-500">
                    RAG Method: <span className="font-semibold ml-1 capitalize">{ragType}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{currentUser?.username}</div>
                    <div className="text-sm text-gray-500">{currentUser?.email}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                  🎯 RAG Method
                </h3>
                <div className="space-y-3">
                  {ragMethods.map(method => (
                    <button
                      key={method.value}
                      onClick={() => setRagType(method.value)}
                      className={`w-full text-left p-4 rounded-xl transition-all group ${
                        ragType === method.value
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-2 border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg">{method.icon}</span>
                        <span className="font-semibold">{method.label}</span>
                      </div>
                      <div className={`text-sm ${
                        ragType === method.value ? 'text-white/80' : 'text-gray-500'
                      }`}>
                        {method.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800">💡 Hỗ trợ</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-1">•</span>
                    <span>📄 TXT, MD, PDF files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-1">•</span>
                    <span>🌐 Web URLs (articles, blogs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold mt-1">•</span>
                    <span>3 RAG methods thông minh</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 font-bold mt-1">•</span>
                    <span>Lịch sử tự động lưu trữ</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGDocumentQA;
