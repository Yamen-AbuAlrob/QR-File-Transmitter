// Small deterministic PRNG (mulberry32): same seed gives the same sequence
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Robust soliton distribution: how many blocks to combine in one packet
function buildDegreeTable(k) {
  const c = 0.1;
  const delta = 0.5;
  const s = Math.max(1, c * Math.log(k / delta) * Math.sqrt(k));
  const pivot = Math.max(1, Math.min(k, Math.round(k / s)));

  const weights = [];
  for (let d = 1; d <= k; d++) {
    // ideal soliton
    let w = d === 1 ? 1 / k : 1 / (d * (d - 1));
    // robust extra part
    if (d < pivot) w += s / (k * d);
    else if (d === pivot) w += (s * Math.log(s / delta)) / k;
    weights.push(w);
  }

  const total = weights.reduce((x, y) => x + y, 0);
  let acc = 0;
  return weights.map(w => (acc += w / total)); // cumulative probabilities
}

function pickDegree(rng, table) {
  const r = rng();
  for (let i = 0; i < table.length; i++) {
    if (r <= table[i]) return i + 1;
  }
  return table.length;
}

// Which original blocks are combined in the packet with this seed
function blockIndicesFor(seed, k, table) {
  const rng = makeRng(seed);
  const degree = Math.min(pickDegree(rng, table), k);
  const picked = new Set();
  while (picked.size < degree) {
    picked.add(Math.floor(rng() * k));
  }
  return Array.from(picked);
}

function xorInto(target, source) {
  for (let i = 0; i < target.length; i++) {
    target[i] ^= source[i];
  }
}

// Sender side: build the encoded block for a seed
function encodeBlock(blocks, seed, table) {
  const indices = blockIndicesFor(seed, blocks.length, table);
  const out = new Uint8Array(blocks[0].length);
  for (const idx of indices) {
    xorInto(out, blocks[idx]);
  }
  return out;
}

// Receiver side: collects packets and solves them step by step
class FountainDecoder {
  constructor(k, blockSize) {
    this.k = k;
    this.blockSize = blockSize;
    this.table = buildDegreeTable(k);
    this.solved = new Array(k).fill(null); // original blocks found so far
    this.solvedCount = 0;
    this.pending = [];                     // { indices: Set, data: Uint8Array }
    this.seen = new Set();                 // seeds already processed
  }

  addPacket(seed, data) {
    if (this.seen.has(seed)) return;
    this.seen.add(seed);

    const indices = new Set(blockIndicesFor(seed, this.k, this.table));
    const copy = new Uint8Array(data); // work on a copy

    // remove blocks we already know
    for (const idx of Array.from(indices)) {
      if (this.solved[idx]) {
        xorInto(copy, this.solved[idx]);
        indices.delete(idx);
      }
    }

    if (indices.size > 0) {
      this.pending.push({ indices, data: copy });
    }
    this.peel();
  }

  // Repeat: find packets with exactly one unknown block, solve it, simplify the rest
  peel() {
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < this.pending.length; i++) {
        const p = this.pending[i];
        if (p.indices.size !== 1) continue;

        const idx = p.indices.values().next().value;
        if (!this.solved[idx]) {
          this.solved[idx] = p.data;
          this.solvedCount++;
        }
        this.pending.splice(i, 1);

        // simplify every other pending packet
        for (const other of this.pending) {
          if (other.indices.has(idx)) {
            xorInto(other.data, this.solved[idx]);
            other.indices.delete(idx);
          }
        }
        progress = true;
        break; // restart the scan, the list changed
      }
      // drop packets that became empty
      this.pending = this.pending.filter(p => p.indices.size > 0);
    }
  }

  isComplete() {
    return this.solvedCount === this.k;
  }
}