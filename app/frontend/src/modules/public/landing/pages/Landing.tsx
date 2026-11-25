import './Landing.css';
import { useLandingInteractions } from '../hooks';
import { LandingNav } from '../components/LandingNav';
import { LandingHero } from '../components/LandingHero';
import { LandingMarquee } from '../components/LandingMarquee';
import { LandingStats } from '../components/LandingStats';
import { LandingFeatures } from '../components/LandingFeatures';
import { LandingSimulator } from '../components/LandingSimulator';
import { LandingRoles } from '../components/LandingRoles';
import { LandingSteps } from '../components/LandingSteps';
import { LandingComparison } from '../components/LandingComparison';
import { LandingTestimonials } from '../components/LandingTestimonials';
import { LandingCta } from '../components/LandingCta';
import { LandingFooter } from '../components/LandingFooter';

export default function Landing() {
  const landing = useLandingInteractions();

  return (
    <div className="landing-page">
      {/* Top Scroll Progress Line */}
      <div id="pg" ref={landing.progressRef} />

      {/* Ambient Subtle Blurs */}
      <div className="aur" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {/* Interactive Canvas Particle Network */}
      <canvas id="fx" ref={landing.canvasRef} aria-hidden="true" />

      <LandingNav />
      <LandingHero {...landing} />
      <LandingMarquee />

      {/* Main Content */}
      <main className="wrap">
        <LandingStats {...landing} />
        <LandingFeatures {...landing} />
        <LandingSimulator {...landing} />
        <LandingRoles {...landing} />
        <LandingSteps {...landing} />
        <LandingComparison />
        <LandingTestimonials {...landing} />
        <LandingCta />
      </main>

      <LandingFooter />
    </div>
  );
}
