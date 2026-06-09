(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('scoreValue');
  const sizeEl = document.getElementById('sizeValue');
  const formEl = document.getElementById('formValue');
  const goalEl = document.getElementById('goalValue');
  const statusEl = document.getElementById('statusText');
  const restartButton = document.getElementById('restartButton');
  const playButton = document.getElementById('playButton');
  const bloopUpload = document.getElementById('bloopUpload');
  const fishUpload = document.getElementById('fishUpload');
  const elgramahaUpload = document.getElementById('elgrmahaUpload');
  const leviathanUpload = document.getElementById('leviathanUpload');
  const bloopNameInput = document.getElementById('bloopNameInput');
  const fishNameInput = document.getElementById('fishNameInput');
  const majaNameInput = document.getElementById('majaNameInput');
  const leviathanNameInput = document.getElementById('leviathanNameInput');
  const eventBanner = document.getElementById('eventBanner');
  const winOverlay = document.getElementById('winOverlay');
  const resultTitle = document.getElementById('resultTitle');
  const resultMessage = document.getElementById('resultMessage');
  const overlayRestart = document.getElementById('overlayRestart');

  const width = canvas.width;
  const height = canvas.height;
  const growThreshold = 150;
  const maxRadius = 300;
  const maxItems = 10;
  const driftColors = ['#ff9d6a', '#5fd3ff', '#adff7d', '#d48fff'];

  const images = {
    bloop: null,
    fish: null,
    elgrmaha: null,
    leviathan: null
  };

  const state = {
    player: { x: width / 2, y: height / 2, r: 16, color: '#78d7ff', speed: 3.6 },
    items: [],
    score: 0,
    transformed: false,
    won: false,
    lost: false,
    leviathanPending: false,
    leviathan: null,
    message: 'Use arrow keys or WASD to move your Bloop and eat smaller items.',
    names: {
      bloop: 'Bloop',
      fish: 'Fish',
      maja: 'El Gran Maja',
      leviathan: 'Leviathan'
    }
  };
  let nextLeviathanLaunch = Date.now() + randomBetween(18, 34) * 1000;
  let gameStarted = false;
  let bannerTimer = null;

  const keys = {};

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function spawnItem({ forceDanger = false, attempt = 0, fromEdge = true } = {}) {
    const maxAttempts = 12;
    const arenaMaxRadius = Math.min(width, height) / 2 - 24;
    const cappedMaxRadius = Math.min(arenaMaxRadius, maxRadius);
    const dangerMin = Math.min(Math.max(state.player.r / 0.9, state.player.r + 4), cappedMaxRadius);
    const minRadius = forceDanger ? dangerMin : 10;
    const maxRadiusChoice = forceDanger ? cappedMaxRadius : 20;

    if (attempt > maxAttempts) {
      const fallbackRadius = forceDanger ? Math.min(Math.max(dangerMin, 22), cappedMaxRadius) : randomBetween(10, 20);
      return createItem({ radius: fallbackRadius, fromEdge, forceDanger });
    }

    const radius = forceDanger
      ? randomBetween(Math.max(dangerMin, 22), maxRadiusChoice)
      : randomBetween(minRadius, maxRadiusChoice);

    const item = createItem({ radius, fromEdge, forceDanger });

    if (distance(item.x, item.y, state.player.x, state.player.y) < item.r + state.player.r + 80) {
      return spawnItem({ forceDanger, attempt: attempt + 1, fromEdge });
    }

    return item;
  }

  function createItem({ radius, fromEdge, forceDanger }) {
    let x;
    let y;
    let vx;
    let vy;

    if (fromEdge) {
      const edge = Math.floor(Math.random() * 4);
      const speed = randomBetween(1.2, 2.4);
      switch (edge) {
        case 0: // left
          x = -radius;
          y = randomBetween(radius, height - radius);
          vx = speed;
          vy = randomBetween(-0.8, 0.8);
          break;
        case 1: // top
          x = randomBetween(radius, width - radius);
          y = -radius;
          vx = randomBetween(-0.8, 0.8);
          vy = speed;
          break;
        case 2: // right
          x = width + radius;
          y = randomBetween(radius, height - radius);
          vx = -speed;
          vy = randomBetween(-0.8, 0.8);
          break;
        default: // bottom
          x = randomBetween(radius, width - radius);
          y = height + radius;
          vx = randomBetween(-0.8, 0.8);
          vy = -speed;
          break;
      }
    } else {
      x = randomBetween(radius + 16, width - radius - 16);
      y = randomBetween(radius + 16, height - radius - 16);
      vx = randomBetween(-1.2, 1.2);
      vy = randomBetween(-1.2, 1.2);
    }

    return {
      x,
      y,
      r: radius,
      vx,
      vy,
      color: driftColors[Math.floor(Math.random() * driftColors.length)],
      value: Math.min(Math.round(radius * 2.2), 2500)
    };
  }

  function ensureDangerFish() {
    const dangerExists = state.items.some((item) => item.r > state.player.r / 0.9);
    if (!dangerExists) {
      const dangerFish = spawnItem({ forceDanger: true });
      state.items.push(dangerFish);
      if (state.items.length > maxItems) {
        state.items.sort((a, b) => a.r - b.r);
        state.items.shift();
      }
    }
  }

  function updateStatus() {
    scoreEl.textContent = state.score;
    sizeEl.textContent = Math.round(state.player.r);
    formEl.textContent = state.transformed ? state.names.maja : state.names.bloop;
    if (state.won) {
      goalEl.textContent = `You won! ${state.names.maja} is complete.`;
    } else if (state.lost) {
      goalEl.textContent = `A too-big ${state.names.fish} ate you—try again.`;
    } else if (state.leviathan?.active) {
      goalEl.textContent = `The ${state.names.leviathan} is swimming across! Catch it for bonus points.`;
    } else {
      goalEl.textContent = state.transformed ? `You are ${state.names.maja}—keep growing!` : `Reach size ${growThreshold} to become ${state.names.maja}.`;
    }
    statusEl.textContent = state.message;

    if (state.won || state.lost) {
      resultTitle.textContent = state.won ? `${state.names.maja} Wins!` : 'Game Over';
      resultMessage.textContent = state.won
        ? `Your ${state.names.bloop} evolved into ${state.names.maja} and dominated the arena.`
        : `A giant ${state.names.fish} ate your ${state.names.bloop}. Grow bigger and avoid larger foes next time.`;
      winOverlay.classList.add('visible');
      winOverlay.setAttribute('aria-hidden', 'false');
    } else {
      winOverlay.classList.remove('visible');
      winOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  function scheduleLeviathan() {
    nextLeviathanLaunch = Date.now() + randomBetween(18, 34) * 1000;
  }

  function showBanner(text, duration = 2800) {
    eventBanner.textContent = text;
    eventBanner.classList.add('visible');
    if (bannerTimer) {
      clearTimeout(bannerTimer);
    }
    bannerTimer = setTimeout(() => {
      eventBanner.classList.remove('visible');
    }, duration);
  }

  function spawnLeviathan() {
    const direction = Math.random() < 0.5 ? 'right' : 'left';
    const x = direction === 'right' ? -100 : width + 100;
    const vx = direction === 'right' ? 2.8 : -2.8;
    state.leviathan = {
      active: true,
      x,
      y: randomBetween(80, height - 80),
      r: 50,
      vx,
      direction,
      bonus: 200
    };
  }

  function maybeTriggerLeviathan() {
    if (state.won || state.leviathan?.active || state.leviathanPending) {
      return;
    }
    if (Date.now() >= nextLeviathanLaunch) {
      state.leviathanPending = true;
      showBanner(`The ${state.names.leviathan} is coming!`, 3000);
      setTimeout(() => {
        spawnLeviathan();
        state.leviathanPending = false;
      }, 3000);
      scheduleLeviathan();
    }
  }

  function togglePlayButton() {
    if (playButton) {
      playButton.classList.toggle('hidden', gameStarted);
    }
  }

  function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    state.message = `Use arrow keys or WASD to move your ${state.names.bloop} and eat smaller items.`;
    togglePlayButton();
    updateStatus();
  }

  function resetGame() {
    gameStarted = false;
    state.player = { x: width / 2, y: height / 2, r: 16, color: '#78d7ff', speed: 3.6 };
    state.items = Array.from({ length: maxItems - 1 }, () => spawnItem());
    state.items.push(spawnItem({ forceDanger: true }));
    state.score = 0;
    state.transformed = false;
    state.won = false;
    state.lost = false;
    state.leviathanPending = false;
    state.leviathan = null;
    state.message = 'Stretch your tummy and eat glowing items to grow.';
    scheduleLeviathan();
    ensureDangerFish();
    togglePlayButton();
    updateStatus();
  }

  function eatItem(item) {
    if (state.won) return;

    const bonus = Math.round(item.r * 3);
    state.score += bonus;
    state.player.r += item.r * 0.35;
    state.player.r = Math.min(state.player.r, maxRadius);
    state.player.speed = Math.max(2.2, 4.2 - state.player.r * 0.024);
    state.items.splice(state.items.indexOf(item), 1);
    state.items.push(spawnItem());
    ensureDangerFish();
    state.message = ['Glorp!', 'Munch!', 'Yum!', 'Crunch!'][Math.floor(Math.random() * 4)] + ` Your ${state.names.bloop} grows.`;

    if (!state.transformed && state.player.r >= growThreshold) {
      state.transformed = true;
      state.player.color = '#8f6dff';
      state.message = `Transformation complete! You are now ${state.names.maja}!`;
    }

    if (state.transformed && state.player.r >= maxRadius) {
      state.player.r = maxRadius;
      state.won = true;
      state.message = `You won! ${state.names.maja} is fully grown.`;
    }

    updateStatus();
  }

  function updatePlayer() {
    let dx = 0;
    let dy = 0;

    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.hypot(dx, dy);
      dx = dx / magnitude * state.player.speed;
      dy = dy / magnitude * state.player.speed;
      state.player.x = Math.min(Math.max(state.player.r, state.player.x + dx), width - state.player.r);
      state.player.y = Math.min(Math.max(state.player.r, state.player.y + dy), height - state.player.r);
    }

    // Update item positions
    for (const item of state.items) {
      item.x += item.vx;
      item.y += item.vy;

      // Bounce off walls
      if (item.x - item.r <= 0 || item.x + item.r >= width) {
        item.vx *= -1;
        item.x = Math.max(item.r, Math.min(width - item.r, item.x));
      }
      if (item.y - item.r <= 0 || item.y + item.r >= height) {
        item.vy *= -1;
        item.y = Math.max(item.r, Math.min(height - item.r, item.y));
      }
    }

    maybeTriggerLeviathan();

    if (state.leviathan?.active) {
      state.leviathan.x += state.leviathan.vx;
      if (state.leviathan.x < -120 || state.leviathan.x > width + 120) {
        state.leviathan = null;
      } else if (distance(state.player.x, state.player.y, state.leviathan.x, state.leviathan.y) <= state.player.r + state.leviathan.r - 8) {
        state.score += state.leviathan.bonus;
        state.message = `${state.names.leviathan} defeated! +${state.leviathan.bonus} points.`;
        state.leviathan = null;
        updateStatus();
      }
    }

    if (state.won || state.lost) {
      return;
    }

    for (const item of [...state.items]) {
      if (distance(state.player.x, state.player.y, item.x, item.y) <= state.player.r + item.r - 2) {
        if (state.player.r > item.r * 0.9) {
          eatItem(item);
        } else {
          state.lost = true;
          state.message = `A huge ${state.names.fish} ate your ${state.names.bloop}. Game Over.`;
          state.player.speed = 0;
          updateStatus();
          return;
        }
      }
    }
  }

  function drawArena() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0e132f';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let y = 40; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 40; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  function drawItems() {
    for (const item of state.items) {
      if (images.fish) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(item.x, item.y);
        ctx.drawImage(images.fish, -item.r, -item.r, item.r * 2, item.r * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.stroke();
      }
      
      // Draw value text
      ctx.fillStyle = 'rgba(18,18,33,0.9)';
      ctx.font = '600 12px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(item.value, item.x, item.y + 4);
    }
  }

  function drawPlayer() {
    if (state.transformed && images.elgrmaha) {
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.drawImage(images.elgrmaha, -state.player.r, -state.player.r, state.player.r * 2, state.player.r * 2);
      ctx.restore();
    } else if (images.bloop) {
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.drawImage(images.bloop, -state.player.r, -state.player.r, state.player.r * 2, state.player.r * 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = state.player.color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
      ctx.fillStyle = state.player.color;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    if (!images.bloop && !state.transformed) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.max(12, Math.min(24, state.player.r * 0.45))}px Inter, system-ui`;
      ctx.fillText('B', state.player.x, state.player.y + state.player.r * 0.15);
    } else if (!images.elgrmaha && state.transformed) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.max(12, Math.min(24, state.player.r * 0.45))}px Inter, system-ui`;
      ctx.fillText('E', state.player.x, state.player.y + state.player.r * 0.15);
    }
  }

  function drawLeviathan() {
    if (!state.leviathan?.active) {
      return;
    }

    if (images.leviathan) {
      ctx.save();
      ctx.translate(state.leviathan.x, state.leviathan.y);
      ctx.drawImage(images.leviathan, -state.leviathan.r, -state.leviathan.r, state.leviathan.r * 2, state.leviathan.r * 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.translate(state.leviathan.x, state.leviathan.y);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 190, 60, 0.18)';
      ctx.strokeStyle = 'rgba(255, 190, 60, 0.72)';
      ctx.lineWidth = 5;
      ctx.ellipse(0, 0, state.leviathan.r * 1.1, state.leviathan.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.leviathan.direction === 'right' ? -state.leviathan.r * 0.9 : state.leviathan.r * 0.9, 0);
      ctx.lineTo(state.leviathan.direction === 'right' ? -state.leviathan.r * 1.6 : state.leviathan.r * 1.6, -state.leviathan.r * 0.5);
      ctx.lineTo(state.leviathan.direction === 'right' ? -state.leviathan.r * 1.6 : state.leviathan.r * 1.6, state.leviathan.r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '600 14px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`+${state.leviathan.bonus}`, state.leviathan.x, state.leviathan.y + 5);
  }

  function render() {
    drawArena();
    drawItems();
    drawLeviathan();
    drawPlayer();
  }

  function gameLoop() {
    if (gameStarted) {
      updatePlayer();
    }
    render();
    requestAnimationFrame(gameLoop);
  }

  function handleImageUpload(file, imageKey) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        images[imageKey] = img;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  bloopUpload.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'bloop');
  });

  fishUpload.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'fish');
  });

  elgramahaUpload.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'elgrmaha');
  });

  leviathanUpload.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'leviathan');
  });

  bloopNameInput?.addEventListener('input', (e) => {
    state.names.bloop = e.target.value || 'Bloop';
    updateStatus();
  });

  fishNameInput?.addEventListener('input', (e) => {
    state.names.fish = e.target.value || 'Fish';
    updateStatus();
  });

  majaNameInput?.addEventListener('input', (e) => {
    state.names.maja = e.target.value || 'El Gran Maja';
    updateStatus();
  });

  leviathanNameInput?.addEventListener('input', (e) => {
    state.names.leviathan = e.target.value || 'Leviathan';
    updateStatus();
  });

  window.addEventListener('keydown', (event) => {
    const isTextInput = document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text';
    const isFileInput = document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'file';
    
    const actionKeys = ['Enter', ' ', 'Spacebar'];
    if (actionKeys.includes(event.key) && !isTextInput && !isFileInput) {
      event.preventDefault();
      if (state.won || state.lost) {
        resetGame();
        return;
      }
      if (!gameStarted) {
        startGame();
        return;
      }
    }

    if (!isTextInput && !isFileInput) {
      keys[event.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
        event.preventDefault();
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    const isTextInput = document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text';
    if (!isTextInput) {
      keys[event.key] = false;
    }
  });

  playButton?.addEventListener('click', startGame);
  restartButton.addEventListener('click', resetGame);
  overlayRestart.addEventListener('click', resetGame);

  resetGame();
  requestAnimationFrame(gameLoop);
})();
