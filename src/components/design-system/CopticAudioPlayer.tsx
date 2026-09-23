import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Repeat, FastForward } from 'lucide-react';
import { Language } from '../../types';
import { t } from '../../localization/i18n';
import { CopticButton } from './CopticButton';
import { CopticCard } from './CopticCard';
import { CopticBadge } from './CopticBadge';

export interface CopticAudioPlayerProps {
  titleEn: string;
  titleAr: string;
  titleCop: string;
  seasonEn?: string;
  audioUrl?: string;
  lang?: Language;
  onTimeUpdate?: (time: number) => void;
}

export const CopticAudioPlayer: React.FC<CopticAudioPlayerProps> = ({
  titleEn,
  titleAr,
  titleCop,
  seasonEn = 'Annual',
  audioUrl,
  lang = 'en',
  onTimeUpdate
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(148); // demo fallback 2:28
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(0.85);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedCycle = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <CopticCard variant="sacred" padding="sm" className="w-full">
      {/* Track Meta */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border-stone)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] coptic-ui">
              {titleCop}
            </span>
            <CopticBadge variant="gold" size="sm">
              {seasonEn}
            </CopticBadge>
          </div>
          <div className="text-xs text-[var(--text-ink)] font-semibold mt-0.5">
            {lang === 'ar' ? titleAr : titleEn}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Speed Selector */}
          <button
            onClick={handleSpeedCycle}
            className="text-[11px] font-bold px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-stone)] rounded-lg hover:border-[var(--brand-gold)] transition-colors cursor-pointer"
            title={`${t('audio.speed', lang)}: ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>

          {/* Loop Refrain Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              isLooping
                ? 'bg-[var(--brand-gold)] text-white border-[var(--brand-gold-dark)]'
                : 'bg-[var(--surface-elevated)] text-[var(--text-ink)] border-[var(--border-stone)] hover:bg-[var(--surface-card)]'
            }`}
            title={t('audio.loop', lang)}
            aria-pressed={isLooping}
          >
            <Repeat size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar & Timestamps */}
      <div className="space-y-1 my-2">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => setCurrentTime(Number(e.target.value))}
          aria-label={t('audio.seek', lang)}
          className="w-full h-1.5 bg-[var(--border-stone)] rounded-lg appearance-none cursor-pointer accent-[var(--brand-burgundy)] dark:accent-[var(--brand-gold)]"
        />
        <div className="flex justify-between text-[11px] font-mono text-[var(--color-neutral)]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Primary Controls */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setCurrentTime(0)}
          className="p-2 text-[var(--color-neutral)] hover:text-[var(--text-ink)] rounded-xl hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
          title="Rewind to beginning"
        >
          <RotateCcw size={16} />
        </button>

        <div className="flex items-center gap-3">
          <CopticButton
            onClick={togglePlay}
            variant="primary"
            size="md"
            icon={isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            className="w-12 h-12 !rounded-full !p-0 shadow-md"
            aria-label={isPlaying ? t('audio.pause', lang) : t('audio.play', lang)}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 text-[var(--color-neutral)] hover:text-[var(--text-ink)] rounded-xl hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : t('audio.mute', lang)}
            aria-label={t('audio.volume', lang)}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </CopticCard>
  );
};
