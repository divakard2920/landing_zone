import { useState, useEffect, useRef } from 'react';

function CapybaraAvatar() {
  const [isAwake, setIsAwake] = useState(false);
  const sleepTimerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = () => {
      setIsAwake(true);

      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
      sleepTimerRef.current = setTimeout(() => {
        setIsAwake(false);
      }, 2000);
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`capybara-avatar ${isAwake ? 'awake' : 'sleeping'}`}>
      <svg width="70" height="70" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="50" cy="60" rx="35" ry="25" fill="#8B7355"/>
        {/* Head */}
        <ellipse cx="50" cy="35" rx="28" ry="22" fill="#A0826D"/>
        {/* Snout */}
        <ellipse cx="50" cy="45" rx="18" ry="12" fill="#C4A484"/>
        {/* Nose */}
        <ellipse cx="50" cy="42" rx="6" ry="4" fill="#4A3728"/>

        {isAwake ? (
          <>
            {/* Awake eyes */}
            <circle cx="38" cy="30" r="5" fill="#2C1810"/>
            <circle cx="39" cy="29" r="2" fill="#FFF"/>
            <circle cx="62" cy="30" r="5" fill="#2C1810"/>
            <circle cx="63" cy="29" r="2" fill="#FFF"/>
            {/* Blush */}
            <ellipse cx="30" cy="38" rx="5" ry="3" fill="#E8A0A0" opacity="0.5"/>
            <ellipse cx="70" cy="38" rx="5" ry="3" fill="#E8A0A0" opacity="0.5"/>
          </>
        ) : (
          <>
            {/* Sleeping eyes */}
            <path d="M33 30 Q38 33 43 30" stroke="#2C1810" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <path d="M57 30 Q62 33 67 30" stroke="#2C1810" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          </>
        )}

        {/* Ears */}
        <ellipse cx="28" cy="22" rx="8" ry="6" fill="#8B7355"/>
        <ellipse cx="72" cy="22" rx="8" ry="6" fill="#8B7355"/>
        {/* Mouth */}
        <path d="M44 48 Q50 52 56 48" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Whiskers */}
        <path d="M30 44 L18 42" stroke="#4A3728" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M30 47 L18 49" stroke="#4A3728" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M70 44 L82 42" stroke="#4A3728" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M70 47 L82 49" stroke="#4A3728" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>

      <div className="capybara-speech">
        {isAwake ? (
          <span className="speech-bubble hi">Hi!</span>
        ) : (
          <span className="speech-bubble zzz">zzz</span>
        )}
      </div>
    </div>
  );
}

export default CapybaraAvatar;
