import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LiveVoice() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const playNextChunk = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    const buffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    const currentTime = audioContextRef.current.currentTime;
    const playTime = Math.max(currentTime, nextPlayTimeRef.current);
    
    source.start(playTime);
    nextPlayTimeRef.current = playTime + buffer.duration;

    source.onended = () => {
      playNextChunk();
    };
  };

  const base64ToFloat32Array = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Convert PCM 16-bit LE to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  };

  const float32ToBase64 = (float32Array: Float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleConnect = async () => {
    setError(null);
    try {
      // 1. Setup Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Gemini prefers 16kHz for input
      });

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Connected to Gemini Live");
            setIsConnected(true);
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const audioData = base64ToFloat32Array(base64Audio);
              audioQueueRef.current.push(audioData);
              if (!isPlayingRef.current) {
                playNextChunk();
              }
            }
            
            // Handle Interruption
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              nextPlayTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Disconnected from Gemini Live");
            cleanup();
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
            setError(err.message || "Connection error");
            cleanup();
          }
        }
      });

      sessionRef.current = await sessionPromise;

      // 4. Setup Audio Processing (Input)
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessor for simplicity (AudioWorklet is better but requires separate file)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for UI
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        setVolume(Math.sqrt(sum / inputData.length));

        // Send to Gemini
        // Downsample to 16kHz if needed (though context is 16kHz)
        const base64Data = float32ToBase64(inputData);
        
        if (sessionRef.current) {
           sessionRef.current.sendRealtimeInput({
             media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
           });
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination); // Connect to dest to keep it alive, but mute it? 
      // Actually, connecting to destination might cause feedback loop if not careful.
      // Usually ScriptProcessor needs to be connected to destination to fire events.
      // But we should mute the output of the processor to avoid hearing ourselves.
      // The inputBuffer is what we want. The outputBuffer is what goes to speakers.
      // We can just leave outputBuffer silent.

    } catch (err: any) {
      console.error("Setup Error:", err);
      setError(err.message || "Failed to start audio session");
      cleanup();
    }
  };

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Live Voice Conversation</h1>
        <p className="text-gray-500">
          Talk naturally with Gemini in real-time.
        </p>
      </div>

      <div className="relative inline-block">
        {/* Pulse Effect */}
        {isConnected && (
          <div 
            className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping"
            style={{ animationDuration: '2s' }}
          />
        )}
        
        <button
          onClick={isConnected ? cleanup : handleConnect}
          className={cn(
            "relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
            isConnected 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {isConnected ? <MicOff size={48} /> : <Mic size={48} />}
        </button>

        {/* Volume Ring */}
        {isConnected && (
          <div 
            className="absolute inset-0 rounded-full border-4 border-blue-400 transition-all duration-75"
            style={{ 
              transform: `scale(${1 + volume * 2})`,
              opacity: 0.5 + volume 
            }}
          />
        )}
      </div>

      <div className="mt-8 space-y-4">
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
          isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
          )} />
          {isConnected ? "Live & Listening" : "Ready to Connect"}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg max-w-md mx-auto">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Note: This uses the Gemini Live API. Ensure your microphone is enabled. 
          Latency depends on your network connection.
        </p>
      </div>
    </div>
  );
}
