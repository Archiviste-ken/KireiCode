"use client";

import { useState } from "react";
import {
  Send,
  User,
  TerminalSquare,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "ai",
    content:
      "Hi. I am Kirei AI processing your active analysis graph. Please feel free to ask me anything about the codebase.",
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
];

export default function ChatPage() {
  const { requestChat, lastAnalysis } = useApi();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userPrompt = inputVal.trim();

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: userPrompt,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setInputVal("");
    setIsTyping(true);
    setErrorStr(null);

    try {
      const response = await requestChat(userPrompt);
      if (response) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "ai",
            content: response,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      } else {
        setErrorStr(
          "The chat engine encountered an error generating a response.",
        );
      }
    } catch (err) {
      setErrorStr(String(err));
    } finally {
      setIsTyping(false);
    }
  };

  const formatMessageContent = (text: string) => {
    // Basic text formatter separating blocks safely
    const blocks = text.split("\n\n");
    return blocks.map((b, i) => (
      <p key={i} className="mb-3 last:mb-0 whitespace-pre-wrap leading-relaxed">
        {b}
      </p>
    ));
  };

  if (!lastAnalysis) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 p-10 text-center">
        <h2 className="text-xl font-bold text-white">No Analysis Available</h2>
        <p className="text-gray-400">
          Please go to the Dashboard to evaluate a codebase before chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[65vh] max-w-4xl flex-col lg:h-[calc(100dvh-10rem)]">
      {/* Messages Area */}
      <div className="scrollable-list flex flex-1 flex-col gap-8 overflow-y-auto pb-8 pr-2">
        {messages.map((msg) => {
          const isAI = msg.role === "ai";

          return (
            <div
              key={msg.id}
              className={`flex gap-4 ${isAI ? "" : "flex-row-reverse"}`}
            >
              {/* Avatar */}
              <div className="mt-1 shrink-0">
                {isAI ? (
                  <div className="w-8 h-8 rounded border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <TerminalSquare size={16} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded border border-[#ffffff1a] bg-[#11161d] flex items-center justify-center text-gray-400">
                    <User size={16} />
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div
                className={`flex flex-col gap-1.5 max-w-[85%] ${isAI ? "items-start" : "items-end"}`}
              >
                <div
                  className={`flex items-center gap-3 ${isAI ? "flex-row" : "flex-row-reverse"}`}
                >
                  <span className="text-xs font-bold text-gray-400">
                    {isAI ? "Kirei AI" : "User Developer"}
                  </span>
                  <span className="text-[10px] text-gray-600 font-medium">
                    {msg.timestamp}
                  </span>
                </div>

                <div
                  className={`text-sm px-5 py-3 rounded-lg ${
                    isAI
                      ? "bg-[#11161d] text-gray-200 border border-[#ffffff0f]"
                      : "bg-[#ffffff0f] text-white border border-[#ffffff1a]"
                  }`}
                >
                  {formatMessageContent(msg.content)}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-4">
            <div className="mt-1 shrink-0">
              <div className="w-8 h-8 rounded border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-400">
                <LoaderCircle className="animate-spin" size={16} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 items-start">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400">
                  Kirei AI
                </span>
              </div>
              <div className="text-sm px-5 py-3 rounded-lg bg-[#11161d] text-gray-400 border border-[#ffffff0f] italic">
                Thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorStr && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle size={16} />
          {errorStr}
        </div>
      )}

      {/* Input Box */}
      <div className="pt-4 border-t border-[#ffffff0f]">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? "AI is typing..." : "Message Kirei AI..."}
            className="w-full bg-[#11161d] border border-[#ffffff0f] rounded-md py-4 pl-4 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all shadow-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 disabled:bg-transparent disabled:text-gray-600 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
