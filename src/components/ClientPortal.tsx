import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  auth, db 
} from "../firebase";
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, orderBy, setDoc, increment 
} from "firebase/firestore";
import { 
  Activity, MessageSquare, CreditCard, Download, ExternalLink, 
  Send, Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, User as UserIcon, LogOut,
  Layout, Database, Globe, Smartphone, Server, ImageIcon, PenTool, Zap, Sparkles, Plus,
  ShoppingBag, Paperclip, FileText, PlayCircle, Video, Phone, PhoneOff, MicOff, VideoOff, Reply, Edit3, Trash2, MoreVertical, X, PanelLeft, Calendar
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { cn } from "../lib/utils";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { ThemeToggle } from "./ThemeToggle";
import { ProjectNotes } from "./ProjectNotes";
import { MeetingRequestCard } from "./MeetingRequestCard";

interface Milestone {
  id: string;
  title: string;
  price: number;
  status: 'pending' | 'paid';
}

interface Project {
  id: string;
  title: string;
  status: string;
  progress: number;
  nextMilestone: string;
  milestones?: Milestone[];
  eta: string;
  deadline?: string;
  files?: Array<{ name: string; url: string; price: number; isLocked: boolean }>;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: any;
  fileId?: string;
  productId?: string;
}

interface PurchasedProduct {
  id: string;
  title: string;
  category?: string;
  preview_image: string;
  source_code_url: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
  read?: boolean;
  type?: 'proposal' | 'file' | 'text' | 'call' | 'meeting_request';
  meetingDate?: string;
  meetingTime?: string;
  meetingNotes?: string;
  meetingStatus?: 'pending' | 'approved' | 'declined';
  callStatus?: 'started' | 'answered' | 'missed' | 'cancelled';
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
  };
  proposalData?: {
    title: string;
    description: string;
    price: number;
    initialDeposit: number;
    status: string;
  };
  file?: {
    url: string;
    type: string;
    name: string;
  };
}

export const ClientPortal = () => {
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [showAssetsSidebar, setShowAssetsSidebar] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminIsTyping, setAdminIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofNotes, setProofNotes] = useState("");
  const [proofMessage, setProofMessage] = useState({ text: "", type: "" });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "payments" | "store" | "settings">("dashboard");
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [purchasedProducts, setPurchasedProducts] = useState<PurchasedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentResult, setPaymentResult] = useState<"success" | "cancel" | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string, text: string } | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "incoming" | "active">("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidates = React.useRef<RTCIceCandidateInit[]>([]);
  useEffect(() => { 
    pcRef.current = peerConnection; 
    if (peerConnection && peerConnection.remoteDescription) {
      pendingIceCandidates.current.forEach(candidate => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding queued ice candidate", e));
      });
      pendingIceCandidates.current = [];
    }
  }, [peerConnection, peerConnection?.remoteDescription]);

  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Video Meeting Request States & Handler
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

  const handleRequestMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate || !meetingTime || !user) return;
    setIsSubmittingMeeting(true);

    try {
      const conversationId = activeConversationId || `conv_${user.uid}_admin`;
      
      // Ensure the conversation document exists first
      const convRef = doc(db, "conversations", conversationId);
      await setDoc(convRef, {
        id: conversationId,
        clientId: user.uid,
        clientName: user.name || user.email,
        clientEmail: user.email,
        participants: [user.uid, "admin"],
        lastMessage: `Requested a video meeting on ${meetingDate} at ${meetingTime}`,
        lastMessageAt: serverTimestamp()
      }, { merge: true });

      // Add the message to the messages subcollection
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        text: `Requested a video meeting consultation on ${meetingDate} at ${meetingTime}.`,
        timestamp: serverTimestamp(),
        read: false,
        type: "meeting_request",
        meetingDate,
        meetingTime,
        meetingNotes: meetingNotes || "",
        meetingStatus: "pending",
        remindersSent: 0,
        remindersLog: []
      });

      // Clear form & close modal
      setMeetingDate("");
      setMeetingTime("");
      setMeetingNotes("");
      setIsScheduleModalOpen(false);
      
      // Notify admin
      notifyAdmin(`New Meeting Request: Video consultation on ${meetingDate} at ${meetingTime}`, conversationId);
    } catch (err) {
      console.error("Failed to request meeting:", err);
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const startCall = async (callType: 'video' | 'audio' = 'video') => {
    if (!socket || !activeConversationId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: callType === 'video', 
        audio: true 
      });
      setLocalStream(stream);
      setCallStatus("calling");
      setShowVideoCall(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" }
        ]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { conversationId: activeConversationId, candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit("call-user", { conversationId: activeConversationId, offer, from: user.uid, callType });
      setPeerConnection(pc);

      // Log call
      await addDoc(collection(db, "conversations", activeConversationId, "messages"), {
        senderId: user.uid,
        text: `Outgoing ${callType === 'video' ? 'Video' : 'Audio'} Call`,
        type: "call",
        timestamp: serverTimestamp(),
        callStatus: "started",
        callType
      });
    } catch (err) {
      console.error("Call error:", err);
      alert("Could not access camera/microphone");
    }
  };

  const answerCall = async () => {
    if (!socket || !incomingCallData) return;
    const conversationId = incomingCallData.conversationId || activeConversationId;
    if (!conversationId) return;

    try {
      const callType = incomingCallData.callType || 'video';
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: callType === 'video', 
        audio: true 
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" }
        ]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { conversationId, candidate: event.candidate });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", { conversationId, answer });
      setPeerConnection(pc);
      setCallStatus("active");

      // Log answer
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        text: "Call Answered",
        type: "call",
        timestamp: serverTimestamp(),
        callStatus: "answered"
      });
    } catch (err) {
      console.error("Answer error:", err);
    }
  };

  const endCall = async () => {
    const conversationId = incomingCallData?.conversationId || activeConversationId;

    if (callStatus === "calling" || callStatus === "incoming") {
      // Log missed call / cancelled call
      const callType = incomingCallData?.callType || (showVideoCall && !localStream?.getVideoTracks().length ? 'audio' : 'video');
      if (conversationId) {
        await addDoc(collection(db, "conversations", conversationId, "messages"), {
          senderId: user.uid,
          text: callStatus === "calling" ? "Call Cancelled" : `Missed ${callType === 'video' ? 'Video' : 'Audio'} Call`,
          type: "call",
          timestamp: serverTimestamp(),
          callStatus: callStatus === "calling" ? "cancelled" : "missed",
          callType
        });
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    setCallStatus("idle");
    setShowVideoCall(false);
    setIncomingCallData(null);
    if (socket && conversationId) {
      socket.emit("end-call", { conversationId });
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!activeConversationId || !newText.trim()) return;
    try {
      const msgRef = doc(db, "conversations", activeConversationId, "messages", messageId);
      await updateDoc(msgRef, {
        text: newText,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setEditingMessage(null);
      setNewMessage("");
      if (socket) {
        socket.emit("edit-message", { 
          conversationId: activeConversationId, 
          messageId, 
          newText,
          senderId: user.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${activeConversationId}/messages/${messageId}`);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      const msgRef = doc(db, "conversations", activeConversationId, "messages", messageId);
      await updateDoc(msgRef, {
        isDeleted: true,
        text: "This message was deleted",
        updatedAt: serverTimestamp()
      });
      if (socket) {
        socket.emit("delete-message", { 
          conversationId: activeConversationId, 
          messageId,
          senderId: user.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${activeConversationId}/messages/${messageId}`);
    }
  };

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    if (user?.uid) {
      newSocket.emit("identify", user.uid);
    }

    newSocket.on("user-presence", (users: string[]) => {
      setOnlineUsers(users);
    });

    newSocket.on("call-rejected", ({ reason }) => {
      if (reason === "busy") {
        alert("Admin is currently in another call. Please try again later.");
      }
      endCall();
    });

    newSocket.on("message-edited", ({ messageId, newText }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText } : m));
    });

    newSocket.on("message-deleted", ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    // Video Call Handlers
    newSocket.on("incoming-call", (data) => {
      setIncomingCallData(data);
      setCallStatus("incoming");
      setShowVideoCall(true);
    });

    newSocket.on("call-answered", async ({ answer }) => {
      if (pcRef.current) {
        try {
          if (pcRef.current.signalingState !== "stable") {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setCallStatus("active");
            // Process queued candidates
            pendingIceCandidates.current.forEach(candidate => {
              pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding queued ice candidate", e));
            });
            pendingIceCandidates.current = [];
          }
        } catch (e) {
          console.error("Error setting remote description", e);
        }
      }
    });

    newSocket.on("ice-candidate", async ({ candidate }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      } else {
        pendingIceCandidates.current.push(candidate);
      }
    });

    newSocket.on("call-ended", () => {
      endCall();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && activeConversationId) {
      socket.emit("join-room", activeConversationId);
    }
  }, [socket, activeConversationId]);

  useEffect(() => {
    if (!user) return;
    const defaultConvId = `conv_${user.uid}_admin`;
    const currentConvId = activeConversationId || defaultConvId;

    const unsubscribe = onSnapshot(doc(db, "conversations", currentConvId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdminIsTyping(data.typing?.admin === true);
      } else {
        setAdminIsTyping(false);
      }
    });

    return () => unsubscribe();
  }, [user, activeConversationId]);

  useEffect(() => {
    if (!user || !activeConversationId || activeTab !== "chat") return;

    let typingTimeout: any;
    const handleTyping = async (isTyping: boolean) => {
      if (!user || !activeConversationId) return;
      try {
        await updateDoc(doc(db, "conversations", activeConversationId), {
          [`typing.${user.uid}`]: isTyping
        });
      } catch (err) {
        // Conversation might not exist yet, ignore
      }
    };

    if (newMessage.length > 0) {
      handleTyping(true);
      typingTimeout = setTimeout(() => handleTyping(false), 3000);
    } else {
      handleTyping(false);
    }

    return () => {
      clearTimeout(typingTimeout);
      handleTyping(false);
    };
  }, [newMessage, user, activeConversationId, activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    if (status === "success") {
      setPaymentResult("success");
      // Clear URL params to avoid re-triggering on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === "cancel") {
      setPaymentResult("cancel");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        unsubUserDoc = onSnapshot(doc(db, "users", currentUser.uid), (userSnap) => {
          if (userSnap.exists()) {
            const userData = { ...currentUser, ...userSnap.data() } as any;
            setUser(userData);
            setProfileForm({
              name: userData.name || "",
              email: userData.email || "",
              phone: userData.phone || "",
              address: userData.address || ""
            });
          } else {
            setUser(currentUser as any);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch projects
    const q = query(collection(db, "projects"), where("clientId", "==", user.uid));
    const unsubscribeProjects = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projectsData);
      
      // Real-time synchronization for the active project
      setActiveProject(prevActive => {
        if (projectsData.length === 0) return null;
        if (!prevActive) return projectsData[0];
        
        const updatedActive = projectsData.find(p => p.id === prevActive.id);
        return updatedActive || projectsData[0];
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "projects");
    });

    return () => unsubscribeProjects();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Set default ID immediately
    const defaultId = `conv_${user.uid}_admin`;
    if (!activeConversationId) {
      setActiveConversationId(defaultId);
    }

    // Fetch all conversations the user is part of
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribeConvs = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Manual sort to avoid needing a composite index for now
      convs.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setConversations(convs);
    }, (error) => {
       console.warn("Conversations list listener error:", error);
    });

    return () => unsubscribeConvs();
  }, [user]);

  useEffect(() => {
    if (!user || !activeConversationId) return;

    // Fetch messages for active conversation
    const q = query(
      collection(db, "conversations", activeConversationId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Mark admin messages as read if chat is active
      if (activeTab === "chat") {
        msgs.forEach(msg => {
          if (msg.senderId === "admin" && !msg.read) {
            updateDoc(doc(db, "conversations", activeConversationId, "messages", msg.id), {
              read: true
            });
          }
        });
      }
    }, (error) => {
       console.warn("Message listener error (expected if channel empty):", error);
    });

    // Listen for admin's typing status
    const unsubTyping = onSnapshot(doc(db, "conversations", activeConversationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdminIsTyping(data.typing?.admin === true);
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, `conversations/${activeConversationId}`);
    });

    return () => {
      unsubscribeMessages();
      unsubTyping();
    };
  }, [user, activeConversationId, activeTab]);

  useEffect(() => {
    if (activeTab !== "chat") return;
    
    // Auto-scroll to bottom of chat
    const chatContainer = document.getElementById("chat-scroll-area");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!user) return;

    // Fetch transaction history
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeTransactions = onSnapshot(q, async (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(transData);

      // Fetch product details for completed transactions
      const completedPids = transData
        .filter(t => t.status === "completed" && t.productId)
        .map(t => t.productId!);
      
      if (completedPids.length > 0) {
        const prodData: PurchasedProduct[] = [];
        for (const pid of [...new Set(completedPids)]) {
          const pDoc = await getDoc(doc(db, "products", pid));
          if (pDoc.exists()) {
             prodData.push({ id: pDoc.id, ...pDoc.data() } as PurchasedProduct);
          }
        }
        setPurchasedProducts(prodData);
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    return () => unsubscribeTransactions();
  }, [user]);

  const notifyAdmin = async (snippet: string, conversationId?: string, messageId?: string) => {
    if (!user) return;
    try {
      await fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: user.name || user.email,
          messageSnippet: snippet,
          conversationId,
          messageId
        })
      });
    } catch (err) {
      console.warn("Failed to notify admin via email:", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, fileObj?: any) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !fileObj) return;
    if (!user) return;

    const conversationId = activeConversationId || `conv_${user.uid}_admin`;
    const messageText = newMessage;
    
    // Clear input optimistically
    setNewMessage("");

    try {
      // 1. Ensure conversation document exists with correct participants
      // We use 'admin' as a stable identifier for any admin participant to avoid real UID leaks
      // and ensure consistent channel naming.
      const convRef = doc(db, "conversations", conversationId);
      const convSnap = await getDoc(convRef);
      
      const convData = {
        participants: [user.uid, "admin"],
        lastMessage: fileObj ? `Attachment: ${fileObj.name}` : messageText,
        updatedAt: serverTimestamp(),
        lastSenderId: user.uid,
        unreadCount: increment(1)
      };

      if (!convSnap.exists()) {
        await setDoc(convRef, {
          ...convData,
          createdAt: serverTimestamp(),
          typing: {}
        });
      } else {
        await updateDoc(convRef, convData);
      }

      // 2. Add message to subcollection
      const messageData = {
        senderId: user.uid,
        text: messageText,
        timestamp: serverTimestamp(),
        read: false,
        type: fileObj ? 'file' : 'text',
        ...(fileObj && { file: fileObj }),
        ...(replyingTo && { 
          replyTo: {
            id: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.senderId
          }
        })
      };

      const docRef = await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
      
      // Clear reply state
      setReplyingTo(null);

      // 3. Notify admin (server-side handles email checking with 5s delay)
      notifyAdmin(fileObj ? `Shared an attachment: ${fileObj.name}` : messageText, conversationId, docRef.id);
    } catch (error: any) {
      console.error("Chat Error:", error);
      // Restore the message text if it failed
      setNewMessage(messageText);
      
      const errorMessage = error?.message?.includes("permission") 
        ? "Permission denied. Please try logging out and back in."
        : "Failed to send message. Please check your connection.";
        
      alert(errorMessage);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileSelection = e.target.files?.[0];
    if (!fileSelection || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const key = `chat/${Date.now()}-${fileSelection.name}`;
      const workerUrl = "https://r2-upload-worker.jsaha3741.workers.dev";
      
      const response = await fetch(`${workerUrl}/upload?key=${key}`, {
        method: "POST",
        body: fileSelection,
        headers: { "Content-Type": fileSelection.type },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const resData = await response.json();
      const fileObj = {
        url: resData.url,
        type: fileSelection.type,
        name: fileSelection.name
      };
      
      await handleSendMessage(undefined, fileObj);
      
      setIsUploading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error("Upload failed:", error);
      setIsUploading(false);
      alert("Failed to upload file. Please try again.");
    }
  };

  const handleProofSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileSelection = e.target.files?.[0];
    if (!fileSelection) return;

    setSelectedProofFile(fileSelection);
    if (fileSelection.type.startsWith("image/")) {
      const url = URL.createObjectURL(fileSelection);
      setProofPreviewUrl(url);
    } else {
      setProofPreviewUrl(null);
    }
  };

  const submitPaymentProof = async () => {
    if (!selectedProofFile || !user) return;

    setIsUploadingProof(true);
    setProofMessage({ text: "Uploading secure proof...", type: "info" });

    try {
      const key = `payment_proofs/${Date.now()}-${selectedProofFile.name}`;
      const workerUrl = "https://r2-upload-worker.jsaha3741.workers.dev";
      
      const response = await fetch(`${workerUrl}/upload?key=${key}`, {
        method: "POST",
        body: selectedProofFile,
        headers: { "Content-Type": selectedProofFile.type },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const resData = await response.json();
      
      // Save proof to Firestore
      await addDoc(collection(db, "payment_proofs"), {
        userId: user.uid,
        projectId: activeProject?.id || null,
        imageUrl: resData.url,
        status: "pending",
        createdAt: serverTimestamp(),
        notes: proofNotes || `Manual proof for ${activeProject?.title || "Account"}`
      });

      setProofMessage({ text: "Payment proof submitted successfully! Verification pending.", type: "success" });
      setSelectedProofFile(null);
      setProofPreviewUrl(null);
      setProofNotes("");
      setIsUploadingProof(false);
      
      // Clear message after 5 seconds
      setTimeout(() => setProofMessage({ text: "", type: "" }), 5000);
    } catch (error) {
      console.error("Proof upload failed:", error);
      setProofMessage({ text: "Failed to submit proof. Please try again.", type: "error" });
      setIsUploadingProof(false);
    }
  };

  useEffect(() => {
    if (!user || activeTab !== "chat" || !activeConversationId) return;
    
    const conversationId = activeConversationId;
    let typingTimeout: any;

    const handleTypingStatus = async (isTyping: boolean) => {
      if (!user || !activeConversationId) return;
      try {
        await updateDoc(doc(db, "conversations", activeConversationId), {
          [`typing.${user.uid}`]: isTyping
        });
      } catch (err) {
        // Ignore errors for metadata updates
      }
    };

    if (newMessage.length > 0) {
      handleTypingStatus(true);
      typingTimeout = setTimeout(() => handleTypingStatus(false), 3000);
    } else {
      handleTypingStatus(false);
    }

    return () => {
      clearTimeout(typingTimeout);
    };
  }, [newMessage, user, activeTab, activeConversationId]);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState("");
  const [selectedFileForPayment, setSelectedFileForPayment] = useState<any | null>(null);

  const calculateDiscountedPrice = (price: number) => {
    if (!appliedCoupon) return price;
    if (appliedCoupon.discountType === 'percentage') {
      return price - (price * (appliedCoupon.discountValue / 100));
    }
    return Math.max(0, price - appliedCoupon.discountValue);
  };

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponCode) return;
    
    try {
      const { query, collection, where, getDocs } = await import("firebase/firestore");
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase()), where("isActive", "==", true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError("Invalid or inactive coupon code.");
        setAppliedCoupon(null);
        return;
      }

      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() as any };
      
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError("This coupon has expired.");
        setAppliedCoupon(null);
        return;
      }

      if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
        setCouponError("Usage limit reached.");
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(coupon);
    } catch (err) {
      console.error(err);
      setCouponError("Validation error.");
    }
  };

  const handlePayment = async (item: any) => {
    try {
      const finalPrice = calculateDiscountedPrice(item.price);
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalPrice,
          productTitle: item.name || item.title,
          userId: user.uid,
          fileId: item.url || null,
          projectId: item.projectId || null,
          milestoneId: item.milestoneId || null,
          customerName: user.name,
          customerEmail: user.email,
          couponId: appliedCoupon?.id || null
        })
      });
      const data = await response.json();
      if (data.status === "SUCCESS") {
        window.open(data.data.checkoutUrl, "_self");
      }
    } catch (error) {
      console.error("Payment error:", error);
    }
  };

  const handleAcceptProposal = async (proposal: any) => {
    try {
      // 1. Create a project record first as pending
      const projectData = {
        title: proposal.title,
        description: proposal.description,
        clientId: user.uid,
        status: "pending",
        progress: 0,
        nextMilestone: "Initial Deposit",
        eta: "TBD",
        deadline: "TBD",
        files: [],
        totalBudget: proposal.price,
        initialDeposit: proposal.initialDeposit,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "projects"), projectData);
      
      // 2. Trigger payment for initial deposit
      handlePayment({
        title: `Deposit: ${proposal.title}`,
        price: proposal.initialDeposit,
        projectId: docRef.id
      });
      
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "projects");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...profileForm,
        updatedAt: serverTimestamp()
      });
      setUser({ ...user, ...profileForm });
      alert("Profile updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="bg-surface p-12 rounded-[2rem] border border-border shadow-2xl max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-8">
            <UserIcon size={40} />
        </div>
        <h2 className="text-3xl font-black mb-4">Client Portal</h2>
        <p className="text-ink/60 mb-8">Please sign in to access your project dashboard and chat with your developer.</p>
        <button 
           onClick={() => {/* Trigger auth modal */}}
           className="w-full py-4 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          Access Portal
        </button>
      </div>
    </div>
  );

  const PaymentConfirmationModal = () => (
    <AnimatePresence>
      {paymentResult && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-surface p-10 rounded-[3rem] border border-border shadow-2xl max-w-md w-full text-center relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className={cn(
              "absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-10",
              paymentResult === "success" ? "bg-green-500" : "bg-red-500"
            )} />

            <div className={cn(
              "w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl",
              paymentResult === "success" ? "bg-green-500 text-white shadow-green-500/20" : "bg-red-500 text-white shadow-red-500/20"
            )}>
              {paymentResult === "success" ? <CheckCircle size={48} /> : <AlertCircle size={48} />}
            </div>

            <h3 className="text-3xl font-black mb-4 tracking-tighter uppercase italic">
              {paymentResult === "success" ? "Operation Success" : "Payment Cancelled"}
            </h3>
            
            <p className="text-ink/60 mb-10 font-medium leading-relaxed">
              {paymentResult === "success" 
                ? "Your payment was processed successfully. The project files have been unlocked and are now available for download in your dashboard."
                : "The payment process was interrupted or cancelled. You can try again whenever you are ready from the payments tab."}
            </p>

            <button 
              onClick={() => {
                setPaymentResult(null);
                if (paymentResult === "success") setActiveTab("dashboard");
              }}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95",
                paymentResult === "success" ? "bg-green-500 shadow-green-500/20" : "bg-red-500 shadow-red-500/20"
              )}
            >
              CONTINUE TO PORTAL
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row relative">
      <PaymentConfirmationModal />
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border sticky top-0 z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-premium-gradient flex items-center justify-center text-white">
            <Activity size={24} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Portal</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-ink"
        >
          {isSidebarOpen ? <LogOut className="rotate-90" /> : <Layout />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[80] w-80 bg-surface border-r border-border p-8 flex flex-col gap-12 transition-transform duration-500 md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div>
          <div className="hidden md:flex items-center gap-3 mb-8">
             <div className="w-12 h-12 rounded-2xl bg-premium-gradient flex items-center justify-center text-white">
                <Activity size={28} />
             </div>
             <span className="text-2xl font-black tracking-tighter uppercase">Client Portal</span>
          </div>
          
          <nav className="space-y-1.5">
            {[
              { id: "dashboard", icon: Layout, label: "Command Center" },
              { id: "chat", icon: MessageSquare, label: "Direct Support" },
              { id: "store", icon: ShoppingBag, label: "Digital Assets" },
              { id: "payments", icon: CreditCard, label: "Billing & Invoices" },
              { id: "settings", icon: UserIcon, label: "Profile Settings" },
            ].map((item: any) => (
              <button 
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                  activeTab === item.id 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                    : "text-ink/50 hover:bg-primary/5 hover:text-primary active:scale-95"
                )}
              >
                <item.icon size={18} className={cn("transition-transform duration-300", activeTab === item.id ? "animate-pulse" : "group-hover:scale-110")} />
                {!isSidebarCollapsed && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                )}
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" 
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto pt-8 border-t border-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UserIcon size={24} />
            </div>
            <div>
              <p className="font-bold text-ink leading-none mb-1">{user.name || "Client Name"}</p>
              <p className="text-xs text-ink/40 uppercase tracking-widest font-black leading-none">Verified Account</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-6 p-4 bg-background rounded-2xl border border-border">
             <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Appearance</span>
             <ThemeToggle />
          </div>

          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-red-500/20 text-red-500 font-bold hover:bg-red-500/5 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          <Link to="/" className="w-full flex items-center justify-center gap-3 py-3 mt-4 rounded-xl text-ink/60 font-bold hover:text-primary transition-colors">
            <ExternalLink size={18} /> Return to Site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black mb-2 tracking-tighter">
              {activeTab === "dashboard" ? "Welcome back," : activeTab === "chat" ? "Direct Dialogues" : activeTab === "store" ? "Digital Assets" : "Financial Center"}
              <span className="text-primary block md:inline md:ml-3">{user.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-ink/60 font-medium">Real-time snapshots of your digital progress.</p>
          </div>

          
          <div className="flex items-center gap-4 p-2 bg-surface rounded-2xl border border-border">
             <div className="px-4 py-2 bg-green-500/10 text-green-500 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Connection
             </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div 
               key="dashboard"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-12"
            >
              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Active Projects", value: projects.filter(p => p.status !== 'completed').length, icon: Activity, color: "text-primary" },
                  { label: "Files Unlocked", value: projects.reduce((acc, p) => acc + (p.files?.filter(f => !f.isLocked).length || 0), 0), icon: Download, color: "text-green-500" },
                  { label: "Store Purchases", value: purchasedProducts.length, icon: ShoppingBag, color: "text-secondary" },
                  { label: "Pending Tasks", value: projects.filter(p => p.progress < 100).length, icon: Clock, color: "text-orange-500" },
                ].map((stat, i) => (
                  <div key={i} className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
                    <div className={cn("w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center mb-4", stat.color)}>
                      <stat.icon size={20} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">{stat.label}</p>
                    <p className="text-2xl font-black tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Search and Quick Actions */}
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                <div className="relative w-full lg:max-w-md">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20">
                      <Layout size={18} />
                   </div>
                   <input 
                      type="text" 
                      placeholder="Filter projects by title..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full bg-surface border border-border rounded-2xl pl-12 pr-6 py-4 focus:ring-2 ring-primary/20 outline-none font-medium transition-all"
                   />
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                   <button 
                     onClick={() => {
                        setActiveTab("chat");
                        setNewMessage("Hi! I'd like to request a new project quote regarding...");
                     }}
                     className="flex-1 lg:flex-none px-6 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
                   >
                     <Plus size={18} />
                     <span className="text-xs uppercase tracking-widest">New Project</span>
                   </button>
                   <button 
                     onClick={() => {
                        setActiveTab("chat");
                        setNewMessage("I need technical support with one of my active projects.");
                     }}
                     className="flex-1 lg:flex-none px-6 py-4 bg-surface border border-border text-ink font-black rounded-2xl hover:bg-background transition-colors flex items-center justify-center gap-3"
                   >
                     <MessageSquare size={18} />
                     <span className="text-xs uppercase tracking-widest">Support</span>
                   </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                {projects.filter(p => p.title.toLowerCase().includes(projectSearchTerm.toLowerCase())).map((project) => (
                  <motion.div 
                    key={project.id}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "premium-card p-8 cursor-pointer transition-all",
                      activeProject?.id === project.id ? "ring-2 ring-primary" : ""
                    )}
                    onClick={() => setActiveProject(project)}
                  >
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1 block">Project Status</span>
                        <h3 className="text-2xl font-black tracking-tight">{project.title}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 mb-1 block">Completion</span>
                        <div className="text-3xl font-black text-primary tabular-nums tracking-tighter">{project.progress}%</div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="relative">
                        {/* Progress Bar Track */}
                        <div className="h-4 w-full bg-surface-accent rounded-full overflow-hidden border border-border/50 shadow-inner">
                          {/* Progress Bar Fill */}
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${project.progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-premium-gradient relative"
                          >
                            {/* Animated Shine Effect */}
                            <motion.div 
                              animate={{ 
                                x: ["-100%", "200%"],
                              }}
                              transition={{ 
                                repeat: Infinity, 
                                duration: 2, 
                                ease: "linear",
                                repeatDelay: 1
                              }}
                              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                            />
                          </motion.div>
                        </div>
                        
                        {/* Status Label on Track */}
                        <div className="flex justify-between mt-3 px-1">
                          <span className="text-[9px] font-black uppercase italic text-ink/40">{project.status}</span>
                          <span className="text-[9px] font-black uppercase italic text-ink/40">100% Finalized</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-surface-accent rounded-2xl border border-border/50 group-hover:border-primary/20 transition-colors">
                          <div className="flex items-center gap-2 mb-2 opacity-40">
                             <Zap size={12} className="text-primary" />
                             <span className="text-[9px] font-black uppercase tracking-wider">Next Phase</span>
                          </div>
                          <p className="text-xs font-bold text-ink truncate">{project.nextMilestone}</p>
                        </div>
                        <div className="p-4 bg-surface-accent rounded-2xl border border-border/50 group-hover:border-primary/20 transition-colors">
                          <div className="flex items-center gap-2 mb-2 opacity-40">
                             <Clock size={12} className="text-secondary" />
                             <span className="text-[9px] font-black uppercase tracking-wider">Target ETA</span>
                          </div>
                          <p className="text-xs font-bold text-ink truncate">{project.eta}</p>
                        </div>
                        {project.deadline && (
                          <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/20 group-hover:border-red-500/40 transition-colors col-span-2">
                            <div className="flex items-center gap-2 mb-2 opacity-60">
                               <AlertCircle size={12} className="text-red-500" />
                               <span className="text-[9px] font-black uppercase tracking-wider text-red-500">Hard Deadline</span>
                            </div>
                            <p className="text-xs font-bold text-red-500">{new Date(project.deadline).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Option */}
                      <div className="pt-6 border-t border-border mt-6 flex items-center justify-between">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setActiveTab("chat");
                             setNewMessage(`I have a revision request for project: ${project.title}. Area of focus: `);
                           }}
                           className="text-[10px] font-black uppercase tracking-widest text-secondary hover:text-secondary/80 flex items-center gap-2 py-2 px-4 rounded-lg bg-secondary/5 hover:bg-secondary/10 transition-all"
                         >
                           <Edit3 size={12} />
                           Request Revision
                         </button>
                         <button 
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-2 py-2 px-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-all"
                            onClick={(e) => {
                               e.stopPropagation();
                               setActiveTab("chat");
                               setNewMessage(`Quick question about project: ${project.title}`);
                            }}
                         >
                            <MessageSquare size={12} />
                            Contact Lead
                         </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {activeProject && (
                <div className="space-y-12">
                  {/* Milestones Section */}
                  {activeProject.milestones && activeProject.milestones.length > 0 && (
                    <div className="bg-surface rounded-[2rem] border border-border p-8 shadow-xl">
                      <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                        <Zap size={24} className="text-secondary" />
                        Project Milestones
                      </h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeProject.milestones.map((milestone) => (
                           <div key={milestone.id} className="p-6 rounded-3xl bg-background border border-border flex flex-col justify-between transition-all hover:shadow-lg">
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                   <div className={cn(
                                     "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                     milestone.status === 'paid' ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                                   )}>
                                     {milestone.status}
                                   </div>
                                   <span className="text-sm font-black text-primary">${milestone.price}</span>
                                </div>
                                <h5 className="font-bold text-ink mb-2">{milestone.title}</h5>
                              </div>
                              
                              {milestone.status === 'pending' ? (
                                <button 
                                  onClick={() => handlePayment({
                                    ...milestone,
                                    projectId: activeProject.id,
                                    milestoneId: milestone.id
                                  })}
                                  className="w-full mt-4 py-3 bg-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <CreditCard size={14} />
                                  Pay Milestone
                                </button>
                              ) : (
                                <div className="w-full mt-4 py-3 bg-green-500/5 text-green-500 rounded-xl font-black text-xs uppercase tracking-widest border border-green-500/10 flex items-center justify-center gap-2">
                                  <CheckCircle size={14} />
                                  Payment Received
                                </div>
                              )}
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Private Project Notes Section */}
                  <ProjectNotes projectId={activeProject.id} userId={user.uid} />

                  {/* Deliverables Section */}
                  <div className="bg-surface rounded-[2rem] border border-border p-8 shadow-xl">
                  <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Download size={24} className="text-primary" />
                    Deliverables & Assets
                  </h4>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeProject.files?.map((file, i) => {
                      const isImageFile = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                      const isPDF = /\.pdf$/i.test(file.name);
                      const isDoc = /\.(doc|docx|txt)$/i.test(file.name);

                      return (
                        <div key={i} className="group p-6 rounded-3xl bg-background border border-border flex flex-col transition-all hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
                           <div className="flex-1">
                              <div className="aspect-video mb-4 rounded-2xl overflow-hidden bg-surface-accent border border-border flex items-center justify-center relative group-hover:border-primary/20 transition-colors">
                                 {isImageFile ? (
                                   <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                 ) : (
                                   <div className={cn(
                                     "w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner",
                                     isPDF ? "bg-red-500/10 text-red-500" : isDoc ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary"
                                   )}>
                                     {isPDF ? <FileText size={32} /> : isDoc ? <PenTool size={32} /> : <Paperclip size={32} />}
                                   </div>
                                 )}
                                 {!file.isLocked && (
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                      <button 
                                        onClick={() => window.open(file.url, "_blank")}
                                        className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all"
                                        title="Open in new tab"
                                      >
                                        <ExternalLink size={20} />
                                      </button>
                                   </div>
                                 )}
                                 {file.isLocked && (
                                   <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                      <div className="bg-white/90 p-3 rounded-full shadow-lg">
                                        <Clock size={24} className="text-secondary" />
                                      </div>
                                   </div>
                                 )}
                              </div>
                              
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <p className="font-bold text-ink leading-tight flex-1">{file.name}</p>
                                <div className="flex items-center gap-1">
                                   {file.isLocked ? (
                                        <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[9px] font-black uppercase rounded-md border border-secondary/10 flex items-center gap-1 whitespace-nowrap">
                                            <Clock size={10} /> Locked
                                        </span>
                                   ) : (
                                        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase rounded-md border border-green-500/10 flex items-center gap-1 whitespace-nowrap">
                                            <CheckCircle size={10} /> Ready
                                        </span>
                                   )}
                                </div>
                              </div>
                              <p className="text-[10px] text-ink/40 uppercase font-black tracking-widest mb-6">
                                {isImageFile ? "Image Asset" : isPDF ? "PDF Document" : isDoc ? "Word Document" : "Project Resource"}
                              </p>
                           </div>
                           
                           <button 
                              onClick={() => {
                                 if (file.isLocked) {
                                    handlePayment({
                                       name: file.name,
                                       price: file.price,
                                       url: file.url,
                                       projectId: activeProject.id
                                    });
                                 } else {
                                    window.open(file.url, "_blank");
                                 }
                              }}
                              className={cn(
                                 "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                                 file.isLocked 
                                  ? "bg-secondary text-white shadow-lg shadow-secondary/20 hover:bg-secondary/90" 
                                  : "bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                              )}
                           >
                              {file.isLocked ? (
                                <>
                                  <CreditCard size={18} />
                                  <span>Unlock for ${file.price}</span>
                                </>
                              ) : (
                                <>
                                  <Download size={18} />
                                  <span>Download Asset</span>
                                </>
                              )}
                           </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

          {activeTab === "chat" && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-surface rounded-[2.5rem] border border-border h-[75vh] flex flex-col shadow-2xl relative overflow-hidden ring-1 ring-border"
            >
              <div className="p-6 border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                     className="p-3 bg-background border border-border rounded-2xl text-ink/40 hover:text-primary hover:bg-primary/5 transition-all shadow-sm hidden lg:block"
                     title="Toggle Sidebar"
                   >
                      <PanelLeft size={20} className={cn("transition-transform duration-500", isSidebarCollapsed && "rotate-180")} />
                   </button>
                   <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-premium-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
                         <Sparkles size={24} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-surface rounded-full shadow-sm" />
                   </div>
                   <div>
                      <h3 className="font-bold text-ink text-lg leading-tight">Project Admin</h3>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          onlineUsers.includes('admin') ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-ink/20"
                        )} />
                        <p className={cn(
                          "text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors",
                          adminIsTyping ? "text-primary" : (onlineUsers.includes('admin') ? "text-green-500" : "text-ink/40")
                        )}>
                           {adminIsTyping ? (
                             <>
                               <span className="w-1.5 h-1.5 rounded-full block bg-primary animate-bounce" />
                               Admin is composing...
                             </>
                           ) : (
                              onlineUsers.includes('admin') ? "Online & Encrypted" : "Offline"
                           )}
                        </p>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative hidden lg:block">
                    <input 
                      type="text" 
                      placeholder="Search history..." 
                      value={chatSearchTerm}
                      onChange={(e) => setChatSearchTerm(e.target.value)}
                      className="bg-background border border-border rounded-xl px-5 py-2.5 text-xs focus:ring-2 ring-primary/20 outline-none w-56 font-medium transition-all focus:w-64"
                    />
                  </div>
                  {!user?.isBlocked && (
                    <>
                      <button 
                        onClick={() => startCall('audio')}
                        className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-2xl border border-primary/10 transition-all shadow-sm"
                        title="Audio Call"
                      >
                        <Phone size={20} />
                      </button>
                      <button 
                        onClick={() => startCall('video')}
                        className="p-3 bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-2xl border border-green-500/10 transition-all shadow-sm"
                        title="Start Video Consultation"
                      >
                        <Video size={20} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setShowAssetsSidebar(!showAssetsSidebar)}
                    className={cn(
                      "p-3 rounded-2xl border border-border transition-all hover:scale-105 active:scale-95 shadow-sm",
                      showAssetsSidebar ? "bg-primary text-white border-primary" : "bg-background text-ink/40 hover:text-primary"
                    )}
                    title="Shared Assets"
                  >
                    <Paperclip size={20} />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Chat History Sidebar */}
                <motion.div 
                  initial={false}
                  animate={{ 
                    width: isSidebarCollapsed ? 0 : 288,
                    opacity: isSidebarCollapsed ? 0 : 1,
                  }}
                  className="border-r border-border bg-surface-accent h-full overflow-hidden hidden md:block"
                >
                  <div className="w-72 h-full flex flex-col">
                    <div className="p-5 border-b border-border bg-background/30">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40">Conversations</p>
                    </div>
                    <div className="flex-1 overflow-y-auto flex flex-col p-2 gap-1">
                      {conversations.map((conv) => (
                      <button 
                        key={conv.id}
                        onClick={() => setActiveConversationId(conv.id)}
                        className={cn(
                          "p-4 rounded-2xl text-left transition-all group relative overflow-hidden",
                          activeConversationId === conv.id 
                            ? "bg-primary text-white shadow-lg shadow-primary/20" 
                            : "hover:bg-primary/5 opacity-70 hover:opacity-100"
                        )}
                      >
                        <div className="relative z-10">
                          <p className={cn("text-xs font-bold truncate mb-1", activeConversationId === conv.id ? "text-white" : "text-ink")}>
                            {conv.id === `conv_${user.uid}_admin` ? "Direct Support" : (conv.title || "Project Discussion")}
                          </p>
                          <p className={cn("text-[10px] truncate italic font-medium opacity-70", activeConversationId === conv.id ? "text-white/80" : "text-ink/60")}>
                            {conv.lastMessage || "Start a dialogue..."}
                          </p>
                          <div className={cn("flex items-center justify-between mt-2 pt-2 border-t", activeConversationId === conv.id ? "border-white/10" : "border-border")}>
                            <p className={cn("text-[9px] font-black uppercase tracking-widest", activeConversationId === conv.id ? "text-white/60" : "text-primary/60")}>
                              {conv.updatedAt?.toDate ? conv.updatedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Recently"}
                            </p>
                            {conv.unreadCount > 0 && activeConversationId !== conv.id && (
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    {conversations.length === 0 && (
                      <div className="p-10 text-center flex flex-col items-center gap-3 opacity-20 italic">
                        <MessageSquare size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest">No Dialogues</p>
                      </div>
                    )}
                    </div>
                  </div>
                </motion.div>

                <div className="flex-1 flex flex-col relative h-full bg-background/20 backdrop-blur-sm overflow-hidden">
                  <div id="chat-scroll-area" className="flex-1 p-6 md:p-8 overflow-y-auto space-y-4 scroll-smooth bg-background-alt/30">
                    {messages.length === 0 ? (
                       <div key="no-messages" className="h-full flex flex-col items-center justify-center text-center py-20 opacity-60">
                          <div className="w-24 h-24 rounded-[2.5rem] bg-background border border-border flex items-center justify-center text-primary mb-6 shadow-sm">
                            <MessageSquare size={48} className="opacity-20" />
                          </div>
                          <h4 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Secure Channel</h4>
                          <p className="text-sm font-medium text-ink/40 max-w-xs">Start a secure, encrypted conversation with our team.</p>
                       </div>
                    ) : (
                      <div className="flex flex-col space-y-4">
                        {messages.filter(m => 
                          !chatSearchTerm || (m.text || "").toLowerCase().includes(chatSearchTerm.toLowerCase())
                        ).map((msg, index, filteredArray) => {
                          const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleDateString() : (msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : "");
                          const isMe = msg.senderId === user.uid;
                          const nextMsg = filteredArray[index + 1];
                          const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                          
                          return (
                            <div 
                              key={msg.id || index}
                              className={cn(
                                "group flex flex-col gap-1.5 max-w-[85%] sm:max-w-[70%]",
                                (msg as any).deleted ? "opacity-50 italic" : "",
                                isMe ? "ml-auto items-end" : "mr-auto items-start",
                                isLastInGroup ? "mb-4" : "mb-1"
                              )}
                            >
                              {msg.replyTo && (
                                <div 
                                  onClick={() => {
                                     const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                                     if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }}
                                  className={cn(
                                   "mb-[-16px] pb-5 px-4 pt-3 rounded-2xl text-[11px] font-medium border-l-4 cursor-pointer transition-all hover:brightness-95",
                                   isMe ? "bg-white/10 border-white/40 mr-4" : "bg-primary/5 border-primary ml-4"
                                 )}>
                                   <div className="flex items-center gap-1.5 mb-1">
                                      <Reply size={10} className="rotate-180 opacity-60" />
                                      <p className="font-black uppercase tracking-[0.1em] text-[9px] opacity-60">
                                         {msg.replyTo.senderId === user.uid ? "You" : "Support Team"}
                                      </p>
                                   </div>
                                   <p className="truncate italic opacity-70">"{msg.replyTo.text}"</p>
                                 </div>
                               )}
                              
                              <div className={cn(
                                "p-4 md:p-5 rounded-3xl relative shadow-lg transition-all group/msg",
                                isMe 
                                  ? "bg-primary text-white shadow-primary/20" 
                                  : "bg-surface border border-border text-ink shadow-ink/5",
                                isMe && isLastInGroup ? "rounded-tr-none" : "",
                                !isMe && isLastInGroup ? "rounded-tl-none" : ""
                              )}>
                                {/* Hover Actions for WhatsApp-like feel */}
                                <div className={cn(
                                  "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-all flex items-center gap-1 z-30",
                                  isMe ? "right-full mr-3 translate-x-2 group-hover/msg:translate-x-0" : "left-full ml-3 -translate-x-2 group-hover/msg:translate-x-0"
                                )}>
                                  <button 
                                    onClick={() => setReplyingTo(msg)}
                                    className="p-2 bg-surface border border-border rounded-full text-ink/40 hover:text-primary hover:border-primary transition-all shadow-sm"
                                    title="Reply"
                                  >
                                    <Reply size={14} />
                                  </button>
                                  {isMe && !(msg as any).deleted && (
                                    <>
                                      {msg.type !== 'call' && (
                                        <button 
                                          onClick={() => {
                                            setEditingMessage({ id: msg.id, text: msg.text });
                                            setNewMessage(msg.text);
                                          }}
                                          className="p-2 bg-surface border border-border rounded-full text-ink/40 hover:text-secondary hover:border-secondary transition-all shadow-sm"
                                          title="Edit"
                                        >
                                          <Edit3 size={14} />
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => { if(confirm("Delete this message?")) handleDeleteMessage(msg.id); }}
                                        className="p-2 bg-surface border border-border rounded-full text-ink/40 hover:text-red-500 hover:border-red-500 transition-all shadow-sm"
                                        title="Delete"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>

                                {msg.type === 'call' ? (
                                  <div className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border min-w-[200px]",
                                    isMe ? "bg-white/10 border-white/20" : "bg-surface-accent border-border shadow-inner"
                                  )}>
                                     <div className={cn(
                                       "p-2 rounded-lg",
                                       msg.callStatus === 'started' ? "bg-blue-500 text-white" :
                                       msg.callStatus === 'missed' ? "bg-red-500 text-white" : 
                                       msg.callStatus === 'cancelled' ? "bg-gray-500 text-white" : "bg-green-500 text-white"
                                     )}>
                                        {(msg as any).callStatus === 'missed' ? <PhoneOff size={16} /> : <Phone size={16} />}
                                     </div>
                                     <div>
                                        <p className="text-sm font-bold">{msg.text}</p>
                                        <p className={cn("text-[10px] opacity-60 uppercase font-black tracking-widest", isMe ? "text-white/70" : "text-ink/40")}>{(msg as any).callStatus}</p>
                                     </div>
                                  </div>
                                ) : msg.type === 'proposal' ? (
                                  <div className="flex flex-col gap-5 p-2">
                                    <div className="flex items-center gap-4">
                                      <div className="w-16 h-16 rounded-[1.5rem] bg-premium-gradient text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                        <Sparkles size={32} />
                                      </div>
                                      <div>
                                        <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-1", isMe ? "text-white/60" : "text-primary/60")}>Project Milestone Proposal</p>
                                        <p className="text-xl font-black tracking-tight">{msg.proposalData?.title}</p>
                                      </div>
                                    </div>
                                    
                                    <div className={cn("p-5 rounded-2xl border", isMe ? "bg-white/10 border-white/20" : "bg-background border-border")}>
                                       <p className="text-sm leading-relaxed italic opacity-80">"{msg.proposalData?.description}"</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                       <div className={cn("p-4 rounded-2xl border", isMe ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/20")}>
                                          <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/60" : "text-primary")}>Budget</p>
                                          <p className="text-2xl font-black tabular-nums">${msg.proposalData?.price}</p>
                                       </div>
                                       <div className={cn("p-4 rounded-2xl border", isMe ? "bg-white/10 border-white/20" : "bg-secondary/5 border-secondary/20")}>
                                          <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/60" : "text-secondary")}>Initial Deposit</p>
                                          <p className="text-2xl font-black tabular-nums">${msg.proposalData?.initialDeposit}</p>
                                       </div>
                                    </div>

                                    <motion.button 
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleAcceptProposal(msg.proposalData)}
                                      className={cn(
                                        "w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all flex items-center justify-center gap-3 border relative overflow-hidden group/btn",
                                        isMe 
                                          ? "bg-white text-primary border-white" 
                                          : "bg-premium-gradient text-white border-primary shadow-primary/40"
                                      )}
                                    >
                                      <motion.div 
                                        animate={{ 
                                          x: ["-100%", "200%"],
                                        }}
                                        transition={{ 
                                          repeat: Infinity, 
                                          duration: 3, 
                                          ease: "linear",
                                          repeatDelay: 2
                                        }}
                                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
                                      />
                                      <ShoppingBag size={14} className="group-hover/btn:rotate-12 transition-transform" />
                                      Order Now & Initialize Project
                                    </motion.button>
                                  </div>
                                ) : msg.type === 'meeting_request' ? (
                                  <MeetingRequestCard 
                                    msg={msg} 
                                    isMe={isMe} 
                                    isClientView={true} 
                                    conversationId={activeConversationId || `conv_${user.uid}_admin`} 
                                  />
                                ) : msg.file ? (
                                  <div className="flex flex-col gap-3 min-w-[200px] md:min-w-[280px]">
                                    {msg.file.type?.startsWith('image/') ? (
                                      <div className="relative group/img overflow-hidden rounded-2xl shadow-2xl">
                                        <img 
                                          src={msg.file.url} 
                                          alt={msg.file.name} 
                                          className="w-full h-auto max-h-[300px] object-cover cursor-pointer hover:brightness-90 transition-all duration-500" 
                                          onClick={() => window.open(msg.file!.url, '_blank')} 
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none bg-black/40 backdrop-blur-sm">
                                           <div className="p-3 bg-white text-primary rounded-full shadow-lg">
                                              <ExternalLink size={24} />
                                           </div>
                                        </div>
                                      </div>
                                    ) : msg.file.type?.startsWith('video/') ? (
                                      <video controls className="w-full rounded-2xl shadow-2xl border border-border">
                                        <source src={msg.file.url} type={msg.file.type} />
                                      </video>
                                    ) : (
                                      <div className={cn(
                                        "flex flex-col gap-4 p-4 rounded-2xl border transition-all",
                                        isMe ? "bg-white/10 border-white/20" : "bg-surface-accent border-border"
                                      )}>
                                        <div className="flex items-center gap-4">
                                          <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl",
                                            msg.file.type?.includes('pdf') ? "bg-red-500 text-white" : "bg-primary text-white"
                                          )}>
                                            {msg.file.type?.includes('pdf') ? <FileText size={28} /> : <Paperclip size={28} />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-bold truncate", isMe ? "text-white" : "text-ink")}>{msg.file.name}</p>
                                            <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 mt-0.5", isMe ? "text-white/80" : "text-ink/40")}>
                                              {msg.file.type?.split('/')[1] || 'DOC'} • Resource
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <a 
                                            href={msg.file.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className={cn(
                                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95",
                                              isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-background border border-border text-ink hover:bg-surface-accent"
                                            )}
                                          >
                                            <ExternalLink size={14} /> Preview
                                          </a>
                                          <a 
                                            href={msg.file.url} 
                                            download={msg.file.name}
                                            className={cn(
                                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg",
                                              isMe ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white hover:bg-primary/90"
                                            )}
                                          >
                                            <Download size={14} /> Fetch
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[15px] font-medium leading-relaxed selection:bg-white/30">{msg.text}</p>
                                )}
                                
                                <div className={cn(
                                  "flex items-center gap-2 mt-2",
                                  isMe ? "justify-end" : "justify-start"
                                )}>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest opacity-50",
                                    isMe ? "text-white" : "text-ink"
                                  )}>
                                    {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Transmitting...")}
                                  </span>
                                  {isMe && (
                                    <div className="flex items-center -space-x-1.5">
                                       <CheckCircle size={10} className={cn("transition-colors", msg.read ? "text-white opacity-100" : "text-white opacity-30")} />
                                       {msg.read && <CheckCircle size={10} className="text-white opacity-60" />}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {adminIsTyping && (
                      <div className="mr-auto items-start flex flex-col gap-1 max-w-[70%] mt-4">
                        <div className="bg-surface border border-border text-ink p-4 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-3">
                          <div className="flex gap-1 items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-75" />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Admin is responding</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 md:p-6 bg-surface border-t border-border relative overflow-visible z-30">
                    <AnimatePresence>
                      {replyingTo && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="mb-4 bg-background border border-border shadow-sm rounded-2xl overflow-hidden flex items-stretch group"
                        >
                          <div className={cn(
                            "w-1.5",
                            replyingTo.senderId === user.uid ? "bg-primary" : "bg-secondary"
                          )} />
                          <div className="flex-1 p-3 px-4 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                replyingTo.senderId === user.uid ? "text-primary" : "text-secondary"
                              )}>
                                {replyingTo.senderId === user.uid ? "Your Message" : "Support Team"}
                              </p>
                              <button onClick={() => setReplyingTo(null)} className="p-1 text-ink/20 hover:text-red-500 transition-colors">
                                <X size={14} />
                              </button>
                            </div>
                            <p className="text-xs text-ink/60 truncate pr-4 italic font-medium">
                               {replyingTo.type === 'file' ? (
                                 <span className="flex items-center gap-2">
                                   <Paperclip size={10} /> Attachment: {replyingTo.file?.name}
                                 </span>
                               ) : replyingTo.text}
                            </p>
                          </div>
                        </motion.div>
                      )}
                      {editingMessage && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="mb-4 p-4 bg-secondary/5 border-l-4 border-secondary rounded-2xl flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-secondary mb-1">Editing Message</p>
                            <p className="text-xs text-ink/60 truncate italic">"{editingMessage.text}"</p>
                          </div>
                          <button onClick={() => { setEditingMessage(null); setNewMessage(""); }} className="p-2 text-ink/30 hover:text-red-500 transition-colors">
                            <X size={16} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {user?.isBlocked ? (
                      <div className="p-6 bg-red-500/5 border border-red-500/15 rounded-3xl flex items-center justify-center gap-3 text-red-500 text-sm font-medium">
                        <AlertCircle size={20} className="shrink-0" />
                        <span>Your messaging and call access has been disabled by the administrator.</span>
                      </div>
                    ) : (
                      <form 
                        onSubmit={editingMessage ? (e) => { e.preventDefault(); handleEditMessage(editingMessage.id, newMessage); } : (e) => handleSendMessage(e)} 
                        className="flex gap-4 items-end"
                      >
                        {isUploading && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-surface ring-1 ring-border/50">
                            <motion.div 
                              className="h-full bg-premium-gradient shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress || 50}%` }}
                            />
                          </div>
                        )}
                      
                      <div className="flex gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="p-4 bg-background border border-border rounded-2xl transition-all shadow-sm hover:ring-2 hover:ring-primary/20 hover:scale-105 active:scale-95 text-ink/40 hover:text-primary group flex items-center justify-center"
                          title="Schedule Video Consultation"
                        >
                          <Calendar size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <label className="cursor-pointer p-4 bg-background border border-border rounded-2xl transition-all shadow-sm hover:ring-2 hover:ring-primary/20 hover:scale-105 active:scale-95 text-ink/40 hover:text-primary group">
                          <Paperclip size={20} className="group-hover:rotate-12 transition-transform" />
                          <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,application/pdf,application/zip" />
                        </label>
                      </div>

                      <div className="flex-1 relative">
                         <textarea 
                            value={newMessage}
                            onChange={(e) => {
                              setNewMessage(e.target.value);
                              if (socket && user && activeConversationId) {
                                socket.emit("typing", { conversationId: activeConversationId, userId: user.uid, isTyping: e.target.value.length > 0 });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            onBlur={() => {
                              if (socket && user && activeConversationId) {
                                 socket.emit("typing", { conversationId: activeConversationId, userId: user.uid, isTyping: false });
                              }
                            }}
                            placeholder={isUploading ? "Processing secure upload..." : "Compose a message..."}
                            disabled={isUploading}
                            rows={1}
                            className="w-full bg-background border border-border p-4 pr-16 rounded-[1.5rem] text-sm md:text-base font-medium text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 ring-primary/20 disabled:opacity-50 min-h-[56px] max-h-32 resize-none transition-all scrollbar-hide"
                         />
                         <button 
                            type="submit"
                            disabled={(!newMessage.trim() && !isUploading) || isUploading}
                            className="absolute right-2 bottom-2 p-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:shadow-none"
                         >
                            <Send size={20} />
                         </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

                <AnimatePresence>
                  {showAssetsSidebar && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 340, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="border-l border-border bg-surface-accent h-full overflow-y-auto hidden xl:block"
                    >
                      <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                            <ImageIcon size={14} /> Vault Assets
                          </h4>
                          <span className="px-2 py-0.5 bg-background border border-border rounded-md text-[9px] font-bold opacity-60">
                            {messages.filter(m => m.file).length} items
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {messages.filter(m => m.file).map((msg, i) => (
                            <motion.div 
                              key={i} 
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="aspect-square bg-background rounded-2xl border border-border overflow-hidden group cursor-pointer shadow-sm relative" 
                              onClick={() => window.open(msg.file?.url, '_blank')}
                            >
                              {msg.file?.type?.startsWith('image/') ? (
                                <img src={msg.file.url} className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-500" alt="" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                  <div className={cn(
                                    "p-3 rounded-xl mb-2",
                                    msg.file?.type?.includes('pdf') ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                                  )}>
                                    <FileText size={24} />
                                  </div>
                                  <span className="text-[9px] font-black uppercase truncate w-full px-2 opacity-60">{msg.file?.name}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center">
                                <Download size={20} className="text-white" />
                              </div>
                            </motion.div>
                          ))}
                          {messages.filter(m => m.file).length === 0 && (
                            <div className="col-span-2 py-20 text-center flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border rounded-3xl opacity-20">
                              <Paperclip size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest">No shared media</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === "store" && (
            <motion.div 
               key="store"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
               <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {purchasedProducts.length === 0 ? (
                     <div className="lg:col-span-3 p-20 text-center rounded-[3rem] border-2 border-dashed border-border">
                        <ShoppingBag size={64} className="mx-auto mb-6 text-ink/10" />
                        <h3 className="text-2xl font-black mb-2 italic opacity-40">No Digital Artifacts Found</h3>
                        <p className="text-ink-muted">Visit the main store to acquire premium source code packages.</p>
                     </div>
                  ) : (
                     purchasedProducts.map((product) => (
                        <div key={product.id} className="premium-card p-0 overflow-hidden flex flex-col group">
                           <div className="relative aspect-video overflow-hidden">
                              <img src={product.preview_image} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={product.title} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute top-4 left-4 flex flex-col gap-2">
                                 <span className="px-3 py-1 bg-green-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">License: Lifetime</span>
                                 <span className="px-3 py-1 bg-primary/90 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded-lg shadow-lg">{product.category || "General"}</span>
                              </div>
                           </div>
                           <div className="p-6">
                              <h3 className="text-xl font-black mb-6">{product.title}</h3>
                              <a 
                                href={product.source_code_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-3 py-4 bg-primary text-white rounded-xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
                              >
                                 <Download size={20} /> Download Source Code
                              </a>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </motion.div>
          )}

          {activeTab === "payments" && (
            <motion.div 
               key="payments"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="flex flex-col gap-8"
            >
               {/* Locked Deliverables Section */}
               {activeProject?.files?.some(f => f.isLocked) && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-[2rem] p-8">
                     <div className="flex items-center gap-3 mb-6">
                        <AlertCircle className="text-yellow-500" />
                        <h4 className="text-xl font-black">Locked Deliverables Awaiting Payment</h4>
                     </div>
                     <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeProject.files.filter(f => f.isLocked).map((file, idx) => (
                           <div key={idx} className="bg-background p-6 rounded-2xl border border-border flex flex-col justify-between gap-4 shadow-sm">
                              <div>
                                 <p className="font-bold text-ink mb-1 truncate">{file.name}</p>
                                 <div className="flex flex-col gap-1">
                                    <p className={cn("text-2xl font-black transition-all", appliedCoupon ? "text-ink/30 line-through text-sm" : "text-primary")}>${file.price}</p>
                                    {appliedCoupon && (
                                       <p className="text-2xl font-black text-primary">${calculateDiscountedPrice(file.price)}</p>
                                    )}
                                  </div>
                                 <p className="text-[10px] text-ink/40 font-black uppercase tracking-widest mt-2 flex items-center gap-1">
                                    <Clock size={10} /> Pending Unlock
                                 </p>
                              </div>

                              {/* Coupon Application Inline */}
                              <div className="space-y-2 pt-2 border-t border-border">
                                 <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="CODE"
                                      value={couponCode}
                                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                      className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-bold uppercase"
                                    />
                                    <button 
                                      onClick={handleApplyCoupon}
                                      className="px-2 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all"
                                    >
                                      Apply
                                    </button>
                                 </div>
                                 {appliedCoupon && <p className="text-[9px] text-green-500 font-bold uppercase">Applied!</p>}
                                 {couponError && <p className="text-[9px] text-red-500 font-bold uppercase">{couponError}</p>}
                              </div>
                              <button 
                                 onClick={() => handlePayment(file)}
                                 className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                              >
                                 {appliedCoupon ? "Pay Discounted" : "Pay with UddoktaPay"}
                              </button>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-surface rounded-[2rem] border border-border p-8 shadow-xl">
                  <h4 className="text-2xl font-black mb-8">Transaction Logs</h4>
                  <div className="space-y-4">
                     {transactions.length === 0 ? (
                        <div className="p-12 text-center opacity-40">
                           <CreditCard size={48} className="mx-auto mb-4" />
                           <p className="font-bold">No transactions found</p>
                           <p className="text-sm">Your payment history will appear here.</p>
                        </div>
                     ) : (
                        transactions.map(t => (
                           <div key={t.id} className="p-6 rounded-2xl bg-background border border-border flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <div className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center",
                                   t.status === "completed" ? "bg-green-500/10 text-green-500" : 
                                   t.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                                 )}>
                                    <CreditCard size={20} />
                                 </div>
                                 <div className="overflow-hidden max-w-[150px] md:max-w-none">
                                    <p className="font-bold text-ink truncate">{t.fileId || "Project Milestone"}</p>
                                    <p className="text-[10px] text-ink/40 font-black uppercase tracking-widest">
                                       {t.createdAt?.toDate()?.toLocaleDateString() || "Processing..."} • ID: {t.id.slice(0, 8)}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-xl font-black text-ink">${t.amount}</p>
                                 <p className={cn(
                                   "text-[10px] font-black uppercase tracking-widest",
                                   t.status === "completed" ? "text-green-500" : 
                                   t.status === "failed" ? "text-red-500" : "text-yellow-500"
                                 )}>{t.status}</p>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>

               <div className="bg-premium-gradient rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-20 -right-20 opacity-10"
                  >
                    <Globe size={250} />
                  </motion.div>
                  <div className="relative z-10 flex flex-col h-full">
                     <h4 className="text-4xl font-black mb-6 tracking-tighter italic">Secure Payments</h4>
                     <p className="text-white/80 font-medium mb-12">I support payments via UddoktaPay. Instant settlement, secure verification, and zero friction. Choose the smarter way to pay for digital artifacts.</p>
                     
                     <div className="mt-auto space-y-4">
                        {proofMessage.text && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg",
                              proofMessage.type === "success" ? "bg-green-500 text-white" : 
                              proofMessage.type === "error" ? "bg-red-500 text-white" : "bg-white text-primary"
                            )}
                          >
                            {proofMessage.text}
                          </motion.div>
                        )}

                        {!selectedProofFile ? (
                          <label className="w-full flex items-center justify-center gap-3 py-6 bg-white/10 backdrop-blur-md border-2 border-dashed border-white/30 text-white rounded-[2rem] font-black cursor-pointer hover:bg-white/20 transition-all group">
                            <div className="flex flex-col items-center gap-2">
                               <div className="w-12 h-12 rounded-2xl bg-white text-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                  <Plus size={24} />
                               </div>
                               <span className="text-[10px] uppercase tracking-[0.2em] mt-2">Select Payment Proof</span>
                            </div>
                            <input type="file" className="hidden" onChange={handleProofSelection} accept="image/*,application/pdf" disabled={isUploadingProof} />
                          </label>
                        ) : (
                          <div className="space-y-4">
                             <div className="bg-white/10 backdrop-blur-md p-4 rounded-[2rem] border border-white/20">
                                <div className="flex items-center justify-between mb-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-white text-primary flex items-center justify-center">
                                         <ImageIcon size={20} />
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-xs font-black truncate max-w-[150px]">{selectedProofFile.name}</p>
                                         <p className="text-[9px] opacity-60 uppercase font-black tracking-widest">{(selectedProofFile.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                   </div>
                                   <button 
                                     onClick={() => { setSelectedProofFile(null); setProofPreviewUrl(null); }}
                                     className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                   >
                                      <X size={18} />
                                   </button>
                                </div>
                                
                                {proofPreviewUrl && (
                                   <div className="aspect-video w-full rounded-xl overflow-hidden mb-4 border border-white/10">
                                      <img src={proofPreviewUrl} className="w-full h-full object-cover" alt="Preview" />
                                   </div>
                                )}

                                <textarea 
                                  placeholder="Add notes (Transaction ID, reason, etc.)"
                                  value={proofNotes}
                                  onChange={(e) => setProofNotes(e.target.value)}
                                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 ring-white/50 resize-none h-20"
                                />
                             </div>

                             <button 
                                onClick={submitPaymentProof}
                                disabled={isUploadingProof}
                                className="w-full py-4 bg-white text-primary rounded-2xl font-black shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                             >
                                {isUploadingProof ? (
                                  <>
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                    <span>Transmitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle size={20} />
                                    <span>Confirm & Submit Proof</span>
                                  </>
                                )}
                             </button>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary">
                              <CheckCircle size={24} />
                           </div>
                           <p className="font-bold text-white">Instant File Unlocking</p>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-secondary">
                              <CheckCircle size={24} />
                           </div>
                           <p className="font-bold text-white">Zero Chargeback Risk</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </motion.div>
      )}

      {activeTab === "settings" && (
        <motion.div 
           key="settings"
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           className="max-w-4xl"
        >
           <div className="bg-surface p-10 rounded-[3rem] border border-border shadow-xl">
              <h4 className="text-2xl font-black mb-8 flex items-center gap-3">
                 <UserIcon size={32} className="text-primary" />
                 Profile Information
              </h4>
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 ml-1">Full Name</label>
                    <input 
                       value={profileForm.name} 
                       onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                       className="w-full bg-background border border-border rounded-2xl p-5 focus:ring-2 ring-primary/20 outline-none font-bold" 
                       placeholder="Your full name"
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 ml-1">Email Address</label>
                    <input 
                       value={profileForm.email} 
                       disabled
                       className="w-full bg-background border border-border rounded-2xl p-5 opacity-60 font-bold cursor-not-allowed" 
                       placeholder="email@example.com"
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 ml-1">Phone Number</label>
                    <input 
                       value={profileForm.phone} 
                       onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                       className="w-full bg-background border border-border rounded-2xl p-5 focus:ring-2 ring-primary/20 outline-none font-bold" 
                       placeholder="+1 (555) 000-0000"
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 ml-1">Mailing Address</label>
                    <input 
                       value={profileForm.address} 
                       onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                       className="w-full bg-background border border-border rounded-2xl p-5 focus:ring-2 ring-primary/20 outline-none font-bold" 
                       placeholder="123 Street, City, Country"
                    />
                 </div>
                 <div className="md:col-span-2 pt-6">
                    <button 
                       type="submit"
                       className="px-10 py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 uppercase tracking-widest text-xs"
                    >
                       Update Account Details
                    </button>
                 </div>
              </form>
           </div>
           
           <div className="mt-8 bg-red-500/5 p-10 rounded-[3rem] border border-red-500/10">
              <h5 className="text-red-500 font-black mb-2 uppercase tracking-widest text-sm">Security Zone</h5>
              <p className="text-ink/60 text-sm mb-6">Need to update your password or delete your account? Please contact our lead developer via the direct support channel for security verification.</p>
              <button 
                type="button"
                onClick={() => setActiveTab("chat")}
                className="px-6 py-3 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500/5 transition-all"
              >
                 Contact Security Support
              </button>
           </div>
        </motion.div>
      )}

        </AnimatePresence>

        {/* Video Call Modal for Client */}
        <AnimatePresence>
          {showVideoCall && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8"
            >
              <div className="w-full max-w-4xl aspect-video bg-zinc-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-white/10 group">
                {remoteStream ? (
                  <video 
                    autoPlay 
                    playsInline 
                    ref={el => { if(el) el.srcObject = remoteStream; }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-6">
                    <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                        <UserIcon size={64} />
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-black uppercase tracking-[0.2em] mb-2">{callStatus === 'incoming' ? 'Incoming Secure Connection' : 'Initializing Satellite Link...'}</p>
                        <p className="text-white/20 text-xs font-mono">CLIENT PORTAL // SECURE P2P</p>
                    </div>
                  </div>
                )}
                
                <div className="absolute right-6 bottom-6 w-48 md:w-64 aspect-video bg-zinc-800 rounded-3xl overflow-hidden border border-white/20 shadow-2xl z-20">
                  <video 
                    autoPlay 
                    playsInline 
                    muted 
                    ref={el => { if(el) el.srcObject = localStream; }}
                    className="w-full h-full object-cover"
                  />
                </div>

                {callStatus === "incoming" && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl flex flex-col items-center justify-center gap-12 z-30">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-premium-gradient flex items-center justify-center text-white animate-pulse shadow-2xl shadow-primary/40 relative z-10">
                          {incomingCallData?.callType === 'audio' ? <Phone size={48} /> : <Video size={48} />}
                      </div>
                      <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20" />
                    </div>
                    <div className="text-center px-6">
                      <h2 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase italic">{incomingCallData?.callType === 'audio' ? 'Admin Audio Call' : 'Admin Video Request'}</h2>
                    </div>
                    <div className="flex gap-8">
                        <button 
                          onClick={answerCall}
                          className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center shadow-2xl shadow-green-500/20 hover:scale-110 active:scale-95 transition-all group"
                        >
                          <Phone size={32} className="group-hover:animate-bounce" />
                        </button>
                        <button 
                          onClick={endCall}
                          className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-500/20 hover:scale-110 active:scale-95 transition-all group"
                        >
                          <X size={32} />
                        </button>
                    </div>
                  </div>
                )}

                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 py-4 px-8 bg-black/40 backdrop-blur-3xl rounded-full border border-white/10 shadow-2xl z-40">
                   <button 
                     onClick={toggleMic}
                     className={cn(
                       "w-12 h-12 flex items-center justify-center rounded-full text-white transition-all",
                       isMicMuted ? "bg-red-500" : "bg-white/5 hover:bg-white/10"
                     )}
                   >
                     {isMicMuted ? <MicOff size={20} /> : <Phone size={20} className="rotate-[135deg]" />}
                   </button>
                   <button 
                     onClick={toggleCamera}
                     className={cn(
                       "w-12 h-12 flex items-center justify-center rounded-full text-white transition-all",
                       isCameraOff ? "bg-red-500" : "bg-white/5 hover:bg-white/10"
                     )}
                   >
                     {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                   </button>
                   <button 
                     onClick={endCall}
                     className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-2xl shadow-red-500/30 hover:scale-110 active:scale-90 transition-all flex items-center justify-center"
                   >
                     <Phone size={28} className="rotate-[135deg]" />
                   </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scheduling Request Modal */}
        <AnimatePresence>
          {isScheduleModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-surface border border-border rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
              >
                <button 
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="absolute top-5 right-5 p-2 rounded-full hover:bg-background transition-colors text-ink/40 hover:text-ink"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-ink">Schedule Video Meeting</h3>
                    <p className="text-xs text-ink/40">Request a date and time for a video consultation</p>
                  </div>
                </div>

                <form onSubmit={handleRequestMeeting} className="space-y-5 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/50">Date</label>
                      <input 
                        type="date" 
                        required
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl p-3 text-xs font-bold text-ink focus:outline-none focus:ring-2 ring-primary/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/50">Time</label>
                      <input 
                        type="time" 
                        required
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl p-3 text-xs font-bold text-ink focus:outline-none focus:ring-2 ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/50">Notes / Agenda (Optional)</label>
                    <textarea 
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="e.g. Discussing project milestones, design updates..."
                      rows={3}
                      className="w-full bg-background border border-border rounded-xl p-3 text-xs font-bold text-ink focus:outline-none focus:ring-2 ring-primary/20 transition-all resize-none placeholder:text-ink/30"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(false)}
                      className="flex-1 py-3 px-4 border border-border hover:bg-background rounded-xl text-xs font-black uppercase tracking-widest transition-all text-center text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingMeeting}
                      className="flex-1 py-3 px-4 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 text-center"
                    >
                      {isSubmittingMeeting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
