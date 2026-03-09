'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, MessageSquare, X } from 'lucide-react';
import CallistoOrb from '@/components/CallistoOrb';
import TranscriptPanel from '@/components/TranscriptPanel';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { ConnectionState } from '@/types';

/** Gemini-style four-pointed star used as a decorative background element. */
const GeminiStar = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0Z" />
  </svg>
);

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.CONNECTED]: 'Listening',
  [ConnectionState.CONNECTING]: 'Connecting…',
  [ConnectionState.ERROR]: 'Connection error',
  [ConnectionState.DISCONNECTED]: 'Standby',
};

const STATUS_COLOR: Record<ConnectionState, string> = {
  [ConnectionState.CONNECTED]: '#60a5fa',
  [ConnectionState.CONNECTING]: '#a78bfa',
  [ConnectionState.ERROR]: '#f87171',
  [ConnectionState.DISCONNECTED]: '#525252',
};

export default function Home() {
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    connectionState,
    transcripts,
    inputVolume,
    outputVolume,
    connect,
    disconnect,
    isConnected,
    isConnecting,
  } = useVoiceAssistant();

  // Use whichever volume source is louder for the visual
  const audioLevel = isConnected ? Math.max(inputVolume, outputVolume) : 0;

  const handleOrbClick = () => {
    if (isConnected) {
      disconnect();
    } else if (!isConnecting) {
      void connect();
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative select-none">

      {/* ── Decorative star background ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <GeminiStar className="absolute top-[10%] left-[20%] w-3 h-3 text-white opacity-80" />
        <GeminiStar className="absolute top-[30%] left-[80%] w-4 h-4 text-white opacity-60" />
        <GeminiStar className="absolute top-[70%] left-[15%] w-2 h-2 text-white opacity-90" />
        <GeminiStar className="absolute top-[85%] left-[75%] w-3 h-3 text-white opacity-50" />
        <GeminiStar className="absolute top-[40%] left-[40%] w-5 h-5 text-white opacity-20 blur-[1px]" />
        <GeminiStar className="absolute top-[60%] left-[60%] w-3 h-3 text-blue-200 opacity-70" />
        <GeminiStar className="absolute top-[20%] left-[60%] w-2 h-2 text-orange-200 opacity-80" />
        <GeminiStar className="absolute top-[55%] left-[35%] w-2 h-2 text-purple-200 opacity-60" />
        <GeminiStar className="absolute top-[15%] left-[50%] w-3 h-3 text-neutral-300 opacity-40" />
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">

        {/* Orb */}
        <CallistoOrb
          audioLevel={audioLevel}
          isActive={isConnected}
          onClick={handleOrbClick}
        />

        {/* Controls */}
        <div className="mt-8 flex flex-col items-center gap-6">

          {/* Mic toggle button */}
          <motion.button
            whileHover={{ scale: isConnecting ? 1 : 1.05 }}
            whileTap={{ scale: isConnecting ? 1 : 0.95 }}
            onClick={handleOrbClick}
            disabled={isConnecting}
            aria-label={isConnected ? 'Disconnect' : 'Connect microphone'}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60
              ${isConnected
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_24px_rgba(59,130,246,0.35)]'
                : connectionState === ConnectionState.ERROR
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : connectionState === ConnectionState.CONNECTING
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                    : 'bg-neutral-800/60 text-neutral-400 border border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200'}
            `}
          >
            {isConnected ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </motion.button>

          {/* Name & status */}
          <div className="text-center">
            <motion.h1
              className="text-2xl font-light tracking-widest text-neutral-200 uppercase"
              animate={{ opacity: isConnected ? 1 : 0.7 }}
            >
              Callisto
            </motion.h1>
            <motion.p
              className="text-xs tracking-widest uppercase mt-2"
              animate={{
                color: STATUS_COLOR[connectionState],
                opacity: isConnected ? 1 : 0.55,
              }}
              transition={{ duration: 0.4 }}
            >
              {STATUS_LABEL[connectionState]}
            </motion.p>
          </div>
        </div>
      </div>

      {/* ── Transcript toggle ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {transcripts.length > 0 && (
          <motion.button
            key="transcript-toggle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowTranscript((v) => !v)}
            aria-label={showTranscript ? 'Close transcript' : 'Open transcript'}
            className="fixed bottom-6 right-6 z-20 w-12 h-12 rounded-full
                       bg-neutral-900/80 border border-neutral-700 text-neutral-400
                       hover:text-neutral-200 flex items-center justify-center
                       transition-colors backdrop-blur-sm"
          >
            {showTranscript ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Transcript panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTranscript && (
          <TranscriptPanel
            transcripts={transcripts}
            onClose={() => setShowTranscript(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
