import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HashtagParserProps {
  text: string;
  className?: string;
}

export const HashtagParser: React.FC<HashtagParserProps> = ({ text, className = '' }) => {
  const navigate = useNavigate();

  if (!text) return null;

  // Split by hashtags (#\w+) and mentions (@\w+)
  const regex = /(#[\w\d_-]+|@[\w\d_.-]+)/g;
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('#')) {
          const tag = part.substring(1);
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/search?q=${encodeURIComponent(part)}`);
              }}
              className="inline font-bold text-cyan-300 hover:text-cyan-200 hover:underline active:opacity-80 transition-colors mr-1 cursor-pointer"
            >
              {part}
            </button>
          );
        } else if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${encodeURIComponent(username)}`);
              }}
              className="inline font-bold text-purple-300 hover:text-purple-200 hover:underline active:opacity-80 transition-colors mr-1 cursor-pointer"
            >
              {part}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};
