import React, { useState, useRef, useEffect } from "react";
import { FaPlay, FaPause } from "react-icons/fa";

const VoiceMessage = ({ audioUrl, theme, isUserMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("timeupdate", setAudioTime);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("timeupdate", setAudioTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const time = e.target.value;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="flex items-center space-x-3 py-2 px-1 min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button
        onClick={togglePlay}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isUserMessage 
            ? (theme === "dark" ? "bg-white/20 hover:bg-white/30 text-white" : "bg-green-600/20 hover:bg-green-600/30 text-green-700") 
            : "bg-green-500 hover:bg-green-600 text-white"
        }`}
      >
        {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} className="ml-1" />}
      </button>

      <div className="flex-grow flex flex-col space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-current ${
            isUserMessage 
              ? (theme === "dark" ? "bg-white/30 text-white" : "bg-green-600/30 text-green-700") 
              : "bg-gray-300 text-green-500"
          }`}
        />
        <div className={`flex justify-between text-[10px] ${
          isUserMessage 
            ? (theme === "dark" ? "text-white/70" : "text-green-800/70") 
            : "text-gray-500"
        }`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex-shrink-0 opacity-70">
        <div className="flex space-x-[2px] items-end h-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-[2px] rounded-full transition-all duration-300 ${
                isUserMessage 
                  ? (theme === "dark" ? "bg-white/60" : "bg-green-700/60") 
                  : "bg-green-500/60"
              }`}
              style={{
                height: `${Math.random() * (isPlaying ? 100 : 40) + 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
