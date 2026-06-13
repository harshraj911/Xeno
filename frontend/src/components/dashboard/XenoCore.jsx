import { useRef, useMemo, useEffect, useState, Component } from 'react';

/* ── WebGL detection ──────────────────────────────────── */
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/* ── Error boundary to catch any Three.js crash ────────── */
class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <CoreFallback />;
    }
    return this.props.children;
  }
}

/* ── CSS-only animated fallback ────────────────────────── */
function CoreFallback() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes xeno-spin-slow  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes xeno-spin-rev   { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes xeno-spin-ring2 { from { transform: rotate(0deg);   } to { transform: rotate(180deg);  } }
        @keyframes xeno-pulse      { 0%,100% { transform: scale(1);    opacity:.7; }  50% { transform: scale(1.12); opacity:1; } }
        @keyframes xeno-pulse-glow { 0%,100% { opacity:.15; transform: scale(1);   }  50% { opacity:.3;  transform: scale(1.3); } }
        @keyframes xeno-orbit-1    { from { transform: rotate(0deg) translateX(72px) rotate(0deg);    } to { transform: rotate(360deg) translateX(72px) rotate(-360deg);  } }
        @keyframes xeno-orbit-2    { from { transform: rotate(120deg) translateX(50px) rotate(-120deg); } to { transform: rotate(480deg) translateX(50px) rotate(-480deg);  } }
        @keyframes xeno-orbit-3    { from { transform: rotate(240deg) translateX(88px) rotate(-240deg); } to { transform: rotate(600deg) translateX(88px) rotate(-600deg);  } }
        @keyframes xeno-flicker    { 0%,100% { opacity:.5; } 45% { opacity:1; } 50% { opacity:.2; } 55% { opacity:.9; } }
      `}</style>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 260, height: 260,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
        animation: 'xeno-pulse-glow 3s ease-in-out infinite',
      }} />

      {/* Outer ring */}
      <div style={{
        position: 'absolute',
        width: 200, height: 200,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.08)',
        animation: 'xeno-spin-slow 18s linear infinite',
      }}>
        <div style={{
          position: 'absolute', top: -3, left: '50%',
          transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          boxShadow: '0 0 8px #fff',
          animation: 'xeno-flicker 2.4s ease-in-out infinite',
        }} />
      </div>

      {/* Mid ring */}
      <div style={{
        position: 'absolute',
        width: 150, height: 150,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.05)',
        animation: 'xeno-spin-rev 12s linear infinite',
        transform: 'rotate(60deg)',
      }}>
        <div style={{
          position: 'absolute', top: -3, left: '50%',
          transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          boxShadow: '0 0 6px #fff',
          animation: 'xeno-flicker 3.1s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: -3, left: '50%',
          transform: 'translateX(-50%)',
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          boxShadow: '0 0 4px #fff',
        }} />
      </div>

      {/* Inner ring — tilted */}
      <div style={{
        position: 'absolute',
        width: 105, height: 105,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.12)',
        animation: 'xeno-spin-ring2 8s linear infinite',
        transform: 'rotate(45deg) rotateX(60deg)',
      }} />

      {/* Core sphere — pure CSS */}
      <div style={{
        position: 'relative',
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.95) 65%, rgba(255,255,255,0.04) 100%)',
        boxShadow: '0 0 30px rgba(255,255,255,0.15), 0 0 60px rgba(255,255,255,0.05), inset 0 0 20px rgba(255,255,255,0.05)',
        animation: 'xeno-pulse 4s ease-in-out infinite',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Core inner glow dot */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)',
          boxShadow: '0 0 12px rgba(255,255,255,0.8)',
          animation: 'xeno-flicker 2s ease-in-out infinite',
        }} />
      </div>

      {/* Floating particles */}
      {[
        { delay: '0s', dur: '6s', anim: 'xeno-orbit-1' },
        { delay: '2s', dur: '8s', anim: 'xeno-orbit-2' },
        { delay: '4s', dur: '7s', anim: 'xeno-orbit-3' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          boxShadow: '0 0 6px rgba(255,255,255,0.4)',
          animation: `${p.anim} ${p.dur} linear infinite`,
          animationDelay: p.delay,
        }} />
      ))}

      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none',
        borderRadius: '50%',
        width: 260, height: 260,
        margin: 'auto',
        top: 0, left: 0, right: 0, bottom: 0,
      }} />
    </div>
  );
}

/* ── Lazy-loaded Three.js parts ────────────────────────── */
let ThreeCanvas = null;
let threeLoaded = false;

function XenoCoreThree({ revenue, customers }) {
  const [ready, setReady] = useState(threeLoaded);

  useEffect(() => {
    if (threeLoaded) return;
    // Dynamic import so the bundle chunk still loads, but only when WebGL is confirmed available
    Promise.all([
      import('@react-three/fiber'),
      import('@react-three/drei'),
      import('three'),
    ]).then(([fiber, drei, THREE]) => {
      const { Canvas, useFrame } = fiber;
      const { Sphere, MeshDistortMaterial } = drei;

      function CoreSphere() {
        const meshRef = useRef();
        const glowRef = useRef();
        const ring1Ref = useRef();

        useFrame((state) => {
          const t = state.clock.elapsedTime;
          if (meshRef.current) meshRef.current.rotation.y = t * 0.15;
          if (glowRef.current) {
            const s = 1 + Math.sin(t * 1.5) * 0.05;
            glowRef.current.scale.set(s, s, s);
          }
          if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.4;
        });

        return (
          <group>
            <mesh ref={glowRef}>
              <sphereGeometry args={[1.5, 16, 16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.03} side={THREE.BackSide} />
            </mesh>
            <Sphere ref={meshRef} args={[1, 32, 32]}>
              <MeshDistortMaterial
                color="#000000"
                emissive="#ffffff"
                emissiveIntensity={0.2}
                metalness={1}
                roughness={0}
                distort={0.3}
                speed={1.5}
              />
            </Sphere>
            <mesh>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} transparent opacity={0.6} />
            </mesh>
            <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[1.7, 0.005, 8, 64]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} transparent opacity={0.3} />
            </mesh>
            <pointLight color="#ffffff" intensity={1.5} distance={8} />
          </group>
        );
      }

      function ParticleField() {
        const count = 50;
        const positions = useMemo(() => {
          const arr = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            const r = 2 + Math.random() * 4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            arr[i * 3 + 2] = r * Math.cos(phi);
          }
          return arr;
        }, []);
        const pointsRef = useRef();
        useFrame((state) => {
          if (pointsRef.current) pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
        });
        return (
          <points ref={pointsRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color="#ffffff" size={0.02} transparent opacity={0.3} sizeAttenuation />
          </points>
        );
      }

      ThreeCanvas = function CanvasWrapper() {
        return (
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            style={{ background: 'transparent' }}
            dpr={1}
            gl={{
              antialias: false,
              alpha: true,
              stencil: false,
              depth: true,
              powerPreference: 'high-performance',
              failIfMajorPerformanceCaveat: false,
              preserveDrawingBuffer: false,
            }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <ambientLight intensity={0.1} />
            <ParticleField />
            <CoreSphere />
          </Canvas>
        );
      };

      threeLoaded = true;
      setReady(true);
    }).catch(() => {
      // If dynamic import fails, stay on fallback (error boundary will handle it)
    });
  }, []);

  if (!ready || !ThreeCanvas) return <CoreFallback />;
  return <ThreeCanvas />;
}

/* ── Public export ─────────────────────────────────────── */
export default function XenoCore({ revenue = 0, customers = 0 }) {
  const [webglOk] = useState(() => isWebGLAvailable());

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {webglOk ? (
        <WebGLErrorBoundary>
          <XenoCoreThree revenue={revenue} customers={customers} />
        </WebGLErrorBoundary>
      ) : (
        <CoreFallback />
      )}
    </div>
  );
}
