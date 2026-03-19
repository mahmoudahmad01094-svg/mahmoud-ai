/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Send, Bot, User, Sparkles, Image as ImageIcon, Loader2, Trash2, 
  Menu, Plus, LogIn, LogOut, Mail, Lock, Chrome, X, ChevronRight, 
  Wand2, Copy, Check, RefreshCw, Settings, History, MessageSquare,
  MoreVertical, Book, ChevronDown, FileText, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  serverTimestamp, doc, getDocs, updateDoc, deleteDoc, getDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key" });

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: any;
  image?: string;
  isImageGen?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: any;
}

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'الأسرع للمهام اليومية' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'الأذكى للمهام المعقدة' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'متوازن بين السرعة والذكاء' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Image', desc: 'الأفضل لتوليد الصور' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', desc: 'جودة صور فائقة' }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error'}[]>([
    { id: 'welcome-toast', message: 'مرحباً بك في MahmoudAi v2.0', type: 'success' }
  ]);
  const [chatMode, setChatMode] = useState<'chat' | 'image' | 'code' | 'search'>('chat');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isProMode, setIsProMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-hide welcome toast after 1s
  useEffect(() => {
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== 'welcome-toast'));
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setChats([]);
        setMessages([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load User Chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatSession[];
      setChats(chatList);
    }, (error) => {
      handleFirestoreError(error, 'list', 'chats');
    });

    return () => unsubscribe();
  }, [user]);

  const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    
    // Don't log or throw if it's just a permission denied on a listener that might be transient
    if (errInfo.error.toLowerCase().includes('permission') || errInfo.error.toLowerCase().includes('insufficient')) {
      return;
    }

    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  // Load Messages for Current Chat
  useEffect(() => {
    if (!currentChatId || !user) return;

    const path = `chats/${currentChatId}/messages`;
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, 'list', path);
    });

    return () => unsubscribe();
  }, [currentChatId, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createNewChat = async (firstMessage: string) => {
    if (!user) return null;
    const chatDoc = await addDoc(collection(db, 'chats'), {
      userId: user.uid,
      title: firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setCurrentChatId(chatDoc.id);
    return chatDoc.id;
  };

  const saveMessage = async (chatId: string, msg: Omit<Message, 'id'>) => {
    const path = `chats/${chatId}/messages`;
    try {
      // Remove undefined fields for Firestore
      const cleanMsg = Object.fromEntries(
        Object.entries(msg).filter(([_, v]) => v !== undefined)
      );
      
      await addDoc(collection(db, path), {
        ...cleanMsg,
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'chats', chatId), {
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', path);
    }
  };

  // Handle Scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = async (forcedImageGen = false) => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const isImageMode = forcedImageGen || chatMode === 'image';
    const isSearchMode = chatMode === 'search';
    const isCodeMode = chatMode === 'code';

    let chatId = currentChatId;
    if (!chatId && user) {
      chatId = await createNewChat(input || (isImageMode ? "صورة جديدة" : "محادثة جديدة"));
    }

    const userMsgData: Omit<Message, 'id'> = {
      role: 'user',
      text: input,
      timestamp: new Date(),
      image: selectedImage || undefined,
    };

    if (chatId) {
      await saveMessage(chatId, userMsgData);
    } else {
      // Guest mode (local only)
      setMessages(prev => [...prev, { ...userMsgData, id: Date.now().toString() }]);
    }

    const currentInput = input;
    const currentImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let responseText = "";
      let generatedImageUrl = "";

      const activeModelId = isProMode ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';

      if (isImageMode || selectedModel.id.includes('image')) {
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image', // Nano Banana technology
          contents: {
            parts: [{ text: `Generate a high-quality, professional, artistic image of: ${currentInput}` }],
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          } else if (part.text) {
            responseText = part.text;
          }
        }
      } else {
        let response: GenerateContentResponse;
        const systemInstruction = isCodeMode 
          ? "You are an expert software engineer. Provide clean, efficient, and well-documented code. Explain your logic clearly."
          : isSearchMode 
            ? "You are a helpful assistant with access to real-time information. Use Google Search to provide accurate and up-to-date answers."
            : "You are a helpful assistant.";

        const tools = isSearchMode ? [{ googleSearch: {} }] : undefined;

        if (currentImage) {
          const base64Data = currentImage.split(',')[1];
          const imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: "image/png",
            },
          };
          response = await genAI.models.generateContent({
            model: activeModelId,
            contents: { parts: [{ text: currentInput || "حلل هذه الصورة بالتفصيل." }, imagePart] },
            config: { systemInstruction, tools }
          });
        } else {
          response = await genAI.models.generateContent({
            model: activeModelId,
            contents: currentInput,
            config: { systemInstruction, tools }
          });
        }
        responseText = response.text || "عذراً، لم أتمكن من معالجة طلبك حالياً.";
      }

      const botMsgData: Omit<Message, 'id'> = {
        role: 'bot',
        text: responseText,
        image: generatedImageUrl || undefined,
        timestamp: new Date(),
        isImageGen: isImageMode
      };

      if (chatId) {
        await saveMessage(chatId, botMsgData);
      } else {
        setMessages(prev => [...prev, { ...botMsgData, id: (Date.now() + 1).toString() }]);
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      
      const errorMsg: Omit<Message, 'id'> = {
        role: 'bot',
        text: "واجهت مشكلة في الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.",
        timestamp: new Date(),
      };
      if (chatId) {
        await saveMessage(chatId, errorMsg);
      } else {
        setMessages(prev => [...prev, { ...errorMsg, id: (Date.now() + 1).toString() }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setCurrentChatId(null);
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        text: 'مرحباً بك في MahmoudAi. أنا هنا لمساعدتك في التفكير، الإبداع، وتوليد الصور. كيف يمكنني خدمتك اليوم؟',
        timestamp: new Date(),
      },
    ]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      addToast('تم حذف المحادثة', 'success');
      if (currentChatId === chatId) {
        clearChat();
      }
    } catch (error) {
      console.error("Delete Error:", error);
      addToast('فشل حذف المحادثة', 'error');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast('تم نسخ النص بنجاح');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsAuthModalOpen(false);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setIsAuthModalOpen(false);
    } catch (error) {
      alert("خطأ: " + (error as Error).message);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 overflow-hidden" dir="rtl">
      
      {/* Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`px-4 py-2 rounded-xl shadow-2xl border backdrop-blur-md flex items-center gap-2 text-sm font-medium ${
                toast.type === 'success' 
                  ? 'bg-emerald-500/20 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/20 border-red-500/20 text-red-400'
              }`}
            >
              {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 h-full w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">MahmoudAi</h1>
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Premium Intelligence</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-white/5 rounded-lg">
              <X size={20} />
            </button>
          </div>
          
          <button 
            onClick={clearChat}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-xl shadow-white/5 active:scale-[0.98]"
          >
            <Plus size={18} />
            محادثة جديدة
          </button>

          {/* Search Bar */}
          <div className="relative group">
            <input 
              type="text"
              placeholder="بحث في المحادثات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all text-right"
            />
            <MessageSquare size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <div className="text-[10px] uppercase tracking-widest text-white/30 px-3 mb-2">المحادثات السابقة</div>
          <div className="space-y-1">
            {filteredChats.length > 0 ? filteredChats.map((chat) => (
              <div 
                key={chat.id} 
                onClick={() => {
                  setCurrentChatId(chat.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-right group relative cursor-pointer ${
                  currentChatId === chat.id ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`}
              >
                <MessageSquare size={16} className={`shrink-0 ${currentChatId === chat.id ? 'text-emerald-500' : 'text-white/20'}`} />
                <span className="truncate flex-1 font-medium">{chat.title}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(e, chat.id);
                  }}
                  className="p-1.5 text-white/20 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
                {currentChatId === chat.id && (
                  <motion.div layoutId="active-chat" className="absolute right-0 w-1 h-6 bg-emerald-500 rounded-l-full" />
                )}
              </div>
            )) : (
              <div className="px-3 py-12 text-center opacity-20">
                <p className="text-xs">{searchQuery ? 'لا توجد نتائج' : 'لا توجد محادثات بعد'}</p>
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          {user ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                <User size={20} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName || user.email?.split('@')[0]}</p>
                <button onClick={() => signOut(auth)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">تسجيل الخروج</button>
              </div>
              <Settings size={16} className="text-white/30 hover:text-white cursor-pointer" />
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-xl text-sm font-medium text-emerald-400 transition-all"
            >
              <LogIn size={18} />
              <span>تسجيل الدخول</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-[#050505] overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-emerald-500/5 blur-[120px] pointer-events-none" />
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-2xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-white/5 rounded-lg">
              <Menu size={20} />
            </button>
            
            {/* Model Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold tracking-tight">{selectedModel.name}</span>
                <ChevronDown size={14} className={`transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isModelSelectorOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-64 bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl p-2 z-50"
                  >
                    {MODELS.map((m) => (
                      <button 
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m);
                          setIsModelSelectorOpen(false);
                        }}
                        className={`w-full flex flex-col items-start gap-0.5 p-3 rounded-xl transition-all text-right ${
                          selectedModel.id === m.id ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-white/60'
                        }`}
                      >
                        <span className="text-sm font-bold">{m.name}</span>
                        <span className="text-[10px] opacity-60">{m.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Sparkles className="text-emerald-400 w-3 h-3" />
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">MahmoudAi v2.1</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
              <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">MAI</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar relative"
        >
          {!currentChatId && messages.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-10">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20"
              >
                <Sparkles className="text-white w-12 h-12" />
              </motion.div>
              <div className="space-y-3">
                <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">كيف يمكنني مساعدتك اليوم؟</h2>
                <p className="text-white/40 max-w-md mx-auto text-sm leading-relaxed">أنا MahmoudAi، مساعدك الذكي المتطور. يمكنني كتابة الأكواد، تحليل الصور، وتوليد الفنون الرقمية.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                {[
                  { icon: Wand2, text: "صمم لي شعاراً عصرياً لشركة تقنية", color: "text-cyan-400" },
                  { icon: MessageSquare, text: "اشرح لي نظرية النسبية ببساطة", color: "text-emerald-400" },
                  { icon: ImageIcon, text: "حلل هذه الصورة واستخرج النص منها", color: "text-purple-400" },
                  { icon: FileText, text: "اكتب لي خطة عمل لمشروع جديد", color: "text-amber-400" }
                ].map((item, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(item.text)}
                    className="flex items-center gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.06] hover:border-white/10 transition-all text-right group"
                  >
                    <div className={`p-2 rounded-xl bg-white/5 ${item.color} group-hover:scale-110 transition-transform`}>
                      <item.icon size={20} />
                    </div>
                    <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-10">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx === messages.length - 1 ? 0.1 : 0 }}
                    className={`flex gap-6 ${msg.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      msg.role === 'bot' 
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20' 
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}>
                      {msg.role === 'bot' ? <Bot size={20} /> : <User size={20} />}
                    </div>
                    
                    <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-start' : 'items-end'}`}>
                      <div className={`group relative px-6 py-5 rounded-[2rem] text-[15px] leading-relaxed transition-all w-full break-words ${
                        msg.role === 'bot' 
                          ? 'bg-[#111111] border border-white/5 text-white/90 hover:bg-[#151515] rounded-tl-none' 
                          : 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-xl shadow-emerald-900/20 rounded-tr-none'
                      }`}>
                        {msg.image && (
                          <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 group/img relative">
                            <img 
                              src={msg.image} 
                              alt="Content" 
                              className="w-full h-auto max-h-[500px] object-contain hover:scale-[1.02] transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-4 left-4 transition-opacity">
                              <a 
                                href={msg.image} 
                                download="generated-image.png"
                                className="p-2 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-black/80 transition-all flex items-center gap-2 text-xs"
                              >
                                <Download size={14} />
                                حفظ الصورة
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="markdown-body prose prose-invert max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="relative group/code my-4">
                            <div className="absolute top-4 left-4 z-10 transition-opacity">
                              <button 
                                onClick={() => copyToClipboard(String(children).replace(/\n$/, ''), msg.id + '-code')}
                                className="p-2 bg-white/10 backdrop-blur-md rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-all flex items-center gap-2 text-[10px]"
                              >
                                {copiedId === msg.id + '-code' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                نسخ الكود
                              </button>
                            </div>
                                    <SyntaxHighlighter
                                      style={atomDark}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-2xl !bg-[#050505] !p-6 border border-white/5"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-400" {...props}>
                                    {children}
                                  </code>
                                )
                              }
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                        
                        {/* Message Actions */}
                        {msg.role === 'bot' && (
                          <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4 transition-opacity">
                            <button 
                              onClick={() => copyToClipboard(msg.text, msg.id)}
                              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2 text-[10px]"
                              title="نسخ النص"
                            >
                              {copiedId === msg.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                              <span>نسخ الإجابة</span>
                            </button>
                            <button className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all" title="إعادة توليد">
                              <RefreshCw size={14} />
                            </button>
                            <button className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all" title="المزيد">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-white/20 font-medium px-2">
                        {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-6 flex-row-reverse">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/10">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                  <div className="px-6 py-4 rounded-3xl bg-white/[0.03] border border-white/5 rounded-tl-none">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-emerald-500/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-emerald-500/40 rounded-full animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-32" />
            </div>
          )}

          {/* Scroll to Bottom */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className="fixed bottom-32 left-8 md:left-12 p-3 bg-white text-black rounded-full shadow-2xl hover:scale-110 transition-transform z-40"
              >
                <ChevronDown size={20} />
              </motion.button>
            )}
          </AnimatePresence>
        </main>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            {!user && messages.length > 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                    <History size={16} />
                  </div>
                  <p className="text-xs text-amber-200/70">سجل الدخول لحفظ محادثاتك والوصول إليها لاحقاً</p>
                </div>
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-1.5 bg-amber-500 text-black text-[10px] font-bold rounded-lg hover:bg-amber-400 transition-colors"
                >
                  تسجيل الدخول
                </button>
              </motion.div>
            )}
            <AnimatePresence>
              {selectedImage && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="mb-4 p-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center gap-4 w-fit"
                >
                  <img src={selectedImage} alt="Preview" className="w-14 h-14 object-cover rounded-xl shadow-lg" referrerPolicy="no-referrer" />
                  <button onClick={() => setSelectedImage(null)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-500/5 blur-2xl group-focus-within:bg-emerald-500/10 transition-all rounded-3xl" />
              
              <div className="relative bg-[#111111]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 focus-within:border-emerald-500/40 transition-all shadow-2xl">
                <div className="flex items-end gap-3">
                  
                  {/* Mode Selection Popup */}
                  <div className="relative mb-1">
                    <button
                      onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                      className={`p-3 rounded-2xl transition-all bg-white/5 hover:bg-white/10 ${
                        chatMode === 'image' ? 'text-cyan-400' :
                        chatMode === 'code' ? 'text-amber-400' :
                        chatMode === 'search' ? 'text-purple-400' :
                        'text-emerald-400'
                      }`}
                    >
                      {chatMode === 'chat' && <MessageSquare size={20} />}
                      {chatMode === 'image' && <Wand2 size={20} />}
                      {chatMode === 'code' && <FileText size={20} />}
                      {chatMode === 'search' && <Sparkles size={20} />}
                    </button>

                    <AnimatePresence>
                      {isModeMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="absolute bottom-full right-0 mb-4 bg-[#1a1a1a] border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[150px] z-50"
                        >
                          {[
                            { id: 'chat', icon: MessageSquare, label: 'دردشة ذكية', color: 'text-emerald-400' },
                            { id: 'image', icon: Wand2, label: 'توليد صور', color: 'text-cyan-400' },
                            { id: 'code', icon: FileText, label: 'كتابة كود', color: 'text-amber-400' },
                            { id: 'search', icon: Sparkles, label: 'بحث ويب', color: 'text-purple-400' }
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => {
                                setChatMode(mode.id as any);
                                setIsModeMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5 ${
                                chatMode === mode.id ? mode.color : 'text-white/40'
                              }`}
                            >
                              <mode.icon size={18} />
                              <span className="text-sm font-medium">{mode.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Attachment Popup */}
                  <div className="relative mb-1">
                    <button 
                      onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                      className="p-3 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors shrink-0"
                      title="إرفاق"
                    >
                      <ImageIcon size={22} />
                    </button>

                    <AnimatePresence>
                      {isAttachmentMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="absolute bottom-full right-0 mb-4 bg-[#1a1a1a] border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[180px] z-50"
                        >
                          <button
                            onClick={() => {
                              fileInputRef.current?.click();
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5 text-white/60"
                          >
                            <ImageIcon size={18} className="text-cyan-400" />
                            <span className="text-sm font-medium">رفع صورة</span>
                          </button>
                          <button
                            onClick={() => {
                              // For now just trigger file input, could be specialized
                              fileInputRef.current?.click();
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5 text-white/60"
                          >
                            <Book size={18} className="text-emerald-400" />
                            <span className="text-sm font-medium">رفع ملفات</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      chatMode === 'image' ? "صف الصورة التي تريد إنشاؤها..." :
                      chatMode === 'code' ? "اكتب الكود الذي تريده أو اطلب حلاً..." :
                      chatMode === 'search' ? "ابحث عن أي شيء في الويب..." :
                      "اسأل MahmoudAi عن أي شيء..."
                    }
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-4 resize-none max-h-40 min-h-[56px] scrollbar-none text-right placeholder:text-white/20"
                    rows={1}
                  />

                  <div className="flex items-center gap-3 p-1 mb-1">
                    {/* Fast/Pro Toggle */}
                    <button
                      onClick={() => setIsProMode(!isProMode)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                        isProMode 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20' 
                          : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                    >
                      {isProMode ? 'PRO' : 'FAST'}
                    </button>

                    <button
                      onClick={() => handleSend()}
                      disabled={(!input.trim() && !selectedImage) || isLoading}
                      className={`p-3.5 rounded-full transition-all ${
                        (!input.trim() && !selectedImage) || isLoading 
                          ? 'bg-white/5 text-white/10' 
                          : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/30'
                      }`}
                    >
                      {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} className="rotate-180" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-center text-white/10 mt-4 font-medium tracking-wide">
              نظام ذكاء اصطناعي فائق التطور • MahmoudAi v2.0
            </p>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-500" />
              
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-6 left-6 p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="text-center mb-10">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
                  <Sparkles className="text-black w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">مرحباً بك مجدداً</h2>
                <p className="text-sm text-white/40 mt-3">سجل دخولك لتجربة ذكاء اصطناعي مخصصة</p>
              </div>

              <div className="space-y-5">
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black rounded-2xl font-bold hover:bg-white/90 transition-all shadow-lg"
                >
                  <Chrome size={22} />
                  <span>المتابعة باستخدام Google</span>
                </button>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-white/20 font-bold uppercase tracking-widest">أو عبر البريد</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-1">
                    <input 
                      type="email" 
                      placeholder="البريد الإلكتروني"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all text-right outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <input 
                      type="password" 
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all text-right outline-none"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/40 mt-2"
                  >
                    {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                  </button>
                </form>

                <p className="text-center text-xs text-white/30 mt-8">
                  {authMode === 'login' ? 'لا تملك حساباً؟' : 'لديك حساب بالفعل؟'}
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-emerald-400 mr-2 font-bold hover:text-emerald-300 transition-colors"
                  >
                    {authMode === 'login' ? 'أنشئ حساباً' : 'سجل دخولك'}
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
