import { useState, useRef, useEffect } from "react";
import { X, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import axios from "axios";
import api from "@/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  id: 0,
  role: "assistant",
  content: "您好，我是系統小幫手。您可以用自然語言詢問本院的就診資料，例如：「今天候診還有幾隻？」或「找一下叫芝麻的動物最近的血液報告」。",
};

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post<{ reply: string }>("/assistant/chat", {
        message: text,
        history,
      });
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: res.data.reply },
      ]);
    } catch (err) {
      let msg = "抱歉，無法連接到小幫手服務，請稍後再試。";
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (detail) msg = detail;
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: msg },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* 背景遮罩（點擊關閉） */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* 滑入面板 */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-80 flex flex-col bg-background border-l shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* 標題列 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">系統小幫手</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 對話區 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          ))}

          {isLoading && (
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground">
              <span className="animate-pulse">思考中…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 輸入列 */}
        <div className="border-t px-3 py-3 flex gap-2">
          <Input
            placeholder="輸入問題…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="h-9 text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
