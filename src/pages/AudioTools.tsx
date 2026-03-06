import { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, Play, Square, Loader2, Volume2, FileAudio } from 'lucide-react';
import { cn } from '@/lib/utils';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export default function AudioTools() {
  const [activeTab, setActiveTab] = useState<'tts' | 'transcribe'>('tts');
  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [ttsAudioSrc, setTtsAudioSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleTTS = async () => {
    if (!ttsInput.trim() || isProcessing) return;
    setIsProcessing(true);
    setTtsAudioSrc(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsInput }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setTtsAudioSrc(`data:audio/wav;base64,${base64Audio}`);
      } else {
        alert("No audio generated.");
      }
    } catch (error: any) {
      console.error("TTS Error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // Or mp3/webm depending on browser
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          const mimeType = (reader.result as string).split(';')[0].split(':')[1];
          await transcribeAudio(base64String, mimeType);
        };
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true); // Start processing immediately after stop
    }
  };

  const transcribeAudio = async (base64Data: string, mimeType: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              { text: "Transcribe this audio exactly as spoken." }
            ]
          }
        ]
      });

      setTranscription(response.text || "No transcription available.");
    } catch (error: any) {
      console.error("Transcription Error:", error);
      setTranscription(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Audio Tools</h1>
        <p className="text-gray-500">Generate speech from text or transcribe audio recordings.</p>
      </div>

      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('tts')}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'tts' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Text to Speech
        </button>
        <button
          onClick={() => setActiveTab('transcribe')}
          className={cn(
            "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
            activeTab === 'transcribe' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Transcription
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm min-h-[400px]">
        {activeTab === 'tts' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Voice Selection</label>
                  <div className="flex flex-wrap gap-2">
                    {VOICES.map(voice => (
                      <button
                        key={voice}
                        onClick={() => setSelectedVoice(voice)}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-lg border transition-colors",
                          selectedVoice === voice
                            ? "bg-blue-50 border-blue-500 text-blue-700"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {voice}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Input</label>
                  <textarea
                    value={ttsInput}
                    onChange={(e) => setTtsInput(e.target.value)}
                    placeholder="Enter text to convert to speech..."
                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40 resize-none"
                  />
                </div>

                <button
                  onClick={handleTTS}
                  disabled={!ttsInput.trim() || isProcessing}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Volume2 />}
                  Generate Speech
                </button>
              </div>

              <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                {ttsAudioSrc ? (
                  <div className="text-center p-6 w-full">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Volume2 size={32} />
                    </div>
                    <audio controls src={ttsAudioSrc} className="w-full" autoPlay />
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <FileAudio size={48} className="mx-auto mb-2 opacity-20" />
                    <p>Audio output will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing && !isRecording}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                  isRecording 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={32} />}
              </button>
              
              <p className="text-gray-500 font-medium">
                {isRecording ? "Recording... Click to stop" : isProcessing ? "Transcribing..." : "Click microphone to record"}
              </p>
            </div>

            {transcription && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Transcription Result</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{transcription}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
