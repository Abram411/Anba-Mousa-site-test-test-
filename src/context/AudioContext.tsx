import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

interface AudioContextType {
  currentTrackUrl: string | null;
  isPlaying: boolean;
  volume: number;
  playTrack: (url: string) => void;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);

  const playPromiseRef = useRef<Promise<void> | void>();

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = volume;
      
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('error', (e) => {
        console.error("Audio playback error", e);
        setIsPlaying(false);
      });
      
      audioRef.current = audio;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const safePlay = () => {
    if (!audioRef.current) return;
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromiseRef.current = playPromise;
      playPromise.catch(e => {
        if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
          console.error("Play failed:", e);
        }
      });
    }
  };

  const safePause = () => {
    if (!audioRef.current) return;
    if (playPromiseRef.current !== undefined) {
      playPromiseRef.current.then(() => {
        audioRef.current?.pause();
      }).catch(() => {
        // Already aborted
      });
    } else {
      audioRef.current.pause();
    }
  };

  const playTrack = (url: string) => {
    if (!audioRef.current) return;
    
    if (currentTrackUrl === url) {
      togglePlay();
      return;
    }

    if (isPlaying) {
      safePause();
    }

    // Small delay to allow pause to settle if needed, or immediately set src
    setTimeout(() => {
      if (!audioRef.current) return;
      audioRef.current.src = url;
      audioRef.current.load();
      setCurrentTrackUrl(url);
      safePlay();
    }, 50);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrackUrl) return;
    
    if (isPlaying) {
      safePause();
    } else {
      safePlay();
    }
  };

  const setVolume = (vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setVolumeState(vol);
  };

  return (
    <AudioContext.Provider value={{ currentTrackUrl, isPlaying, volume, playTrack, togglePlay, setVolume }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useGlobalAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used within an AudioProvider');
  }
  return context;
}
