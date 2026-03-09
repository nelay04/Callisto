'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff } from 'lucide-react';
import CallistoOrb from '@/components/CallistoOrb';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { ConnectionState } from '@/types';

/** Gemini-style four-pointed star used as a decorative background element. */
const GeminiStar = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0Z" />
  </svg>
);

export default function Home() {
  const [showTranscripts, setShowTranscripts] = useState(true);

  const {
    connectionState,
    transcripts,
    inputVolume,
    outputVolume,
    inputPitch,
    outputPitch,
    connect,
    disconnect,
    isConnected,
    isConnecting,
  } = useVoiceAssistant();

  // Detect when the AI is actively producing audio
  const isSpeaking = isConnected && outputVolume > 0.04;

  // Drive orb particle animation from whichever source is active
  const audioLevel = isConnected ? (isSpeaking ? outputVolume : inputVolume) : 0;

  // Unused pitch refs kept to avoid breaking the hook signature
  void inputPitch; void outputPitch;

  // Dynamic status label and accent colour
  const statusLabel =
    connectionState === ConnectionState.CONNECTED    ? (isSpeaking ? 'Speaking' : 'Listening') :
    connectionState === ConnectionState.CONNECTING   ? 'Connecting…' :
    connectionState === ConnectionState.ERROR        ? 'Connection error' :
    'Standby';

  const statusColor =
    connectionState === ConnectionState.CONNECTED    ? (isSpeaking ? '#2dd4bf' : '#60a5fa') :
    connectionState === ConnectionState.CONNECTING   ? '#a78bfa' :
    connectionState === ConnectionState.ERROR        ? '#f87171' :
    '#525252';

  // Show only the last 3 turns per side — no scroll, just the recent lines
  const aiTurns   = transcripts.filter((t) => t.role === 'model').slice(-3);
  const userTurns = transcripts.filter((t) => t.role === 'user').slice(-3);

  const handleOrbClick = () => {
    if (isConnected) disconnect();
    else if (!isConnecting) void connect();
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative select-none">

      {/* ── Decorative star background ──────────────────────────────────── */}
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

      {/* ── Centered orb + controls ─────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">

        {/* Orb — particle animation only, position is fixed */}
        <div className="w-full">
          <CallistoOrb
            audioLevel={audioLevel}
            isActive={isConnected}
            onClick={handleOrbClick}
          />
        </div>

        <div className="mt-16 flex flex-col items-center gap-6">

          {/* Mic toggle */}
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
                ? isSpeaking
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_24px_rgba(59,130,246,0.35)]'
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
              animate={{ color: statusColor, opacity: isConnected ? 1 : 0.55 }}
              transition={{ duration: 0.4 }}
            >
              {statusLabel}
            </motion.p>
          </div>
        </div>
      </div>

      {/* ── Callisto’s responses — floating text on left ────────────────────── */}
      {showTranscripts && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-start gap-4
                        max-w-[26vw] pl-8 pr-4 pointer-events-none">
          {aiTurns.map((turn, i) => (
            <motion.div
              key={turn.timestamp.getTime()}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i === aiTurns.length - 1 ? 1 : 0.35 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#4ba2af' }}>Callisto</span>
              <p className="text-sm leading-relaxed font-light" style={{ color: '#4ba2af' }}>
                {turn.text}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── User’s transcriptions — floating text on right ───────────────────── */}
      {showTranscripts && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-start gap-4
                        max-w-[26vw] pr-8 pl-4 pointer-events-none">
          {userTurns.map((turn, i) => (
            <motion.div
              key={turn.timestamp.getTime()}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: i === userTurns.length - 1 ? 1 : 0.35 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#8b665d' }}>You</span>
              <p className="text-sm leading-relaxed font-light" style={{ color: '#8b665d' }}>
                {turn.text}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Transcript toggle — bottom right slider ───────────────────────── */}
      <div className="fixed bottom-6 right-6 z-20 flex items-center gap-3">
        <span className="text-[9px] tracking-widest uppercase"
              style={{ color: showTranscripts ? '#50a2ff' : '#e5e5e5', opacity: 0.7 }}>
          {showTranscripts ? 'Transcript on' : 'Transcript off'}
        </span>
        <button
          onClick={() => setShowTranscripts((v) => !v)}
          aria-label="Toggle transcripts"
          style={{ background: showTranscripts ? '#091934' : '#262626' }}
          className="relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-none"
        >
          <span
            style={{ background: showTranscripts ? '#50a2ff' : '#e5e5e5' }}
            className={`absolute top-1/2 -translate-y-1/2 left-0.5 w-4 h-4 rounded-full transition-transform duration-300
              ${showTranscripts ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

    </div>
  );
}

