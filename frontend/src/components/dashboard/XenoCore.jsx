import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Ring, Torus } from '@react-three/drei';
import * as THREE from 'three';

function CoreSphere({ revenue, customers }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime; // Avoid .getElapsedTime() warning
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.15;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.05;
      glowRef.current.scale.set(s, s, s);
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.4;
    }
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
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.2}
          transparent
          opacity={0.6}
        />
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
  const count = 50; // Drastically reduced
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const pointsRef = useRef();
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
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

export default function XenoCore({ revenue = 0, customers = 0 }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        dpr={1}
        powerPreference="high-performance"
        gl={{ 
          antialias: false,
          alpha: true, 
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.1} />
        <ParticleField />
        <CoreSphere revenue={revenue} customers={customers} />
      </Canvas>
    </div>
  );
}
