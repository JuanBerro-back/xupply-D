import React, { useEffect, useRef, useState } from 'react';
import { simulatorProductsByType, statuses, words } from './landingData';

export function useLandingInteractions() {
  const [typewriterText, setTypewriterText] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIdx];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIdx < currentWord.length) {
      timeout = setTimeout(() => {
        setTypewriterText(currentWord.slice(0, charIdx + 1));
        setCharIdx(c => c + 1);
      }, 75);
    } else if (!isDeleting && charIdx === currentWord.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
    } else if (isDeleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setTypewriterText(currentWord.slice(0, charIdx - 1));
        setCharIdx(c => c - 1);
      }, 35);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setWordIdx(w => (w + 1) % words.length);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, wordIdx]);

  // 2. Barra de progreso de scroll. Se actualiza el DOM directamente (sin
  //    re-render de toda la página) y se cachea scrollHeight para no forzar
  //    un reflow en cada evento de scroll.
  const progressRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let max = 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      const p = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      if (progressRef.current) progressRef.current.style.width = `${p}%`;
    };
    const measure = () => {
      max = document.body.scrollHeight - window.innerHeight;
    };
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    const handleResize = () => {
      measure();
      update();
    };
    measure();
    update();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 3. Particle network canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respeta "prefers-reduced-motion": sin animación de partículas.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const mouse = { x: -999, y: -999 };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const particles = Array.from({ length: window.innerWidth < 700 ? 30 : 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.3 + 1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const distMouse = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (distMouse < 140) {
          p.x += (p.x - mouse.x) * 0.006;
          p.y += (p.y - mouse.y) * 0.006;
        }

        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.18;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      // Pausa la animación cuando la pestaña no es visible (ahorra CPU/batería).
      if (!document.hidden) animId = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      if (!document.hidden) render();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 4. Stepper & Telemetry
  const [currentStep, setCurrentStep] = useState(0);
  const [autoStep, setAutoStep] = useState(true);
  const [simulatedDeliverySuccess, setSimulatedDeliverySuccess] = useState(false);

  useEffect(() => {
    if (!autoStep) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % statuses.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [autoStep]);

  const handleManualStep = (idx: number) => {
    setAutoStep(false);
    setCurrentStep(idx);
  };

  const handleSimulateFastForward = () => {
    setAutoStep(false);
    setCurrentStep(4);
    setSimulatedDeliverySuccess(true);
    setTimeout(() => {
      setSimulatedDeliverySuccess(false);
    }, 3000);
  };

  // 5. Simulator State
  const [selectedType, setSelectedType] = useState('burger');
  const currentProducts = simulatorProductsByType[selectedType] || simulatorProductsByType.burger;

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cufeCode, setCufeCode] = useState('8f3b92c47a1098e21054de74b39a...01cb');
  const [orderTransmittedMsg, setOrderTransmittedMsg] = useState(false);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const prods = simulatorProductsByType[type] || simulatorProductsByType.burger;
    const initialQty: Record<number, number> = {};
    prods.forEach(p => {
      initialQty[p.id] = 0;
    });
    setQuantities(initialQty);
  };

  const handleQuantity = (id: number, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  // Simulator calculations
  const rawSubtotal = currentProducts.reduce((acc, p) => acc + p.price * (quantities[p.id] || 0), 0);
  const fefoSavings = currentProducts.reduce((acc, p) => acc + p.price * (quantities[p.id] || 0) * p.fefoDiscount, 0);
  const subtotalAfterFefo = rawSubtotal - fefoSavings;
  const tax = Math.round(subtotalAfterFefo * 0.08); // 8% Impoconsumo
  const totalPayable = subtotalAfterFefo + tax;

  const handleEmitOrder = () => {
    const randHash = Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setCufeCode(`${randHash.slice(0, 16)}...${randHash.slice(-12)}`);
    setOrderTransmittedMsg(true);
    setTimeout(() => {
      setOrderTransmittedMsg(false);
    }, 3500);
  };

  // 6. Role Explorer Tabs
  const [activeRole, setActiveRole] = useState('admin');

  // 7. 3D Card Tilt handler
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty('--ry', (px - 0.5) * 12 + 'deg');
    card.style.setProperty('--rx', (0.5 - py) * 12 + 'deg');
    card.style.setProperty('--mx', px * 100 + '%');
    card.style.setProperty('--my', py * 100 + '%');
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  return {
    typewriterText,
    progressRef,
    canvasRef,
    currentStep,
    autoStep,
    simulatedDeliverySuccess,
    handleManualStep,
    handleSimulateFastForward,
    selectedType,
    currentProducts,
    quantities,
    cufeCode,
    orderTransmittedMsg,
    handleTypeChange,
    handleQuantity,
    rawSubtotal,
    fefoSavings,
    subtotalAfterFefo,
    tax,
    totalPayable,
    handleEmitOrder,
    activeRole,
    setActiveRole,
    handleCardMouseMove,
    handleCardMouseLeave,
  };
}

export type LandingInteractions = ReturnType<typeof useLandingInteractions>;
