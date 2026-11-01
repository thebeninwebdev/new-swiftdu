const colors = [
  [0.486, 0.227, 0.929, 1],
  [0.961, 0.62, 0.043, 1],
  [0.059, 0.467, 0.435, 1],
  [0.925, 0.282, 0.6, 1],
  [0.145, 0.388, 0.922, 1],
  [0.882, 0.114, 0.282, 1],
]

const layers = Array.from({ length: 30 }, (_, index) => {
  const x = 12 + (index * 47) % 376
  const startY = -30 + (index * 83) % 420
  const endX = x + ((index % 5) - 2) * 18
  const endY = startY + 440
  const width = 6 + (index % 3) * 2
  const height = 12 + (index % 4) * 3
  const rotation = (index * 31) % 180

  return {
    ty: 4,
    nm: 'Confetti ' + String(index + 1),
    ind: index + 1,
    ip: 0,
    op: 180,
    st: 0,
    bm: 0,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: [{ t: 0, s: [rotation], e: [rotation + 540 + (index % 4) * 180], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }, { t: 180, s: [rotation + 540 + (index % 4) * 180] }] },
      p: { a: 1, k: [{ t: 0, s: [x, startY, 0], e: [endX, endY, 0], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }, { t: 180, s: [endX, endY, 0] }] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [{ t: 0, s: [75, 100, 100], e: [115, 72, 100], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }, { t: 90, s: [115, 72, 100], e: [75, 100, 100], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }, { t: 180, s: [75, 100, 100] }] },
    },
    shapes: [{
      ty: 'gr',
      nm: 'Piece',
      np: 2,
      cix: 2,
      bm: 0,
      it: [
        { ty: 'rc', d: 1, nm: 'Rectangle', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [width, height] }, r: { a: 0, k: 1 } },
        { ty: 'fl', nm: 'Fill', c: { a: 0, k: colors[index % colors.length] }, o: { a: 0, k: 100 }, r: 1, bm: 0 },
        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
      ],
    }],
  }
})

export const confettiAnimation = {
  v: '5.12.2',
  fr: 60,
  ip: 0,
  op: 180,
  w: 400,
  h: 400,
  nm: 'SwiftDU winner confetti',
  ddd: 0,
  assets: [],
  layers,
}
