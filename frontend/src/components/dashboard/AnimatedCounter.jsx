import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export default function AnimatedCounter({ value, prefix = '', suffix = '', duration = 1.5 }) {
  const nodeRef = useRef(null);
  
  // Clean the value (remove commas if string, handle formatting later)
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value);
  
  const springValue = useSpring(0, {
    mass: 1,
    stiffness: 70,
    damping: 15,
    duration: duration * 1000
  });

  const displayValue = useTransform(springValue, (current) => {
    // Format appropriately: integers vs decimals
    const rounded = numValue % 1 !== 0 ? current.toFixed(1) : Math.round(current);
    // Add commas formatting automatically for thousands
    return `${prefix}${Number(rounded).toLocaleString('en-IN')}${suffix}`;
  });

  useEffect(() => {
    springValue.set(numValue || 0);
  }, [numValue, springValue]);

  return <motion.span ref={nodeRef}>{displayValue}</motion.span>;
}
