import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Bot, User, Zap, Brain, Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'standard' | 'thinking' | 'fast' | 'search';

interface Message {
  role: 'user' | 'model';
  content: string;
  groundingMetadata?: any;
}

const MODES: { id: Mode; label: string; icon: any; description: string }[] = [
  { id: 'standard', label: 'Standard', icon: MessageSquare, description: 'Balanced performance (Gemini 3.1 Pro)' },
  { id: 'thinking', label: 'Thinking', icon: Brain, description: 'Deep reasoning (Gemini 3.1 Pro + Thinking)' },
  { id: 'fast', label: 'Fast', icon: Zap, description: 'Low latency (Gemini 3.1 Flash Lite)' },
  { id: 'search', label: 'Search', icon: Search, description: 'Grounded with Google Search (Gemini 3 Flash)' },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('standard');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let modelName = 'gemini-3.1-pro-preview';
      let config: any = {};

      switch (mode) {
        case 'standard':
          modelName = 'gemini-3.1-pro-preview';
          break;
        case 'thinking':
          modelName = 'gemini-3.1-pro-preview';
          config = { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } };
          break;
        case 'fast':
          modelName = 'gemini-3.1-flash-lite-preview';
          break;
        case 'search':
          modelName = 'gemini-3-flash-preview';
          config = { tools: [{ googleSearch: {} }] };
          break;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config
      });

      const text = response.text || "No response generated.";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      setMessages(prev => [...prev, { 
        role: 'model', 
        content: text,
        groundingMetadata
      }]);

    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message || 'Something went wrong.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Chat</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border transition-all text-sm",
                mode === m.id 
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" 
                  : "border-gray-200 hover:bg-gray-50 text-gray-600"
              )}
            >
              <m.icon className="mb-2 h-5 w-5" />
              <span className="font-medium">{m.label}</span>
              <span className="text-[10px] opacity-70 mt-1 hidden md:block text-center">{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border shadow-sm p-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Bot size={48} className="mb-4 opacity-20" />
            <p>Select a mode and start chatting!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                )}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl p-4",
                  msg.role === 'user' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                )}>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {/* Grounding Sources */}
                  {msg.groundingMetadata?.groundingChunks && (
                    <div className="mt-3 pt-3 border-t border-gray-200/50 text-xs">
                      <p className="font-semibold mb-1 opacity-70">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                          chunk.web?.uri && (
                            <a 
                              key={i} 
                              href={chunk.web.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="bg-white/50 hover:bg-white/80 px-2 py-1 rounded border border-gray-200/50 truncate max-w-[200px] inline-block transition-colors"
                            >
                              {chunk.web.title || chunk.web.uri}
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="bg-gray-100 rounded-2xl p-4 text-gray-500 italic text-sm">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Message Gemini (${MODES.find(m => m.id === mode)?.label} mode)...`}
          className="w-full p-4 pr-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
