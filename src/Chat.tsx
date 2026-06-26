import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MessageSquare, Send, X, User, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    // Check if we are on admin page to set identity
    setIsAdmin(location.pathname.includes("admin"));
  }, [location]);

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on("chat_history", (history) => {
      setMessages(history);
    });

    socketRef.current.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    socketRef.current?.emit("send_message", {
      sender: isAdmin ? "Admin" : "User",
      text: inputText,
    });
    setInputText("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass w-80 h-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 border border-border"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-background font-bold">
                <MessageSquare size={18} />
                <span>Live Support</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-background/80 hover:text-background">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-surface/50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === (isAdmin ? "Admin" : "User") ? "items-end" : "items-start"}`}>
                  <div className={`flex items-center gap-1 text-[10px] uppercase tracking-widest mb-1 ${msg.sender === "Admin" ? "text-primary" : "text-secondary"}`}>
                    {msg.sender === "Admin" ? <Shield size={10} /> : <User size={10} />}
                    {msg.sender}
                  </div>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.sender === (isAdmin ? "Admin" : "User") 
                      ? "bg-primary text-background rounded-tr-none" 
                      : "bg-primary/10 text-ink rounded-tl-none"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-surface border-t border-border flex gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-background p-2 rounded-xl hover:scale-105 transition-transform">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-primary text-background shadow-xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  );
}
