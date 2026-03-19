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
  MoreVertical, Book, ChevronDown, FileText, Download, Music2, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser,
  OAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider,
  getRedirectResult, signInWithRedirect
} from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  serverTimestamp, doc, getDocs, updateDoc, deleteDoc, getDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: "AIzaSyB8XIJUIoVCA4rVDJbieNmku6c2JwT5ZWw" });

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
  const [showSplash, setShowSplash] = useState(true);
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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play splash sound
    if (showSplash) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log("Audio play blocked:", e));
      audioRef.current = audio;
    }
  }, [showSplash]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error'}[]>([
    { id: 'welcome-toast', message: 'مرحباً بك في MahmoudAi v2.0', type: 'success' }
  ]);
  const [chatMode, setChatMode] = useState<'chat' | 'image' | 'code' | 'search' | 'blogger'>('chat');
  const [bloggerCode, setBloggerCode] = useState('');
  
  useEffect(() => {
    // Standard Blogger Template for the UI
    setBloggerCode(`<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:defaultwidgetversion='2' b:layoutsversion='3' b:responsive='true' expr:dir='data:blog.languageDirection' expr:lang='data:blog.locale' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
  <head>
    <meta content='width=device-width, initial-scale=1' name='viewport'/>
    <title><data:blog.pageTitle/></title>
    <b:skin><![CDATA[
      /* Blogger Template: mnb */
      body { font-family: sans-serif; background: #f4f4f4; margin: 0; }
      .container { max-width: 1000px; margin: auto; background: #fff; padding: 20px; }
    ]]></b:skin>
  </head>
  <body>
    <b:section id='main' showaddelement='no'>
      <b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog'/>
    </b:section>
  </body>
</html>`);
  }, []);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isProMode, setIsProMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userSettings, setUserSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('mahmoudai_settings');
      return saved ? JSON.parse(saved) : {
        theme: 'dark',
        fontSize: 'medium',
        autoSave: true
      };
    } catch (e) {
      console.warn("localStorage is not available", e);
      return {
        theme: 'dark',
        fontSize: 'medium',
        autoSave: true
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mahmoudai_settings', JSON.stringify(userSettings));
    } catch (e) {
      console.warn("Failed to save to localStorage", e);
    }
  }, [userSettings]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide welcome toast after 1s
  useEffect(() => {
    if (!showSplash) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== 'welcome-toast'));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);
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
    getRedirectResult(auth).then((result) => {
      if (result) {
        setIsAuthModalOpen(false);
        addToast('تم تسجيل الدخول بنجاح');
      }
    }).catch((error) => {
      console.error("Redirect Result Error:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const isNewLogin = !user && currentUser;
      setUser(currentUser);
      if (isNewLogin) {
        setIsAuthModalOpen(false);
        try {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#059669']
          });
        } catch (err) {
          console.error('Confetti error:', err);
        }
      }
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
    if ((operationType === 'list' || operationType === 'get') && 
        (errInfo.error.toLowerCase().includes('permission') || errInfo.error.toLowerCase().includes('insufficient'))) {
      return;
    }

    console.error('Firestore Error: ', JSON.stringify(errInfo));
    addToast(`خطأ في قاعدة البيانات: ${errInfo.error}`, 'error');
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

  const compressImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let base64 = reader.result as string;
        // Compress if it's a large file to stay under Firestore's 1MB limit
        if (base64.length > 500000) {
          try {
            base64 = await compressImage(base64);
          } catch (e) {
            console.error("Initial compression failed:", e);
          }
        }
        setSelectedImage(base64);
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
      let finalMsg = { ...msg };
      
      // Compress image if it exists and is likely too large for Firestore (1MB limit)
      // Base64 is ~33% larger than binary, so 1MB binary is ~1.33MB base64.
      // We check if it's over 800KB to be safe.
      if (finalMsg.image && finalMsg.image.length > 800000) {
        try {
          finalMsg.image = await compressImage(finalMsg.image);
        } catch (e) {
          console.error("Image compression failed:", e);
        }
      }

      // Remove undefined fields for Firestore
      const cleanMsg = Object.fromEntries(
        Object.entries(finalMsg).filter(([_, v]) => v !== undefined)
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
              aspectRatio: "1:1"
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
          ? "أنت مهندس برمجيات خبير. قدم كوداً نظيفاً وفعالاً وموثقاً جيداً. اشرح منطقك بوضوح باللغة العربية."
          : isSearchMode 
            ? "أنت مساعد مفيد ولديك وصول إلى معلومات في الوقت الفعلي. استخدم بحث Google لتقديم إجابات دقيقة ومحدثة باللغة العربية."
            : "أنت مساعد مفيد. يجب أن تكون جميع ردودك باللغة العربية الفصحى وبأسلوب مهذب.";

        const config: any = { systemInstruction };
        if (isSearchMode) {
          config.tools = [{ googleSearch: {} }];
        }

        if (currentImage) {
          const mimeType = currentImage.split(';')[0].split(':')[1];
          const base64Data = currentImage.split(',')[1];
          const imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || "image/png",
            },
          };
          response = await genAI.models.generateContent({
            model: activeModelId,
            contents: { parts: [{ text: currentInput || "حلل هذه الصورة بالتفصيل." }, imagePart] },
            config
          });
        } else {
          response = await genAI.models.generateContent({
            model: activeModelId,
            contents: currentInput,
            config
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
      addToast(error.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي", "error");
      
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
      
      // Check if we are in a webview or if popups are likely blocked
      const isWebView = /wv|Android.*Version\/[\d.]+/.test(navigator.userAgent);
      
      if (isWebView) {
        await signInWithRedirect(auth, provider);
      } else {
        try {
          await signInWithPopup(auth, provider);
          setIsAuthModalOpen(false);
        } catch (popupError: any) {
          // Fallback to redirect if popup is blocked
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error) {
      console.error("Login Error:", error);
      addToast('فشل تسجيل الدخول بجوجل', 'error');
    }
  };

  const handleTikTokLogin = async () => {
    try {
      const provider = new OAuthProvider('tiktok.com');
      // TikTok requires specific scopes usually
      provider.addScope('user.info.basic');
      
      const isWebView = /wv|Android.*Version\/[\d.]+/.test(navigator.userAgent);
      if (isWebView) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
        setIsAuthModalOpen(false);
        addToast('تم تسجيل الدخول بتيك توك بنجاح');
      }
    } catch (error: any) {
      console.error("TikTok Login Error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError(`يجب تفعيل TikTok في Firebase Console.
1. اذهب إلى Authentication > Sign-in method.
2. أضف TikTok كمزود خدمة.
3. استخدم Redirect URI: https://${firebaseConfig.authDomain}/__/auth/handler`);
        addToast('يجب تفعيل TikTok في Firebase Console أولاً', 'error');
      } else {
        addToast('فشل تسجيل الدخول بتيك توك', 'error');
      }
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('Recaptcha resolved');
        }
      });
    }
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.startsWith('+')) {
      addToast('يرجى إدخال الرقم مع رمز الدولة (مثال: +20)', 'error');
      return;
    }
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      (window as any).confirmationResult = confirmationResult;
      setIsOtpSent(true);
      addToast('تم إرسال رمز التحقق بنجاح');
    } catch (error) {
      console.error("Phone Auth Error:", error);
      addToast('فشل إرسال الرمز، تأكد من الرقم', 'error');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const confirmationResult = (window as any).confirmationResult;
      await confirmationResult.confirm(otp);
      setIsAuthModalOpen(false);
      setIsOtpSent(false);
      addToast('تم تسجيل الدخول بنجاح');
    } catch (error) {
      console.error("OTP Verification Error:", error);
      addToast('رمز التحقق غير صحيح', 'error');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        addToast('تم تسجيل الدخول بنجاح');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        addToast('تم إنشاء الحساب بنجاح');
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Auth Error:", error);
      let errorMsg = 'حدث خطأ أثناء المصادقة';
      if (error.code === 'auth/email-already-in-use') errorMsg = 'البريد الإلكتروني مستخدم بالفعل';
      if (error.code === 'auth/invalid-email') errorMsg = 'البريد الإلكتروني غير صالح';
      if (error.code === 'auth/weak-password') errorMsg = 'كلمة المرور ضعيفة جداً';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      
      addToast(errorMsg, 'error');
    }
  };

  return (
    <div className={`flex h-screen ${userSettings.theme === 'light' ? 'bg-[#f5f5f5] text-black' : 'bg-[#050505] text-white'} font-sans selection:bg-emerald-500/30 overflow-hidden ${
      userSettings.fontSize === 'small' ? 'text-sm' : userSettings.fontSize === 'large' ? 'text-lg' : 'text-base'
    }`} dir="rtl">
      <div id="recaptcha-container"></div>
      {/* Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[200] bg-[#050505] flex flex-col items-center justify-center text-center p-6 overflow-hidden"
          >
            {/* Animated Background Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: Math.random() * 1000, 
                    y: Math.random() * 1000,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: [null, -100],
                    opacity: [0, 0.3, 0],
                    scale: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 3, 
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                  className="absolute w-1 h-1 bg-emerald-500 rounded-full"
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: 0.2
              }}
              className="relative mb-12"
            >
              <div className="absolute inset-0 bg-emerald-500/30 blur-[120px] rounded-full animate-pulse" />
              <div className="relative z-10 p-8 bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KICA8cGF0aCBkPSJNMjU2IDEyMEwyODUuNSAyMjYuNUwzOTIgMjU2TDI4NS41IDI4NS41TDI1NiAzOTJMMjI2LjUgMjg1LjVMMTIwIDI1NkwyMjYuNSAyMjYuNUwyNTYgMTIwWiIgZmlsbD0id2hpdGUiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjg7MTswLjgiIGR1cj0iM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvcGF0aD4KICA8Y2lyY2xlIGN4PSIzODAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC42Ij4KICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMjU7MzU7MjUiIGR1cj0iNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvY2lyY2xlPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjM4MCIgcj0iMjAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjQiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjI7MC42OzAuMiIgZHVyPSI1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgPC9jaXJjbGU+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjMTBCOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=" alt="Logo" className="w-24 h-24" />
              </div>
              
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 border border-emerald-500/20 rounded-[3.5rem] border-dashed"
              />
            </motion.div>
            
            <div className="space-y-6 relative z-10">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <h1 className="text-6xl font-black tracking-tighter text-white mb-2">
                  Mahmoud<span className="text-emerald-500">Ai</span>
                </h1>
                <div className="h-1 w-24 bg-gradient-to-r from-transparent via-emerald-500 to-transparent mx-auto rounded-full" />
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-2"
              >
                <p className="text-emerald-500/60 font-medium tracking-[0.3em] text-xs uppercase">Premium Intelligence</p>
                <p className="text-white/40 text-sm font-arabic">صلي على سيدنا محمد</p>
              </motion.div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1, duration: 1.5 }}
                className="w-48 h-0.5 bg-white/5 mx-auto rounded-full overflow-hidden"
              >
                <motion.div 
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-1/2 h-full bg-emerald-500"
                />
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="text-[10px] text-white/20 font-arabic"
              >
                مصمم م/محمود احمد
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative w-full max-w-md border rounded-3xl p-8 shadow-2xl overflow-hidden transition-colors ${
                userSettings.theme === 'light' ? 'bg-[#f8f9fa] border-black/5' : 'bg-[#050505] border-white/10'
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${userSettings.theme === 'light' ? 'text-black' : 'text-white'}`}>الإعدادات</h2>
                    <p className={`text-[10px] uppercase tracking-widest font-medium ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>App Preferences</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={`p-2 rounded-xl transition-colors ${
                    userSettings.theme === 'light' ? 'hover:bg-black/5 text-black/30' : 'hover:bg-white/5 text-white/30'
                  }`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={`text-sm font-medium block ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>المظهر</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['dark', 'light'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setUserSettings({...userSettings, theme: t})}
                        className={`py-3 rounded-xl border transition-all ${
                          userSettings.theme === t 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                            : (userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black/40 hover:bg-black/10' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10')
                        }`}
                      >
                        {t === 'dark' ? 'داكن' : 'فاتح'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className={`text-sm font-medium block ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>حجم الخط</label>
                  <div className="flex gap-2">
                    {['small', 'medium', 'large'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setUserSettings({...userSettings, fontSize: s})}
                        className={`flex-1 py-3 rounded-xl border transition-all text-sm ${
                          userSettings.fontSize === s 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                            : (userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black/40 hover:bg-black/10' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10')
                        }`}
                      >
                        {s === 'small' ? 'صغير' : s === 'medium' ? 'متوسط' : 'كبير'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`flex items-center justify-between py-4 border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}>
                  <div className="space-y-0.5">
                    <div className={`font-medium ${userSettings.theme === 'light' ? 'text-black' : 'text-white'}`}>حفظ تلقائي</div>
                    <div className={`text-xs ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>حفظ المحادثات تلقائياً</div>
                  </div>
                  <button
                    onClick={() => setUserSettings({...userSettings, autoSave: !userSettings.autoSave})}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      userSettings.autoSave ? 'bg-emerald-500' : (userSettings.theme === 'light' ? 'bg-black/10' : 'bg-white/10')
                    }`}
                  >
                    <motion.div
                      animate={{ x: userSettings.autoSave ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
                    />
                  </button>
                </div>

                <div className={`space-y-3 pt-4 border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}>
                  <label className={`text-sm font-medium block ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>رابط التطبيق لـ AppCreator24</label>
                  <div className="flex gap-2">
                    <input 
                      readOnly
                      value={window.location.origin}
                      className={`flex-1 border rounded-xl px-3 py-2 text-[10px] outline-none ${
                        userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black/60' : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin);
                        addToast('تم نسخ الرابط');
                      }}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-all"
                    >
                      نسخ
                    </button>
                  </div>
                  <p className={`text-[9px] leading-relaxed ${userSettings.theme === 'light' ? 'text-black/20' : 'text-white/20'}`}>استخدم هذا الرابط في قسم "Website" عند إنشاء تطبيقك في AppCreator24 لضمان عمل جميع الميزات.</p>
                </div>
              </div>

              <button
                onClick={() => {
                  addToast('تم حفظ الإعدادات بنجاح');
                  setIsSettingsOpen(false);
                }}
                className="w-full mt-8 py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                حفظ التغييرات
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
        fixed md:relative z-50 h-full w-80 border-l flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        ${userSettings.theme === 'light' ? 'bg-[#f8f9fa] border-black/5' : 'bg-[#050505] border-white/5'}
      `}>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KICA8cGF0aCBkPSJNMjU2IDEyMEwyODUuNSAyMjYuNUwzOTIgMjU2TDI4NS41IDI4NS41TDI1NiAzOTJMMjI2LjUgMjg1LjVMMTIwIDI1NkwyMjYuNSAyMjYuNUwyNTYgMTIwWiIgZmlsbD0id2hpdGUiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjg7MTswLjgiIGR1cj0iM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvcGF0aD4KICA8Y2lyY2xlIGN4PSIzODAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC42Ij4KICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMjU7MzU7MjUiIGR1cj0iNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvY2lyY2xlPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjM4MCIgcj0iMjAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjQiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjI7MC42OzAuMiIgZHVyPSI1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgPC9jaXJjbGU+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjMTBCOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=" alt="Logo" className="w-8 h-8" />
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
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-black rounded-2xl font-bold text-sm hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/10 active:scale-[0.98]"
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
              className={`w-full border rounded-xl py-2.5 pr-10 pl-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all text-right ${
                userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black' : 'bg-white/5 border-white/10 text-white'
              }`}
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
                  currentChatId === chat.id 
                    ? (userSettings.theme === 'light' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-white/10 text-white') 
                    : (userSettings.theme === 'light' ? 'text-black/60 hover:bg-black/5 hover:text-black' : 'text-white/40 hover:bg-white/5 hover:text-white/70')
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

        <div className={`p-4 border-t space-y-2 ${
          userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'
        }`}>
          {user ? (
            <div className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
              userSettings.theme === 'light' ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'
            }`}>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                <User size={20} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName || user.email?.split('@')[0]}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsSettingsOpen(true)} className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-emerald-400 transition-colors">
                    <Settings size={14} />
                  </button>
                  <span className="text-[10px] text-white/10">•</span>
                  <button onClick={() => signOut(auth)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-medium">خروج</button>
                </div>
              </div>
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
      <div className={`flex-1 flex flex-col relative overflow-hidden transition-colors duration-300 ${
        userSettings.theme === 'light' ? 'bg-[#f8f9fa]' : 'bg-[#050505]'
      }`}>
        {/* Background Decoration */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 blur-[120px] pointer-events-none ${
          userSettings.theme === 'light' ? 'bg-emerald-500/10' : 'bg-emerald-500/5'
        }`} />
        
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-4 md:px-6 border-b z-30 sticky top-0 transition-colors ${
          userSettings.theme === 'light' ? 'bg-[#f8f9fa] border-black/5' : 'bg-[#050505] border-white/5'
        }`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className={`p-2 rounded-xl transition-colors ${
                userSettings.theme === 'light' ? 'hover:bg-black/5 text-black/60' : 'hover:bg-white/5 text-white/60'
              }`}
            >
              <Menu size={20} />
            </button>
            
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KICA8cGF0aCBkPSJNMjU2IDEyMEwyODUuNSAyMjYuNUwzOTIgMjU2TDI4NS41IDI4NS41TDI1NiAzOTJMMjI2LjUgMjg1LjVMMTIwIDI1NkwyMjYuNSAyMjYuNUwyNTYgMTIwWiIgZmlsbD0id2hpdGUiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjg7MTswLjgiIGR1cj0iM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvcGF0aD4KICA8Y2lyY2xlIGN4PSIzODAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC42Ij4KICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMjU7MzU7MjUiIGR1cj0iNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvY2lyY2xlPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjM4MCIgcj0iMjAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjQiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjI7MC42OzAuMiIgZHVyPSI1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgPC9jaXJjbGU+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjMTBCOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=" alt="Logo" className="w-6 h-6" />
              </div>
              <span className={`font-bold text-sm tracking-tight hidden sm:block ${userSettings.theme === 'light' ? 'text-black' : 'text-white'}`}>MahmoudAi</span>
            </div>

            <div className="h-6 w-[1px] bg-white/10 mx-1 hidden sm:block" />
            
            {/* Model Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                  userSettings.theme === 'light' ? 'bg-black/5 border-black/5 hover:bg-black/10' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={`text-[11px] font-bold tracking-tight ${userSettings.theme === 'light' ? 'text-black/70' : 'text-white/70'}`}>{selectedModel.name}</span>
                <ChevronDown size={12} className={`transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''} ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`} />
              </button>

              <AnimatePresence>
                {isModelSelectorOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute top-full right-0 mt-2 w-64 border rounded-2xl shadow-2xl p-2 z-50 ${
                      userSettings.theme === 'light' ? 'bg-white border-black/5' : 'bg-[#0f0f0f] border-white/10'
                    }`}
                  >
                    {MODELS.map((m) => (
                      <button 
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m);
                          setIsModelSelectorOpen(false);
                        }}
                        className={`w-full flex flex-col items-start gap-0.5 p-3 rounded-xl transition-all text-right ${
                          selectedModel.id === m.id 
                            ? (userSettings.theme === 'light' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400') 
                            : (userSettings.theme === 'light' ? 'hover:bg-black/5 text-black/60' : 'hover:bg-white/5 text-white/60')
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

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Sparkles className="text-emerald-400 w-3 h-3" />
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">MahmoudAi v2.1</span>
            </div>
            
            {user ? (
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                  userSettings.theme === 'light' ? 'bg-black/5 border-black/5 hover:bg-black/10' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                  <User size={14} className="text-emerald-400" />
                </div>
                <span className={`text-[11px] font-bold tracking-tight hidden md:block ${userSettings.theme === 'light' ? 'text-black/70' : 'text-white/70'}`}>حسابي</span>
              </button>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 text-black rounded-xl font-bold text-[11px] hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <LogIn size={14} />
                <span>دخول</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar relative"
        >
          {chatMode === 'blogger' ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/20 rounded-2xl">
                        <Book className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">قالب بلوجر (mnb)</h2>
                        <p className="text-sm text-white/40">كود XML كامل جاهز للاستخدام في Blogger</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(bloggerCode, 'blogger-code')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all font-bold"
                    >
                      {copiedId === 'blogger-code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedId === 'blogger-code' ? 'تم النسخ' : 'نسخ الكود'}
                    </button>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative bg-[#0d1117] rounded-2xl overflow-hidden border border-white/5">
                      <SyntaxHighlighter
                        language="xml"
                        style={atomDark}
                        customStyle={{
                          background: 'transparent',
                          padding: '24px',
                          fontSize: '13px',
                          maxHeight: '500px'
                        }}
                        showLineNumbers={true}
                      >
                        {bloggerCode}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                  
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-emerald-500 font-bold mb-1">المجلد</div>
                      <div className="text-sm opacity-60">mm/</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-emerald-500 font-bold mb-1">اسم الملف</div>
                      <div className="text-sm opacity-60">mnb.xml</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-emerald-500 font-bold mb-1">النوع</div>
                      <div className="text-sm opacity-60">Blogger XML Template</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : !currentChatId && messages.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-10">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20 overflow-hidden"
              >
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KICA8cGF0aCBkPSJNMjU2IDEyMEwyODUuNSAyMjYuNUwzOTIgMjU2TDI4NS41IDI4NS41TDI1NiAzOTJMMjI2LjUgMjg1LjVMMTIwIDI1NkwyMjYuNSAyMjYuNUwyNTYgMTIwWiIgZmlsbD0id2hpdGUiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjg7MTswLjgiIGR1cj0iM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvcGF0aD4KICA8Y2lyY2xlIGN4PSIzODAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC42Ij4KICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMjU7MzU7MjUiIGR1cj0iNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvY2lyY2xlPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjM4MCIgcj0iMjAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjQiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjI7MC42OzAuMiIgZHVyPSI1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgPC9jaXJjbGU+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjMTBCOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=" alt="Logo" className="w-16 h-16" />
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
                      <div className={`group relative px-6 py-5 rounded-[2rem] leading-relaxed transition-all w-full break-words ${
                        userSettings.fontSize === 'small' ? 'text-[13px]' : userSettings.fontSize === 'large' ? 'text-[17px]' : 'text-[15px]'
                      } ${
                        msg.role === 'bot' 
                          ? (userSettings.theme === 'light' ? 'bg-white border border-black/5 text-black/90 hover:bg-gray-50 rounded-tl-none' : 'bg-[#111111] border border-white/5 text-white/90 hover:bg-[#151515] rounded-tl-none')
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
        <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-8 pointer-events-none transition-all ${
          userSettings.theme === 'light' ? 'bg-gradient-to-t from-white via-white/90 to-transparent' : 'bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent'
        }`}>
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
              
              <div className={`relative backdrop-blur-2xl border rounded-[2.5rem] p-3 focus-within:border-emerald-500/40 transition-all shadow-2xl ${
                userSettings.theme === 'light' ? 'bg-white/80 border-black/5 shadow-black/5' : 'bg-[#111111]/80 border-white/10 shadow-emerald-500/5'
              }`}>
                <div className="flex items-end gap-3">
                  
                  {/* Mode Selection Popup */}
                  <div className="relative mb-1">
                    <button
                      onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                      className={`p-3 rounded-2xl transition-all ${
                        userSettings.theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
                      } ${
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
                            { id: 'search', icon: Sparkles, label: 'بحث ويب', color: 'text-purple-400' },
                            { id: 'blogger', icon: Book, label: 'قالب بلوجر', color: 'text-emerald-400' }
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
                    className={`flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-4 resize-none max-h-40 min-h-[56px] scrollbar-none text-right transition-colors ${
                      userSettings.theme === 'light' ? 'text-black placeholder:text-black/30' : 'text-white placeholder:text-white/20'
                    }`}
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
              className={`border rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden transition-colors ${
                userSettings.theme === 'light' ? 'bg-white border-black/5' : 'bg-[#0f0f0f] border-white/10'
              }`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-500 to-emerald-400 bg-[length:200%_100%] animate-gradient-x" />
              
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className={`absolute top-6 left-6 p-2 rounded-full transition-colors ${
                  userSettings.theme === 'light' ? 'hover:bg-black/5 text-black/30 hover:text-black' : 'hover:bg-white/5 text-white/30 hover:text-white'
                }`}
              >
                <X size={20} />
              </button>
              
              <div className="text-center mb-10">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20 overflow-hidden"
                >
                  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KICA8cGF0aCBkPSJNMjU2IDEyMEwyODUuNSAyMjYuNUwzOTIgMjU2TDI4NS41IDI4NS41TDI1NiAzOTJMMjI2LjUgMjg1LjVMMTIwIDI1NkwyMjYuNSAyMjYuNUwyNTYgMTIwWiIgZmlsbD0id2hpdGUiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjg7MTswLjgiIGR1cj0iM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvcGF0aD4KICA8Y2lyY2xlIGN4PSIzODAiIGN5PSIxNTAiIHI9IjMwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC42Ij4KICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9InIiIHZhbHVlcz0iMjU7MzU7MjUiIGR1cj0iNHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogIDwvY2lyY2xlPgogIDxjaXJjbGUgY3g9IjEzMCIgY3k9IjM4MCIgcj0iMjAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjQiPgogICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0ib3BhY2l0eSIgdmFsdWVzPSIwLjI7MC42OzAuMiIgZHVyPSI1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgPC9jaXJjbGU+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjMTBCOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=" alt="Logo" className="w-14 h-14" />
                </motion.div>
                <h2 className={`text-3xl font-bold tracking-tight ${userSettings.theme === 'light' ? 'text-black' : 'text-white'}`}>مرحباً بك مجدداً</h2>
                <p className={`text-sm mt-3 ${userSettings.theme === 'light' ? 'text-black/40' : 'text-white/40'}`}>سجل دخولك لتجربة ذكاء اصطناعي مخصصة</p>
                
                {authError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-right"
                  >
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <X size={16} onClick={() => setAuthError(null)} className="cursor-pointer" />
                      <span className="text-xs font-bold">خطأ في الإعدادات</span>
                    </div>
                    <p className="text-[10px] text-red-200/70 whitespace-pre-line leading-relaxed">
                      {authError}
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${firebaseConfig.authDomain}/__/auth/handler`);
                        addToast('تم نسخ رابط إعادة التوجيه');
                      }}
                      className="mt-2 text-[9px] text-emerald-400 hover:underline"
                    >
                      نسخ رابط Redirect URI
                    </button>
                  </motion.div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleGoogleLogin}
                    className="group flex items-center justify-center gap-2 py-3.5 bg-white text-black rounded-2xl font-bold hover:bg-white/90 transition-all shadow-lg text-xs active:scale-95 border border-black/5"
                  >
                    <Chrome size={18} className="group-hover:rotate-12 transition-transform" />
                    <span>Google</span>
                  </button>
                  <button 
                    onClick={handleTikTokLogin}
                    className="group flex items-center justify-center gap-2 py-3.5 bg-black text-white border border-white/10 rounded-2xl font-bold hover:bg-white/5 transition-all shadow-lg text-xs active:scale-95"
                  >
                    <Music2 size={18} className="group-hover:scale-110 transition-transform" />
                    <span>TikTok</span>
                  </button>
                </div>

                <div className="relative flex items-center py-2">
                  <div className={`flex-grow border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}></div>
                  <span className={`flex-shrink mx-4 text-[9px] font-bold uppercase tracking-widest ${userSettings.theme === 'light' ? 'text-black/20' : 'text-white/20'}`}>أو عبر الهاتف</span>
                  <div className={`flex-grow border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}></div>
                </div>

                <div className="space-y-3">
                  {!isOtpSent ? (
                    <div className="flex gap-2">
                      <input 
                        type="tel" 
                        placeholder="+20 123 456 7890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className={`flex-1 border rounded-2xl py-3.5 px-4 text-xs focus:border-emerald-500/50 transition-all text-left outline-none ${
                          userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/10 text-white'
                        }`}
                      />
                      <button 
                        onClick={handleSendOtp}
                        className="px-6 py-3.5 bg-emerald-500 text-black rounded-2xl font-bold text-xs hover:bg-emerald-400 transition-all active:scale-95"
                      >
                        إرسال
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="رمز التحقق"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className={`flex-1 border rounded-2xl py-3.5 px-4 text-xs focus:border-emerald-500/50 transition-all text-center outline-none ${
                          userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/10 text-white'
                        }`}
                      />
                      <button 
                        onClick={handleVerifyOtp}
                        className="px-6 py-3.5 bg-emerald-500 text-black rounded-2xl font-bold text-xs hover:bg-emerald-400 transition-all active:scale-95"
                      >
                        تأكيد
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center py-2">
                  <div className={`flex-grow border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}></div>
                  <span className={`flex-shrink mx-4 text-[9px] font-bold uppercase tracking-widest ${userSettings.theme === 'light' ? 'text-black/20' : 'text-white/20'}`}>أو عبر البريد</span>
                  <div className={`flex-grow border-t ${userSettings.theme === 'light' ? 'border-black/5' : 'border-white/5'}`}></div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 ${userSettings.theme === 'light' ? 'text-black/20' : 'text-white/20'}`} />
                      <input 
                        type="email" 
                        placeholder="البريد الإلكتروني"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full border rounded-2xl py-3.5 pl-4 pr-10 text-xs focus:border-emerald-500/50 transition-all outline-none ${
                          userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/10 text-white'
                        }`}
                        required
                      />
                    </div>
                    <div className="relative">
                      <Lock size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 ${userSettings.theme === 'light' ? 'text-black/20' : 'text-white/20'}`} />
                      <input 
                        type="password" 
                        placeholder="كلمة المرور"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full border rounded-2xl py-3.5 pl-4 pr-10 text-xs focus:border-emerald-500/50 transition-all outline-none ${
                          userSettings.theme === 'light' ? 'bg-black/5 border-black/5 text-black' : 'bg-white/[0.03] border-white/10 text-white'
                        }`}
                        required
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-black rounded-2xl font-bold text-xs hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                  >
                    {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className={`text-[11px] transition-colors font-medium ${
                      userSettings.theme === 'light' ? 'text-black/40 hover:text-emerald-600' : 'text-white/40 hover:text-emerald-400'
                    }`}
                  >
                    {authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
