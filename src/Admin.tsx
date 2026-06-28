import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Edit2, X, Image as ImageIcon, Briefcase, MessageSquare, Star, Share2, PenTool, ArrowLeft, User, Play, Send, CheckCircle, Clock, CreditCard, ShoppingBag, ExternalLink, Paperclip, FileText, Download, Globe, Zap, Sparkles, Quote, Tag, Percent, DollarSign, Award,
  Video, Phone, PhoneOff, MicOff, VideoOff, Reply, Edit3, MoreVertical, PanelLeft, ChevronLeft, ChevronRight, User as UserIcon, ShieldAlert, Menu, Upload, Layers, Check
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { MeetingRequestCard } from "./components/MeetingRequestCard";
import { Link } from "react-router-dom";
import { cn } from "./lib/utils";
import { io, Socket } from "socket.io-client";
import { db, auth } from "./firebase";
import { handleFirestoreError, OperationType } from "./lib/firestore-errors";
import { 
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, query, where, orderBy, serverTimestamp 
} from "firebase/firestore";

export default function Admin({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<"projects" | "clients" | "chat" | "transactions" | "settings" | "store" | "portfolio" | "coupons" | "proofs" | "blog">("projects");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentProofs, setPaymentProofs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [blog, setBlog] = useState<any[]>([]);
  const [portfolioContent, setPortfolioContent] = useState<any>({
    hero: { name: "", role: "", bio: "", image: "" },
    socials: { github: "", linkedin: "", twitter: "", email: "" },
    contact: { address: "", phone: "" },
    about: { title: "", description: "", image: "", imageSmall: "", stat1Label: "", stat1Value: "", stat2Label: "", stat2Value: "" },
    resumeUrl: "",
    brandName: "",
    logoType: "icon",
    logoIcon: "Activity",
    logoImage: "",
    sectionVisibility: {
      contact: true,
      store: true,
      services: true,
      experience: true,
      gallery: true,
      testimonials: true,
      education: true,
      skills: true,
      portfolio: true,
      blog: true
    }
  });

  const [skillForm, setSkillForm] = useState({ name: "", icon: "", category: "Frontend" });
  const [eduForm, setEduForm] = useState({ degree: "", school: "", period: "", description: "" });
  const [certForm, setCertForm] = useState({ title: "", image: "", description: "" });
  const [serviceForm, setServiceForm] = useState({ title: "", description: "", icon: "" });
  const [portfolioProjectForm, setPortfolioProjectForm] = useState({ title: "", description: "", image: "", gallery: [] as string[], demo_link: "", tags: [] as string[] });
  const [expForm, setExpForm] = useState({ company: "", role: "", period: "", description: "" });
  const [galleryForm, setGalleryForm] = useState({ url: "", title: "", category: "Project" });
  const [testimonialForm, setTestimonialForm] = useState({ name: "", role: "", company: "", text: "", image: "" });
  const [blogForm, setBlogForm] = useState({ 
    title: "", 
    slug: "", 
    excerpt: "", 
    content: "", 
    image: "", 
    category: "Tech",
    published_at: new Date().toISOString().split('T')[0]
  });
  const [proposalForm, setProposalForm] = useState({ title: "", description: "", price: 0, initialDeposit: 0 });
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [clientIsTyping, setClientIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uddoktaSettings, setUddoktaSettings] = useState<any>({
    apiKey: "****************",
    baseUrl: "https://sandbox.uddoktapay.com/api/checkout-v2"
  });
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newProject, setNewProject] = useState({ 
    title: "", 
    clientId: "", 
    status: "pending", 
    progress: 0, 
    nextMilestone: "", 
    milestones: [] as any[],
    eta: "", 
    deadline: "",
    description: "",
    files: [] as any[]
  });

  const [milestoneForm, setMilestoneForm] = useState({ title: "", price: 0 });

  const addMilestone = () => {
    if (!milestoneForm.title || milestoneForm.price <= 0) return;
    const milestone = {
      id: "ms-" + Date.now(),
      title: milestoneForm.title,
      price: milestoneForm.price,
      status: "pending"
    };
    setNewProject(prev => ({
      ...prev,
      milestones: [...(prev.milestones || []), milestone]
    }));
    setMilestoneForm({ title: "", price: 0 });
  };

  const removeMilestone = (id: string) => {
    setNewProject(prev => ({
      ...prev,
      milestones: (prev.milestones || []).filter((m: any) => m.id !== id)
    }));
  };

  const [productForm, setProductForm] = useState({
    title: "",
    description: "",
    price: 0,
    category: "Full-Stack",
    live_demo_url: "",
    source_code_url: "",
    preview_image: ""
  });

  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "percentage",
    discountValue: 0,
    expiryDate: "",
    usageLimit: 100,
    isActive: true
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
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

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit("identify-admin");

    newSocket.on("user-presence", (users: string[]) => {
      setOnlineUsers(users);
    });

    newSocket.on("call-rejected", ({ reason }) => {
      if (reason === "busy") {
        alert("Client is currently in another call.");
      }
      endCall();
    });

    newSocket.on("incoming-call", (data) => {
      setIncomingCallData(data);
      // If we are getting a call from a conversation we haven't selected, 
      // we might need to find that conversation or just allow answering it.
      if (data.conversationId && (!activeConversation || activeConversation.id !== data.conversationId)) {
        // We'll trust the signaling to use the conversationId from the call data
      }
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

  const startCall = async (callType: 'video' | 'audio' = 'video') => {
    if (!socket || !activeConversation) return;
    
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
          socket.emit("ice-candidate", { conversationId: activeConversation.id, candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit("call-user", { conversationId: activeConversation.id, offer, from: "admin", callType });
      setPeerConnection(pc);

      // Log call
      await addDoc(collection(db, "conversations", activeConversation.id, "messages"), {
        senderId: "admin",
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
    const conversationId = incomingCallData.conversationId || activeConversation?.id;
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
        senderId: "admin",
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
    const conversationId = incomingCallData?.conversationId || activeConversation?.id;

    if (callStatus === "calling" || callStatus === "incoming") {
      // Log missed call / cancelled call
      const callType = incomingCallData?.callType || (showVideoCall && !localStream?.getVideoTracks().length ? 'audio' : 'video');
      if (conversationId) {
        await addDoc(collection(db, "conversations", conversationId, "messages"), {
          senderId: "admin",
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

  useEffect(() => {
    if (socket && activeConversation) {
      socket.emit("join-room", activeConversation.id);

      socket.on("user-typing", ({ userId, isTyping }) => {
        if (userId !== auth.currentUser?.uid) {
          setClientIsTyping(isTyping);
        }
      });

      return () => {
        socket.off("user-typing");
      };
    }
  }, [socket, activeConversation]);

  useEffect(() => {
    // SECURITY: only attach listeners if user exists and is admin
    if (!user || user.role !== 'admin') return;
    
    // Real-time synchronization
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "projects");
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "users");
    });

    const unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc")), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "uddoktapay"), (snap) => {
      if (snap.exists()) {
        setUddoktaSettings(snap.data());
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, "settings/uddoktapay");
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
       setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "products");
    });

    const unsubPortfolio = onSnapshot(doc(db, "settings", "portfolio"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPortfolioContent({
          hero: {
            name: data.hero?.name || data.name || "",
            role: data.hero?.role || data.role || "",
            bio: data.hero?.bio || data.bio || "",
            image: data.hero?.image || data.profilePic || "",
          },
          socials: {
            github: data.socials?.github || data.github || "",
            linkedin: data.socials?.linkedin || data.linkedin || "",
            twitter: data.socials?.twitter || data.twitter || "",
            email: data.socials?.email || data.email || "",
          },
          contact: {
            address: data.contact?.address || data.location || "",
            phone: data.contact?.phone || data.phone || "",
          },
          about: {
            aboutTitle: data.about?.aboutTitle || data.aboutTitle || "",
            aboutDescription: data.about?.aboutDescription || data.aboutDescription || "",
            aboutImage: data.about?.aboutImage || data.aboutImage || "",
            aboutImageSmall: data.about?.aboutImageSmall || data.aboutImageSmall || "",
            stat1Label: data.about?.stat1Label || data.stat1Label || "",
            stat1Value: data.about?.stat1Value || data.stat1Value || "",
            stat2Label: data.about?.stat2Label || data.stat2Label || "",
            stat2Value: data.about?.stat2Value || data.stat2Value || "",
          },
          resumeUrl: data.resumeUrl || data.hero?.resumeUrl || ""
        });
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, "settings/portfolio");
    });

    const unsubSkills = onSnapshot(collection(db, "skills"), (snap) => {
      setSkills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "skills");
    });

    const unsubEdu = onSnapshot(collection(db, "education"), (snap) => {
      setEducation(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "education");
    });

    const unsubCertificates = onSnapshot(collection(db, "certificates"), (snap) => {
      setCertificates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "certificates");
    });

    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "services");
    });

    const unsubPortfolioProjects = onSnapshot(collection(db, "portfolio_projects"), (snap) => {
      setPortfolioProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "portfolio_projects");
    });

    const unsubExperience = onSnapshot(collection(db, "experience"), (snap) => {
      setExperience(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "experience");
    });

    const unsubGallery = onSnapshot(collection(db, "gallery"), (snap) => {
      setGallery(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "gallery");
    });

    const unsubTestimonials = onSnapshot(collection(db, "testimonials"), (snap) => {
      setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "testimonials");
    });

    const unsubBlog = onSnapshot(collection(db, "blog"), (snap) => {
      setBlog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "blog");
    });

    const unsubCoupons = onSnapshot(collection(db, "coupons"), (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "coupons");
    });

    const unsubProofs = onSnapshot(query(collection(db, "payment_proofs"), orderBy("createdAt", "desc")), (snap) => {
       setPaymentProofs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, "payment_proofs");
    });

    return () => {
      unsubProjects();
      unsubUsers();
      unsubTransactions();
      unsubSettings();
      unsubProducts();
      unsubPortfolio();
      unsubSkills();
      unsubEdu();
      unsubCertificates();
      unsubServices();
      unsubPortfolioProjects();
      unsubExperience();
      unsubGallery();
      unsubTestimonials();
      unsubBlog();
      unsubCoupons();
      unsubProofs();
    };
  }, []);

  useEffect(() => {
    if (!activeConversation || !user || user.role !== 'admin') {
      setClientIsTyping(false);
      return;
    }

    const unsubTyping = onSnapshot(doc(db, "conversations", activeConversation.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const clientId = activeConversation.participants.find((p: string) => p !== auth.currentUser?.uid);
        setClientIsTyping(data.typing?.[clientId] === true);
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, `conversations/${activeConversation.id}`);
    });

    return () => unsubTyping();
  }, [activeConversation]);

  useEffect(() => {
    if (!activeConversation || activeTab !== "chat") return;

    let typingTimeout: any;
    const handleTyping = async (isTyping: boolean) => {
      // Use updateDoc to avoid creating documents if they don't exist yet
      try {
        await updateDoc(doc(db, "conversations", activeConversation.id), {
          "typing.admin": isTyping
        });
      } catch (err) {
        // Silently fail if conversation doc doesn't exist yet, it's fine
      }
    };

    if (newMessage.length > 0) {
      handleTyping(true);
      typingTimeout = setTimeout(() => handleTyping(false), 3000);
    } else {
      handleTyping(false);
    }

    return () => clearTimeout(typingTimeout);
  }, [newMessage, activeConversation, activeTab]);

  const saveSettings = async () => {
    await setDoc(doc(db, "settings", "uddoktapay"), {
      ...uddoktaSettings,
      updatedAt: serverTimestamp()
    });
    alert("UddoktaPay configuration deployed successfully.");
  };

  const handleProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const key = `deliverables/${Date.now()}-${file.name}`;
      const workerUrl = "https://r2-upload-worker.jsaha3741.workers.dev";
      
      const response = await fetch(`${workerUrl}/upload?key=${key}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const resData = await response.json();
      
      const newFileObj = {
        name: file.name,
        url: resData.url,
        type: file.type,
        price: 0,
        isLocked: false
      };
      
      setNewProject(prev => ({
        ...prev,
        files: [...(prev.files || []), newFileObj]
      }));
      
      setIsUploading(false);
    } catch (err) {
      console.error("Upload error:", err);
      setIsUploading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "projects", editingId), {
        ...newProject,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, "projects"), {
        ...newProject,
        updatedAt: serverTimestamp()
      });
    }
    setEditingId(null);
    setNewProject({ 
      title: "", 
      clientId: "", 
      status: "pending", 
      progress: 0, 
      nextMilestone: "", 
      milestones: [],
      eta: "", 
      deadline: "", 
      description: "", 
      files: [] 
    });
  };

  const handleProofStatus = async (proofId: string, status: 'pending' | 'verified' | 'rejected') => {
    try {
      await updateDoc(doc(db, "payment_proofs", proofId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payment_proofs/${proofId}`);
    }
  };

  const handleCreateStoreProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), {
        ...productForm,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, "products"), {
        ...productForm,
        createdAt: serverTimestamp()
      });
    }
    setEditingId(null);
    setProductForm({ title: "", description: "", price: 0, category: "Full-Stack", live_demo_url: "", source_code_url: "", preview_image: "" });
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "coupons", editingId), {
          ...couponForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "coupons"), {
          ...couponForm,
          usageCount: 0,
          createdAt: serverTimestamp()
        });
      }
      setEditingId(null);
      setCouponForm({ code: "", discountType: "percentage", discountValue: 0, expiryDate: "", usageLimit: 100, isActive: true });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "coupons");
    }
  };

  const notifyClient = async (userId: string, snippet: string, conversationId?: string, messageId?: string) => {
    const client = users.find(u => u.uid === userId);
    if (!client) return;

    await fetch("/api/notify-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail: client.email,
        clientName: client.name,
        messageSnippet: snippet,
        portalLink: window.location.origin + "/portal",
        conversationId,
        messageId
      })
    });
  };

  const handleSendMessage = async (e?: React.FormEvent, fileObj?: any) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !fileObj) return;
    if (!activeConversation) return;

    const conversationId = activeConversation.id;
    const msgText = newMessage;
    const replyData = replyingTo;
    
    // Clear input optimistically
    setNewMessage("");
    setReplyingTo(null);

    try {
      // 1. Ensure conversation document is updated/exists
      const convRef = doc(db, "conversations", conversationId);
      const convSnap = await getDoc(convRef);
      
      const clientId = conversationId.replace('conv_', '').replace('_admin', '');
      
      const convData = {
        participants: [clientId, "admin"],
        lastMessage: fileObj ? `Attachment: ${fileObj.name}` : msgText,
        updatedAt: serverTimestamp(),
        lastSenderId: "admin",
        unreadCount: 0 
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
        senderId: "admin",
        text: msgText,
        timestamp: serverTimestamp(),
        read: false,
        type: fileObj ? 'file' : 'text',
        ...(fileObj && { file: fileObj }),
        ...(replyData && { 
          replyTo: {
            id: replyData.id,
            text: replyData.text,
            senderId: replyData.senderId
          }
        })
      };

      const docRef = await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
      setReplyingTo(null);
      setEditingMessage(null);

      // 3. Notify Client
      notifyClient(clientId, fileObj ? `Shared an attachment: ${fileObj.name}` : msgText, conversationId, docRef.id);
    } catch (error) {
      console.error("Admin Chat Error:", error);
      setNewMessage(msgText);
      alert("Failed to send message. Please check the network.");
    }
  };

  const handleEditMessageAdmin = async (messageId: string, newText: string) => {
    if (!activeConversation || !newText.trim()) return;
    try {
      const msgRef = doc(db, "conversations", activeConversation.id, "messages", messageId);
      await updateDoc(msgRef, {
        text: newText,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setEditingMessage(null);
      setNewMessage("");
      if (socket) {
        socket.emit("edit-message", { 
          conversationId: activeConversation.id, 
          messageId, 
          newText,
          senderId: "admin"
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${activeConversation.id}/messages/${messageId}`);
    }
  };

  const handleDeleteMessageAdmin = async (messageId: string) => {
    if (!activeConversation) return;
    const confirm = window.confirm("Are you sure you want to delete this message for everyone?");
    if (!confirm) return;

    try {
      const msgRef = doc(db, "conversations", activeConversation.id, "messages", messageId);
      await updateDoc(msgRef, {
        isDeleted: true,
        text: "This message was deleted",
        updatedAt: serverTimestamp()
      });
      if (socket) {
        socket.emit("delete-message", { 
          conversationId: activeConversation.id, 
          messageId,
          senderId: "admin"
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${activeConversation.id}/messages/${messageId}`);
    }
  };

  const handleSendProposal = async () => {
    if (!activeConversation || !proposalForm.title || proposalForm.price <= 0) return;

    try {
      const messageData = {
        senderId: "admin",
        text: `PROJECT PROPOSAL: ${proposalForm.title}`,
        timestamp: serverTimestamp(),
        read: false,
        type: 'proposal',
        proposalData: {
          ...proposalForm,
          createdAt: new Date().toISOString(),
          status: 'pending'
        }
      };

      const conversationId = activeConversation.id;
      const clientId = conversationId.replace('conv_', '').replace('_admin', '');

      const docRef = await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
      
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: `Project Proposal: ${proposalForm.title}`,
        updatedAt: serverTimestamp(),
        lastSenderId: "admin"
      });

      if (clientId) {
        notifyClient(clientId, `Sent a project proposal: ${proposalForm.title}`, conversationId, docRef.id);
      }

      setProposalForm({ title: "", description: "", price: 0, initialDeposit: 0 });
      setShowProposalModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${activeConversation.id}/messages`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const key = `chat/${Date.now()}-${file.name}`;
      const workerUrl = "https://r2-upload-worker.jsaha3741.workers.dev";
      
      const response = await fetch(`${workerUrl}/upload?key=${key}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const resData = await response.json();
      const fileObj = {
        url: resData.url,
        type: file.type,
        name: file.name
      };
      
      await handleSendMessage(undefined, fileObj);
      
      setIsUploading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error("Admin upload failed:", error);
      setIsUploading(false);
      alert("Failed to upload file.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'testimonial' | 'portfolio_project' | 'portfolio_gallery' | 'blog' | 'product' | 'portfolio_hero' | 'portfolio_about' | 'portfolio_about_small' | 'portfolio_resume' | 'portfolio_gallery_item' | 'portfolio_logo_image' | 'portfolio_certificate') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const key = `${target}/${Date.now()}-${file.name}`;
      const workerUrl = "https://r2-upload-worker.jsaha3741.workers.dev";
      
      const response = await fetch(`${workerUrl}/upload?key=${key}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const resData = await response.json();
      const fileObj = {
        url: resData.url,
        type: file.type,
        name: file.name
      };
      
      if (target === 'testimonial') setTestimonialForm(prev => ({ ...prev, image: fileObj.url }));
      else if (target === 'portfolio_project') setPortfolioProjectForm(prev => ({ ...prev, image: fileObj.url }));
      else if (target === 'portfolio_gallery') setPortfolioProjectForm(prev => ({ ...prev, gallery: [...(prev.gallery || []), fileObj.url] }));
      else if (target === 'portfolio_gallery_item') setGalleryForm(prev => ({ ...prev, url: fileObj.url }));
      else if (target === 'blog') setBlogForm(prev => ({ ...prev, image: fileObj.url }));
      else if (target === 'product') setProductForm(prev => ({ ...prev, preview_image: fileObj.url }));
      else if (target === 'portfolio_hero') setPortfolioContent(prev => ({ ...prev, hero: { ...prev.hero, image: fileObj.url } }));
      else if (target === 'portfolio_about') setPortfolioContent(prev => ({ ...prev, about: { ...prev.about, aboutImage: fileObj.url } }));
      else if (target === 'portfolio_about_small') setPortfolioContent(prev => ({ ...prev, about: { ...prev.about, aboutImageSmall: fileObj.url } }));
      else if (target === 'portfolio_resume') setPortfolioContent(prev => ({ ...prev, resumeUrl: fileObj.url }));
      else if (target === 'portfolio_logo_image') setPortfolioContent(prev => ({ ...prev, logoImage: fileObj.url }));
      else if (target === 'portfolio_certificate') setCertForm(prev => ({ ...prev, image: fileObj.url }));
      
      setIsUploading(false);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      alert("Image upload failed");
    }
  };

  const handleSavePortfolioSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const flatAndNestedData = {
        ...portfolioContent,
        name: portfolioContent?.hero?.name || "",
        role: portfolioContent?.hero?.role || "",
        bio: portfolioContent?.hero?.bio || "",
        profilePic: portfolioContent?.hero?.image || "",
        aboutTitle: portfolioContent?.about?.aboutTitle || "",
        aboutDescription: portfolioContent?.about?.aboutDescription || "",
        aboutImage: portfolioContent?.about?.aboutImage || "",
        aboutImageSmall: portfolioContent?.about?.aboutImageSmall || "",
        email: portfolioContent?.socials?.email || "",
        github: portfolioContent?.socials?.github || "",
        linkedin: portfolioContent?.socials?.linkedin || "",
        twitter: portfolioContent?.socials?.twitter || "",
        phone: portfolioContent?.contact?.phone || "",
        location: portfolioContent?.contact?.address || "",
        stat1Value: portfolioContent?.about?.stat1Value || "",
        stat1Label: portfolioContent?.about?.stat1Label || "",
        stat2Value: portfolioContent?.about?.stat2Value || "",
        stat2Label: portfolioContent?.about?.stat2Label || "",
        resumeUrl: portfolioContent?.resumeUrl || "",
        brandName: portfolioContent?.brandName || "",
        logoType: portfolioContent?.logoType || "icon",
        logoIcon: portfolioContent?.logoIcon || "Activity",
        logoImage: portfolioContent?.logoImage || "",
      };
      await setDoc(doc(db, "settings", "portfolio"), flatAndNestedData);
      alert("Portfolio settings updated!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "settings/portfolio");
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "skills", editingId), skillForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "skills"), skillForm);
      }
      setSkillForm({ name: "", icon: "", category: "Frontend" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "skills");
    }
  };

  const handleAddEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "education", editingId), eduForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "education"), eduForm);
      }
      setEduForm({ degree: "", school: "", period: "", description: "" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "education");
    }
  };

  const handleAddCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certForm.title || !certForm.image || !certForm.description) {
      alert("Please fill all certificate fields including image upload.");
      return;
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "certificates", editingId), {
          ...certForm,
          updatedAt: serverTimestamp()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "certificates"), {
          ...certForm,
          createdAt: serverTimestamp()
        });
      }
      setCertForm({ title: "", image: "", description: "" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "certificates");
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "services", editingId), serviceForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "services"), serviceForm);
      }
      setServiceForm({ title: "", description: "", icon: "" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "services");
    }
  };

  const handleAddPortfolioProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "portfolio_projects", editingId), portfolioProjectForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "portfolio_projects"), portfolioProjectForm);
      }
      setPortfolioProjectForm({ title: "", description: "", image: "", gallery: [], demo_link: "", tags: [] });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "portfolio_projects");
    }
  };
  
  const handleAddExp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "experience", editingId), expForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "experience"), expForm);
      }
      setExpForm({ company: "", role: "", period: "", description: "" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "experience");
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "gallery", editingId), galleryForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "gallery"), galleryForm);
      }
      setGalleryForm({ url: "", title: "", category: "Project" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "gallery");
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "testimonials", editingId), testimonialForm);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "testimonials"), testimonialForm);
      }
      setTestimonialForm({ name: "", role: "", company: "", text: "", image: "" });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "testimonials");
    }
  };

  const handleAddBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const slug = blogForm.slug || blogForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const finalData = { ...blogForm, slug, updatedAt: serverTimestamp() };
      
      if (editingId) {
        await updateDoc(doc(db, "blog", editingId), finalData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "blog"), {
          ...finalData,
          createdAt: serverTimestamp()
        });
      }
      setBlogForm({ 
        title: "", 
        slug: "", 
        excerpt: "", 
        content: "", 
        image: "", 
        category: "Tech",
        published_at: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, "blog");
    }
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (window.confirm("Are you sure?")) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row relative">
      {/* Mobile Sticky Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border sticky top-0 z-50 w-full h-[60px]">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-xl bg-background border border-border text-ink hover:bg-ink/5 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-sm font-bold text-ink">Admin</span>
          <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">{activeTab}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-background border border-border text-ink hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "bg-surface border-r border-border flex-col transition-all duration-300 z-40 md:sticky md:top-0 md:h-screen overflow-y-auto",
        isMobileMenuOpen ? "fixed inset-x-0 top-[60px] bottom-0 flex" : "hidden md:flex",
        isAdminSidebarCollapsed ? "md:w-24" : "md:w-72"
      )}>
        <div className={cn(
          "p-6 border-b border-border items-center transition-all duration-300 hidden md:flex",
          isAdminSidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isAdminSidebarCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <Link to="/" className="p-2 rounded-xl bg-background border border-border text-ink hover:bg-ink/5 transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-xl font-bold text-primary truncate">Admin</h1>
            </motion.div>
          )}
          <button 
            onClick={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
            className="p-2 rounded-xl bg-background border border-border text-ink hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            {isAdminSidebarCollapsed ? <PanelLeft size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="p-4 flex flex-col gap-1.5 overflow-y-auto scrollbar-hide max-h-[calc(100vh-140px)]">
          {[
            { id: "projects", icon: Briefcase, label: "Core Projects" },
            { id: "clients", icon: User, label: "Client Records" },
            { id: "chat", icon: MessageSquare, label: "Neural Chat" },
            { id: "store", icon: ShoppingBag, label: "Asset Store" },
            { id: "coupons", icon: Tag, label: "Promo Codes" },
            { id: "transactions", icon: CreditCard, label: "Ledger" },
            { id: "proofs", icon: ImageIcon, label: "Manual Proofs" },
            { id: "portfolio", icon: Globe, label: "Identity Node" },
            { id: "blog", icon: PenTool, label: "Nerve Center" },
            { id: "settings", icon: Zap, label: "System Config" },
          ].map((item: any) => (
            <button 
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden active:scale-95",
                isAdminSidebarCollapsed ? "md:justify-center justify-start" : "justify-start",
                activeTab === item.id 
                  ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                  : "text-ink/60 hover:bg-primary/5 hover:text-primary"
              )}
              title={isAdminSidebarCollapsed ? item.label : ""}
            >
              <item.icon size={18} className={cn("transition-transform duration-300 flex-shrink-0", activeTab === item.id ? "animate-pulse" : "group-hover:scale-110")} />
              {(isMobileMenuOpen || !isAdminSidebarCollapsed) && (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate">{item.label}</span>
              )}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="adminTabGlow"
                  className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" 
                />
              )}
            </button>
          ))}
        </nav>

        {(isMobileMenuOpen || !isAdminSidebarCollapsed) && (
          <div className="mt-auto p-6 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={20} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">System Admin</p>
                <p className="text-[10px] text-ink-muted uppercase tracking-widest font-bold">Authenticated</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        )}
        {(!isMobileMenuOpen && isAdminSidebarCollapsed) && (
          <div className="mt-auto p-6 border-t border-border flex flex-col items-center gap-4">
             <ThemeToggle />
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={20} />
             </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === "projects" && (
            <motion.div 
               key="projects"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
              <form onSubmit={handleCreateProject} className="card grid md:grid-cols-2 gap-4">
                <h2 className="text-xl font-bold md:col-span-2">{editingId ? "Update Project" : "Initiate New Project"}</h2>
                <input placeholder="Project Title" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="bg-background border border-border rounded-lg p-3" required />
                <select value={newProject.clientId} onChange={e => setNewProject({...newProject, clientId: e.target.value})} className="bg-background border border-border rounded-lg p-3" required>
                   <option value="">Select Client</option>
                   {users.filter(u => u.role === 'client').map(u => (
                      <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>
                   ))}
                </select>
                <select value={newProject.status} onChange={e => setNewProject({...newProject, status: e.target.value})} className="bg-background border border-border rounded-lg p-3">
                   <option value="pending">Pending</option>
                   <option value="in-progress">In Progress</option>
                   <option value="completed">Completed</option>
                </select>
                <input type="number" placeholder="Progress %" value={newProject.progress} onChange={e => setNewProject({...newProject, progress: parseInt(e.target.value)})} className="bg-background border border-border rounded-lg p-3" />
                <input placeholder="Next Milestone" value={newProject.nextMilestone} onChange={e => setNewProject({...newProject, nextMilestone: e.target.value})} className="bg-background border border-border rounded-lg p-3" />
                <input placeholder="ETA" value={newProject.eta} onChange={e => setNewProject({...newProject, eta: e.target.value})} className="bg-background border border-border rounded-lg p-3" />
                <input type="date" placeholder="Deadline" value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="bg-background border border-border rounded-lg p-3" />
                <textarea placeholder="Description" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="bg-background border border-border rounded-lg p-3 md:col-span-2" />
                
                <div className="md:col-span-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-ink/60 uppercase tracking-widest text-xs">Payment Milestones</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <input 
                      placeholder="Milestone Title" 
                      value={milestoneForm.title} 
                      onChange={e => setMilestoneForm({...milestoneForm, title: e.target.value})} 
                      className="bg-background border border-border rounded-lg p-2 text-xs"
                    />
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/40" />
                      <input 
                        type="number" 
                        placeholder="Price" 
                        value={milestoneForm.price} 
                        onChange={e => setMilestoneForm({...milestoneForm, price: parseFloat(e.target.value)})} 
                        className="w-full bg-background border border-border rounded-lg p-2 pl-7 text-xs"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={addMilestone}
                      className="bg-primary text-white text-xs font-black uppercase rounded-lg px-4 py-2 hover:bg-primary/90 transition-all"
                    >
                      Add Milestone
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newProject.milestones?.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-white",
                            m.status === 'paid' ? "bg-green-500" : "bg-orange-500"
                          )}>
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-xs">{m.title}</p>
                            <p className="text-[10px] opacity-40 uppercase font-black">${m.price} • {m.status}</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeMilestone(m.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-ink/60 uppercase tracking-widest text-xs">Deliverables & Assets</h3>
                    <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary hover:text-white transition-all">
                       <Plus size={14} /> Upload Asset
                       <input type="file" className="hidden" onChange={handleProjectFileUpload} />
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    {newProject.files?.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-background border border-border rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-surface-accent flex items-center justify-center text-primary">
                          {/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name) ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={file.isLocked} 
                                onChange={(e) => {
                                  const updatedFiles = [...newProject.files];
                                  updatedFiles[idx].isLocked = e.target.checked;
                                  setNewProject({...newProject, files: updatedFiles});
                                }}
                                className="w-4 h-4 rounded text-primary"
                              />
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Locked</span>
                            </label>
                            {file.isLocked && (
                              <div className="flex items-center bg-surface rounded-md border border-border px-2">
                                <DollarSign size={10} className="text-secondary" />
                                <input 
                                  type="number" 
                                  value={file.price} 
                                  onChange={(e) => {
                                    const updatedFiles = [...newProject.files];
                                    updatedFiles[idx].price = parseFloat(e.target.value);
                                    setNewProject({...newProject, files: updatedFiles});
                                  }}
                                  className="w-16 bg-transparent border-none text-[10px] font-black p-1 focus:ring-0"
                                  placeholder="Price"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedFiles = newProject.files.filter((_, i) => i !== idx);
                            setNewProject({...newProject, files: updatedFiles});
                          }}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!newProject.files || newProject.files.length === 0) && (
                      <p className="text-center py-6 text-xs italic opacity-30">No deliverables uploaded yet.</p>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn-primary md:col-span-2 py-4 justify-center text-lg">
                   {editingId ? <CheckCircle size={20} /> : <Plus size={20} />}
                   {editingId ? "Sync Updates" : "Deploy Project Tracking"}
                </button>
              </form>

              <div className="grid lg:grid-cols-2 gap-6">
                 {projects.map(p => (
                    <div key={p.id} className="card group hover:ring-2 ring-primary transition-all">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <h3 className="text-xl font-bold">{p.title}</h3>
                             <p className="text-xs text-primary font-black uppercase tracking-widest">{users.find(u => u.uid === p.clientId)?.name || "Unknown Client"}</p>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => {setEditingId(p.id); setNewProject({...p});}} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors">
                                <Edit2 size={16} />
                             </button>
                             <button onClick={() => deleteDoc(doc(db, "projects", p.id))} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-ink/40">
                             <span>Progress</span>
                             <span>{p.progress}%</span>
                          </div>
                          <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                             <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
            </motion.div>
          )}

          {activeTab === "clients" && (
            <div className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink/40">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Search clients by name or email..." 
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full bg-surface border border-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 ring-primary transition-all shadow-sm"
                />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users
                  .filter(u => 
                    u.name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                    u.email?.toLowerCase().includes(clientSearchTerm.toLowerCase())
                  )
                  .map(u => (
                    <div key={u.id} className="card flex items-center gap-4 group hover:border-primary transition-colors">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-black">
                        {u.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink truncate">{u.name}</p>
                        <p className="text-xs text-ink/40 truncate">{u.email}</p>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/5 text-primary rounded-full">{u.role}</span>
                      </div>
                    </div>
                  ))}
                {users.filter(u => 
                  u.name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                  u.email?.toLowerCase().includes(clientSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="col-span-full py-12 text-center card bg-surface-accent border-dashed border-2">
                    <p className="text-ink/40 font-bold">No clients match your search criteria.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="flex bg-surface rounded-[2.5rem] border border-border h-[80vh] overflow-hidden shadow-2xl relative">
               <motion.div 
                 initial={false}
                 animate={{ 
                   width: isChatSidebarCollapsed ? 0 : (activeConversation ? (typeof window !== "undefined" && window.innerWidth < 768 ? 0 : 320) : (typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : 320)),
                   opacity: isChatSidebarCollapsed ? 0 : (activeConversation && typeof window !== "undefined" && window.innerWidth < 768 ? 0 : 1)
                 }}
                 className={cn(
                   "border-r border-border bg-background-alt/30 overflow-hidden flex-col",
                   activeConversation ? "hidden md:flex md:w-[320px]" : "flex w-full md:w-[320px]"
                 )}
               >
                  <div className="p-6 border-b border-border bg-background/50 flex items-center justify-between">
                     <h3 className="font-black italic uppercase text-sm tracking-tighter">Active Dialogues</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {users.filter(u => u.role === 'client').map(client => (
                       <button 
                          key={client.uid} 
                          onClick={() => setActiveConversation({ id: `conv_${client.uid}_admin`, participants: [client.uid, auth.currentUser?.uid], clientName: client.name })}
                          className={cn(
                             "w-full p-6 border-b border-border transition-all flex items-center gap-4 relative group",
                             activeConversation?.id === `conv_${client.uid}_admin` ? "bg-primary text-white" : "hover:bg-primary/5 bg-surface"
                          )}
                       >
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-lg",
                            activeConversation?.id === `conv_${client.uid}_admin` ? "bg-white text-primary" : "bg-primary/10 text-primary"
                          )}>
                             {client.name?.[0]}
                          </div>
                          <div className="text-left overflow-hidden flex-1">
                             <div className="flex items-center gap-2">
                               <div className={cn(
                                 "w-2 h-2 rounded-full",
                                 onlineUsers.includes(client.uid) ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-ink/20"
                               )} />
                               <p className="font-bold truncate">{client.name}</p>
                             </div>
                             <p className={cn("text-[10px] uppercase font-black tracking-widest opacity-60 truncate", activeConversation?.id === `conv_${client.uid}_admin` ? "text-white" : "text-ink")}>{client.email}</p>
                          </div>
                       </button>
                    ))}
                  </div>
               </motion.div>
               
               <div className={cn(
                 "flex-1 flex flex-col bg-background/30 relative",
                 activeConversation ? "flex" : "hidden md:flex"
               )}>
                  {activeConversation ? (
                     <>
                        <div className="p-4 border-b border-border bg-surface flex items-center justify-between z-10">
                           <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setActiveConversation(null)}
                                className="p-2.5 bg-background border border-border rounded-xl text-ink hover:text-primary hover:bg-primary/5 transition-all shadow-sm md:hidden"
                              >
                                <ArrowLeft size={20} />
                              </button>
                              <button 
                                onClick={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
                                className="p-2.5 bg-background border border-border rounded-xl text-ink/40 hover:text-primary hover:bg-primary/5 transition-all shadow-sm hidden lg:block"
                              >
                                <PanelLeft size={20} className={cn("transition-transform duration-500", isChatSidebarCollapsed && "rotate-180")} />
                              </button>
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-sm">
                                 {activeConversation.clientName?.[0] || 'C'}
                              </div>
                              <div>
                                 <h3 className="font-bold text-ink leading-tight">{activeConversation.clientName || 'Client Chat'}</h3>
                                 <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      onlineUsers.includes(activeConversation.id.replace('conv_', '').replace('_admin', '')) ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-ink/20"
                                    )} />
                                    {clientIsTyping ? (
                                      <p className="text-[10px] text-primary animate-pulse font-black uppercase tracking-widest">Digital input sharing...</p>
                                    ) : (
                                      <p className={cn(
                                        "text-[10px] font-black uppercase tracking-widest",
                                        onlineUsers.includes(activeConversation.id.replace('conv_', '').replace('_admin', '')) ? "text-green-500" : "text-ink/40"
                                      )}>
                                        {onlineUsers.includes(activeConversation.id.replace('conv_', '').replace('_admin', '')) ? "Connection Stable" : "Client Offline"}
                                      </p>
                                    )}
                                 </div>
                              </div>
                           </div>
                           {(() => {
                             const clientUid = activeConversation.id.replace('conv_', '').replace('_admin', '');
                             const clientUser = users.find(u => u.uid === clientUid || u.id === clientUid);
                             const isBlocked = clientUser?.isBlocked || false;
                             const handleToggleBlock = async () => {
                               try {
                                 const clientRef = doc(db, "users", clientUid);
                                 await updateDoc(clientRef, {
                                   isBlocked: !isBlocked
                                 });
                               } catch (err) {
                                 console.error("Failed to toggle block status:", err);
                               }
                             };
                             return (
                               <div className="flex items-center gap-3">
                                 <button 
                                   onClick={handleToggleBlock}
                                   className={cn(
                                     "p-3 rounded-2xl border transition-all shadow-sm flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider",
                                     isBlocked 
                                       ? "bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse" 
                                       : "bg-red-500/10 text-red-600 border-red-500/10 hover:bg-red-500 hover:text-white"
                                   )}
                                   title={isBlocked ? "Unlock Client Portal Access" : "Block Client Portal Access"}
                                 >
                                    <ShieldAlert size={20} />
                                    <span className="hidden sm:inline">{isBlocked ? "Blocked" : "Block Client"}</span>
                                 </button>
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
                                   title="Video Call"
                                 >
                                    <Video size={20} />
                                 </button>
                               </div>
                             );
                           })()}
                        </div>
                        
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                           <ChatMessages 
                             conversationId={activeConversation.id} 
                             currentConv={activeConversation} 
                             setReplyingTo={setReplyingTo}
                             setEditingMessage={setEditingMessage}
                             handleDeleteMessageAdmin={handleDeleteMessageAdmin}
                             setNewMessage={setNewMessage}
                           />
                        </div>

                        <div className="p-4 md:p-6 bg-surface border-t border-border relative overflow-visible z-20">
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
                                  replyingTo.senderId === "admin" ? "bg-primary" : "bg-blue-500"
                                )} />
                                <div className="flex-1 p-3 px-4 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <p className={cn(
                                      "text-[9px] font-black uppercase tracking-widest",
                                      replyingTo.senderId === "admin" ? "text-primary" : "text-blue-500"
                                    )}>
                                      {replyingTo.senderId === "admin" ? "Your Message" : "Client Message"}
                                    </p>
                                    <button onClick={() => setReplyingTo(null)} className="p-1 text-ink/20 hover:text-red-500 transition-colors">
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <p className="text-xs text-ink/60 truncate pr-4 italic">
                                     {replyingTo.type === 'file' ? `Attachment: ${replyingTo.file?.name}` : replyingTo.text}
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
                          
                          <form 
                            onSubmit={editingMessage ? (e) => { e.preventDefault(); handleEditMessageAdmin(editingMessage.id, newMessage); } : handleSendMessage} 
                            className="flex gap-4 items-end"
                          >
                            {isUploading && (
                               <div className="absolute top-0 left-0 w-full h-1 bg-background">
                                  <motion.div 
                                     className="h-full bg-primary"
                                     initial={{ width: 0 }}
                                     animate={{ width: `${uploadProgress}%` }}
                                  />
                               </div>
                            )}

                            <label className="cursor-pointer p-4 hover:bg-background border border-border rounded-xl transition-all text-ink/40 hover:text-primary shadow-sm" title="Upload Attachment">
                               <Paperclip size={24} />
                               <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,application/pdf" />
                            </label>

                            <button 
                               type="button"
                               onClick={() => setShowProposalModal(true)}
                               className="p-4 hover:bg-background border border-border rounded-xl transition-all text-ink/40 hover:text-secondary shadow-sm"
                               title="Create Milestone Proposal"
                            >
                               <Sparkles size={24} />
                            </button>

                            <div className="flex-1 relative">
                               <textarea 
                                  value={newMessage}
                                  onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    if (socket && activeConversation) {
                                      socket.emit("typing", { 
                                        conversationId: activeConversation.id, 
                                        userId: auth.currentUser?.uid, 
                                        isTyping: e.target.value.length > 0 
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (editingMessage) {
                                        handleEditMessageAdmin(editingMessage.id, newMessage);
                                      } else {
                                        handleSendMessage();
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    if (socket && activeConversation) {
                                      socket.emit("typing", { 
                                        conversationId: activeConversation.id, 
                                        userId: auth.currentUser?.uid, 
                                        isTyping: false 
                                      });
                                    }
                                  }}
                                  placeholder={editingMessage ? "Update your secure response..." : isUploading ? "Processing secure file..." : "Type a secure response..."}
                                  disabled={isUploading}
                                  rows={1}
                                  className="w-full bg-background border border-border p-4 pr-16 rounded-[1.5rem] text-sm md:text-base font-medium text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 ring-primary/20 disabled:opacity-50 min-h-[56px] max-h-32 resize-none scrollbar-hide"
                               />
                               <button 
                                 type="submit" 
                                 disabled={(!newMessage.trim() && !isUploading) || isUploading}
                                 className={cn(
                                   "absolute right-2 bottom-2 p-3 rounded-xl shadow-lg transition-all disabled:opacity-30",
                                   editingMessage ? "bg-secondary text-white" : "bg-primary text-white"
                                 )}
                               >
                                  {editingMessage ? <CheckCircle size={24} /> : <Send size={24} />}
                               </button>
                            </div>
                          </form>
                        </div>
                     </>
                  ) : (
                     <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <div className="w-24 h-24 rounded-[3rem] bg-background border border-border flex items-center justify-center mb-6">
                           <MessageSquare size={48} className="text-primary opacity-20" />
                        </div>
                        <h4 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Omnichannel Terminal</h4>
                        <p className="text-sm font-medium text-ink/40">Select a secure node to initialize connection.</p>
                     </div>
                  )}
               </div>

               {/* Video Call Modal for Admin */}
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
                               <p className="text-white/20 text-xs font-mono">ADMIN TERMINAL // SECURE P2P</p>
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
                             <h2 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase italic">{incomingCallData?.callType === 'audio' ? 'Client Audio Call' : 'Client Video Request'}</h2>
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
            </div>
          )}
          {activeTab === "transactions" && (
            <motion.div 
               key="transactions"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="card"
            >
               <h2 className="text-2xl font-black mb-8">Financial Monitor</h2>
               <div className="space-y-4">
                  {transactions.map(t => (
                     <div key={t.id} className="p-6 rounded-2xl bg-background border border-border flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-12 h-12 rounded-xl flex items-center justify-center",
                             t.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                           )}>
                              <CreditCard size={24} />
                           </div>
                           <div>
                              <p className="font-bold text-ink">{users.find(u => u.uid === t.userId)?.name || "Client"} - ${t.amount}</p>
                              <p className="text-xs text-ink/40 font-black uppercase tracking-widest">
                                 {t.createdAt?.toDate()?.toLocaleString()} • {t.id}
                              </p>
                           </div>
                        </div>
                        <div className="text-left sm:text-right flex items-center justify-between sm:justify-end sm:block w-full sm:w-auto border-t sm:border-t-0 border-border/40 pt-4 sm:pt-0">
                           <span className={cn(
                             "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                             t.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                           )}>
                              {t.status}
                           </span>
                           {t.status === "pending" && (
                              <button 
                                 onClick={() => updateDoc(doc(db, "transactions", t.id), { status: "completed" })}
                                 className="ml-4 text-xs font-bold text-primary hover:underline"
                              >
                                 Mark Completed
                              </button>
                           )}
                        </div>
                     </div>
                  ))}
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
               <form onSubmit={handleCreateStoreProduct} className="card grid md:grid-cols-2 gap-4">
                  <h2 className="text-xl font-bold md:col-span-2">{editingId ? "Update Product" : "List New Source Code"}</h2>
                  <input placeholder="Product Title" value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} className="bg-background border border-border rounded-lg p-3" required />
                  <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="bg-background border border-border rounded-lg p-3">
                     <option value="Full-Stack">Full-Stack App</option>
                     <option value="Landing Page">Landing Page</option>
                     <option value="Dashboard">Admin Dashboard</option>
                     <option value="E-commerce">E-commerce</option>
                     <option value="SaaS">SaaS Boilerplate</option>
                     <option value="Other">Other</option>
                  </select>
                  <input type="number" placeholder="Price (USDT/USD)" value={productForm.price} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} className="bg-background border border-border rounded-lg p-3" required />
                  <input placeholder="Live Demo URL" value={productForm.live_demo_url} onChange={e => setProductForm({...productForm, live_demo_url: e.target.value})} className="bg-background border border-border rounded-lg p-3" />
                  <input placeholder="Source Code ZIP URL" value={productForm.source_code_url} onChange={e => setProductForm({...productForm, source_code_url: e.target.value})} className="bg-background border border-border rounded-lg p-3" required />
                     <div className="flex items-center gap-2 md:col-span-2">
                        <input placeholder="Preview Image URL" value={productForm.preview_image} onChange={e => setProductForm({...productForm, preview_image: e.target.value})} className="flex-1 bg-background border border-border rounded-lg p-3" />
                        <label className="cursor-pointer p-3 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all">
                           <ImageIcon size={20} />
                           <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'product')} accept="image/*" />
                        </label>
                     </div>
                  <textarea placeholder="Product Description" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="bg-background border border-border rounded-lg p-3 md:col-span-2" />
                  <button type="submit" className="btn-primary md:col-span-2 py-4 justify-center text-lg">
                     {editingId ? <CheckCircle size={20} /> : <ShoppingBag size={20} />}
                     {editingId ? "Sync Inventory" : "Publish to Store"}
                  </button>
               </form>

               <div className="grid lg:grid-cols-3 gap-6">
                  {products.map(p => (
                     <div key={p.id} className="card group overflow-hidden p-0 flex flex-col">
                        <img src={p.preview_image || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600"} className="w-full h-40 object-cover" alt="" />
                        <div className="p-6 flex-1 flex flex-col">
                           <div className="flex justify-between items-start mb-2">
                              <div>
                                 <h3 className="font-bold text-lg">{p.title}</h3>
                                 <span className="text-[10px] font-black uppercase text-primary tracking-widest">{p.category || "General"}</span>
                              </div>
                              <span className="text-primary font-black">${p.price}</span>
                           </div>
                           <p className="text-xs text-ink/40 line-clamp-2 mb-4">{p.description}</p>
                           <div className="mt-auto flex gap-2">
                              <button onClick={() => {setEditingId(p.id); setProductForm({...p});}} className="flex-1 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors">Edit</button>
                              <button onClick={() => deleteDoc(doc(db, "products", p.id))} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </motion.div>
          )}
          {activeTab === "coupons" && (
            <motion.div 
               key="coupons"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
               <form onSubmit={handleCreateCoupon} className="card grid md:grid-cols-2 gap-4">
                  <h2 className="text-xl font-bold md:col-span-2">{editingId ? "Update Coupon" : "Generate Coupon Code"}</h2>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest opacity-40">Coupon Code</label>
                    <input placeholder="SAVE10" value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} className="w-full bg-background border border-border rounded-lg p-3" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest opacity-40">Discount Type</label>
                    <select value={couponForm.discountType} onChange={e => setCouponForm({...couponForm, discountType: e.target.value})} className="w-full bg-background border border-border rounded-lg p-3">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest opacity-40">Discount Value</label>
                    <input type="number" placeholder="10" value={couponForm.discountValue} onChange={e => setCouponForm({...couponForm, discountValue: parseFloat(e.target.value)})} className="w-full bg-background border border-border rounded-lg p-3" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest opacity-40">Expiry Date</label>
                    <input type="date" value={couponForm.expiryDate} onChange={e => setCouponForm({...couponForm, expiryDate: e.target.value})} className="w-full bg-background border border-border rounded-lg p-3" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest opacity-40">Usage Limit</label>
                    <input type="number" value={couponForm.usageLimit} onChange={e => setCouponForm({...couponForm, usageLimit: parseInt(e.target.value)})} className="w-full bg-background border border-border rounded-lg p-3" />
                  </div>
                  <div className="flex items-center gap-3 md:pt-6">
                    <input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm({...couponForm, isActive: e.target.checked})} className="w-5 h-5" />
                    <span className="font-bold">Active</span>
                  </div>
                  <button type="submit" className="btn-primary md:col-span-2 py-4 justify-center text-lg">
                     {editingId ? <CheckCircle size={20} /> : <Zap size={20} />}
                     {editingId ? "Update Coupon" : "Create Coupon"}
                  </button>
               </form>

               <div className="grid lg:grid-cols-3 gap-6">
                  {coupons.map(c => (
                     <div key={c.id} className={cn("card border-2 transition-all", c.isActive ? "border-primary/20 shadow-lg shadow-primary/5" : "border-border opacity-60")}>
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                                 <Tag size={20} />
                              </div>
                              <div>
                                 <h3 className="text-xl font-black">{c.code}</h3>
                                 <p className="text-xs font-bold text-ink-muted">
                                   {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `$${c.discountValue} OFF`}
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => {setEditingId(c.id); setCouponForm({...c});}} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors">
                                 <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteItem("coupons", c.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-border">
                           <div className="flex justify-between items-center text-xs">
                              <span className="text-ink/40 font-bold uppercase tracking-widest">Usage</span>
                              <span className="font-bold">{c.usageCount || 0} / {c.usageLimit || '∞'}</span>
                           </div>
                           <div className="flex justify-between items-center text-xs">
                              <span className="text-ink/40 font-bold uppercase tracking-widest">Status</span>
                              <span className={cn("font-bold", c.isActive ? "text-green-500" : "text-red-500")}>
                                {c.isActive ? "Active" : "Inactive"}
                              </span>
                           </div>
                           {c.expiryDate && (
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-ink/40 font-bold uppercase tracking-widest">Expires</span>
                                <span className="font-bold text-amber-500">{new Date(c.expiryDate).toLocaleDateString()}</span>
                             </div>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </motion.div>
          )}
          {activeTab === "proofs" && (
            <motion.div 
              key="proofs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Payment Proofs</h2>
                <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest">
                  {paymentProofs.filter(p => p.status === 'pending').length} Pending Review
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paymentProofs.map((proof) => (
                  <div key={proof.id} className="card p-0 overflow-hidden flex flex-col group bg-surface border border-border shadow-sm">
                    <div className="relative aspect-video bg-background overflow-hidden">
                       <img 
                          src={proof.imageUrl} 
                          className="w-full h-full object-cover cursor-zoom-in" 
                          alt="" 
                          referrerPolicy="no-referrer"
                          onClick={() => window.open(proof.imageUrl, '_blank')}
                       />
                       <div className="absolute top-4 right-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg",
                            proof.status === "pending" ? "bg-yellow-500 text-white" : 
                            proof.status === "verified" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                          )}>
                            {proof.status}
                          </span>
                       </div>
                    </div>
                    
                    <div className="p-6">
                       <div className="mb-4">
                          <p className="text-sm font-bold text-ink">
                             {users.find(u => u.id === proof.userId)?.name || "Unknown User"}
                          </p>
                          <p className="text-[10px] text-ink/40 font-black uppercase tracking-tight">
                             Project: {projects.find(p => p.id === proof.projectId)?.title || "General / Product"}
                          </p>
                          <p className="text-[10px] text-ink/40 font-black uppercase tracking-tight">
                             Submitted: {proof.createdAt?.toDate()?.toLocaleString() || "Recent"}
                          </p>
                       </div>

                       {proof.notes && (
                          <div className="p-3 bg-surface-accent rounded-xl border border-border mb-4">
                             <p className="text-xs italic text-ink/60">"{proof.notes}"</p>
                          </div>
                       )}

                       {proof.status === 'pending' && (
                          <div className="flex gap-2">
                             <button 
                                onClick={() => handleProofStatus(proof.id, 'verified')}
                                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-green-500/20"
                             >
                                <CheckCircle size={16} /> Verify
                             </button>
                             <button 
                                onClick={() => handleProofStatus(proof.id, 'rejected')}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-red-500/20"
                             >
                                <X size={16} /> Reject
                             </button>
                          </div>
                       )}
                       
                       {proof.status !== 'pending' && (
                          <button 
                             onClick={() => handleProofStatus(proof.id, 'pending')}
                             className="w-full py-2 border border-border text-ink/40 text-[10px] font-black uppercase rounded-lg hover:bg-surface transition-colors"
                          >
                             Reset to Pending
                          </button>
                       )}
                    </div>
                  </div>
                ))}
                
                {paymentProofs.length === 0 && (
                   <div className="col-span-full py-20 text-center card border-dashed border-2 bg-surface-accent">
                      <ImageIcon size={48} className="mx-auto mb-4 opacity-10 text-ink" />
                      <p className="text-ink/40 font-bold uppercase italic tracking-widest">No Submissions Found</p>
                   </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "blog" && (
            <motion.div
              key="blog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
               {/* Blog Section */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <PenTool size={20} className="text-primary" /> Blog Manager
                  </h3>
                  <form onSubmit={handleAddBlog} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 bg-background p-8 rounded-2xl border border-border">
                     <input placeholder="Post Title" value={blogForm.title} onChange={e => setBlogForm({...blogForm, title: e.target.value})} className="bg-background border border-border rounded-xl p-4 md:col-span-2" />
                     <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <input placeholder="Slug (auto-generated if empty)" value={blogForm.slug} onChange={e => setBlogForm({...blogForm, slug: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                        <input placeholder="Category" value={blogForm.category} onChange={e => setBlogForm({...blogForm, category: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     </div>
                     <input type="date" value={blogForm.published_at} onChange={e => setBlogForm({...blogForm, published_at: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <input placeholder="Featured Image URL" value={blogForm.image} onChange={e => setBlogForm({...blogForm, image: e.target.value})} className="flex-1 bg-background border border-border rounded-xl p-4" />
                           <label className={cn(
                              "cursor-pointer p-4 rounded-xl transition-all flex items-center justify-center",
                              isUploading ? "bg-primary/20 text-primary animate-pulse" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                           )}>
                              {isUploading ? (
                                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                    <Sparkles size={20} />
                                 </motion.div>
                              ) : <ImageIcon size={20} />}
                              <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'blog')} accept="image/*" disabled={isUploading} />
                           </label>
                        </div>
                        {blogForm.image && (
                           <div className="relative group w-full h-40 rounded-2xl overflow-hidden border border-border">
                              <img src={blogForm.image} alt="Preview" className="w-full h-full object-cover" />
                              <button 
                                 type="button" 
                                 onClick={() => setBlogForm({...blogForm, image: ""})}
                                 className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        )}
                        {isUploading && (
                           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                              <Sparkles size={10} /> Syncing artifact with Cloudflare R2...
                           </div>
                        )}
                     </div>
                     <textarea placeholder="Post excerpt (brief summary)..." value={blogForm.excerpt} onChange={e => setBlogForm({...blogForm, excerpt: e.target.value})} className="bg-background border border-border rounded-xl p-4 md:col-span-2 h-20" />
                     <textarea placeholder="Markdown content..." value={blogForm.content} onChange={e => setBlogForm({...blogForm, content: e.target.value})} className="bg-background border border-border rounded-xl p-4 md:col-span-2 h-64 font-mono text-sm shadow-inner" />
                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg shadow-xl shadow-primary/20">
                        {editingId ? "Confirm Evolution" : "Deploy Narrative"}
                     </button>
                  </form>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {blog.map(post => (
                        <div key={post.id} className="bg-background rounded-2xl border border-border overflow-hidden group hover:ring-2 ring-primary transition-all shadow-sm">
                           <div className="h-48 overflow-hidden relative">
                              <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                              <div className="absolute top-4 left-4">
                                <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">{post.category}</span>
                              </div>
                           </div>
                           <div className="p-6">
                              <h4 className="font-black text-lg line-clamp-2 leading-tight mb-2">{post.title}</h4>
                              <p className="text-[10px] font-black text-ink/30 uppercase tracking-widest">{post.published_at}</p>
                              <div className="flex gap-2 mt-6">
                                 <button onClick={() => { setBlogForm(post); setEditingId(post.id); }} className="flex-1 btn-primary py-2.5 text-xs font-black uppercase justify-center">Edit</button>
                                 <button onClick={() => handleDeleteItem("blog", post.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div 
               key="settings"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
            >
               <div className="card max-w-2xl">
                  <h2 className="text-2xl font-black mb-6">Gateway Configuration</h2>
                  <div className="space-y-6">
                     <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                        <div className="p-3 bg-primary text-white rounded-xl">
                           <CreditCard size={24} />
                        </div>
                        <div>
                           <p className="font-bold">UddoktaPay Integration</p>
                           <p className="text-xs opacity-60">Control your payment gateway credentials and endpoints.</p>
                        </div>
                     </div>

                     <div className="grid gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-black uppercase tracking-widest opacity-40">API Key</label>
                           <input 
                              type="password" 
                              value={uddoktaSettings.apiKey} 
                              onChange={e => setUddoktaSettings({...uddoktaSettings, apiKey: e.target.value})}
                              className="w-full bg-background border border-border p-4 rounded-xl focus:ring-2 ring-primary/20 outline-none"
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-black uppercase tracking-widest opacity-40">UddoktaPay URL</label>
                           <input 
                              type="text" 
                              value={uddoktaSettings.baseUrl} 
                              onChange={e => setUddoktaSettings({...uddoktaSettings, baseUrl: e.target.value})}
                              placeholder="https://sandbox.uddoktapay.com/api/checkout-v2"
                              className="w-full bg-background border border-border p-4 rounded-xl focus:ring-2 ring-primary/20 outline-none"
                           />
                        </div>
                     </div>

                     <button 
                        onClick={saveSettings}
                        className="btn-primary w-full py-4 justify-center"
                     >
                        Deploy Configuration
                     </button>
                  </div>
               </div>
            </motion.div>
          )}
          {activeTab === "portfolio" && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
               {/* Hero & Contact Settings */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <User size={24} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Identity & Contact</h2>
                        <p className="text-xs font-bold text-ink/40 uppercase tracking-widest">Main Landing Page Info</p>
                     </div>
                  </div>

                  <form onSubmit={handleSavePortfolioSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <h3 className="font-black uppercase tracking-widest text-primary text-xs text-center border-b border-border pb-2">Brand Customization</h3>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Brand / Logo Name</label>
                           <input placeholder="Brand Name (e.g., JOY SAHA)" value={portfolioContent?.brandName || ""} onChange={e => setPortfolioContent({...portfolioContent, brandName: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4 mt-1" />
                        </div>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Logo Type</label>
                           <select value={portfolioContent?.logoType || "icon"} onChange={e => setPortfolioContent({...portfolioContent, logoType: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4 mt-1">
                              <option value="icon">Lucide Vector Icon</option>
                              <option value="image">Custom Image URL / Upload</option>
                           </select>
                        </div>

                        {portfolioContent?.logoType === "image" ? (
                           <div>
                              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Logo Image</label>
                              <div className="flex gap-2">
                                 <input placeholder="Logo Image URL" value={portfolioContent?.logoImage || ""} onChange={e => setPortfolioContent({...portfolioContent, logoImage: e.target.value})} className="flex-1 bg-background border border-border rounded-xl p-4 mt-1" />
                                 <label className={`cursor-pointer px-5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold mt-1 whitespace-nowrap ${isUploading ? "bg-primary/25 text-primary animate-pulse cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"}`}>
                                    {isUploading ? (
                                       <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                          <Sparkles size={16} />
                                       </motion.div>
                                    ) : <Upload size={16} />}
                                    <span>Upload Logo</span>
                                    <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_logo_image')} accept="image/*" disabled={isUploading} />
                                 </label>
                              </div>
                           </div>
                        ) : (
                           <div>
                              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Logo Lucide Icon</label>
                              <select value={portfolioContent?.logoIcon || "Activity"} onChange={e => setPortfolioContent({...portfolioContent, logoIcon: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4 mt-1">
                                 {["Activity", "Terminal", "Zap", "Target", "Heart", "Eye", "Share2", "Sparkles", "Layers", "Code", "Database", "Globe"].map(ic => (
                                    <option key={ic} value={ic}>{ic}</option>
                                 ))}
                              </select>
                           </div>
                        )}

                        <h3 className="font-black uppercase tracking-widest text-primary text-xs text-center border-b border-border pb-2 pt-4">Hero Section</h3>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Display Name</label>
                           <input placeholder="Personal Name" value={portfolioContent?.hero?.name} onChange={e => setPortfolioContent({...portfolioContent, hero: {...portfolioContent.hero, name: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4 mt-1" />
                        </div>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Professional Title</label>
                           <input placeholder="Job Role" value={portfolioContent?.hero?.role} onChange={e => setPortfolioContent({...portfolioContent, hero: {...portfolioContent.hero, role: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4 mt-1" />
                        </div>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Short Bio</label>
                           <textarea placeholder="Bio description" value={portfolioContent?.hero?.bio} onChange={e => setPortfolioContent({...portfolioContent, hero: {...portfolioContent.hero, bio: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4 h-32 mt-1" />
                        </div>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Profile Image URL</label>
                           <div className="flex gap-2">
                             <input placeholder="Image URL" value={portfolioContent?.hero?.image} onChange={e => setPortfolioContent({...portfolioContent, hero: {...portfolioContent.hero, image: e.target.value}})} className="flex-1 bg-background border border-border rounded-xl p-4 mt-1" />
                             <label className={`cursor-pointer px-5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold mt-1 whitespace-nowrap ${isUploading ? "bg-primary/25 text-primary animate-pulse cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"}`}>
                                {isUploading ? (
                                   <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                      <Sparkles size={16} />
                                   </motion.div>
                                ) : <Upload size={16} />}
                                <span>Upload Image</span>
                                <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_hero')} accept="image/*" disabled={isUploading} />
                             </label>
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Resume PDF Document (Download Resume)</label>
                           <div className="flex gap-2">
                             <input placeholder="Resume PDF URL" value={portfolioContent?.resumeUrl || ""} onChange={e => setPortfolioContent({...portfolioContent, resumeUrl: e.target.value})} className="flex-1 bg-background border border-border rounded-xl p-4 mt-1" />
                             <label className={`cursor-pointer px-5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold mt-1 whitespace-nowrap ${isUploading ? "bg-secondary/25 text-secondary animate-pulse cursor-not-allowed" : "bg-secondary/10 text-secondary hover:bg-secondary hover:text-white"}`}>
                                {isUploading ? (
                                   <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                      <Sparkles size={16} />
                                   </motion.div>
                                ) : <Upload size={16} />}
                                <span>Upload PDF</span>
                                <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_resume')} accept="application/pdf" disabled={isUploading} />
                             </label>
                           </div>
                        </div>

                        {/* Extended About Section */}
                        <div className="mt-8 p-6 bg-background rounded-2xl border border-dotted border-border space-y-4">
                           <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">About Section Expansion</h4>
                           <input placeholder="About Title" value={portfolioContent?.about?.aboutTitle} onChange={e => setPortfolioContent({...portfolioContent, about: {...portfolioContent.about, aboutTitle: e.target.value}})} className="w-full bg-surface border border-border rounded-xl p-4" />
                           <textarea placeholder="About Description" value={portfolioContent?.about?.aboutDescription} onChange={e => setPortfolioContent({...portfolioContent, about: {...portfolioContent.about, aboutDescription: e.target.value}})} className="w-full bg-surface border border-border rounded-xl p-4 h-24" />
                           <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <input placeholder="Large Image URL" value={portfolioContent?.about?.aboutImage} onChange={e => setPortfolioContent({...portfolioContent, about: {...portfolioContent.about, aboutImage: e.target.value}})} className="w-full bg-surface border border-border rounded-xl p-4" />
                                <label className="cursor-pointer py-2 px-4 bg-primary/5 text-primary rounded-xl hover:bg-primary/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                   <ImageIcon size={14} /> Upload
                                   <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_about')} accept="image/*" />
                                </label>
                              </div>
                              <div className="flex flex-col gap-1">
                                <input placeholder="Small Image URL" value={portfolioContent?.about?.aboutImageSmall} onChange={e => setPortfolioContent({...portfolioContent, about: {...portfolioContent.about, aboutImageSmall: e.target.value}})} className="w-full bg-surface border border-border rounded-xl p-4" />
                                <label className="cursor-pointer py-2 px-4 bg-primary/5 text-primary rounded-xl hover:bg-primary/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                   <ImageIcon size={14} /> Upload
                                   <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_about_small')} accept="image/*" />
                                </label>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <h3 className="font-black uppercase tracking-widest text-secondary text-xs text-center border-b border-border pb-2">Socials & Contact</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <input placeholder="GitHub URL" value={portfolioContent?.socials?.github} onChange={e => setPortfolioContent({...portfolioContent, socials: {...portfolioContent.socials, github: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                           <input placeholder="LinkedIn URL" value={portfolioContent?.socials?.linkedin} onChange={e => setPortfolioContent({...portfolioContent, socials: {...portfolioContent.socials, linkedin: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <input placeholder="Twitter URL" value={portfolioContent?.socials?.twitter} onChange={e => setPortfolioContent({...portfolioContent, socials: {...portfolioContent.socials, twitter: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                           <input placeholder="Public Email" value={portfolioContent?.socials?.email} onChange={e => setPortfolioContent({...portfolioContent, socials: {...portfolioContent.socials, email: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                        </div>
                        <input placeholder="Phone / WhatsApp" value={portfolioContent?.contact?.phone} onChange={e => setPortfolioContent({...portfolioContent, contact: {...portfolioContent.contact, phone: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                        <input placeholder="Office Address" value={portfolioContent?.contact?.address} onChange={e => setPortfolioContent({...portfolioContent, contact: {...portfolioContent.contact, address: e.target.value}})} className="w-full bg-background border border-border rounded-xl p-4" />
                     </div>

                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg shadow-xl shadow-primary/20 transition-all hover:-translate-y-1">
                        Deploy Identity Update
                     </button>
                  </form>
               </div>

               {/* Section Visibility Control */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Layers size={24} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Section Visibility</h2>
                        <p className="text-xs font-bold text-ink/40 uppercase tracking-widest">Show or Hide Sections on Frontend</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                     {[
                        { key: "contact", label: "Identity & Contact" },
                        { key: "store", label: "Inventory / Store" },
                        { key: "services", label: "Offerings (Services)" },
                        { key: "experience", label: "Work History" },
                        { key: "gallery", label: "Visual Gallery" },
                        { key: "testimonials", label: "Testimonial Bank" },
                        { key: "education", label: "Academic Background" },
                        { key: "skills", label: "Skill Bank" },
                        { key: "portfolio", label: "Visual Portfolio" },
                        { key: "blog", label: "Blog" },
                     ].map((section) => {
                        const isVisible = portfolioContent?.sectionVisibility?.[section.key] !== false;
                        return (
                           <button
                              key={section.key}
                              type="button"
                              onClick={() => {
                                 const currentVis = portfolioContent.sectionVisibility || {};
                                 setPortfolioContent({
                                    ...portfolioContent,
                                    sectionVisibility: {
                                       ...currentVis,
                                       [section.key]: !isVisible,
                                    },
                                 });
                              }}
                              className={cn(
                                 "p-4 rounded-2xl border transition-all text-sm font-bold flex items-center justify-between",
                                 isVisible
                                    ? "bg-primary/5 border-primary/20 text-primary"
                                    : "bg-background border-border text-ink/40 opacity-60"
                              )}
                           >
                              <span>{section.label}</span>
                              <div className={cn(
                                 "w-4 h-4 rounded-full border flex items-center justify-center",
                                 isVisible ? "border-primary bg-primary font-bold text-white" : "border-border bg-background"
                              )}>
                                 {isVisible && <Check size={10} className="stroke-[3]" />}
                              </div>
                           </button>
                        );
                     })}
                  </div>

                  <button 
                     onClick={handleSavePortfolioSettings}
                     className="btn-primary w-full py-4 justify-center shadow-xl shadow-primary/20 font-black uppercase text-sm tracking-wider"
                  >
                     Save Visibility Settings
                  </button>
               </div>

               {/* Grid for Skills & Services */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Skills Management */}
                  <div className="bg-surface p-8 rounded-3xl border border-border shadow-xl shadow-ink/5">
                     <h3 className="text-xl font-black italic uppercase mb-6 flex items-center gap-2">
                        <Zap size={20} className="text-primary" /> Skill Bank
                     </h3>
                     <form onSubmit={handleAddSkill} className="space-y-4 mb-8 p-6 bg-background rounded-2xl border border-border">
                        <input placeholder="Skill Name" value={skillForm.name} onChange={e => setSkillForm({...skillForm, name: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4" />
                        <input placeholder="Icon Name (lucide)" value={skillForm.icon} onChange={e => setSkillForm({...skillForm, icon: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4" />
                        <select value={skillForm.category} onChange={e => setSkillForm({...skillForm, category: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4">
                           <option>Frontend</option>
                           <option>Backend</option>
                           <option>Tools</option>
                           <option>Other</option>
                        </select>
                        <button type="submit" className="w-full btn-primary py-4 justify-center">
                           {editingId ? "Save Change" : "Add Skill"}
                        </button>
                     </form>
                     <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {skills.map(skill => (
                           <div key={skill.id} className="bg-background p-4 rounded-xl border border-border flex justify-between items-center group">
                              <p className="font-bold text-sm">{skill.name}</p>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => { setSkillForm(skill); setEditingId(skill.id); }} className="p-1.5 text-primary hover:bg-primary/10 rounded-md"><Edit2 size={12} /></button>
                                 <button onClick={() => handleDeleteItem("skills", skill.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={12} /></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Services Management */}
                  <div className="bg-surface p-8 rounded-3xl border border-border shadow-xl shadow-ink/5">
                     <h3 className="text-xl font-black italic uppercase mb-6 flex items-center gap-2">
                        <Briefcase size={20} className="text-primary" /> Offerings
                     </h3>
                     <form onSubmit={handleAddService} className="space-y-4 mb-8 p-6 bg-background rounded-2xl border border-border">
                        <input placeholder="Service Title" value={serviceForm.title} onChange={e => setServiceForm({...serviceForm, title: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4" />
                        <textarea placeholder="Brief description" value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} className="w-full bg-background border border-border rounded-xl p-4 h-24" />
                        <button type="submit" className="w-full btn-primary py-4 justify-center">
                           {editingId ? "Update Offering" : "Add Service"}
                        </button>
                     </form>
                     <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {services.map(ser => (
                           <div key={ser.id} className="p-4 bg-background rounded-xl border border-border flex justify-between items-center group">
                              <p className="font-bold text-sm">{ser.title}</p>
                              <div className="flex gap-2">
                                 <button onClick={() => { setServiceForm(ser); setEditingId(ser.id); }} className="p-2 text-primary hover:bg-primary/10 rounded-md"><Edit2 size={14} /></button>
                                 <button onClick={() => handleDeleteItem("services", ser.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Portfolio Projects Showcase */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <Star size={20} className="text-primary" /> Visual Portfolio
                  </h3>
                  <form onSubmit={handleAddPortfolioProject} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 bg-background p-8 rounded-2xl border border-border">
                     <input placeholder="Project Name" value={portfolioProjectForm.title} onChange={e => setPortfolioProjectForm({...portfolioProjectForm, title: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Demo / Live Link" value={portfolioProjectForm.demo_link} onChange={e => setPortfolioProjectForm({...portfolioProjectForm, demo_link: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <div className="flex items-center gap-2">
                        <input placeholder="Cover Image URL" value={portfolioProjectForm.image} onChange={e => setPortfolioProjectForm({...portfolioProjectForm, image: e.target.value})} className="flex-1 bg-background border border-border rounded-xl p-4" />
                        <label className="cursor-pointer p-4 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                           <ImageIcon size={20} />
                           <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_project')} accept="image/*" />
                        </label>
                     </div>
                     <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-widest opacity-40 ml-2 italic">Project Gallery ({portfolioProjectForm.gallery?.length || 0})</label>
                        <div className="flex items-center gap-2">
                           <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                              {portfolioProjectForm.gallery?.map((url, idx) => (
                                 <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                                    <img src={url} className="w-full h-full object-cover" alt="" />
                                    <button 
                                       type="button"
                                       onClick={() => setPortfolioProjectForm(prev => ({ ...prev, gallery: prev.gallery.filter((_, i) => i !== idx) }))}
                                       className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                       <Trash2 size={12} />
                                    </button>
                                 </div>
                              ))}
                              <label className="cursor-pointer w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-ink/20 hover:text-primary hover:border-primary transition-all flex-shrink-0">
                                 <Plus size={20} />
                                 <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_gallery')} accept="image/*" />
                              </label>
                           </div>
                        </div>
                     </div>
                     <textarea placeholder="Project narrative..." value={portfolioProjectForm.description} onChange={e => setPortfolioProjectForm({...portfolioProjectForm, description: e.target.value})} className="bg-background border border-border rounded-xl p-4 md:col-span-2 h-24" />
                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg">
                        {editingId ? "Commit Changes" : "Publish Project"}
                     </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {portfolioProjects.map(pproject => (
                        <div key={pproject.id} className="bg-background rounded-2xl border border-border overflow-hidden group">
                           <div className="h-40 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                             <img src={pproject.image} alt={pproject.title} className="w-full h-full object-cover" />
                           </div>
                           <div className="p-5 border-t border-border">
                              <h4 className="font-black text-lg truncate">{pproject.title}</h4>
                              <div className="flex gap-2 mt-4">
                                 <button onClick={() => { 
                                    setPortfolioProjectForm({
                                      ...pproject,
                                      gallery: pproject.gallery || []
                                    }); 
                                    setEditingId(pproject.id); 
                                 }} className="flex-1 btn-primary py-2 text-xs justify-center font-black uppercase">Edit</button>
                                 <button onClick={() => handleDeleteItem("portfolio_projects", pproject.id)} className="p-2 bg-red-500 text-white rounded-lg"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
               
               {/* Experience Section */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <Briefcase size={20} className="text-primary" /> Work History
                  </h3>
                  <form onSubmit={handleAddExp} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 bg-background p-8 rounded-2xl border border-border">
                     <input placeholder="Company Name" value={expForm.company} onChange={e => setExpForm({...expForm, company: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Role Title" value={expForm.role} onChange={e => setExpForm({...expForm, role: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Duration (e.g. 2020 - Present)" value={expForm.period} onChange={e => setExpForm({...expForm, period: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Short Description" value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg">
                        {editingId ? "Update Experience" : "Add Experience"}
                     </button>
                  </form>
                  <div className="space-y-4">
                     {experience.map(exp => (
                        <div key={exp.id} className="p-5 bg-background rounded-xl border border-border flex justify-between items-center group">
                           <div>
                              <p className="font-black text-lg">{exp.role} @ {exp.company}</p>
                              <p className="text-[10px] uppercase font-bold text-ink-muted">{exp.period}</p>
                           </div>
                           <div className="flex gap-1">
                              <button onClick={() => { setExpForm(exp); setEditingId(exp.id); }} className="p-2 text-primary hover:bg-primary/10 rounded-md"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteItem("experience", exp.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={14} /></button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Gallery Section */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <ImageIcon size={20} className="text-primary" /> Visual Gallery
                  </h3>
                  <form onSubmit={handleAddGallery} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 bg-background p-8 rounded-2xl border border-border">
                     <div className="bg-background border border-border rounded-xl md:col-span-2 flex items-center gap-2 p-1">
                        <input placeholder="Image URL" value={galleryForm.url} onChange={e => setGalleryForm({...galleryForm, url: e.target.value})} className="flex-1 bg-transparent border-0 rounded-xl p-3 focus:outline-none" />
                        <label className="cursor-pointer p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap">
                           {isUploading ? <Sparkles size={16} className="animate-spin" /> : <Upload size={16} />}
                           <span>Upload</span>
                           <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'portfolio_gallery_item')} accept="image/*" disabled={isUploading} />
                        </label>
                     </div>
                     <input placeholder="Image Title" value={galleryForm.title} onChange={e => setGalleryForm({...galleryForm, title: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <select value={galleryForm.category} onChange={e => setGalleryForm({...galleryForm, category: e.target.value})} className="bg-background border border-border rounded-xl p-4">
                        <option>Project</option>
                        <option>Workspace</option>
                        <option>Event</option>
                     </select>
                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg">
                        {editingId ? "Update Image" : "Add to Gallery"}
                     </button>
                  </form>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                     {gallery.map(img => (
                        <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-border bg-background">
                           <img src={img.url} alt={img.title} className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0" />
                           <div className="absolute inset-0 bg-ink/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setGalleryForm(img); setEditingId(img.id); }} className="p-2 bg-white/20 hover:bg-white/40 rounded-lg backdrop-blur-md"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteItem("gallery", img.id)} className="p-2 bg-red-500 rounded-lg"><Trash2 size={14} /></button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Testimonials Section */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <Quote size={20} className="text-primary" /> Testimonial Bank
                  </h3>
                  <form onSubmit={handleAddTestimonial} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 bg-background p-8 rounded-2xl border border-border">
                     <input placeholder="Client Name" value={testimonialForm.name} onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Client Role" value={testimonialForm.role} onChange={e => setTestimonialForm({...testimonialForm, role: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Company" value={testimonialForm.company} onChange={e => setTestimonialForm({...testimonialForm, company: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <div className="flex items-center gap-2">
                        <input placeholder="Avatar URL" value={testimonialForm.image} onChange={e => setTestimonialForm({...testimonialForm, image: e.target.value})} className="flex-1 bg-background border border-border rounded-xl p-4" />
                        <label className="cursor-pointer p-4 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                           <ImageIcon size={20} />
                           <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'testimonial')} accept="image/*" />
                        </label>
                     </div>
                     <textarea placeholder="Feedback text..." value={testimonialForm.text} onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})} className="bg-background border border-border rounded-xl p-4 md:col-span-2 h-24" />
                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg">
                        {editingId ? "Update Feedback" : "Publish Testimonial"}
                     </button>
                  </form>
                  <div className="space-y-4">
                     {testimonials.map(tes => (
                        <div key={tes.id} className="p-6 bg-background rounded-2xl border border-border flex justify-between items-start group relative">
                           <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                                 <img src={tes.image || "https://picsum.photos/seed/avatar/200/200"} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div>
                                 <p className="font-black text-lg">{tes.name}</p>
                                 <p className="text-xs font-bold text-primary italic">{tes.role} @ {tes.company}</p>
                                 <p className="mt-2 text-ink-muted line-clamp-2 italic">"{tes.text}"</p>
                              </div>
                           </div>
                           <div className="flex gap-1 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setTestimonialForm(tes); setEditingId(tes.id); }} className="p-2 text-primary hover:bg-primary/10 rounded-md"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteItem("testimonials", tes.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={14} /></button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Education Chronology */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-xl shadow-ink/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <PenTool size={20} className="text-secondary" /> Academic Background
                  </h3>
                  <form onSubmit={handleAddEdu} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-background p-6 rounded-2xl border border-border">
                     <input placeholder="Degree / Certificate" value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Institution" value={eduForm.school} onChange={e => setEduForm({...eduForm, school: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <input placeholder="Years Active" value={eduForm.period} onChange={e => setEduForm({...eduForm, period: e.target.value})} className="bg-background border border-border rounded-xl p-4" />
                     <button type="submit" className="md:col-span-3 btn-primary py-4 justify-center">
                        Add Education entry
                     </button>
                  </form>
                  <div className="space-y-4">
                     {education.map(edu => (
                        <div key={edu.id} className="p-5 bg-background rounded-xl border border-border flex justify-between items-center group">
                           <div>
                              <p className="font-black text-lg">{edu.degree}</p>
                              <p className="text-[10px] uppercase font-bold text-ink-muted">{edu.school} • {edu.period}</p>
                           </div>
                           <div className="flex gap-1">
                              <button onClick={() => { setEduForm(edu); setEditingId(edu.id); }} className="p-2 text-primary hover:bg-primary/10 rounded-md"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteItem("education", edu.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"><Trash2 size={14} /></button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Certificates Management */}
               <div className="bg-surface p-8 rounded-3xl border border-border shadow-xl shadow-ink/5 mt-8">
                  <h3 className="text-xl font-black italic uppercase mb-8 flex items-center gap-2">
                     <Award size={20} className="text-primary" /> Professional Certifications
                  </h3>
                  <form onSubmit={handleAddCertificate} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-background p-6 rounded-2xl border border-border">
                     <div className="flex flex-col gap-4">
                        <input 
                           placeholder="Certificate Title (e.g., AWS Certified Solutions Architect)" 
                           value={certForm.title} 
                           onChange={e => setCertForm({...certForm, title: e.target.value})} 
                           className="bg-background border border-border rounded-xl p-4 w-full text-ink" 
                        />
                        <textarea 
                           placeholder="Short Description of the certification..." 
                           value={certForm.description} 
                           onChange={e => setCertForm({...certForm, description: e.target.value})} 
                           className="bg-background border border-border rounded-xl p-4 w-full h-28 resize-none text-ink" 
                        />
                     </div>
                     
                     <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 hover:border-primary/50 transition-colors relative min-h-[160px]">
                        {certForm.image ? (
                           <div className="relative w-full h-full flex items-center justify-center">
                              <img 
                                 src={certForm.image} 
                                 alt="Preview" 
                                 className="max-h-36 rounded-xl object-contain" 
                                 referrerPolicy="no-referrer"
                              />
                              <button 
                                 type="button" 
                                 onClick={() => setCertForm(prev => ({ ...prev, image: "" }))} 
                                 className="absolute top-1 right-1 p-2 bg-red-500/85 hover:bg-red-500 text-white rounded-full transition-all"
                              >
                                 <Trash2 size={12} />
                              </button>
                           </div>
                        ) : (
                           <label className="flex flex-col items-center gap-2 cursor-pointer text-ink-muted hover:text-primary transition-colors">
                              <Upload size={32} />
                              <span className="text-xs font-bold uppercase tracking-widest">Upload Certificate Image</span>
                              <input 
                                 type="file" 
                                 className="hidden" 
                                 onChange={(e) => handleImageUpload(e, 'portfolio_certificate')} 
                                 accept="image/*" 
                              />
                           </label>
                        )}
                     </div>

                     <button type="submit" className="md:col-span-2 btn-primary py-4 justify-center text-lg">
                        {editingId ? "Update Certificate" : "Add Certificate"}
                     </button>
                  </form>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                     {certificates.map(cert => (
                        <div key={cert.id} className="p-5 bg-background rounded-2xl border border-border flex flex-col justify-between group relative overflow-hidden">
                           {cert.image && (
                              <div className="h-32 rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center mb-4 p-2">
                                 <img 
                                    src={cert.image} 
                                    alt={cert.title} 
                                    className="max-h-full object-contain" 
                                    referrerPolicy="no-referrer"
                                 />
                              </div>
                           )}
                           <div>
                              <p className="font-black text-lg line-clamp-1">{cert.title}</p>
                              <p className="text-xs text-ink-muted line-clamp-2 mt-1 italic">"{cert.description}"</p>
                           </div>
                           <div className="flex gap-1 justify-end mt-4 pt-4 border-t border-border">
                              <button 
                                 onClick={() => { setCertForm(cert); setEditingId(cert.id); }} 
                                 className="p-2 text-primary hover:bg-primary/10 rounded-md"
                              >
                                 <Edit2 size={14} />
                               </button>
                              <button 
                                 onClick={() => handleDeleteItem("certificates", cert.id)} 
                                 className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"
                              >
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Project Proposal Modal */}
        <AnimatePresence>
          {showProposalModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-surface border border-border rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                         <Sparkles size={28} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black italic">Create Proposal</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Convert conversation to order</p>
                      </div>
                   </div>
                   <button onClick={() => setShowProposalModal(false)} className="p-3 hover:bg-primary/5 rounded-full text-ink/40"><X size={24} /></button>
                </div>

                <div className="space-y-6 text-left">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/40 ml-2">Project Title</label>
                      <input 
                        placeholder="e.g. E-commerce Platform Development"
                        value={proposalForm.title}
                        onChange={e => setProposalForm({...proposalForm, title: e.target.value})}
                        className="w-full bg-background border border-border rounded-2xl p-4"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/40 ml-2">Summary Specifications</label>
                      <textarea 
                        placeholder="List the key deliverables and scope..."
                        value={proposalForm.description}
                        onChange={e => setProposalForm({...proposalForm, description: e.target.value})}
                        className="w-full bg-background border border-border rounded-2xl p-4 h-32 resize-none"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-ink/40 ml-2">Total Price (USD)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 font-bold">$</span>
                          <input 
                            type="number"
                            value={proposalForm.price}
                            onChange={e => setProposalForm({...proposalForm, price: parseFloat(e.target.value) || 0})}
                            className="w-full bg-background border border-border rounded-2xl p-4 pl-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-ink/40 ml-2">Min. Deposit (USD)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 font-bold">$</span>
                          <input 
                            type="number"
                            value={proposalForm.initialDeposit}
                            onChange={e => setProposalForm({...proposalForm, initialDeposit: parseFloat(e.target.value) || 0})}
                            className="w-full bg-background border border-border rounded-2xl p-4 pl-8"
                          />
                        </div>
                      </div>
                   </div>

                   <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <p className="text-xs font-bold text-primary italic">This will send a professional proposal card directly to the client's chat where they can click "Order Now" to initialize the project.</p>
                   </div>

                   <button 
                    onClick={handleSendProposal}
                    disabled={!proposalForm.title || proposalForm.price <= 0}
                    className="w-full btn-primary py-5 rounded-2xl justify-center text-lg gap-3"
                   >
                     <Send size={20} /> Deploy Proposal
                   </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const ChatMessages = ({ 
  conversationId, 
  currentConv, 
  setReplyingTo, 
  setEditingMessage, 
  handleDeleteMessageAdmin,
  setNewMessage 
}: { 
  conversationId: string; 
  currentConv: any;
  setReplyingTo: (msg: any) => void;
  setEditingMessage: (msg: any) => void;
  handleDeleteMessageAdmin: (msgId: string) => void;
  setNewMessage: (text: string) => void;
}) => {
   const [messages, setMessages] = useState<any[]>([]);
   const [currentUser, setCurrentUser] = useState<any>(null);
   const [activeMenu, setActiveMenu] = useState<string | null>(null);

   useEffect(() => {
      setCurrentUser(auth.currentUser);
   }, []);

   useEffect(() => {
      const q = query(
         collection(db, "conversations", conversationId, "messages"),
         orderBy("timestamp", "asc")
      );
      return onSnapshot(q, (snap) => {
         const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
         setMessages(msgs);

         // Mark client messages as read
         msgs.forEach((m: any) => {
            if (m.senderId !== "admin" && !m.read) {
               updateDoc(doc(db, "conversations", conversationId, "messages", m.id), {
                  read: true
               });
            }
         });
      }, (error) => {
         handleFirestoreError(error, OperationType.LIST, `conversations/${conversationId}/messages`);
      });
   }, [conversationId]);

   const scrollToMessage = (msgId: string) => {
     const el = document.getElementById(`msg-${msgId}`);
     if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
   };

   return (
      <div className="flex flex-col space-y-4 pb-4">
         {messages.map((m, index) => {
            const isAdmin = m.senderId === "admin";
            return (
              <motion.div 
                key={m.id || index} 
                id={`msg-${m.id}`}
                initial={{ opacity: 0, x: isAdmin ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "group relative max-w-[85%] md:max-w-[70%]",
                  isAdmin ? "ml-auto" : "mr-auto"
                )}
              >
                 {/* Reply Header */}
                 {m.replyTo && (
                    <div 
                      onClick={() => scrollToMessage(m.replyTo.id)}
                      className={cn(
                        "mb-[-16px] p-4 px-5 pb-7 rounded-[2rem] text-[11px] cursor-pointer hover:brightness-95 transition-all flex flex-col gap-1.5",
                        isAdmin ? "bg-white/10 border-white/40 ml-6 mr-2" : "bg-primary/5 border-primary ml-2 mr-6"
                      )}
                    >
                      <p className="font-black uppercase tracking-widest text-[9px] opacity-60">
                        {m.replyTo.senderId === "admin" ? "You" : "Client"}
                      </p>
                      <p className="truncate opacity-80 italic">"{m.replyTo.text}"</p>
                    </div>
                 )}

                 <div className={cn(
                    "relative p-5 md:p-6 rounded-[2rem] shadow-xl transition-all group/msg",
                    isAdmin ? "bg-premium-gradient text-white rounded-tr-none shadow-primary/20" : "bg-surface border border-border text-ink rounded-tl-none shadow-ink/5"
                 )}>
                    {/* Hover Menu */}
                    <div className={cn(
                      "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1",
                      isAdmin ? "right-full mr-2" : "left-full ml-2"
                    )}>
                      <button 
                        onClick={() => setReplyingTo(m)}
                        className="p-2 bg-background border border-border rounded-xl text-ink/40 hover:text-primary transition-all shadow-sm"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      {isAdmin && !m.isDeleted && (
                        <div className="relative">
                          <button 
                            onClick={() => setActiveMenu(activeMenu === m.id ? null : m.id)}
                            className="p-2 bg-background border border-border rounded-xl text-ink/40 hover:text-primary transition-all shadow-sm"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {activeMenu === m.id && (
                            <div className="absolute top-full mt-2 right-0 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-[120px]">
                              <button 
                                onClick={() => { 
                                  setActiveMenu(null); 
                                  setEditingMessage({ id: m.id, text: m.text });
                                  setNewMessage(m.text);
                                }}
                                className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-primary/5 flex items-center gap-2"
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              <button 
                                onClick={() => { setActiveMenu(null); handleDeleteMessageAdmin(m.id); }}
                                className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-red-500/5 text-red-500 flex items-center gap-2 border-t border-border"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {m.isDeleted ? (
                      <p className="text-sm italic opacity-60 flex items-center gap-2">
                        <Trash2 size={14} /> Message was deleted
                      </p>
                    ) : (
                      <>
                        {m.type === 'call' ? (
                          <div className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border min-w-[180px]",
                            isAdmin ? "bg-white/10 border-white/20" : "bg-background border-border shadow-inner"
                          )}>
                             <div className={cn(
                               "p-2 rounded-lg",
                               m.callStatus === 'started' ? "bg-blue-500 text-white" :
                               m.callStatus === 'missed' ? "bg-red-500 text-white" : 
                               m.callStatus === 'cancelled' ? "bg-gray-500 text-white" : "bg-green-500 text-white"
                             )}>
                                {m.callStatus === 'missed' ? <PhoneOff size={16} /> : <Phone size={16} />}
                             </div>
                             <div>
                                <p className={cn("text-sm font-bold", isAdmin ? "text-white" : "text-ink")}>{m.text}</p>
                                <p className={cn("text-[10px] opacity-60 uppercase font-black tracking-widest", isAdmin ? "text-white/70" : "text-ink/40")}>{m.callStatus}</p>
                             </div>
                          </div>
                        ) : m.type === 'proposal' ? (
                          <div className={cn(
                            "flex flex-col gap-3 p-5 rounded-2xl border transition-all",
                            isAdmin ? "bg-white/10 border-white/20" : "bg-surface border-border"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                                <Sparkles size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Proposal Payload</p>
                                <p className="text-sm font-black tracking-tight">{m.proposalData?.title}</p>
                              </div>
                            </div>
                            <div className="p-4 bg-background/50 rounded-xl border border-border/50">
                               <p className="text-xs italic opacity-70 leading-relaxed">"{m.proposalData?.description}"</p>
                            </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                   <p className="text-[9px] font-black uppercase text-primary mb-1">Budget</p>
                                   <p className="text-lg font-black tabular-nums">${m.proposalData?.price}</p>
                                </div>
                                <div className="p-3 bg-secondary/5 rounded-xl border border-secondary/10">
                                   <p className="text-[9px] font-black uppercase text-secondary mb-1">Deposit</p>
                                   <p className="text-lg font-black tabular-nums">${m.proposalData?.initialDeposit}</p>
                                </div>
                             </div>
                             <div className="mt-2 py-3 px-4 bg-primary/20 text-white rounded-xl text-center text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">
                                Pending Client Activation
                             </div>
                          </div>
                        ) : m.type === 'meeting_request' ? (
                          <MeetingRequestCard 
                            msg={m} 
                            isMe={isAdmin} 
                            isClientView={false} 
                            conversationId={conversationId} 
                          />
                        ) : m.file && (
                          <div className="mb-3">
                            {m.file.type?.startsWith('image/') ? (
                              <div className="relative group/img overflow-hidden rounded-xl bg-black/5 border border-white/10">
                                <img src={m.file.url} alt={m.file.name} className="max-w-full rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform duration-500" onClick={() => window.open(m.file.url, '_blank')} />
                              </div>
                            ) : m.file.type?.startsWith('video/') ? (
                              <video controls className="max-w-full rounded-xl shadow-lg bg-black">
                                <source src={m.file.url} type={m.file.type} />
                              </video>
                            ) : (
                              <div className={cn(
                                "flex flex-col gap-3 p-4 rounded-xl border transition-all",
                                isAdmin ? "bg-white/10 border-white/20" : "bg-background border-border shadow-inner"
                              )}>
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
                                    m.file.type?.includes('pdf') ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                                  )}>
                                    {m.file.type?.includes('pdf') ? <FileText size={24} /> : <Paperclip size={24} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{m.file.name}</p>
                                    <p className="text-[10px] opacity-60 uppercase font-black tracking-widest">
                                      {m.file.type?.split('/')[1] || 'File'} • {m.file.type?.includes('pdf') ? 'PDF Document' : 'Attachment'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <a href={m.file.url} target="_blank" rel="noopener noreferrer" className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", isAdmin ? "bg-white/10 hover:bg-white/20 text-white" : "bg-primary/5 text-primary hover:bg-primary/10")}>
                                    <ExternalLink size={12} /> Preview
                                  </a>
                                  <a href={m.file.url} download={m.file.name} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", isAdmin ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white hover:bg-primary/95 shadow-lg shadow-primary/20")}>
                                    <Download size={12} /> Download
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{m.text}</p>
                      </>
                    )}

                    <div className="flex items-center gap-2 mt-2 justify-end opacity-60">
                      {m.isEdited && <span className="text-[9px] font-black uppercase tracking-tighter italic">Edited</span>}
                      <span className="text-[10px] font-bold">
                        {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---"}
                      </span>
                      {isAdmin && !m.isDeleted && (
                        <div className="flex scale-75 origin-right">
                          <CheckCircle size={14} className={cn(m.read ? "text-white" : "text-white/30")} />
                          {m.read && <CheckCircle size={14} className="text-white -ml-2" />}
                        </div>
                      )}
                    </div>
                 </div>
              </motion.div>
            );
         })}
      </div>
   );
};

