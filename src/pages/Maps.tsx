import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { MapPin, Send, Loader2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Maps() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'model', content: string, groundingMetadata?: any}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError("Could not get location. Results may not be relevant to your area.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const config: any = {
        tools: [{ googleMaps: {} }],
      };

      if (location) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      console.error("Maps error:", error);
      setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Maps Grounding</h1>
        <p className="text-gray-500">Ask about places, directions, and local businesses.</p>
        {location ? (
          <div className="flex items-center gap-2 text-xs text-green-600 mt-2">
            <Navigation size={12} />
            <span>Location detected: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-orange-600 mt-2">
            <Navigation size={12} />
            <span>{locationError || "Detecting location..."}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border shadow-sm p-4 mb-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MapPin size={48} className="mb-4 opacity-20" />
            <p>Where do you want to go?</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl p-4",
              msg.role === 'user' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
            )}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>

            {/* Maps Grounding Sources */}
            {msg.groundingMetadata?.groundingChunks && (
              <div className="mt-2 flex flex-wrap gap-2 max-w-[85%]">
                {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                  if (chunk.web?.uri) {
                     return (
                      <a 
                        key={i} 
                        href={chunk.web.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white border border-gray-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <MapPin size={12} />
                        {chunk.web.title || "View on Map"}
                      </a>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm p-2">
            <Loader2 size={16} className="animate-spin" />
            <span>Searching maps...</span>
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Find coffee shops nearby..."
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
