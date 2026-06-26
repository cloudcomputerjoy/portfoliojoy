import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import multer from "multer";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize Firebase Admin
const adminApp = !getApps().length 
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApps()[0];

// In AI Studio, the specific databaseId is important. 
// However, Status 7 PERMISSION_DENIED often means the service account lacks access to that specific ID.
let firestore: any;
try {
  firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  console.log(`Firestore initialized with Database ID: ${firebaseConfig.firestoreDatabaseId}`);
} catch (err) {
  console.warn("Failed to initialize with specific databaseId, falling back to default:", err);
  firestore = getFirestore(adminApp);
}

// Test connection on startup
async function testFirestore() {
  try {
    const testDoc = await firestore.collection("test").doc("connection").get();
    console.log("Firestore connection test successful");
  } catch (err: any) {
    if (err.code === 7 || err.message?.includes("PERMISSION_DENIED")) {
       console.error("CRITICAL: Firestore Admin PERMISSION_DENIED. This is likely an IAM issue or wrong Database ID.");
       console.error("Database ID being used:", firebaseConfig.firestoreDatabaseId);
    } else {
       console.error("Firestore connection test failed:", err.message);
    }
  }
}
testFirestore();

dotenv.config();

// R2 S3 Client configuration
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// In-memory "database" for demo purposes
const db = {
  users: [],
  messages: [],
  projects: [],
  orders: [],
  userProjects: [
    {
      id: 1,
      userId: "demo-user",
      title: "E-commerce Platform",
      category: "Web Development",
      status: "in-progress",
      progress: 65,
      nextMilestone: "Payment Gateway Integration",
      eta: "March 25, 2026",
      files: [{ name: "Project_Specs.pdf", url: "#" }]
    },
    {
      id: 2,
      userId: "demo-user",
      title: "AI Chatbot Implementation",
      category: "AI Integration",
      status: "pending",
      progress: 15,
      nextMilestone: "Model Training",
      eta: "April 10, 2026",
      files: []
    }
  ],
  profile: {
    name: "Joy Saha",
    title: "Full Stack Developer & AI Specialist",
    tagline: "I build high-performance web applications and integrate cutting-edge AI solutions to help businesses scale.",
    profilePic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop",
    email: "joy@example.com",
    phone: "+1 (555) 000-0000",
    location: "San Francisco, CA",
    services: [
      { title: "Full Stack Systems", description: "End-to-end architecture combining high-performance backends with fluid, artistic interfaces.", icon: "Layers" },
      { title: "AI Ecosystems", description: "Integrating advanced LLMs and neural architectures into your core business logic.", icon: "Zap" },
      { title: "Backend Core", description: "Securing your data with robust, distributed database systems and real-time API layers.", icon: "Database" },
      { title: "Creative Tech", description: "Custom platform solutions that merge high-concept design with flawless technical execution.", icon: "Sparkles" }
    ]
  }
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Multer setup for memory storage (for R2 upload)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // --- Upload Route for Cloudflare R2 ---
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { folder = "uploads" } = req.body;

    // Use environment variables for R2 configuration
    const bucketName = process.env.R2_BUCKET_NAME;
    let customDomain = process.env.R2_PUBLIC_CUSTOM_DOMAIN;

    if (!bucketName || !customDomain) {
      return res.status(500).json({ error: "R2 Environment variables not configured (R2_BUCKET_NAME or R2_PUBLIC_CUSTOM_DOMAIN is missing)" });
    }

    // Remove trailing slash from custom domain if present
    if (customDomain.endsWith("/")) {
      customDomain = customDomain.slice(0, -1);
    }

    const key = `${folder}/${Date.now()}-${req.file.originalname}`;

    try {
      console.log(`Uploading to R2: bucket=${bucketName}, key=${key}`);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const fileUrl = `${customDomain}/${key}`;
      console.log(`Upload successful: ${fileUrl}`);
      res.json({ 
        url: fileUrl, 
        type: req.file.mimetype, 
        name: req.file.originalname 
      });
    } catch (error: any) {
      console.error("Cloudflare R2 Upload Error:", error);
      res.status(500).json({ 
        error: "Failed to upload to R2", 
        message: error.message,
        code: error.code || error.$metadata?.httpStatusCode 
      });
    }
  });

  // --- Auth Routes ---
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: Date.now(), email, password: hashedPassword, name };
    db.users.push(user);
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find((u) => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  // --- Project Routes ---
  app.get("/api/projects", (req, res) => {
    res.json(db.projects);
  });

  app.post("/api/projects", (req, res) => {
    const project = { ...req.body, id: Date.now() };
    db.projects.push(project);
    res.json(project);
  });

  app.put("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const index = db.projects.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
      db.projects[index] = { ...req.body, id: parseInt(id) };
      res.json(db.projects[index]);
    } else {
      res.status(404).json({ error: "Project not found" });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    db.projects = db.projects.filter(p => p.id !== parseInt(id));
    res.json({ success: true });
  });

  // Generic routes for other entities
  const entities = ["testimonials", "gallery", "socials", "blog", "experience", "education", "messages"];
  entities.forEach(entity => {
    if (!db[entity]) db[entity] = [];
    
    app.get(`/api/${entity}`, (req, res) => res.json(db[entity]));
    app.post(`/api/${entity}`, (req, res) => {
      const item = { ...req.body, id: Date.now(), created_at: new Date().toISOString() };
      db[entity].push(item);
      res.json(item);
    });
    app.put(`/api/${entity}/:id`, (req, res) => {
      const { id } = req.params;
      const index = db[entity].findIndex(i => i.id === parseInt(id));
      if (index !== -1) {
        db[entity][index] = { ...req.body, id: parseInt(id) };
        res.json(db[entity][index]);
      } else {
        res.status(404).json({ error: "Item not found" });
      }
    });
    app.delete(`/api/${entity}/:id`, (req, res) => {
      const { id } = req.params;
      db[entity] = db[entity].filter(i => i.id !== parseInt(id));
      res.json({ success: true });
    });
  });

  app.get("/api/user-projects", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const userProjects = db.userProjects.filter(p => p.userId === userId || p.userId === "demo-user");
    res.json(userProjects);
  });

  app.get("/api/profile", (req, res) => {
    res.json(db.profile);
  });

  app.put("/api/profile", (req, res) => {
    db.profile = { ...db.profile, ...req.body };
    res.json(db.profile);
  });

// --- UddoktaPay Integration ---
const UDDOKTAPAY_CONFIG = {
  get apiKey() { return process.env.UDDOKTAPAY_API_KEY; },
  get baseUrl() { return process.env.UDDOKTAPAY_BASE_URL || "https://sandbox.uddoktapay.com/api/checkout-v2"; }
};

async function createUddoktaPayOrder(orderData: any) {
  if (!UDDOKTAPAY_CONFIG.apiKey) {
    throw new Error("UddoktaPay API Key not configured");
  }

  const headers = {
    "RT-UDDOKTAPAY-API-KEY": UDDOKTAPAY_CONFIG.apiKey,
    "content-type": "application/json"
  };

  const response = await axios.post(UDDOKTAPAY_CONFIG.baseUrl, orderData, { headers });
  return response.data;
}

// --- Payment Proxy Logic ---
  app.post("/api/payments/create-order", async (req, res) => {
    const { amount, productId, userId, fileId, projectId, milestoneId, customerName, customerEmail, couponId } = req.body;
    
    let baseAmount = amount;
    let finalAmount = amount;
    let productTitle = "Project Payment";
    
    // Security: Fetch real price from Firestore based on type
    try {
      if (productId) {
        const productDoc = await firestore.collection("products").doc(productId).get();
        if (productDoc.exists) {
          const productData = productDoc.data();
          baseAmount = productData?.price; 
          finalAmount = baseAmount;
          productTitle = productData?.title || "Digital Product";
        }
      } else if (fileId && projectId) {
        // Find the file price in the project
        const projectDoc = await firestore.collection("projects").doc(projectId).get();
        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          const file = projectData?.files?.find((f: any) => f.url === fileId);
          if (file) {
            baseAmount = file.price;
            finalAmount = baseAmount;
            productTitle = `File Unlock: ${file.name}`;
          }
        }
      } else if (projectId && milestoneId) {
        // Find the milestone price in the project
        const projectDoc = await firestore.collection("projects").doc(projectId).get();
        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          const milestone = projectData?.milestones?.find((m: any) => m.id === milestoneId);
          if (milestone) {
            baseAmount = milestone.price;
            finalAmount = baseAmount;
            productTitle = `Milestone: ${milestone.title}`;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching payment item details:", err);
    }

    // Apply Coupon if provided
    if (couponId) {
       try {
          const couponDoc = await firestore.collection("coupons").doc(couponId).get();
          if (couponDoc.exists) {
             const couponData = couponDoc.data();
             if (couponData?.isActive && (!couponData.expiryDate || new Date(couponData.expiryDate) > new Date())) {
                if (!couponData.usageLimit || (couponData.usageCount || 0) < couponData.usageLimit) {
                   if (couponData.discountType === "percentage") {
                      finalAmount = baseAmount - (baseAmount * (couponData.discountValue / 100));
                   } else {
                      finalAmount = Math.max(0, baseAmount - couponData.discountValue);
                   }
                }
             }
          }
       } catch (err) {
          console.error("Error applying coupon:", err);
       }
    }

    try {
      const orderData = {
        full_name: customerName || "Guest",
        email: customerEmail || "guest@example.com",
        amount: finalAmount,
        metadata: { userId, fileId, productId, projectId, milestoneId, productTitle, couponId },
        redirect_url: `${req.protocol}://${req.get("host")}/portal?payment=success`,
        cancel_url: `${req.protocol}://${req.get("host")}/portal?payment=cancel`,
        webhook_url: `${req.protocol}://${req.get("host")}/api/payments/webhook`
      };

      const upResponse = await createUddoktaPayOrder(orderData);
      
      if (upResponse.status === true) {
        // Store transaction in Firestore
        await firestore.collection("transactions").add({
          userId,
          amount: finalAmount,
          fileId: fileId || null,
          productId: productId || null,
          projectId: projectId || null,
          milestoneId: milestoneId || null,
          couponId: couponId || null,
          status: "pending",
          invoice_id: upResponse.invoice_id || null,
          createdAt: FieldValue.serverTimestamp()
        });

        res.json({ status: "SUCCESS", data: { checkoutUrl: upResponse.payment_url } });
      } else {
        res.status(400).json({ status: "FAIL", message: upResponse.message });
      }
    } catch (error: any) {
      res.status(500).json({ status: "FAIL", errorMessage: error.message });
    }
  });

  app.post("/api/payments/webhook", async (req, res) => {
    const { status, invoice_id, metadata } = req.body;
    const userId = metadata?.userId;
    const productId = metadata?.productId;
    const projectId = metadata?.projectId;
    const milestoneId = metadata?.milestoneId;
    const fileId = metadata?.fileId;
    const couponId = metadata?.couponId;

    if (status === "Completed") {
      // 1. Coupon Usage
      if (couponId) {
        try {
          await firestore.collection("coupons").doc(couponId).update({
            usageCount: FieldValue.increment(1)
          });
        } catch (err) { console.error(err); }
      }

      // 2. Update Transaction Status
      const transactionsRef = firestore.collection("transactions");
      let orderQuery;
      if (invoice_id) {
        orderQuery = await transactionsRef.where("invoice_id", "==", invoice_id).get();
      }
      if (!orderQuery || orderQuery.empty) {
        orderQuery = await transactionsRef
          .where("userId", "==", userId)
          .where("status", "==", "pending")
          .limit(1)
          .get();
      }
      
      if (!orderQuery.empty) {
        const orderDoc = orderQuery.docs[0];
        await orderDoc.ref.update({ 
          status: "completed",
          invoice_id: invoice_id,
          updatedAt: FieldValue.serverTimestamp()
        });

        // 3. Update Related Entity (Milestone or File)
        if (projectId) {
          const projectRef = firestore.collection("projects").doc(projectId);
          const projectSnap = await projectRef.get();
          
          if (projectSnap.exists) {
            const projectData = projectSnap.data();

            if (milestoneId) {
              const updatedMilestones = projectData?.milestones?.map((m: any) => 
                m.id === milestoneId ? { ...m, status: "paid" } : m
              );
              await projectRef.update({ milestones: updatedMilestones });
            }

            if (fileId) {
              const updatedFiles = projectData?.files?.map((f: any) => 
                f.url === fileId ? { ...f, isLocked: false } : f
              );
              await projectRef.update({ files: updatedFiles });
            }
          }
        }
      }
    }
    res.json({ status: "ACK" });
  });

  // --- Email Notification Logic ---
  app.post("/api/notify-admin", async (req, res) => {
    const { clientName, messageSnippet, conversationId, messageId } = req.body;
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("SMTP credentials missing, skipping admin notification.");
      return res.json({ success: false, error: "SMTP not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const sendEmail = async () => {
      // If we have a messageId, check if it's already read
      if (conversationId && messageId) {
        try {
          const msgRef = firestore.collection("conversations").doc(conversationId).collection("messages").doc(messageId);
          const msgSnap = await msgRef.get();
          if (msgSnap.exists && msgSnap.data()?.read === true) {
            console.log("Message already read, skipping delayed notification.");
            return;
          }
        } catch (err) {
          console.error("Error checking read status:", err);
        }
      }

      const mailOptions = {
        from: `"Client Portal" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `New Client Message from ${clientName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333; text-transform: uppercase;">New Message Received</h2>
            <p><strong>${clientName}</strong> has sent you a new message via the client portal:</p>
            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #007bff; margin: 20px 0;">
              ${messageSnippet}
            </blockquote>
            <p>Login to your admin dashboard to reply:</p>
            <a href="${process.env.ADMIN_URL || '#'}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Admin Panel</a>
            <p style="margin-top: 20px; font-size: 0.8em; color: #777;">This is an automated system notification.</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Admin notification email sent for message: ${messageId}`);
      } catch (error) {
        console.error("Admin Email error:", error);
      }
    };

    // Wait 5 seconds before checking and sending
    setTimeout(sendEmail, 5000);
    
    // Respond immediately to the client
    res.json({ success: true, message: "Notification scheduled" });
  });

  app.post("/api/notify-client", async (req, res) => {
    const { clientEmail, clientName, messageSnippet, portalLink, conversationId, messageId } = req.body;
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("SMTP credentials missing, skipping email.");
      return res.json({ success: false, error: "SMTP not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const sendEmail = async () => {
      // If we have a messageId, check if it's already read
      if (conversationId && messageId) {
        try {
          const msgRef = firestore.collection("conversations").doc(conversationId).collection("messages").doc(messageId);
          const msgSnap = await msgRef.get();
          if (msgSnap.exists && msgSnap.data()?.read === true) {
            console.log("Message already read by client, skipping delayed notification.");
            return;
          }
        } catch (err) {
          console.error("Error checking read status for client:", err);
        }
      }

      const mailOptions = {
        from: `"Support Portal" <${process.env.EMAIL_USER}>`,
        to: clientEmail,
        subject: "New Message from your Project Admin",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Hello ${clientName},</h2>
            <p>You have a new message regarding your project:</p>
            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #ccc;">
              ${messageSnippet}
            </blockquote>
            <p>You can view and reply to this message in your client portal:</p>
            <a href="${portalLink || process.env.PORTAL_URL || '#'}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Go to Portal</a>
            <p style="margin-top: 20px; font-size: 0.8em; color: #777;">This is an automated notification. All conversations are saved for your reference.</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Client notification email sent for message: ${messageId}`);
      } catch (error) {
        console.error("Email error:", error);
      }
    };

    // Wait 5 seconds before checking and sending
    setTimeout(sendEmail, 5000);

    res.json({ success: true, message: "Notification scheduled" });
  });

  // --- Send Meeting Reminders Endpoint ---
  app.post("/api/send-meeting-reminders", async (req, res) => {
    const { clientEmail, clientName, meetingDate, meetingTime } = req.body;
    
    if (!clientEmail) {
      return res.status(400).json({ success: false, error: "Missing clientEmail" });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("SMTP credentials missing, simulating video meeting reminder emails.");
      return res.json({ 
        success: true, 
        simulated: true, 
        message: "SMTP credentials not configured. Reminders simulated successfully in server logs.",
        log: `[SIMULATED EMAIL REMINDERS SENT TO ${clientEmail}] 
        1. Confirmation/1st Reminder: Video Consultation with Joy on ${meetingDate} at ${meetingTime}. 
        2. 2nd Reminder: Starting soon!`
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions1 = {
      from: `"Support Portal" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `[Reminder 1/2] Meeting Confirmed: Video Consultation on ${meetingDate}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb; text-transform: uppercase; margin-bottom: 5px;">Meeting Scheduled</h2>
          <p style="font-size: 0.95em; color: #555;">Hello <strong>${clientName}</strong>,</p>
          <p>Your request for a video meeting has been approved and scheduled by the administrator. Here are the details:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #2563eb;">
            <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${meetingDate}</p>
            <p style="margin: 0 0 8px 0;"><strong>⏰ Time:</strong> ${meetingTime}</p>
            <p style="margin: 0;"><strong>💻 Format:</strong> Video & Audio Consultation</p>
          </div>
          <p>Please log in to your portal at the scheduled time to join the call:</p>
          <a href="${process.env.PORTAL_URL || '#'}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">Open Client Portal</a>
          <p style="font-size: 0.8em; color: #777;">This is the 1st of 2 automated reminders before your meeting. A second alert will be sent closer to the start time.</p>
        </div>
      `
    };

    const mailOptions2 = {
      from: `"Support Portal" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `[Reminder 2/2] Final Alert: Video Consultation Starting Soon`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981; text-transform: uppercase; margin-bottom: 5px;">Starting Soon</h2>
          <p style="font-size: 0.95em; color: #555;">Hello <strong>${clientName}</strong>,</p>
          <p>This is your second and final reminder that your scheduled video consultation is starting shortly!</p>
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #10b981;">
            <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${meetingDate}</p>
            <p style="margin: 0 0 8px 0;"><strong>⏰ Time:</strong> ${meetingTime}</p>
            <p style="margin: 0;"><strong>💻 Status:</strong> Ready to connect</p>
          </div>
          <p>Click below to open the client portal and access the call controls:</p>
          <a href="${process.env.PORTAL_URL || '#'}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">Join Meeting Room</a>
          <p style="font-size: 0.8em; color: #777;">You have received all scheduled reminders for this event. If you need to reschedule, please notify the administrator in the chat.</p>
        </div>
      `
    };

    try {
      // Send both reminder emails
      await transporter.sendMail(mailOptions1);
      console.log(`First meeting reminder email sent to ${clientEmail}`);
      
      // Delay second reminder slightly
      setTimeout(async () => {
        try {
          await transporter.sendMail(mailOptions2);
          console.log(`Second meeting reminder email sent to ${clientEmail}`);
        } catch (err) {
          console.error("Second email reminder failed:", err);
        }
      }, 1500);

      res.json({ success: true, message: "Both scheduled email reminders sent successfully." });
    } catch (error: any) {
      console.error("Meeting reminders SMTP error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- Socket.io Logic ---
  const onlineUsers = new Map<string, string>(); // userId -> socketId
  const busyAdmins = new Set<string>(); // admin socketIds in a call

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("identify", (userId) => {
      onlineUsers.set(userId, socket.id);
      io.emit("user-presence", Array.from(onlineUsers.keys()));
      console.log(`User ${userId} identified with socket ${socket.id}`);
    });

    socket.on("join-room", (conversationId) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined room: ${conversationId}`);
    });

    socket.on("identify-admin", () => {
      socket.join("admins");
      onlineUsers.set("admin", socket.id);
      io.emit("user-presence", Array.from(onlineUsers.keys()));
      console.log(`Socket ${socket.id} identified as admin`);
    });

    socket.on("send-message", async (data) => {
      const { conversationId, senderId, text, file } = data;
      
      io.to(conversationId).emit("receive-message", {
        id: "temp-" + Date.now(),
        senderId,
        text: text || "",
        timestamp: new Date().toISOString(),
        read: false,
        ...(file && { file })
      });
    });

    socket.on("edit-message", (data) => {
      const { conversationId, messageId, newText } = data;
      io.to(conversationId).emit("message-edited", { messageId, newText });
    });

    socket.on("delete-message", (data) => {
      const { conversationId, messageId } = data;
      io.to(conversationId).emit("message-deleted", { messageId });
    });

    // --- Video Call Signaling ---
    socket.on("call-user", (data) => {
      const { conversationId, offer, from, callType } = data; // callType: 'video' | 'audio'
      
      if (from !== "admin") {
        if (busyAdmins.size > 0) {
          socket.emit("call-rejected", { reason: "busy" });
          return;
        }
        // Client calling admin: ensure all admins get it even if not in the room yet
        socket.to("admins").emit("incoming-call", { offer, from, conversationId, callType });
      } else {
        // Admin calling client: only that client's room needs to know
        socket.to(conversationId).emit("incoming-call", { offer, from, conversationId, callType });
      }
    });

    socket.on("answer-call", (data) => {
      const { conversationId } = data;
      if (socket.rooms.has("admins")) {
        busyAdmins.add(socket.id);
      }
      socket.to(conversationId).emit("call-answered", data);
    });

    socket.on("ice-candidate", (data) => {
      const { conversationId, candidate } = data;
      socket.to(conversationId).emit("ice-candidate", { candidate });
    });

    socket.on("end-call", (data) => {
      const { conversationId } = data;
      busyAdmins.delete(socket.id);
      io.to(conversationId).emit("call-ended");
    });

    socket.on("typing", (data) => {
      const { conversationId, userId, isTyping } = data;
      socket.to(conversationId).emit("user-typing", { userId, isTyping });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      busyAdmins.delete(socket.id);
      
      // Find and remove from onlineUsers
      for (const [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          io.emit("user-presence", Array.from(onlineUsers.keys()));
          break;
        }
      }
    });
  });

  // Serve uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
