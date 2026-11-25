import { chips } from '../landingData';

export function LandingMarquee() {
  return (
    <>
      {/* Infinite Marquee Ticker */}
      <div className="mq" aria-hidden="true">
        <div>
          {[...chips, ...chips].map((chip, i) => (
            <span key={i}>
              <b>•</b> {chip}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
