function mod12(n) {
  n = n % 12;
  if (n < 0) n += 12;
  return n;
}

function uniqSortedMod12(pcs) {
  const seen = new Set();
  for (const x of pcs) {
    seen.add(mod12(x));
  }
  return Array.from(seen).sort((a, b) => a - b);
}

// Build the rotation starting at index i as a strictly ascending sequence
// by adding 12 after wrap.
function rotationAscending(sorted, i) {
  const n = sorted.length;
  const out = [];
  const start = sorted[i];

  for (let k = 0; k < n; k++) {
    const j = (i + k) % n;
    let v = sorted[j];
    if (v < start) v += 12;
    out.push(v);
  }
  return out;
}

// For tie-breaking ("packed to the left") we compare the vector of distances
// from the first element, starting from the end (rightmost) moving left.
// Example: [a,b,c,d] -> distances [d-a, c-a, b-a]
function packVector(seqAsc) {
  const n = seqAsc.length;
  const base = seqAsc[0];
  const v = [];
  for (let k = n - 1; k >= 1; k--) {
    v.push(seqAsc[k] - base);
  }
  return v;
}

// Compare two candidates by (1) span, then (2) pack vector lexicographically.
function compareCandidates(aAsc, bAsc) {
  const spanA = aAsc[aAsc.length - 1] - aAsc[0];
  const spanB = bAsc[bAsc.length - 1] - bAsc[0];

  if (spanA !== spanB) {
    return spanA < spanB ? -1 : 1;
  }

  const pa = packVector(aAsc);
  const pb = packVector(bAsc);
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] < pb[i] ? -1 : 1;
    }
  }

  return 0;
}

// normalOrder(pcs):
// - pcs may include repeats and octave equivalents (we dedupe mod 12)
// - [] -> []
// - singleton -> [pc mod 12]
function normalOrder(pcs) {
  const sorted = uniqSortedMod12(Array.isArray(pcs) ? pcs : []);
  const n = sorted.length;

  if (n === 0) return [];
  if (n === 1) return [sorted[0]];

  let bestAsc = null;

  for (let i = 0; i < n; i++) {
    const candAsc = rotationAscending(sorted, i);

    if (bestAsc === null) {
      bestAsc = candAsc;
    }
    else {
      if (compareCandidates(candAsc, bestAsc) < 0) {
        bestAsc = candAsc;
      }
    }
  }

  // Convert back to pcs mod 12 in the chosen cyclic order
  return bestAsc.map(mod12);
}

// Transpose so first element becomes 0 (preserving order mod 12).
function transposeToZero(order) {
  if (order.length === 0) return [];
  const t = order[0];
  return order.map(x => mod12(x - t));
}

// Invert around 0: x -> -x mod 12
function invert(order) {
  return order.map(x => mod12(-x));
}

// primeForm(normal):
// - input must already be in normal order (unique pcs, cyclic order)
// - [] -> []
// - singleton -> [0]
function primeForm(normal, opts = {}) {
  // opts.includeInversion (default true)
  // false => Tn only (necklace)  -> 352 classes (incl trivials)
  // true  => Tn/TnI (bracelet)   -> 224 classes (incl trivials)

  const includeInversion = (opts.includeInversion !== false);
  const n = Array.isArray(normal) ? normal.slice() : [];

  if (n.length === 0) return [];
  if (n.length === 1) return [0];

  // A: transpose normal so it starts on 0
  const A = transposeToZero(n);

  if (!includeInversion) {
    // Tn only (necklace canonical representative)
    return A;
  }

  // B: invert, take normal order of inversion, then transpose to 0
  const inv     = invert(n);
  const invNorm = normalOrder(inv);
  const B       = transposeToZero(invNorm);

  // Compare A vs B by the same compactness criteria.
  function asAscendingFromFirst(order) {
    const out = [order[0]];
    for (let i = 1; i < order.length; i++) {
      let v = order[i];
      while (v < out[i - 1]) v += 12;
      out.push(v);
    }
    return out;
  }

  const aAsc = asAscendingFromFirst(A);
  const bAsc = asAscendingFromFirst(B);

  return (compareCandidates(aAsc, bAsc) <= 0) ? A : B;
}
// --- enumeration helpers ---

function pcsFromMask(mask) {
  const pcs = [];
  for (let i = 0; i < 12; i++) {
    if ((mask >>> i) & 1) {
      pcs.push(i);
    }
  }
  return pcs;
}

function popcount(mask) {
  // Brian Kernighan
  let c = 0;
  while (mask) {
    mask &= (mask - 1);
    c++;
  }
  return c;
}

function keyOf(arr) {
  return arr.join(",");
}

function countClasses(opts = {}) {

  const includeInversion = (opts.includeInversion !== false);
  const excludeTrivial   = (opts.excludeTrivial === true);

  const seen = new Map(); // key -> count of masks mapping here

  for (let mask = 0; mask < (1 << 12); mask++) {

    const card = popcount(mask);

    if (excludeTrivial) {
      if (card === 0 || card === 1 || card === 11 || card === 12) {
        continue;
      }
    }

    const pcs    = pcsFromMask(mask);
    const normal = normalOrder(pcs);
    const rep    = primeForm(normal, { includeInversion });

    const k = keyOf(rep);
    seen.set(k, (seen.get(k) || 0) + 1);
  }

  return seen;
}

(function main() {

  // Count equivalence classes across the full 2^12 pc-set space:
  const braceletAll = countClasses({ includeInversion: true,  excludeTrivial: false });
  const braceletNoT = countClasses({ includeInversion: true,  excludeTrivial: true  });
  const necklaceAll = countClasses({ includeInversion: false, excludeTrivial: false });
  const necklaceNoT = countClasses({ includeInversion: false, excludeTrivial: true  });

  console.log("bracelets  (Tn/TnI) incl trivials:", braceletAll.size); // expect 224
  console.log("bracelets  (Tn/TnI) excl trivials:", braceletNoT.size); // expect 220
  console.log("necklaces  (Tn)     incl trivials:", necklaceAll.size); // expect 352
  console.log("necklaces  (Tn)     excl trivials:", necklaceNoT.size); // expect 348

})();
