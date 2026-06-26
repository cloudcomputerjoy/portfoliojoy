import React, { useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Calendar, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";

export const MeetingRequestCard = ({ 
  msg, 
  isMe, 
  isClientView,
  conversationId,
}: { 
  msg: any; 
  isMe: boolean; 
  isClientView: boolean;
  conversationId: string;
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string>("");

  const handleUpdateStatus = async (status: 'approved' | 'declined') => {
    try {
      const msgRef = doc(db, "conversations", conversationId, "messages", msg.id);
      await updateDoc(msgRef, {
        meetingStatus: status
      });

      // If approved, trigger the reminder emails automatically!
      if (status === 'approved') {
        const conversationSnap = await getDoc(doc(db, "conversations", conversationId));
        const clientEmail = conversationSnap.data()?.clientEmail || "";
        const clientName = conversationSnap.data()?.clientName || "Client";
        
        // Let's call the real/simulated meeting reminders backend!
        await fetch("/api/send-meeting-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientEmail,
            clientName,
            meetingDate: msg.meetingDate,
            meetingTime: msg.meetingTime
          })
        });
      }
    } catch (err) {
      console.error("Failed to update meeting status:", err);
    }
  };

  const handleSimulateReminders = async () => {
    setIsSimulating(true);
    setSimulationLog("Connecting to secure consultation email relays...");
    try {
      const conversationSnap = await getDoc(doc(db, "conversations", conversationId));
      const clientEmail = conversationSnap.data()?.clientEmail || "";
      const clientName = conversationSnap.data()?.clientName || "Client";
      
      const res = await fetch("/api/send-meeting-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail,
          clientName,
          meetingDate: msg.meetingDate,
          meetingTime: msg.meetingTime
        })
      });
      const data = await res.json();
      if (data.simulated) {
        setSimulationLog(`⚡ Simulated Transmissions Complete!\n\n${data.log}`);
      } else {
        setSimulationLog(`✅ Real Reminder Emails dispatched via SMTP successfully to ${clientEmail}!`);
      }
    } catch (err: any) {
      setSimulationLog(`❌ Error dispatching reminders: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={cn(
      "p-5 rounded-3xl border flex flex-col gap-4 text-ink max-w-[280px] sm:max-w-xs w-full text-left my-2",
      isMe ? "bg-white/10 border-white/20" : "bg-background border-border shadow-inner"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Calendar size={18} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-[9px] font-black uppercase tracking-widest", isMe ? "text-white/60" : "text-primary/60")}>Video Meeting</p>
          <h4 className="text-xs font-bold truncate">Request Consultation</h4>
        </div>
      </div>

      {/* Date & Time display */}
      <div className={cn("p-3 bg-black/5 rounded-xl border flex flex-col gap-2", isMe ? "border-white/10" : "border-border")}>
        <div className="flex items-center justify-between text-xs">
          <span className="opacity-60 font-medium">Date:</span>
          <span className="font-bold">{msg.meetingDate}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
          <span className="opacity-60 font-medium">Time:</span>
          <span className="font-bold">{msg.meetingTime}</span>
        </div>
        {msg.meetingNotes && (
          <div className="text-[10px] border-t border-white/5 pt-2 mt-1">
            <span className="opacity-60 font-medium block mb-0.5">Notes:</span>
            <p className="italic opacity-80">"{msg.meetingNotes}"</p>
          </div>
        )}
      </div>

      {/* Status Indicators */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="opacity-60 text-[10px] uppercase font-black tracking-widest">Status:</span>
          {msg.meetingStatus === "pending" && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 border border-yellow-500/10">
              <span className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse" />
              Pending
            </span>
          )}
          {msg.meetingStatus === "approved" && (
            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 border border-green-500/10">
              <span className="w-1 h-1 rounded-full bg-green-500" />
              Confirmed
            </span>
          )}
          {msg.meetingStatus === "declined" && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 border border-red-500/10">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              Declined
            </span>
          )}
        </div>

        {msg.meetingStatus === "approved" && (
          <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-[10px] text-green-600 font-medium flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[8px]">
              <CheckCircle size={10} className="text-green-500" />
              Two Reminders Configured
            </div>
            <span>Emails sent before meeting.</span>
            
            {/* Simulation Block */}
            <div className="mt-2 pt-2 border-t border-green-500/20">
              <button
                onClick={handleSimulateReminders}
                disabled={isSimulating}
                className="w-full py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-black text-[8px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                {isSimulating ? "Sending..." : "Simulate Reminders"}
              </button>
              {simulationLog && (
                <pre className="mt-2 p-1.5 bg-background border border-border rounded-lg text-[8px] text-ink font-mono whitespace-pre-wrap leading-normal text-left max-h-[100px] overflow-y-auto">
                  {simulationLog}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admin Action Buttons */}
      {!isClientView && msg.meetingStatus === "pending" && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => handleUpdateStatus('approved')}
            className="flex-1 py-1.5 bg-green-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-md shadow-green-600/10"
          >
            Approve
          </button>
          <button
            onClick={() => handleUpdateStatus('declined')}
            className="flex-1 py-1.5 bg-red-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-md shadow-red-600/10"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
};
