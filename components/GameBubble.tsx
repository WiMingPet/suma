import React, { useState, useEffect, useCallback, useRef } from 'react';

// 类型定义
type BubbleType = number | null; // 0-5 代表6种颜色, null 代表空
type GridType = BubbleType[][];

// 颜色映射
const COLORS = [
  'bg-red-500',    // 0: 🔴
  'bg-blue-500',   // 1: 🔵
  'bg-green-500',  // 2: 🟢
  'bg-yellow-400', // 3: 🟡
  'bg-purple-500', // 4: 🟣
  'bg-orange-500', // 5: 🟠
];

// 游戏配置
const GRID_SIZE = 8;
const BUBBLE_COUNT = 6;
const INITIAL_BUBBLES = GRID_SIZE * GRID_SIZE;

// 音效管理器
class SoundManager {
  private audioContext: AudioContext | null = null;

  private init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    try {
      this.init();
      if (!this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.error('Sound error:', error);
    }
  }

  playSelect() { this.playTone(440, 0.1); }
  playSwap() { this.playTone(523, 0.15); }
  playMatch() { this.playTone(659, 0.2); }
  playCascade() { this.playTone(784, 0.25); }
  playWin() {
    this.playTone(523, 0.3);
    setTimeout(() => this.playTone(659, 0.3), 100);
    setTimeout(() => this.playTone(784, 0.4), 200);
  }
}

const soundManager = new SoundManager();

// 内嵌 CSS 动画
const styleSheet = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  @keyframes floatUp {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-50px); }
  }

  @keyframes scaleIn {
    0% { transform: scale(0); }
    100% { transform: scale(1); }
  }

  .animate-shake {
    animation: shake 0.3s ease-in-out;
  }

  .animate-float-up {
    animation: floatUp 0.8s ease-out forwards;
  }

  .animate-scale-in {
    animation: scaleIn 0.2s ease-out;
  }

  .bubble-selected {
    box-shadow: 0 0 0 4px #FFD700, 0 0 20px rgba(255, 215, 0, 0.6);
    transform: scale(1.1);
    z-index: 10;
  }

  .bubble-cell {
    transition: all 0.2s ease;
  }

  .bubble-cell:hover {
    transform: scale(1.05);
  }

  .bubble-cell:active {
    transform: scale(0.95);
  }
`;

interface GameBubbleProps {
  onClose?: () => void;
}

interface ScorePopup {
  x: number;
  y: number;
  score: number;
  id: number;
}

// 辅助函数：检查坐标是否有效
const isValidPosition = (x: number, y: number): boolean => {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
};

// 辅助函数：获取相邻泡泡
const getAdjacentBubbles = (x: number, y: number): Array<{x: number; y: number}> => {
  const adjacent = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (isValidPosition(nx, ny)) {
      adjacent.push({ x: nx, y: ny });
    }
  }

  return adjacent;
};

// 辅助函数：查找可消除的泡泡
const findMatches = (grid: GridType): Array<{x: number; y: number}> => {
  const matches: Set<string> = new Set();

  // 检查水平方向
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE - 2; x++) {
      const bubble = grid[y][x];
      if (bubble === null || bubble === undefined) continue;

      let count = 1;
      let currentX = x;

      while (currentX < GRID_SIZE - 1 && grid[y][currentX + 1] === bubble) {
        count++;
        currentX++;
      }

      if (count >= 3) {
        for (let i = 0; i < count; i++) {
          matches.add(`${x + i},${y}`);
        }
      }
    }
  }

  // 检查垂直方向
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE - 2; y++) {
      const bubble = grid[y][x];
      if (bubble === null || bubble === undefined) continue;

      let count = 1;
      let currentY = y;

      while (currentY < GRID_SIZE - 1 && grid[currentY + 1][x] === bubble) {
        count++;
        currentY++;
      }

      if (count >= 3) {
        for (let i = 0; i < count; i++) {
          matches.add(`${x},${y + i}`);
        }
      }
    }
  }

  return Array.from(matches).map(key => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
};

// 辅助函数：计算剩余泡泡数量（只统计非空单元格）
const countRemainingBubbles = (grid: GridType): number => {
  let count = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] !== null && grid[y][x] !== undefined) {
        count++;
      }
    }
  }
  return count;
};

// 辅助函数：下落泡泡
const applyGravity = (grid: GridType): GridType => {
  const newGrid: GridType = grid.map(row => [...row]);

  // 从下往上逐列处理
  for (let x = 0; x < GRID_SIZE; x++) {
    let writeY = GRID_SIZE - 1;

    // 将非空泡泡向下移动
    for (let y = GRID_SIZE - 1; y >= 0; y--) {
      if (newGrid[y][x] !== null && newGrid[y][x] !== undefined) {
        if (y !== writeY) {
          newGrid[writeY][x] = newGrid[y][x];
          newGrid[y][x] = null;
        }
        writeY--;
      }
    }
  }

  return newGrid;
};

// 辅助函数：填充新泡泡
const fillNewBubbles = (grid: GridType): GridType => {
  const newGrid: GridType = grid.map(row => [...row]);

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (newGrid[y][x] === null || newGrid[y][x] === undefined) {
        newGrid[y][x] = Math.floor(Math.random() * BUBBLE_COUNT);
      }
    }
  }

  return newGrid;
};

// 辅助函数：初始化网格
const initializeGrid = (): GridType => {
  const grid: GridType = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: BubbleType[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push(Math.floor(Math.random() * BUBBLE_COUNT));
    }
    grid.push(row);
  }

  return grid;
};

const GameBubble: React.FC<GameBubbleProps> = ({ onClose }) => {
  // 游戏状态
  const [grid, setGrid] = useState<GridType>(initializeGrid);
  const [selectedBubble, setSelectedBubble] = useState<{x: number; y: number} | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('');
  const [gameWon, setGameWon] = useState(false);

  // 进度条状态
  const [remainingBubbles, setRemainingBubbles] = useState(INITIAL_BUBBLES);

  // 视觉特效状态
  const [eliminatingBubbles, setEliminatingBubbles] = useState<Array<{x: number; y: number}>>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const scorePopupIdRef = useRef(0);

  // 更新剩余泡泡数量的函数
  const updateRemainingBubbles = useCallback((newGrid: GridType) => {
    const count = countRemainingBubbles(newGrid);
    setRemainingBubbles(count);
    return count;
  }, []);

  // 处理泡泡点击
  const handleBubbleClick = useCallback((x: number, y: number) => {
    if (gameWon || eliminatingBubbles.length > 0) return;

    // 点击空泡泡，忽略
    if (grid[y][x] === null || grid[y][x] === undefined) {
      return;
    }

    // 如果没有选中的泡泡，则选中当前泡泡
    if (!selectedBubble) {
      setSelectedBubble({ x, y });
      setMessage('已选中泡泡，点击相邻泡泡交换');
      soundManager.playSelect();
      return;
    }

    // 如果点击的是已选中的泡泡，取消选中
    if (selectedBubble.x === x && selectedBubble.y === y) {
      setSelectedBubble(null);
      setMessage('已取消选中');
      return;
    }

    // 检查是否相邻
    const dx = Math.abs(x - selectedBubble.x);
    const dy = Math.abs(y - selectedBubble.y);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      // 相邻泡泡，执行交换
      performSwap(selectedBubble.x, selectedBubble.y, x, y);
    } else {
      // 不相邻，重新选中
      setSelectedBubble({ x, y });
      setMessage('已选中泡泡，点击相邻泡泡交换');
      soundManager.playSelect();
    }
  }, [selectedBubble, grid, gameWon, eliminatingBubbles]);

  // 执行交换
  const performSwap = useCallback(async (x1: number, y1: number, x2: number, y2: number) => {
    setMessage('交换中...');
    soundManager.playSwap();

    // 交换泡泡
    const newGrid = grid.map(row => [...row]);
    const temp = newGrid[y1][x1];
    newGrid[y1][x1] = newGrid[y2][x2];
    newGrid[y2][x2] = temp;

    setGrid(newGrid);
    setSelectedBubble(null);

    // 检查是否有消除
    const matches = findMatches(newGrid);

    if (matches.length === 0) {
      // 没有消除，交换回来
      setMessage('没有可消除的泡泡，交换回原位');
      setTimeout(() => {
        const revertGrid = newGrid.map(row => [...row]);
        revertGrid[y1][x1] = revertGrid[y2][x2];
        revertGrid[y2][x2] = temp;
        setGrid(revertGrid);
        setMessage('');
      }, 500);
      return;
    }

    // 有消除，开始消除流程
    setMessage(`消除了 ${matches.length} 个泡泡！`);
    setCombo(1);
    await eliminateMatches(newGrid, matches);
  }, [grid]);

  // 消除泡泡
  const eliminateMatches = useCallback(async (currentGrid: GridType, matches: Array<{x: number; y: number}>) => {
    setEliminatingBubbles(matches);
    soundManager.playMatch();

    // 计算分数
    const matchScore = matches.length * 10 * (combo || 1);
    setScore(prev => prev + matchScore);

    // 显示飘字特效
    const newPopups: ScorePopup[] = matches.map(match => ({
      x: match.x,
      y: match.y,
      score: matchScore / matches.length,
      id: scorePopupIdRef.current++,
    }));
    setScorePopups(prev => [...prev, ...newPopups]);

    // 等待消除动画
    await new Promise(resolve => setTimeout(resolve, 300));

    // 执行消除
    let nextGrid = currentGrid.map(row => [...row]);
    for (const match of matches) {
      nextGrid[match.y][match.x] = null;
    }
    setEliminatingBubbles([]);

    // 更新剩余泡泡数量
    const remaining = updateRemainingBubbles(nextGrid);

    // 下落泡泡
    soundManager.playCascade();
    nextGrid = applyGravity(nextGrid);
    setGrid(nextGrid);

    await new Promise(resolve => setTimeout(resolve, 300));

    // 填充新泡泡
    nextGrid = fillNewBubbles(nextGrid);
    setGrid(nextGrid);

    // 再次更新剩余泡泡数量
    updateRemainingBubbles(nextGrid);

    await new Promise(resolve => setTimeout(resolve, 200));

    // 检查是否有新的消除
    const newMatches = findMatches(nextGrid);
    if (newMatches.length > 0) {
      // 连续消除
      setCombo(prev => prev + 1);
      setMessage(`连击！消除了 ${newMatches.length} 个泡泡`);
      await eliminateMatches(nextGrid, newMatches);
    } else {
      // 没有新的消除，检查是否通关
      const finalRemaining = countRemainingBubbles(nextGrid);
      if (finalRemaining === 0) {
        setGameWon(true);
        setMessage('🎉 恭喜通关！🎉');
        soundManager.playWin();
      } else {
        setCombo(0);
        setMessage('请继续消除泡泡');
      }
    }
  }, [combo, updateRemainingBubbles]);

  // 新游戏
  const handleNewGame = useCallback(() => {
    const newGrid = initializeGrid();
    setGrid(newGrid);
    setSelectedBubble(null);
    setScore(0);
    setCombo(0);
    setMessage('');
    setGameWon(false);
    setEliminatingBubbles([]);
    setScorePopups([]);

    // 初始化剩余泡泡数量
    updateRemainingBubbles(newGrid);
  }, [updateRemainingBubbles]);

  // 取消选中
  const handleCancelSelection = useCallback(() => {
    setSelectedBubble(null);
    setMessage('已取消选中');
  }, []);

  // 计算进度百分比
  const progressPercent = ((INITIAL_BUBBLES - remainingBubbles) / INITIAL_BUBBLES) * 100;

  // 清理飘字特效
  useEffect(() => {
    const timer = setInterval(() => {
      setScorePopups(prev => prev.filter(popup => {
        // 通过检查是否还存在来过滤
        return true;
      }));
    }, 800);

    return () => clearInterval(timer);
  }, []);

  // 注入样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = styleSheet;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-6 shadow-2xl max-w-lg w-full">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">🫧 泡泡消消乐</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 游戏信息 */}
        <div className="bg-white/10 rounded-xl p-4 mb-4 backdrop-blur-sm">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-white/70 text-sm">得分</div>
              <div className="text-2xl font-bold text-white">{score}</div>
            </div>
            <div>
              <div className="text-white/70 text-sm">连击</div>
              <div className="text-2xl font-bold text-yellow-300">
                {combo > 0 ? `${combo}x` : '-'}
              </div>
            </div>
            <div>
              <div className="text-white/70 text-sm">剩余</div>
              <div className="text-2xl font-bold text-white">{remainingBubbles}</div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>消除进度</span>
              <span>{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 游戏消息 */}
        {message && (
          <div className="text-center text-white mb-4 font-medium">
            {message}
          </div>
        )}

        {/* 游戏网格 */}
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm mb-4">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
          >
            {grid.map((row, y) =>
              row.map((bubble, x) => {
                const isSelected = selectedBubble?.x === x && selectedBubble?.y === y;
                const isEliminating = eliminatingBubbles.some(b => b.x === x && b.y === y);
                const isEmpty = bubble === null || bubble === undefined;

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`
                      aspect-square rounded-full bubble-cell cursor-pointer
                      ${isEmpty ? 'bg-white/5' : COLORS[bubble!]}
                      ${isSelected ? 'bubble-selected' : ''}
                      ${isEliminating ? 'animate-ping animate-shake' : ''}
                    `}
                    onClick={() => handleBubbleClick(x, y)}
                  />
                );
              })
            )}
          </div>

          {/* 飘字特效层 */}
          <div className="absolute inset-0 pointer-events-none">
            {scorePopups.map(popup => (
              <div
                key={popup.id}
                className="absolute animate-float-up text-yellow-300 font-bold text-lg"
                style={{
                  left: `${(popup.x / GRID_SIZE) * 100 + 6.25}%`,
                  top: `${(popup.y / GRID_SIZE) * 100 + 6.25}%`,
                }}
              >
                +{Math.round(popup.score)}
              </div>
            ))}
          </div>
        </div>

        {/* 按钮组 */}
        <div className="flex gap-3">
          <button
            onClick={handleCancelSelection}
            disabled={!selectedBubble}
            className="flex-1 py-3 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消选中
          </button>
          <button
            onClick={handleNewGame}
            className="flex-1 py-3 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold transition-all shadow-lg hover:shadow-xl"
          >
            新游戏
          </button>
        </div>

        {/* 通关提示 */}
        {gameWon && (
          <div className="mt-4 bg-green-500/80 rounded-xl p-4 text-center animate-scale-in">
            <div className="text-2xl mb-2">🎉</div>
            <div className="text-white font-bold text-lg">恭喜通关！</div>
            <div className="text-white/80 mt-1">最终得分: {score}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBubble;
