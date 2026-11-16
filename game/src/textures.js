import * as THREE from 'three';

function canvasTexture(size, draw, { srgb = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeSet(size, diffuse, bump, roughness) {
  return {
    map: canvasTexture(size, diffuse, { srgb: true }),
    bumpMap: canvasTexture(size, bump),
    roughnessMap: canvasTexture(size, roughness),
  };
}

function speckle(ctx, size, count, color, alpha, maxSize = 3) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const s = 1 + Math.random() * maxSize;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function noise(ctx, size, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = 100 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.globalAlpha = alpha;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function sandstoneSet() {
  const rows = 4;
  const blockH = 256 / rows;
  return makeSet(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#b39a6d';
      ctx.fillRect(0, 0, s, s);
      for (let r = 0; r < rows; r++) {
        const y = r * blockH;
        const offset = (r % 2) * (s / 4);
        for (let c = -1; c < 3; c++) {
          const x = offset + c * (s / 2);
          const shade = 168 + Math.floor(Math.random() * 26);
          ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.85)},${Math.floor(shade * 0.6)})`;
          ctx.fillRect(x + 3, y + 3, s / 2 - 6, blockH - 6);
        }
      }
      ctx.fillStyle = '#5d4c33';
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * s;
        const len = 20 + Math.random() * 60;
        ctx.globalAlpha = 0.08 + Math.random() * 0.12;
        ctx.fillRect(x, Math.random() * s * 0.5, 2 + Math.random() * 4, len);
      }
      ctx.globalAlpha = 1;
      speckle(ctx, s, 700, '#000000', 0.12);
    },
    (ctx, s) => {
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 4;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * blockH); ctx.lineTo(s, r * blockH); ctx.stroke();
      }
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (s / 4);
        for (let c = -1; c < 3; c++) {
          const x = offset + c * (s / 2);
          ctx.beginPath(); ctx.moveTo(x, r * blockH); ctx.lineTo(x, (r + 1) * blockH); ctx.stroke();
        }
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 1200, 0.25);
    },
  );
}

function concreteSet() {
  return makeSet(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#7d7f82';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#5c5e61';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = '#55575a';
        ctx.globalAlpha = 0.1 + Math.random() * 0.15;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 12 + Math.random() * 30, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      speckle(ctx, s, 1100, '#000000', 0.14);
      speckle(ctx, s, 400, '#ffffff', 0.05);
    },
    (ctx, s) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
      noise(ctx, s, 900, 0.2);
    },
    (ctx, s) => {
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 900, 0.2);
    },
  );
}

function containerSet(base, dark, light, rust) {
  return makeSet(
    256,
    (ctx, s) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      const ridge = s / 8;
      for (let i = 0; i < 8; i++) {
        const x = i * ridge;
        const grad = ctx.createLinearGradient(x, 0, x + ridge, 0);
        grad.addColorStop(0, dark);
        grad.addColorStop(0.35, base);
        grad.addColorStop(0.65, light);
        grad.addColorStop(1, dark);
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, ridge, s);
      }
      ctx.fillStyle = dark;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(i * ridge + ridge / 2, 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(i * ridge + ridge / 2, s - 10, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = rust;
      for (let i = 0; i < 14; i++) {
        ctx.globalAlpha = 0.1 + Math.random() * 0.2;
        ctx.fillRect(Math.random() * s, 0, 3 + Math.random() * 5, 30 + Math.random() * 90);
      }
      ctx.globalAlpha = 1;
      speckle(ctx, s, 500, '#000000', 0.12);
    },
    (ctx, s) => {
      const ridge = s / 8;
      for (let i = 0; i < 8; i++) {
        const x = i * ridge;
        const grad = ctx.createLinearGradient(x, 0, x + ridge, 0);
        grad.addColorStop(0, '#333333');
        grad.addColorStop(0.5, '#e8e8e8');
        grad.addColorStop(1, '#333333');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, ridge, s);
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 800, 0.2);
    },
  );
}

function hazardSet() {
  return makeSet(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#151515';
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, s, s); ctx.clip();
      const stripe = 36;
      for (let i = -s; i < s * 2; i += stripe * 2) {
        ctx.beginPath();
        ctx.moveTo(i, s);
        ctx.lineTo(i + stripe, s);
        ctx.lineTo(i + stripe + s, 0);
        ctx.lineTo(i + s, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      speckle(ctx, s, 300, '#000000', 0.15);
    },
    (ctx, s) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
    },
    (ctx, s) => {
      ctx.fillStyle = '#909090';
      ctx.fillRect(0, 0, s, s);
    },
  );
}

function crateSet() {
  return makeSet(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#6b5233';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) {
        const y = (i * s) / 4;
        const shade = 96 + Math.floor(Math.random() * 22);
        ctx.fillStyle = `rgb(${shade + 14},${shade},${Math.floor(shade * 0.62)})`;
        ctx.fillRect(0, y + 3, s, s / 4 - 6);
        ctx.strokeStyle = '#3d2f1a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
      ctx.strokeStyle = '#3d2f1a';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, s - 10, s - 10);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      ctx.globalAlpha = 0.85;
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DUSTYARD', s / 2, s / 2 - 8);
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('A-07', s / 2, s / 2 + 26);
      ctx.globalAlpha = 1;
      speckle(ctx, s, 400, '#000000', 0.18);
    },
    (ctx, s) => {
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 4;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, (i * s) / 4); ctx.lineTo(s, (i * s) / 4); ctx.stroke();
      }
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, s - 8, s - 8);
    },
    (ctx, s) => {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 900, 0.2);
    },
  );
}

function asphaltSet() {
  return makeSet(
    512,
    (ctx, s) => {
      ctx.fillStyle = '#33353a';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 5200, '#000000', 0.28, 4);
      speckle(ctx, s, 2600, '#9a9da2', 0.16, 4);
      speckle(ctx, s, 900, '#6a6d72', 0.2, 5);
      ctx.strokeStyle = '#1e1f22';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += (Math.random() - 0.5) * 40;
          y += Math.random() * 24;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#d8c95a';
      ctx.globalAlpha = 0.75;
      for (let y = 0; y < s; y += 64) ctx.fillRect(s / 2 - 4, y, 8, 34);
      ctx.fillStyle = '#cfcfc8';
      ctx.fillRect(14, 0, 5, s);
      ctx.fillRect(s - 19, 0, 5, s);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(s / 2, s * 0.72);
      ctx.lineTo(s / 2 - 26, s * 0.82);
      ctx.lineTo(s / 2 - 10, s * 0.82);
      ctx.lineTo(s / 2 - 10, s * 0.92);
      ctx.lineTo(s / 2 + 10, s * 0.92);
      ctx.lineTo(s / 2 + 10, s * 0.82);
      ctx.lineTo(s / 2 + 26, s * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    (ctx, s) => {
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 2600, 0.25);
    },
    (ctx, s) => {
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, 1600, 0.2);
    },
  );
}

export function createTextures() {
  return {
    sandstone: sandstoneSet(),
    concrete: concreteSet(),
    containerBlue: containerSet('#2e5a88', '#1c3a5c', '#4a7ab0', '#7a4a2a'),
    containerRust: containerSet('#8a3b2a', '#5c2418', '#b05a40', '#4a2a18'),
    containerOlive: containerSet('#5a6242', '#3a4028', '#7a8460', '#6a4a22'),
    hazard: hazardSet(),
    crate: crateSet(),
    asphalt: asphaltSet(),
  };
}

export function createStencilTexture(text, color = '#f2a33c') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 16, 66);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    const y = 20 + Math.random() * 88;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
