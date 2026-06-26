import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bold, Italic, Code, Heading1, Heading2, Quote, List, ListOrdered, CheckSquare, 
  Link as LinkIcon, Eye, Edit2, Columns, Check, Copy, Trash2, Maximize2, Minimize2, 
  Save, Sparkles, FileText, ChevronDown, CheckCircle, RefreshCw
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "../lib/utils";

interface ProjectNotesProps {
  projectId: string;
  userId: string;
}

const TEMPLATES = [
  {
    name: "Requirements Checklist",
    content: `# Project Specifications & Brief\n\n## 🎯 Objectives\n- Goal 1: Describe the primary outcome\n- Goal 2: Describe secondary outcomes\n\n## 📋 Requirements\n- [ ] Key Feature A: Describe feature details\n- [ ] Key Feature B: Describe feature details\n- [ ] Integration: API or platform integrations\n\n## 🔗 References & Assets\n- Figma: [Link here](https://figma.com)\n- Repository: [GitHub link](https://github.com)\n- Brand Assets: [Drive link](https://drive.google.com)`
  },
  {
    name: "Meeting Minutes",
    content: `# Meeting Notes: ${new Date().toLocaleDateString()}\n\n## 👥 Attendees\n- [Client Name]\n- [Joy Saha]\n\n## 💬 Discussion Topics\n- Client feedback on the latest milestone.\n- Review of upcoming deliverables & assets.\n- Clarification on specific feature requests.\n\n## ⚡ Action Items\n- [ ] Client: Provide assets (logo, colors, etc.)\n- [ ] Developer: Hook up remaining API endpoints`
  },
  {
    name: "To-Do / References",
    content: `# Project Task List & References\n\n## 📌 High Priority\n- [ ] Review next milestone details\n- [ ] Confirm and unlock necessary project files\n\n## 🔍 General References\n- Dev site URL: [Insert Link]\n- Staging credentials: \`username / password\`\n- Tech Stack: React, Tailwind, Firebase`
  }
];

export const ProjectNotes = ({ projectId, userId }: ProjectNotesProps) => {
  const [notesText, setNotesText] = useState<string>("");
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("edit");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync / Listen to Firestore Notes document
  useEffect(() => {
    if (!projectId || !userId) return;

    // Single document path per project for isolated client notes
    const noteDocRef = doc(db, "projects", projectId, "private_notes", "user_notes");
    
    setSaveStatus("saving");
    const unsubscribe = onSnapshot(noteDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setNotesText(data.content || "");
        setSaveStatus("saved");
      } else {
        setNotesText("");
        setSaveStatus("idle");
      }
    }, (error) => {
      console.error("Error reading project notes:", error);
      setSaveStatus("error");
    });

    return () => unsubscribe();
  }, [projectId, userId]);

  // Handle auto-save function
  const saveNotesToFirebase = async (content: string) => {
    if (!projectId || !userId) return;
    
    setSaveStatus("saving");
    try {
      const noteDocRef = doc(db, "projects", projectId, "private_notes", "user_notes");
      await setDoc(noteDocRef, {
        content,
        updatedAt: serverTimestamp(),
        userId
      }, { merge: true });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save project notes:", err);
      setSaveStatus("error");
    }
  };

  // Debounce saving notes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotesText(value);
    setSaveStatus("saving");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNotesToFirebase(value);
    }, 1200); // 1.2s debounce to avoid excessive writes
  };

  // Insert formatting markup
  const handleInsert = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    const replacement = prefix + (selectedText || "") + suffix;
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    
    setNotesText(newValue);
    saveNotesToFirebase(newValue);

    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : 0);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // Apply template
  const applyTemplate = (content: string) => {
    if (notesText.trim() && !window.confirm("Applying a template will overwrite your current notes. Continue?")) {
      return;
    }
    setNotesText(content);
    saveNotesToFirebase(content);
    setShowTemplatesDropdown(false);
  };

  // Clear notes
  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear your private notes? This cannot be undone.")) {
      setNotesText("");
      saveNotesToFirebase("");
    }
  };

  // Copy notes to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Could not copy notes to clipboard", err);
    }
  };

  return (
    <div 
      className={cn(
        "bg-surface rounded-[2rem] border border-border overflow-hidden shadow-lg flex flex-col transition-all duration-300",
        isFullscreen ? "fixed inset-4 z-50 bg-background" : "h-[420px]"
      )}
    >
      {/* Editor Header */}
      <div className="px-4 py-2.5 border-b border-border bg-background/40 flex flex-wrap gap-3 items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <FileText size={14} />
          </div>
          <div>
            <h4 className="font-black text-ink text-xs uppercase tracking-wider flex items-center gap-1.5">
              Private Notes
              <span className="text-[8px] bg-primary/10 text-primary font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-primary/20">
                Private
              </span>
            </h4>
            <p className="text-[9px] text-ink-muted">Private scratchpad for objectives, credentials, and reference links.</p>
          </div>
        </div>

        {/* Save Status & General Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Auto-save badge */}
          <div className="mr-1.5 flex items-center gap-1">
            {saveStatus === "saving" && (
              <span className="text-[8px] font-black uppercase tracking-widest text-secondary flex items-center gap-1">
                <RefreshCw size={8} className="animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                <CheckCircle size={8} /> Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[8px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">
                ⚠️ Error
              </span>
            )}
            {saveStatus === "idle" && (
              <span className="text-[8px] font-black uppercase tracking-widest text-ink/30">
                Empty
              </span>
            )}
          </div>

          {/* Mode Selectors */}
          <div className="flex bg-surface-accent rounded-lg p-0.5 border border-border/45">
            <button
              onClick={() => setEditorMode("edit")}
              className={cn(
                "p-1 rounded-md text-ink/60 hover:text-ink transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5",
                editorMode === "edit" ? "bg-surface text-primary shadow-sm border border-border/40 font-black" : ""
              )}
              title="Edit Note"
            >
              <Edit2 size={10} />
              <span className="hidden sm:inline">Write</span>
            </button>
            <button
              onClick={() => setEditorMode("preview")}
              className={cn(
                "p-1 rounded-md text-ink/60 hover:text-ink transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5",
                editorMode === "preview" ? "bg-surface text-primary shadow-sm border border-border/40 font-black" : ""
              )}
              title="Markdown Preview"
            >
              <Eye size={10} />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => setEditorMode("split")}
              className={cn(
                "p-1 rounded-md text-ink/60 hover:text-ink transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 hidden md:flex",
                editorMode === "split" ? "bg-surface text-primary shadow-sm border border-border/40 font-black" : ""
              )}
              title="Split View"
            >
              <Columns size={10} />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-surface-accent border border-border/50 rounded-lg text-ink-muted hover:text-ink transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Edit"}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Editor Toolbar (Only in edit/split modes) */}
      {editorMode !== "preview" && (
        <div className="px-4 py-1.5 border-b border-border bg-surface-accent/20 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-0.5 items-center">
            <button onClick={() => handleInsert("**", "**")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Bold"><Bold size={12} /></button>
            <button onClick={() => handleInsert("*", "*")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Italic"><Italic size={12} /></button>
            <button onClick={() => handleInsert("`", "`")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Inlined Code"><Code size={12} /></button>
            <div className="w-px h-3 bg-border/60 mx-1" />
            <button onClick={() => handleInsert("# ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Heading 1"><Heading1 size={12} /></button>
            <button onClick={() => handleInsert("## ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Heading 2"><Heading2 size={12} /></button>
            <div className="w-px h-3 bg-border/60 mx-1" />
            <button onClick={() => handleInsert("> ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Quote block"><Quote size={12} /></button>
            <button onClick={() => handleInsert("- ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Bullet List"><List size={12} /></button>
            <button onClick={() => handleInsert("1. ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Numbered List"><ListOrdered size={12} /></button>
            <button onClick={() => handleInsert("- [ ] ")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Task Checklist"><CheckSquare size={12} /></button>
            <button onClick={() => handleInsert("[", "](url)")} className="p-1 rounded hover:bg-surface-accent text-ink/50 hover:text-ink transition-colors" title="Hyperlink"><LinkIcon size={12} /></button>
          </div>

          {/* Templates Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
              className="flex items-center gap-1 px-2 py-0.5 bg-surface border border-border hover:bg-surface-accent rounded-lg text-[9px] font-black uppercase tracking-wider text-ink/60 hover:text-ink transition-all shadow-sm"
            >
              <Sparkles size={10} className="text-secondary animate-pulse" />
              Templates
              <ChevronDown size={10} />
            </button>
            
            <AnimatePresence>
              {showTemplatesDropdown && (
                <>
                  <div className="fixed inset-0 z-25" onClick={() => setShowTemplatesDropdown(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 3 }}
                    className="absolute right-0 mt-1 w-48 bg-surface border border-border rounded-xl shadow-lg p-1.5 z-30 ring-1 ring-border"
                  >
                    <span className="text-[8px] font-black text-ink-muted uppercase tracking-[0.15em] px-2 py-1 block border-b border-border/40 mb-1">Select Template</span>
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.name}
                        onClick={() => applyTemplate(tpl.content)}
                        className="w-full text-left px-2 py-1 text-[10px] font-semibold text-ink hover:bg-primary/5 hover:text-primary rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <FileText size={10} className="text-primary" />
                        {tpl.name}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Edit & Preview Pane Container */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-background/10">
        {/* Editor Pane */}
        {editorMode !== "preview" && (
          <div className={cn("flex-1 flex flex-col h-full", editorMode === "split" ? "border-r border-border" : "")}>
            <textarea
              ref={textareaRef}
              value={notesText}
              onChange={handleTextChange}
              placeholder="# Private Project Notes&#10;&#10;Use this space to store credentials, Figma links, technical questions, or general plans.&#10;&#10;*Format your text with Markdown or use the toolbar buttons.*"
              className="flex-1 w-full h-full p-4 bg-transparent resize-none outline-none font-mono text-[11px] leading-relaxed text-ink border-none focus:ring-0 placeholder:text-ink-muted/30"
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {editorMode !== "edit" && (
          <div className="flex-1 h-full overflow-y-auto p-4 bg-surface-accent/5">
            {notesText.trim() ? (
              <div className="markdown-body max-w-none text-ink text-[11px] leading-relaxed break-words">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-xs font-black text-ink mt-3 mb-1 uppercase tracking-wider border-b border-border/30 pb-0.5" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-[11px] font-black text-ink mt-2.5 mb-1" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-[10px] font-black text-ink mt-2 mb-0.5" {...props} />,
                    p: ({node, ...props}) => <p className="text-[11px] text-ink-muted leading-relaxed mb-1.5" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-0.5 text-[11px] text-ink-muted" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-[11px] text-ink-muted" {...props} />,
                    li: ({node, ...props}) => <li className="text-[11px] leading-normal" {...props} />,
                    code: ({node, inline, className, children, ...props} : any) => {
                      return !inline ? (
                        <pre className="bg-black/10 dark:bg-white/5 p-2 rounded-lg font-mono text-[10px] text-ink overflow-x-auto my-1.5 border border-border/30">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      ) : (
                        <code className="bg-black/10 dark:bg-white/5 px-1 py-0.5 rounded font-mono text-[10px] text-primary" {...props}>
                          {children}
                        </code>
                      )
                    },
                    blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-primary/40 pl-2.5 italic text-ink-muted/80 my-1.5 text-[11px]" {...props} />,
                    a: ({node, ...props}) => <a className="text-primary hover:underline font-bold transition-all text-[11px]" target="_blank" rel="noopener noreferrer" {...props} />,
                  }}
                >
                  {notesText}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                <div className="w-8 h-8 rounded-xl bg-border flex items-center justify-center mb-2">
                  <FileText size={14} />
                </div>
                <h5 className="font-bold text-[10px] uppercase tracking-widest mb-1">Live Notes Preview</h5>
                <p className="text-[9px] max-w-[200px]">Type some instructions, notes, or objectives to see the styled render here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Footer / Info Bar */}
      <div className="px-4 py-2 border-t border-border bg-background/40 flex items-center justify-between z-10 text-[9px] text-ink-muted font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span>{notesText ? `${notesText.split(/\s+/).filter(Boolean).length} words` : "0 words"}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>{notesText.length} chars</span>
        </div>

        <div className="flex items-center gap-1.5">
          {notesText && (
            <>
              <button 
                onClick={handleCopy}
                className="px-2 py-0.5 rounded-md border border-border hover:bg-surface-accent transition-all flex items-center gap-1 text-[8px]"
              >
                {copied ? <Check size={8} className="text-emerald-500" /> : <Copy size={8} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button 
                onClick={handleClear}
                className="px-2 py-0.5 rounded-md border border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center gap-1 text-[8px]"
              >
                <Trash2 size={8} />
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
