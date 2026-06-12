import { useEffect, useRef } from 'react';

/**
 * Global Network/Constellation Background
 * Created by Antigravity for XENO // MONOLITH
 */
function NetworkBackground({ activeNodes = 50, opacity = 0.4 }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let nodes = [];
    const numNodes = Math.min(Math.max(activeNodes, 40), 100);
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
      });
    }
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            // Dynamic opacity based on distance
            const lineOpacity = (1 - dist / 150) * 0.12;
            ctx.strokeStyle = `rgba(255,255,255,${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
        
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.3)`;
        ctx.fill();
        
        // Subtle glow for some nodes
        if (i % 7 === 0) {
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,0.05)`;
          ctx.fill();
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    
    return () => { 
      cancelAnimationFrame(animId); 
      window.removeEventListener('resize', resize); 
    };
  }, [activeNodes]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0" 
      style={{ opacity }}
    />
  );
}

export default NetworkBackground;
