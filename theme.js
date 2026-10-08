function waitForElement(els, func, timeout = 100) {
  const queries = els.map((el) => document.querySelector(el));
  if (queries.every((a) => a)) {
    func(queries);
  } else if (timeout > 0) {
    setTimeout(waitForElement, 50, els, func, --timeout);
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

waitForElement(['.Root__top-container'], ([topContainer]) => {
  const r = document.documentElement;
  const rs = window.getComputedStyle(r);

  // 1. Single Ultra-High-Performance Hardware-Accelerated Canvas Starfield
  // (Replaces 120 separate animating DOM nodes with 1 flat GPU canvas texture)
  let canvas = document.querySelector('.starrynight-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'starrynight-canvas';
    topContainer.appendChild(canvas);
  }

  // Remove any legacy DOM star containers if present
  const oldBg = document.querySelector('.starrynight-bg-container');
  if (oldBg) oldBg.remove();

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    }, 100);
  });

  const starColor = rs.getPropertyValue('--spice-star') || '#ffffff';
  let stars = [];

  function initStars() {
    stars = [];
    const count = Math.min(Math.floor((width * height) / 16000), 95);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.65 ? 1 : 2,
        baseAlpha: random(0.25, 0.85),
        twinkleSpeed: random(0.02, 0.05),
        twinkleOffset: Math.random() * Math.PI * 2,
        hasGlow: Math.random() < 0.2,
      });
    }
  }
  initStars();

  // 2. Pure Canvas Shooting Stars (Delroy Prithvi effect - 0 DOM reflows)
  const shootingStars = [
    { x: 0, y: 0, length: 220, speed: 20, active: false, timer: 40 },
    { x: 0, y: 0, length: 260, speed: 24, active: false, timer: 160 },
    { x: 0, y: 0, length: 190, speed: 17, active: false, timer: 280 },
  ];

  function resetShootingStar(s) {
    s.x = random(width * 0.25, width * 1.05);
    s.y = random(-40, height * 0.35);
    s.active = true;
    s.timer = Math.floor(random(160, 360));
  }

  let animFrameId = null;

  function render(time) {
    // If Spotify is minimized or hidden, sleep the animation loop (0% CPU usage)
    if (document.hidden) {
      animFrameId = requestAnimationFrame(render);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    // Render twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const a = s.baseAlpha + Math.sin(time * 0.002 * s.twinkleSpeed * 50 + s.twinkleOffset) * 0.35;
      const alpha = Math.max(0.1, Math.min(1, a));

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);

      if (s.hasGlow && alpha > 0.6) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(alpha - 0.5) * 0.35})`;
        ctx.fillRect(s.x - 1, s.y - 1, s.size + 2, s.size + 2);
      }
    }

    // Render shooting stars
    for (let i = 0; i < shootingStars.length; i++) {
      const ss = shootingStars[i];
      if (!ss.active) {
        ss.timer--;
        if (ss.timer <= 0) {
          resetShootingStar(ss);
        }
        continue;
      }

      ss.x -= ss.speed;
      ss.y += ss.speed * 0.7;

      const tailX = ss.x + ss.length;
      const tailY = ss.y - ss.length * 0.7;

      const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      if (ss.x < -ss.length || ss.y > height + ss.length) {
        ss.active = false;
      }
    }

    animFrameId = requestAnimationFrame(render);
  }

  animFrameId = requestAnimationFrame(render);

  // 3. Resize and collapse observer: when right sidebar collapses, collapse top playbar too!
  const setupResizeObserver = () => {
    const container = document.querySelector('.Root__top-container');
    if (!container) return;
    const rightSidebarSlot = document.querySelector(
      '.Root__right-sidebar, aside#Desktop_PanelContainer_Id, [data-testid="right-sidebar"]'
    );

    if (rightSidebarSlot) {
      let rafPending = false;
      let lastWidth = -1;

      const updateWidth = (w) => {
        if (w === lastWidth || Math.abs(w - lastWidth) < 2) return;
        lastWidth = w;

        if (w < 200) {
          document.body.classList.add('starrynight-sidebar-collapsed');
          container.style.removeProperty('--starrynight-panel-width');
        } else {
          document.body.classList.remove('starrynight-sidebar-collapsed');
          container.style.setProperty('--starrynight-panel-width', `${w}px`);
        }
      };

      const ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            updateWidth(w);
          });
        }
      });
      ro.observe(rightSidebarSlot);
    } else {
      setTimeout(setupResizeObserver, 500);
    }
  };
  setupResizeObserver();

  // 4. Handle play/pause state for spinning cover art
  const setupPlayStateObserver = () => {
    if (window.Spicetify && Spicetify.Player) {
      const updatePlaying = () => {
        const isPlaying = Spicetify.Player.isPlaying();
        if (isPlaying) {
          document.body.classList.add('starrynight-is-playing');
        } else {
          document.body.classList.remove('starrynight-is-playing');
        }
      };
      Spicetify.Player.addEventListener('onplaypause', updatePlaying);
      Spicetify.Player.addEventListener('songchange', () => setTimeout(updatePlaying, 100));
      updatePlaying();
    } else {
      setTimeout(setupPlayStateObserver, 300);
    }
  };
  setupPlayStateObserver();
});
