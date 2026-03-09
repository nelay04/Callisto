'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Turn } from '@/types';

interface TranscriptPanelProps {
  transcripts: Turn[];
  onClose: () => void;
}

export default function TranscriptPanel({ transcripts, onClose }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 320 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 320 }}
      transition={{ type: 'spring', damping: 22, stiffness: 220 }}
      className="fixed right-0 top-0 bottom-0 w-80 bg-neutral-950/95 border-l border-neutral-800
                 backdrop-blur-xl z-30 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <span className="text-[11px] tracking-widest uppercase text-neutral-500 font-medium">
          Transcript
        </span>
        <button
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-300 transition-colors"
          aria-label="Close transcript"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-800">
        {transcripts.length === 0 && (
          <p className="text-xs text-neutral-600 text-center mt-8">
            Conversation will appear here.
          </p>
        )}

        {transcripts.map((turn, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[9px] tracking-widest uppercase text-neutral-600">
              {turn.role === 'user' ? 'You' : 'Callisto'}
            </span>
            <div
              className={`max-w-[90%] px-3 py-2 rounded-2xl text-xs leading-relaxed text-neutral-200
                ${turn.role === 'user'
                  ? 'bg-blue-950/60 border border-blue-900/60'
                  : 'bg-neutral-800/60 border border-neutral-700/50'
                }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </motion.aside>
  );
}
