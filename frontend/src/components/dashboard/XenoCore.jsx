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
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.08);
      glowRef.current.material.opacity = 0.15 + Math.sin(t * 2) * 0.05;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.4;
      ring1Ref.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.2) * 0.1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.3;
      ring2Ref.current.rotation.x = -Math.PI / 4 + Math.cos(t * 0.15) * 0.1;
    }
  });

  return (
    <group>
      {/* outer glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>

      {/* main distorted core */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
        <Sphere ref={meshRef} args={[1, 64, 64]}>
          <MeshDistortMaterial
            color="#000000"
            emissive="#ffffff"
            emissiveIntensity={0.2}
            metalness={1}
            roughness={0}
            distort={0.4}
            speed={2}
          />
        </Sphere>
      </Float>

      {/* inner bright core */}
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* orbiting rings */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.7, 0.01, 16, 100]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} transparent opacity={0.4} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[-Math.PI / 4, 0, 0]}>
        <torusGeometry args={[2.0, 0.005, 16, 100]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} transparent opacity={0.2} />
      </mesh>

      {/* clean point lights */}
      <pointLight color="#ffffff" intensity={2} distance={10} />
    </group>
  );
}

function ParticleField() {
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 5;
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
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.03} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

export default function XenoCore({ revenue = 0, customers = 0 }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
        powerPreference="high-performance"
        gl={{ 
          antialias: true, 
          alpha: true, 
          stencil: false,
          depth: true,
          powerPreference: 'high-performance' 
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
