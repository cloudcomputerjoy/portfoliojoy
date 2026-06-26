import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Mic, Upload, Sparkles } from "lucide-react";
import { GoogleGenAI, Modality } from "@google/genai";
import { generateTTS } from "../App";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai" | "peer";
  timestamp: string;
  image?: string;
  isOrder?: boolean;
}

export const AIChat = ({ user }: { user?: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! I'm Joy's AI assistant. I can help you with project guidance, price negotiation, or placing an order. How can I assist you today?", sender: "ai", timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    recognition.start();
  };

  const handleSend = async (text: string = input, image?: string) => {
    if (!text.trim() && !image) return;

    const userMsg: Message = {
      id: Date.now(),
      text: text,
      sender: "user",
      timestamp: new Date().toISOString(),
      image
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");

    setIsTyping(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are Joy Saha's AI assistant. 
          1. AI Powered Guidance: Guide buyers on which services fit their needs.
          2. AI Price Negotiation: Negotiate prices for Joy's services. Be professional but firm on value.
          3. AI Order System: If a user wants to order, ask for their project details, budget, and timeline. 
          4. Introduction: Always be polite and professional.
          5. Human Escalation: If the user wants to speak to a human or Joy Saha directly, inform them that they MUST access the 'Client Portal' or 'Contact' section. ${!user ? "Crucially, tell them they MUST log in to their account to access direct chat functionality." : "Since they are logged in, suggest they use the Client Portal for direct communication."}`,
        },
      });

      const response = await chat.sendMessage({ message: text });
      const aiMsg: Message = {
        id: Date.now() + 1,
        text: response.text || "I'm sorry, I couldn't process that.",
        sender: "ai",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Voice feedback for AI
      generateTTS(aiMsg.text);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSend("I've uploaded an image for reference.", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-primary text-background shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-[60]"
      >
        <MessageCircle size={32} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-24 right-4 md:right-6 w-[calc(100vw-2rem)] md:w-80 h-[500px] max-h-[calc(100vh-8rem)] bg-surface border border-border rounded-[2rem] shadow-2xl z-[60] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-primary/5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-ink">AI Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-ink-muted uppercase font-bold tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsOpen(false)} className="text-ink-muted hover:text-ink">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-4 rounded-2xl text-sm",
                    msg.sender === "user" ? "bg-primary text-background rounded-tr-none" : "bg-primary/5 text-ink rounded-tl-none border border-border"
                  )}>
                    {msg.image && (
                      <img src={msg.image} alt="Uploaded" className="w-full rounded-lg mb-2" />
                    )}
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    <div className={cn("text-[8px] mt-2 opacity-50", msg.sender === "user" ? "text-right" : "text-left")}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-primary/5 p-4 rounded-2xl rounded-tl-none border border-border flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce delay-200" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-surface">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl bg-primary/5 text-ink-muted hover:text-primary transition-colors shrink-0"
                >
                  <Upload size={18} />
                </button>
                <button 
                  onClick={handleVoiceInput}
                  className={cn(
                    "p-2 rounded-xl transition-colors shrink-0",
                    isListening ? "bg-red-500 text-white animate-pulse" : "bg-primary/5 text-ink-muted hover:text-primary"
                  )}
                >
                  <Mic size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                />
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask Joy's AI..."
                  className="flex-1 min-w-0 bg-primary/5 border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                />
                <button 
                  onClick={() => handleSend()}
                  className="p-2 rounded-xl bg-primary text-background hover:scale-105 transition-transform shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Utility for tailwind classes
function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}
