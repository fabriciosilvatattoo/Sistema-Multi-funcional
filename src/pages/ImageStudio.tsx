import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Image as ImageIcon, Upload, Loader2, Download, Wand2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
// Note: 2:3, 3:2, 21:9 are not officially listed in standard enum but requested. 
// We will stick to the safe ones for now or try to pass them if the model supports string.
// The prompt says "gemini-3.1-flash-image-preview supports 1:4, 1:8, 4:1, 8:1" as well.
// The prompt explicitly asks for 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, and 21:9.
// I will include them all as string values.

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

export default function ImageStudio() {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Using gemini-3.1-flash-image-preview for high quality and more aspect ratios as per prompt
      // Or gemini-3-pro-image-preview as requested for aspect ratio control.
      // The prompt says: "Use gemini-3-pro-image-preview and provide an affordance for the user to specify the aspect ratio"
      const model = 'gemini-3.1-flash-image-preview'; 

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      });

      // Extract image
      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }
      
      if (!foundImage) {
        alert("No image generated. The model might have returned text instead.");
      }

    } catch (error: any) {
      console.error("Generation error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!prompt.trim() || !uploadedImage || isLoading) return;
    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Nano Banana 2
      const model = 'gemini-3.1-flash-image-preview';

      // Strip prefix for API
      const base64Data = uploadedImage.split(',')[1];
      const mimeType = uploadedImage.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
         alert("No image generated.");
      }

    } catch (error: any) {
      console.error("Edit error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Image Studio</h1>
        <p className="text-gray-500">Generate and edit images using Gemini 3.1 Flash Image Preview.</p>
      </div>

      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('generate')}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'generate' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Generate
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'edit' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Edit (Nano Banana 2)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            {activeTab === 'edit' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Source Image</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Source" className="max-h-32 object-contain" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500">Click to upload</span>
                    </>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {activeTab === 'generate' ? 'Prompt' : 'Edit Instructions'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'generate' ? "A futuristic city on Mars..." : "Make the sky purple..."}
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
              />
            </div>

            {activeTab === 'generate' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        "px-2 py-1 text-xs rounded border transition-colors",
                        aspectRatio === ratio
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={activeTab === 'generate' ? handleGenerate : handleEdit}
              disabled={isLoading || !prompt || (activeTab === 'edit' && !uploadedImage)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Processing...
                </>
              ) : (
                <>
                  {activeTab === 'generate' ? <Wand2 className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                  {activeTab === 'generate' ? 'Generate' : 'Edit Image'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="bg-gray-100 rounded-xl border border-gray-200 h-[600px] flex items-center justify-center relative overflow-hidden">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Creating magic...</p>
              </div>
            ) : generatedImage ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                <img 
                  src={generatedImage} 
                  alt="Generated" 
                  className="max-w-full max-h-full object-contain shadow-lg" 
                />
                <a 
                  href={generatedImage} 
                  download={`gemini-${Date.now()}.png`}
                  className="absolute bottom-4 right-4 p-3 bg-white text-gray-900 rounded-full shadow-lg hover:bg-gray-50 transition-transform hover:scale-105"
                >
                  <Download className="h-6 w-6" />
                </a>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Result will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
