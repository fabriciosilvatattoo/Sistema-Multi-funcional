import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon, Video, Upload, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Vision() {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResult('');
    }
  };

  const handleAnalyze = async () => {
    if (!prompt.trim() || !selectedFile || isLoading) return;
    setIsLoading(true);
    setResult('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = (reader.result as string).split(';')[0].split(':')[1];

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64String
                  }
                }
              ]
            }
          ]
        });

        setResult(response.text || "No analysis generated.");
        setIsLoading(false);
      };

    } catch (error: any) {
      console.error("Analysis Error:", error);
      setResult(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Vision & Video Analysis</h1>
        <p className="text-gray-500">Analyze images and videos using Gemini 3.1 Pro.</p>
      </div>

      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => { setActiveTab('image'); setSelectedFile(null); setPreviewUrl(null); setResult(''); }}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'image' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Image Analysis
        </button>
        <button
          onClick={() => { setActiveTab('video'); setSelectedFile(null); setPreviewUrl(null); setResult(''); }}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'video' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Video Understanding
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors min-h-[300px]"
          >
            {previewUrl ? (
              activeTab === 'image' ? (
                <img src={previewUrl} alt="Preview" className="max-h-64 object-contain rounded-lg shadow-sm" />
              ) : (
                <video src={previewUrl} controls className="max-h-64 rounded-lg shadow-sm" />
              )
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">Click to upload {activeTab}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {activeTab === 'image' ? "JPG, PNG, WEBP" : "MP4, WEBM, MOV (Max 20MB for demo)"}
                </p>
              </>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              accept={activeTab === 'image' ? "image/*" : "video/*"}
              className="hidden" 
              onChange={handleFileSelect}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Prompt</label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'image' ? "Describe this image in detail..." : "What is happening in this video?"}
                className="w-full p-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
              />
              <button
                onClick={handleAnalyze}
                disabled={!prompt.trim() || !selectedFile || isLoading}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-full min-h-[400px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Analysis Result</h3>
          {result ? (
            <div className="prose prose-sm max-w-none text-gray-900">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              {activeTab === 'image' ? <ImageIcon size={48} className="mb-4 opacity-20" /> : <Video size={48} className="mb-4 opacity-20" />}
              <p>Analysis will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
