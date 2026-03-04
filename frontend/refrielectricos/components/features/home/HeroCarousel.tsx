'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';

// Blur placeholders base64 para carga instantánea (10x10px)
const BLUR_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDBAURAAYSIRMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABkRAAIDAQAAAAAAAAAAAAAAAAECAAMRIf/aAAwDAQACEQMRAD8AqbWsdPcLlULUTSwxxKrfu8ckEfoOsHONa3cdg26noquop6d4p6eB5Y3EjHkQpIyDwIP7p0aNJKBmYkruULWTPZ//2Q==";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  buttonText: string | null;
  isActive: boolean;
  position: number;
}

interface HeroCarouselProps {
  banners: Banner[];
}

export default function HeroCarousel({ banners }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const slides = banners || [];

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    if (newDirection === 1) {
      setCurrent((curr) => (curr === slides.length - 1 ? 0 : curr + 1));
    } else {
      setCurrent((curr) => (curr === 0 ? slides.length - 1 : curr - 1));
    }
  };

  // Reset current index if it exceeds slides length
  useEffect(() => {
    if (current >= slides.length && slides.length > 0) {
      setCurrent(0);
    }
  }, [slides.length, current]);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => paginate(1), 5000);
    return () => clearInterval(timer);
     
  }, [current, slides.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  // Show empty state if no banners
  if (slides.length === 0) {
    return (
      <div className="relative w-full max-w-7xl mx-auto">
        <div className="relative h-100 md:h-125 w-full overflow-hidden rounded-2xl shadow-lg bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h2 className="text-2xl md:text-4xl font-bold mb-2">Bienvenido a Refrielectricos</h2>
            <p className="text-sm md:text-lg text-blue-100">Tu tienda de confianza en refrigeración</p>
          </div>
        </div>
      </div>
    );
  }

  const currentSlide = slides[current];
  if (!currentSlide) return null;

  return (
    <div className="relative w-full max-w-7xl mx-auto group">
      <div className="relative h-100 md:h-125 w-full overflow-hidden rounded-2xl shadow-lg bg-gray-900">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            className="absolute inset-0 w-full h-full flex items-center"
          >
            <div className="absolute inset-0 z-0">
              <Image
                src={currentSlide.imageUrl}
                alt={currentSlide.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                quality={75}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover opacity-60 mix-blend-overlay"
                priority
                fetchPriority="high"
              />
            </div>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20 bg-[url('/patterns/circuit.svg')] bg-repeat"></div>
            <div className="absolute inset-0 bg-linear-to-r from-black/70 to-transparent"></div>
            
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-12 w-full pointer-events-none">
              <div className="max-w-lg text-white space-y-2 md:space-y-4 pointer-events-auto">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl md:text-4xl font-bold leading-tight"
                >
                  {currentSlide.title}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm md:text-lg text-gray-100 line-clamp-2 md:line-clamp-none"
                >
                  {currentSlide.subtitle || ''}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-2"
                >
                  {currentSlide.link && (
                    <Link href={currentSlide.link!}>
                      <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700 border-none text-sm md:text-base px-4 py-2 md:px-6 md:py-3 h-auto shadow-lg shadow-blue-900/20">
                        {currentSlide.buttonText || 'Ver Productos'}
                      </Button>
                    </Link>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > current ? 1 : -1);
                setCurrent(i);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                current === i ? "bg-white w-6" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Controls (Outside) */}
      <button 
        onClick={() => paginate(-1)} 
        className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-800 hover:text-blue-600 hover:scale-110 transition-all z-20 border border-gray-100"
      >
        <ChevronLeft size={24} />
      </button>
      <button 
        onClick={() => paginate(1)} 
        className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg text-gray-800 hover:text-blue-600 hover:scale-110 transition-all z-20 border border-gray-100"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
