/**
 * Story lines arriving and leaving, the same way in every scene: they come up out of a little
 * haze (a soft blur clearing, a short rise) and go the way they came. The story's motif is haze
 * clearing; the words do it too.
 *
 *   const { lineIn, linesOut } = createReveal(tl, motion, { inDur: 0.025 });
 *   lineIn(caption.lines[0], 0.4);
 *   linesOut(caption.lines, 0.55);
 *
 * at: maps the positions you pass to timeline positions (Scene 2 passes render frames).
 * Reduced motion: opacity only — no blur, a much shorter rise.
 */
export function createReveal(tl, motion, { inDur = 0.025, outDur = 0.02, stagger = 0.005, at = (x) => x } = {}) {
  const P = motion.parallax;
  const blur = (px) => `blur(${motion.reduced ? 0 : px}px)`;
  return {
    lineIn: (node, pos, d = inDur) =>
      tl.fromTo(node,
        { autoAlpha: 0, y: 12 * P, filter: blur(5) },
        { autoAlpha: 1, y: 0, filter: blur(0), duration: d, ease: 'power2.out' }, at(pos)),
    linesOut: (nodes, pos) =>
      nodes.forEach((node, i) =>
        tl.to(node, { autoAlpha: 0, y: -10 * P, filter: blur(3), duration: outDur, ease: 'power1.in' }, at(pos) + i * stagger)),
  };
}
