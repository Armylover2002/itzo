import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Phone, Paperclip, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@core/context/SettingsContext';

const emojis = ['😀', '😂', '😍', '🥺', '😎', '😭', '😡', '👍', '👎', '🎉', '❤️', '🔥', '✅', '❌', '👋', '🙏', '👀', '💯', '💩', '🤡'];

const ChatPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const [messages, setMessages] = useState([
        { id: 1, text: 'Hi there! 👋 Welcome to Support.', sender: 'support', time: '10:00 AM' },
        { id: 2, text: 'How can we help you today?', sender: 'support', time: '10:00 AM' },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setMessages(prev => prev.map((m, i) => i === 0 && m.sender === 'support'
            ? { ...m, text: `Hi there! 👋 Welcome to ${appName} Support.` }
            : m));
    }, [appName]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, selectedImage]);

    const handleSend = () => {
        if (!inputText.trim() && !selectedImage) return;

        const newMessage = {
            id: messages.length + 1,
            text: inputText,
            image: selectedImage,
            sender: 'user',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        setSelectedImage(null);
        setShowEmojiPicker(false);
        setIsTyping(true);

        // Simulate Support Reply
        setTimeout(() => {
            const reply = {
                id: messages.length + 2,
                text: "Thanks for reaching out! One of our support agents will be with you shortly. In the meantime, is there anything specific you need help with regarding an order?",
                sender: 'support',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, reply]);
            setIsTyping(false);
        }, 2000);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    const handleEmojiClick = (emoji) => {
        setInputText(prev => prev + emoji);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setSelectedImage(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-white flex flex-col z-[999] overflow-hidden">
            {/* Chat Header */}
            <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-slate-100 z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-50 transition-colors text-slate-600"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="h-10 w-10 bg-[#0c831f] rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm ring-2 ring-white">
                                AS
                            </div>
                            <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                        </div>
                        <div>
                            <h1 className="text-base font-black text-slate-800 leading-none">Support Chat</h1>
                            <p className="text-[10px] text-green-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                                <span className="h-1 w-1 bg-green-500 rounded-full"></span> Online
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <Phone size={20} />
                    </button>

                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 space-y-6 min-h-0">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] relative group ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`px-4 py-3 rounded-2xl shadow-sm border text-sm leading-relaxed ${msg.sender === 'user'
                                ? 'bg-[#0c831f] text-white border-transparent rounded-tr-none'
                                : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
                                }`}>
                                {msg.image && (
                                    <img src={msg.image} alt="Sent" className="rounded-lg mb-2 max-w-full h-auto object-cover" />
                                )}
                                {msg.text}
                            </div>
                            <span className={`text-[10px] text-slate-400 mt-1 px-1 font-medium ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                {msg.time}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                <AnimatePresence>
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex justify-start"
                        >
                            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center gap-1.5 h-10 w-16">
                                <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-3 border-t border-slate-100 shrink-0 z-30 safe-area-bottom relative mb-4">

                {/* Emoji Picker Popover */}
                <AnimatePresence>
                    {showEmojiPicker && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="absolute bottom-full left-4 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 grid grid-cols-5 gap-2 w-64 z-50"
                        >
                            {emojis.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => handleEmojiClick(emoji)}
                                    className="text-2xl hover:bg-slate-50 p-2 rounded-lg transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Image Preview */}
                <AnimatePresence>
                    {selectedImage && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-full right-4 mb-2 bg-white rounded-xl shadow-lg border border-slate-100 p-2 z-50"
                        >
                            <div className="relative">
                                <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                >
                                    <div className="h-3 w-3 bg-white rotate-45 transform origin-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)', backgroundColor: 'white', width: '8px', height: '8px' }}></div>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-200 focus-within:border-green-300 focus-within:shadow-[0_0_0_4px_rgba(12,131,31,0.1)] transition-all">
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2.5 rounded-full hover:text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0 ${showEmojiPicker ? 'text-[#0c831f] bg-green-50' : 'text-slate-400'}`}
                    >
                        <Smile size={22} />
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                    >
                        <Paperclip size={22} />
                    </button>

                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        className="bg-transparent text-sm w-full py-2.5 outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() && !selectedImage}
                        className="p-2.5 rounded-full bg-[#0c831f] text-white hover:bg-[#0a701a] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-200 flex-shrink-0"
                    >
                        <Send size={20} className="ml-0.5" />
                    </button>
                </div>
            </div>

            <style>
                {`
                    .safe-area-bottom {
                        padding-bottom: env(safe-area-inset-bottom);
                    }
                `}
            </style>
        </div>
    );
};

export default ChatPage;
