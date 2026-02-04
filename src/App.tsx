import { useState, useRef, useEffect, useCallback } from 'react';
import './styles.css';

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'watermelon' | 'orange' | 'apple' | 'lemon' | 'grape' | 'bomb';
  rotation: number;
  rotationSpeed: number;
  size: number;
  sliced: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface SliceTrail {
  x: number;
  y: number;
  age: number;
}

const FRUIT_COLORS: Record<string, { primary: string; secondary: string; emoji: string }> = {
  watermelon: { primary: '#ff4d6d', secondary: '#2d6a4f', emoji: '🍉' },
  orange: { primary: '#ff8c00', secondary: '#ff6b00', emoji: '🍊' },
  apple: { primary: '#dc2626', secondary: '#991b1b', emoji: '🍎' },
  lemon: { primary: '#fde047', secondary: '#facc15', emoji: '🍋' },
  grape: { primary: '#a855f7', secondary: '#7c3aed', emoji: '🍇' },
  bomb: { primary: '#1f1f1f', secondary: '#000', emoji: '💣' },
};

const GRAVITY = 0.3;
const FRUIT_SPAWN_RATE = 1200;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('fruitNinjaHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sliceTrailRef = useRef<SliceTrail[]>([]);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const isSlicingRef = useRef(false);
  const frameIdRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fruitIdRef = useRef(0);
  const particleIdRef = useRef(0);

  const spawnFruit = useCallback((canvas: HTMLCanvasElement) => {
    const isBomb = Math.random() < 0.15;
    const types: Fruit['type'][] = ['watermelon', 'orange', 'apple', 'lemon', 'grape'];
    const type = isBomb ? 'bomb' : types[Math.floor(Math.random() * types.length)];

    const side = Math.random();
    let x: number, vx: number;

    if (side < 0.4) {
      x = Math.random() * canvas.width * 0.3;
      vx = 2 + Math.random() * 4;
    } else if (side < 0.8) {
      x = canvas.width * 0.7 + Math.random() * canvas.width * 0.3;
      vx = -2 - Math.random() * 4;
    } else {
      x = canvas.width * 0.3 + Math.random() * canvas.width * 0.4;
      vx = (Math.random() - 0.5) * 4;
    }

    const fruit: Fruit = {
      id: fruitIdRef.current++,
      x,
      y: canvas.height + 50,
      vx,
      vy: -12 - Math.random() * 6,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      size: type === 'bomb' ? 40 : 35 + Math.random() * 15,
      sliced: false,
    };

    fruitsRef.current.push(fruit);
  }, []);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 3 + Math.random() * 6;
      particlesRef.current.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 4 + Math.random() * 8,
        life: 1,
        maxLife: 1,
      });
    }
  }, []);

  const checkSlice = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const slicedFruits: Fruit[] = [];

    fruitsRef.current.forEach((fruit) => {
      if (fruit.sliced) return;

      const dx = fruit.x - x1;
      const dy = fruit.y - y1;
      const lineDx = x2 - x1;
      const lineDy = y2 - y1;
      const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);

      if (lineLen === 0) return;

      const t = Math.max(0, Math.min(1, (dx * lineDx + dy * lineDy) / (lineLen * lineLen)));
      const closestX = x1 + t * lineDx;
      const closestY = y1 + t * lineDy;

      const distX = fruit.x - closestX;
      const distY = fruit.y - closestY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < fruit.size) {
        fruit.sliced = true;
        slicedFruits.push(fruit);

        const fruitColor = FRUIT_COLORS[fruit.type];
        createParticles(fruit.x, fruit.y, fruitColor.primary, 12);
        createParticles(fruit.x, fruit.y, fruitColor.secondary, 8);
      }
    });

    return slicedFruits;
  }, [createParticles]);

  const handleSlice = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    sliceTrailRef.current.push({ x, y, age: 0 });
    if (sliceTrailRef.current.length > 20) {
      sliceTrailRef.current.shift();
    }

    if (lastMouseRef.current && isSlicingRef.current) {
      const sliced = checkSlice(lastMouseRef.current.x, lastMouseRef.current.y, x, y);

      sliced.forEach((fruit) => {
        if (fruit.type === 'bomb') {
          setLives((prev) => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameState('gameover');
              if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('fruitNinjaHighScore', score.toString());
              }
            }
            return newLives;
          });
          setCombo(0);
        } else {
          setScore((prev) => prev + 10 + combo * 5);
          setCombo((prev) => prev + 1);
          setShowCombo(true);

          if (comboTimerRef.current) {
            clearTimeout(comboTimerRef.current);
          }
          comboTimerRef.current = setTimeout(() => {
            setCombo(0);
            setShowCombo(false);
          }, 1000);
        }
      });
    }

    lastMouseRef.current = { x, y };
  }, [gameState, checkSlice, combo, score, highScore]);

  const startGame = useCallback(() => {
    fruitsRef.current = [];
    particlesRef.current = [];
    sliceTrailRef.current = [];
    setScore(0);
    setLives(3);
    setCombo(0);
    setGameState('playing');
    lastSpawnRef.current = Date.now();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gameLoop = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f0326');
      gradient.addColorStop(0.5, '#1a0a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle pattern
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < canvas.width; i += 40) {
        for (let j = 0; j < canvas.height; j += 40) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(i, j, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (gameState === 'playing') {
        // Spawn fruits
        if (Date.now() - lastSpawnRef.current > FRUIT_SPAWN_RATE) {
          spawnFruit(canvas);
          lastSpawnRef.current = Date.now();
        }

        // Update and draw fruits
        fruitsRef.current = fruitsRef.current.filter((fruit) => {
          fruit.x += fruit.vx;
          fruit.y += fruit.vy;
          fruit.vy += GRAVITY;
          fruit.rotation += fruit.rotationSpeed;

          // Check if fruit fell without being sliced
          if (!fruit.sliced && fruit.y > canvas.height + 100 && fruit.type !== 'bomb') {
            setLives((prev) => {
              const newLives = prev - 1;
              if (newLives <= 0) {
                setGameState('gameover');
                if (score > highScore) {
                  setHighScore(score);
                  localStorage.setItem('fruitNinjaHighScore', score.toString());
                }
              }
              return newLives;
            });
            return false;
          }

          // Remove sliced fruits after animation
          if (fruit.sliced) {
            fruit.size *= 0.9;
            if (fruit.size < 5) return false;
          }

          // Draw fruit
          ctx.save();
          ctx.translate(fruit.x, fruit.y);
          ctx.rotate(fruit.rotation);

          const colors = FRUIT_COLORS[fruit.type];

          // Glow effect
          if (!fruit.sliced) {
            ctx.shadowColor = colors.primary;
            ctx.shadowBlur = 20;
          }

          // Draw fruit body
          ctx.beginPath();
          ctx.arc(0, 0, fruit.size, 0, Math.PI * 2);
          const fruitGradient = ctx.createRadialGradient(-fruit.size * 0.3, -fruit.size * 0.3, 0, 0, 0, fruit.size);
          fruitGradient.addColorStop(0, colors.primary);
          fruitGradient.addColorStop(1, colors.secondary);
          ctx.fillStyle = fruitGradient;
          ctx.fill();

          // Draw emoji
          ctx.shadowBlur = 0;
          ctx.font = `${fruit.size * 1.2}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(colors.emoji, 0, 0);

          ctx.restore();

          return fruit.y < canvas.height + 150;
        });

        // Update and draw particles
        particlesRef.current = particlesRef.current.filter((particle) => {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vy += GRAVITY * 0.5;
          particle.life -= 0.02;

          if (particle.life <= 0) return false;

          ctx.save();
          ctx.globalAlpha = particle.life;
          ctx.fillStyle = particle.color;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          return true;
        });

        // Draw slice trail
        if (sliceTrailRef.current.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          for (let i = 1; i < sliceTrailRef.current.length; i++) {
            const point = sliceTrailRef.current[i];
            const prevPoint = sliceTrailRef.current[i - 1];
            const alpha = Math.max(0, 1 - point.age / 10);
            const lineWidth = Math.max(1, (1 - point.age / 10) * 8);

            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = lineWidth;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 15;
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();

            point.age += 0.5;
          }

          sliceTrailRef.current = sliceTrailRef.current.filter((p) => p.age < 10);
          ctx.restore();
        }
      }

      frameIdRef.current = requestAnimationFrame(gameLoop);
    };

    frameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(frameIdRef.current);
    };
  }, [gameState, spawnFruit, score, highScore]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isSlicingRef.current = true;
    handleSlice(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isSlicingRef.current) {
      handleSlice(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    isSlicingRef.current = false;
    lastMouseRef.current = null;
    sliceTrailRef.current = [];
  };

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* HUD */}
      {gameState === 'playing' && (
        <div className="hud">
          <div className="score-container">
            <span className="score-label">SCORE</span>
            <span className="score-value">{score}</span>
          </div>
          <div className="lives-container">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`life-icon ${i < lives ? 'active' : 'lost'}`}
              >
                ❌
              </span>
            ))}
          </div>
          {showCombo && combo > 1 && (
            <div className="combo-display">
              <span className="combo-text">{combo}x COMBO!</span>
            </div>
          )}
        </div>
      )}

      {/* Menu */}
      {gameState === 'menu' && (
        <div className="menu-overlay">
          <div className="menu-content">
            <h1 className="game-title">
              <span className="title-fruit">🍉</span>
              FRUIT
              <span className="title-ninja">NINJA</span>
              <span className="title-fruit">🍊</span>
            </h1>
            <p className="subtitle">Slice the fruits, avoid the bombs!</p>
            <button className="play-button" onClick={startGame}>
              <span className="button-text">PLAY</span>
              <span className="button-icon">⚔️</span>
            </button>
            <div className="high-score">
              <span className="hs-label">HIGH SCORE</span>
              <span className="hs-value">{highScore}</span>
            </div>
            <div className="instructions">
              <p>👆 Swipe to slice fruits</p>
              <p>💣 Avoid the bombs</p>
              <p>🔥 Chain slices for combos</p>
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div className="menu-overlay gameover">
          <div className="menu-content">
            <h1 className="gameover-title">GAME OVER</h1>
            <div className="final-score">
              <span className="fs-label">FINAL SCORE</span>
              <span className="fs-value">{score}</span>
            </div>
            {score >= highScore && score > 0 && (
              <div className="new-record">🏆 NEW RECORD! 🏆</div>
            )}
            <button className="play-button" onClick={startGame}>
              <span className="button-text">PLAY AGAIN</span>
              <span className="button-icon">🔄</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        Requested by <a href="https://twitter.com/plantingtoearn" target="_blank" rel="noopener noreferrer">@plantingtoearn</a> · Built by <a href="https://twitter.com/clonkbot" target="_blank" rel="noopener noreferrer">@clonkbot</a>
      </footer>
    </div>
  );
}
