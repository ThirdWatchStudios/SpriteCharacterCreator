import type { PropTemplate, ShapeSpec } from '../core/types';
import { rr, circle, ellipse } from '../core/geometry';

/**
 * Parametric prop templates. Conventions:
 * - Canvas coords (128 design units), props rest on the ground line y = 116.
 * - Fills use '$primary' / '$secondary' / '$accent' tokens from the prop's palette.
 * - The global outline pass applies automatically, same as characters.
 */

const GROUND = 116;
const CX = 64;
const SIZE = 128;

const waterCooler: PropTemplate = {
  id: 'water-cooler',
  label: 'Water cooler',
  projection: 'elevation',
  params: [{ key: 'height', label: 'Body height', min: 44, max: 68, step: 2, default: 56 }],
  build(params) {
    const bodyH = params.height;
    const bodyTop = GROUND - bodyH;
    const shapes: ShapeSpec[] = [
      // bottle
      { d: rr(CX - 16, bodyTop - 34, 32, 30, 9), fill: '$primary' },
      { d: rr(CX - 6, bodyTop - 7, 12, 8, 2), fill: '$primary' },
      // cabinet
      { d: rr(CX - 20, bodyTop, 40, bodyH, 5), fill: '$secondary' },
      // taps
      { d: rr(CX - 13, bodyTop + 12, 7, 9, 2), fill: '$accent', silhouette: false },
      { d: rr(CX + 6, bodyTop + 12, 7, 9, 2), fill: '#D85A30', silhouette: false },
      // drip tray
      { d: rr(CX - 11, bodyTop + 26, 22, 4, 2), fill: '#00000026', silhouette: false },
      // bottle waterline glint
      { d: rr(CX - 9, bodyTop - 27, 5, 14, 2.5), fill: '#FFFFFF40', silhouette: false },
    ];
    return shapes;
  },
};

const printer: PropTemplate = {
  id: 'printer',
  label: 'Printer',
  projection: 'elevation',
  params: [{ key: 'width', label: 'Width', min: 44, max: 72, step: 2, default: 56 }],
  build(params) {
    const w = params.width;
    const x = CX - w / 2;
    const bodyTop = GROUND - 34;
    return [
      // paper sticking out of the feed
      { d: rr(CX - w * 0.27, bodyTop - 12, w * 0.54, 14, 1), fill: '#F7F4EC' },
      // body
      { d: rr(x, bodyTop, w, 34, 5), fill: '$secondary' },
      // output slot
      { d: rr(x + 6, bodyTop + 9, w - 12, 4, 2), fill: '#00000040', silhouette: false },
      // control button
      { d: circle(x + w - 10, bodyTop + 24, 3), fill: '$accent', silhouette: false },
      // jam-prone paper tray
      { d: rr(x + 5, GROUND - 7, w - 24, 5, 2), fill: '$primary', silhouette: false },
    ];
  },
};

const desk: PropTemplate = {
  id: 'desk',
  label: 'Desk',
  projection: 'plan',
  params: [
    { key: 'width', label: 'Width', min: 72, max: 120, step: 4, default: 100 },
    { key: 'monitor', label: 'Monitor', min: 0, max: 1, step: 1, default: 1 },
  ],
  build(params) {
    const w = params.width ?? 100;
    const x = CX - w / 2;
    const top = 34;
    const depth = 60;
    const shapes: ShapeSpec[] = [
      // desktop seen from above
      { d: rr(x, top, w, depth, 6), fill: '$primary' },
      // soft grain band
      { d: `M ${x + 10} ${top + depth / 2} L ${x + w - 10} ${top + depth / 2}`, stroke: '#00000010', strokeWidth: 10, silhouette: false },
    ];
    if ((params.monitor ?? 1) >= 1) {
      shapes.push(
        // monitor from above: slim bar near the far edge + stand foot
        { d: rr(CX - 22, top + 8, 44, 9, 2), fill: '#2C2C2A', silhouette: false },
        { d: rr(CX - 4, top + 17, 8, 4, 1.5), fill: '#2C2C2A', silhouette: false },
        // keyboard + mouse
        { d: rr(CX - 18, top + 28, 36, 13, 2), fill: '$secondary', silhouette: false },
        { d: ellipse(CX + 26, top + 34, 3.5, 5), fill: '$secondary', silhouette: false },
      );
    }
    // coffee mug, seen from above
    shapes.push(
      { d: circle(x + w - 13, top + 14, 5), fill: '$accent', silhouette: false },
      { d: circle(x + w - 13, top + 14, 2), fill: '#6E4A2A', silhouette: false },
    );
    return shapes;
  },
};

const coffeeMachine: PropTemplate = {
  id: 'coffee-machine',
  label: 'Coffee machine',
  projection: 'elevation',
  params: [{ key: 'height', label: 'Height', min: 40, max: 56, step: 2, default: 48 }],
  build(params) {
    const h = params.height;
    const top = GROUND - h;
    return [
      // back column
      { d: rr(CX - 17, top, 34, h, 4), fill: '$primary' },
      // brew head overhang
      { d: rr(CX - 21, top, 42, 12, 4), fill: '$primary' },
      // carafe
      { d: rr(CX - 11, GROUND - 20, 22, 17, 5), fill: '#B5D4F4', opacity: 0.92 },
      { d: rr(CX - 11, GROUND - 20, 22, 5, 2), fill: '$secondary', silhouette: false },
      // coffee level
      { d: rr(CX - 9, GROUND - 11, 18, 6, 2), fill: '#6E4A2A', silhouette: false },
      // status lights
      { d: circle(CX - 11, top + 6, 2.2), fill: '$accent', silhouette: false },
      { d: circle(CX - 4, top + 6, 2.2), fill: '#97C459', silhouette: false },
    ];
  },
};

const officePlant: PropTemplate = {
  id: 'office-plant',
  label: 'Office plant',
  projection: 'elevation',
  params: [{ key: 'bushiness', label: 'Bushiness', min: 1, max: 3, step: 1, default: 2 }],
  build(params) {
    const shapes: ShapeSpec[] = [
      { d: `M 50 ${GROUND} L 54 ${GROUND - 20} L 74 ${GROUND - 20} L 78 ${GROUND} Z`, fill: '$accent' },
      { d: rr(51, GROUND - 25, 26, 7, 2), fill: '$accent' },
    ];
    const leaves: Array<[number, number, number]> = [
      [55, 74, 11],
      [73, 74, 11],
      [64, 62, 13],
    ];
    if (params.bushiness >= 2) leaves.push([48, 66, 9], [80, 66, 9]);
    if (params.bushiness >= 3) leaves.push([56, 52, 9], [72, 52, 9], [64, 46, 8]);
    for (const [cx, cy, r] of leaves) shapes.push({ d: circle(cx, cy, r), fill: '$primary' });
    // a couple of darker leaves for depth
    shapes.push(
      { d: circle(60, 72, 7), fill: '$secondary', silhouette: false },
      { d: circle(70, 64, 6), fill: '$secondary', silhouette: false },
    );
    return shapes;
  },
};

const fridge: PropTemplate = {
  id: 'fridge',
  label: 'Break room fridge',
  projection: 'elevation',
  params: [{ key: 'height', label: 'Height', min: 66, max: 90, step: 2, default: 78 }],
  build(params) {
    const h = params.height;
    const top = GROUND - h;
    const freezerY = top + h * 0.32;
    return [
      // body
      { d: rr(CX - 19, top, 38, h, 6), fill: '$primary' },
      // freezer divider
      { d: `M ${CX - 19} ${freezerY} L ${CX + 19} ${freezerY}`, stroke: '#00000033', strokeWidth: 2, silhouette: false },
      // handles
      { d: rr(CX + 10, top + 8, 4, freezerY - top - 14, 2), fill: '$accent', silhouette: false },
      { d: rr(CX + 10, freezerY + 6, 4, 22, 2), fill: '$accent', silhouette: false },
      // passive-aggressive note + magnets
      { d: rr(CX - 13, freezerY + 8, 12, 14, 1), fill: '#F7F4EC', silhouette: false },
      { d: circle(CX - 7, freezerY + 8, 2), fill: '$secondary', silhouette: false },
      { d: circle(CX - 12, top + 10, 2), fill: '$secondary', silhouette: false },
    ];
  },
};

const conferenceTable: PropTemplate = {
  id: 'conference-table',
  label: 'Conference table',
  projection: 'plan',
  params: [
    { key: 'width', label: 'Width', min: 84, max: 120, step: 4, default: 110 },
    { key: 'chairs', label: 'Chairs', min: 0, max: 8, step: 1, default: 6 },
  ],
  build(params) {
    const w = params.width ?? 110;
    const x = CX - w / 2;
    const top = 42;
    const depth = 44;
    const shapes: ShapeSpec[] = [];
    // chairs tucked around the table, drawn first so the tabletop overlaps them
    const chairs = params.chairs ?? 6;
    const nTop = Math.ceil(chairs / 2);
    const nBottom = chairs - nTop;
    const chair = (cx: number, cy: number, away: 1 | -1) => {
      shapes.push(
        { d: circle(cx, cy, 9), fill: '$accent' },
        {
          d: `M ${cx - 9.5} ${cy + 3 * away} A 11 11 0 0 ${away > 0 ? 0 : 1} ${cx + 9.5} ${cy + 3 * away}`,
          stroke: '$accent',
          strokeWidth: 4,
        },
      );
    };
    for (let i = 0; i < nTop; i++) chair(x + ((i + 1) * w) / (nTop + 1), top - 6, -1);
    for (let i = 0; i < nBottom; i++) chair(x + ((i + 1) * w) / (nBottom + 1), top + depth + 6, 1);
    shapes.push(
      { d: rr(x, top, w, depth, 12), fill: '$primary' },
      // tabletop inset
      { d: rr(x + 8, top + 8, w - 16, depth - 16, 8), fill: '#00000010', silhouette: false },
    );
    return shapes;
  },
};

const receptionDesk: PropTemplate = {
  id: 'reception-desk',
  label: 'Reception desk',
  projection: 'plan',
  params: [{ key: 'width', label: 'Width', min: 72, max: 104, step: 4, default: 88 }],
  build(params) {
    const w = params.width ?? 88;
    const x = CX - w / 2;
    const top = 40;
    return [
      // L-shaped counter: front run + side return the receptionist sits behind
      { d: rr(x, top, w, 24, 6), fill: '$primary' },
      { d: rr(x, top, 24, 64, 6), fill: '$primary' },
      // counter surface inset
      { d: rr(x + 4, top + 4, w - 8, 16, 4), fill: '#00000010', silhouette: false },
      // receptionist monitor on the return, seen from above
      { d: rr(x + 6, top + 34, 12, 22, 2), fill: '#2C2C2A', silhouette: false },
      // service bell on the front counter
      { d: circle(x + w - 16, top + 12, 4.5), fill: '$accent', silhouette: false },
      { d: circle(x + w - 16, top + 12, 1.6), fill: '#00000033', silhouette: false },
    ];
  },
};

const badgeReader: PropTemplate = {
  id: 'badge-reader',
  label: 'Badge reader',
  projection: 'plan',
  placement: 'wall-slot',
  params: [{ key: 'granted', label: 'Access granted', min: 0, max: 1, step: 1, default: 1 }],
  build(params) {
    const light = params.granted >= 1 ? '#97C459' : '#E24B4A';
    return [
      // small panel inset on a wall slot, not a front-facing object
      { d: rr(CX - 10, 53, 20, 22, 3), fill: '$primary' },
      { d: rr(CX - 7, 57, 14, 14, 2), fill: '$secondary', silhouette: false },
      // status light
      { d: circle(CX, 60, 2.4), fill: light, silhouette: false },
      // keypad
      { d: circle(CX - 4, 65, 1.3), fill: '#00000055', silhouette: false },
      { d: circle(CX + 4, 65, 1.3), fill: '#00000055', silhouette: false },
      { d: circle(CX - 4, 69, 1.3), fill: '#00000055', silhouette: false },
      { d: circle(CX + 4, 69, 1.3), fill: '#00000055', silhouette: false },
      // swipe slot
      { d: `M ${CX - 5} 72 L ${CX + 5} 72`, stroke: '#00000055', strokeWidth: 2, silhouette: false },
    ];
  },
};

const door: PropTemplate = {
  id: 'door',
  label: 'Door',
  projection: 'plan',
  placement: 'wall-slot',
  params: [
    { key: 'thickness', label: 'Thickness', min: 24, max: 36, step: 2, default: 30 },
    { key: 'open', label: 'Open', min: 0, max: 1, step: 1, default: 0 },
  ],
  /**
   * Top-down door filling a doorway gap. The art is authored for a HORIZONTAL
   * wall (band across the tile); the layout rotates it 90° for vertical runs.
   * It spans the full tile width and sits in the wall band (y centered on 64),
   * with gray frame caps ($secondary) at the ends that overlap the neighbor
   * wall arms — so the door reads as a segment OF the wall, not an object
   * dropped on the floor. Closed = a wood slab ($primary) filling the gap with
   * a centre seam + handles; open = the gap is clear (floor shows through the
   * threshold split) with the leaf swung perpendicular into the room.
   */
  build(params) {
    const t = params.thickness ?? 30;
    const y0 = CX - t / 2;
    const isOpen = (params.open ?? 0) >= 1;
    const OV = 3; // overlap neighbor wall arms so the frame joins the wall run
    const jamb = 13; // length of the gray frame cap at each end
    const seam = '#00000026';
    const shapes: ShapeSpec[] = [
      // gray frame caps that tie the doorway into the wall run on both ends
      { d: rr(-OV, y0, jamb + OV, t, 2), fill: '$secondary' },
      { d: rr(SIZE - jamb, y0, jamb + OV, t, 2), fill: '$secondary' },
    ];
    if (isOpen) {
      // leaf swung 90° flush to the left jamb, opening into the lower room
      shapes.push(
        { d: rr(jamb - 2, y0 + t - 3, 7, 40, 2), fill: '$primary' },
        { d: circle(jamb + 1.5, y0 + t + 33, 2.2), fill: '$accent', silhouette: false },
        // faint swing arc hinting the travel of the leaf
        { d: `M ${jamb + 5} ${y0 + t} A 40 40 0 0 1 ${jamb + 42} ${y0 + t + 2}`, stroke: '#00000018', strokeWidth: 2, silhouette: false },
      );
    } else {
      // closed leaf spanning the opening between the two frame caps
      const x = jamb - 1;
      const w = SIZE - 2 * (jamb - 1);
      shapes.push(
        { d: rr(x, y0 + 1, w, t - 2, 2), fill: '$primary' },
        // centre meeting seam + two leaf panels
        { d: `M ${CX} ${y0 + 3} L ${CX} ${y0 + t - 3}`, stroke: seam, strokeWidth: 2, silhouette: false },
        { d: `M ${x + w * 0.33} ${y0 + 4} L ${x + w * 0.33} ${y0 + t - 4}`, stroke: '#00000014', strokeWidth: 1.5, silhouette: false },
        { d: `M ${x + w * 0.67} ${y0 + 4} L ${x + w * 0.67} ${y0 + t - 4}`, stroke: '#00000014', strokeWidth: 1.5, silhouette: false },
        // paired handles at the centre seam
        { d: circle(CX - 6, CX, 2.2), fill: '$accent', silhouette: false },
        { d: circle(CX + 6, CX, 2.2), fill: '$accent', silhouette: false },
      );
    }
    return shapes;
  },
};

const window: PropTemplate = {
  id: 'window',
  label: 'Window',
  projection: 'plan',
  placement: 'wall-slot',
  params: [
    { key: 'width', label: 'Width', min: 48, max: 88, step: 4, default: 72 },
    { key: 'blinds', label: 'Blinds', min: 0, max: 3, step: 1, default: 1 },
  ],
  build(params) {
    const w = params.width ?? 72;
    const x = CX - w / 2;
    const y = 52;
    const h = 24;
    const shapes: ShapeSpec[] = [
      { d: rr(x - 5, y - 4, w + 10, h + 8, 3), fill: '$primary' },
      { d: rr(x, y, w, h, 2), fill: '$secondary', opacity: 0.86 },
      { d: `M ${CX} ${y + 3} L ${CX} ${y + h - 3} M ${x + 4} ${y + h / 2} L ${x + w - 4} ${y + h / 2}`, stroke: '$primary', strokeWidth: 2.5, silhouette: false },
      { d: `M ${x + 8} ${y + 6} L ${x + 20} ${y + 6}`, stroke: '#FFFFFF80', strokeWidth: 2, silhouette: false },
    ];
    const blinds = params.blinds ?? 1;
    for (let i = 0; i < blinds; i++) {
      const by = y + 7 + i * 5;
      shapes.push({ d: `M ${x + 7} ${by} L ${x + w - 7} ${by}`, stroke: '$accent', strokeWidth: 1.5, opacity: 0.55, silhouette: false });
    }
    return shapes;
  },
};

const nameplate: PropTemplate = {
  id: 'nameplate',
  label: 'Nameplate',
  projection: 'plan',
  placement: 'wall-slot',
  params: [
    { key: 'width', label: 'Width', min: 34, max: 64, step: 2, default: 48 },
    { key: 'lines', label: 'Label lines', min: 1, max: 3, step: 1, default: 2 },
  ],
  build(params) {
    const w = params.width ?? 48;
    const x = CX - w / 2;
    const y = 55;
    const shapes: ShapeSpec[] = [
      { d: rr(x - 3, y - 3, w + 6, 18, 3), fill: '$primary' },
      { d: rr(x + 4, y + 4, w - 8, 3, 1), fill: '$secondary', silhouette: false },
    ];
    const lines = params.lines ?? 2;
    for (let i = 0; i < lines; i++) {
      shapes.push({ d: rr(x + 9, y + 9 + i * 4, w - 18 - i * 8, 2, 1), fill: '$accent', silhouette: false });
    }
    return shapes;
  },
};

const hvacVent: PropTemplate = {
  id: 'hvac-vent',
  label: 'HVAC vent',
  projection: 'plan',
  placement: 'wall-slot',
  params: [
    { key: 'width', label: 'Width', min: 36, max: 66, step: 2, default: 52 },
    { key: 'slats', label: 'Slats', min: 3, max: 7, step: 1, default: 5 },
  ],
  build(params) {
    const w = params.width ?? 52;
    const x = CX - w / 2;
    const y = 55;
    const shapes: ShapeSpec[] = [
      { d: rr(x, y, w, 18, 3), fill: '$primary' },
      { d: rr(x + 4, y + 4, w - 8, 10, 2), fill: '$secondary', silhouette: false },
    ];
    const slats = params.slats ?? 5;
    for (let i = 0; i < slats; i++) {
      const sx = x + 9 + (i * (w - 18)) / Math.max(1, slats - 1);
      shapes.push({ d: `M ${sx} ${y + 6} L ${sx - 2} ${y + 13}`, stroke: '$accent', strokeWidth: 1.7, silhouette: false });
    }
    return shapes;
  },
};

const deskClutter: PropTemplate = {
  id: 'desk-clutter',
  label: 'Desk clutter',
  projection: 'plan',
  params: [
    { key: 'papers', label: 'Paper piles', min: 1, max: 4, step: 1, default: 3 },
    { key: 'phone', label: 'Phone', min: 0, max: 1, step: 1, default: 1 },
  ],
  build(params) {
    const shapes: ShapeSpec[] = [];
    const piles = params.papers ?? 3;
    const paperCells: Array<[number, number, number]> = [
      [42, 42, -7],
      [59, 55, 4],
      [77, 44, -3],
      [50, 72, 6],
    ];
    for (let i = 0; i < piles; i++) {
      const [x, y, rot] = paperCells[i];
      shapes.push(
        { d: `M ${x - 9} ${y - 7} L ${x + 10} ${y - 7 + rot * 0.04} L ${x + 8} ${y + 8} L ${x - 10} ${y + 7 - rot * 0.04} Z`, fill: '#F7F4EC' },
        { d: `M ${x - 5} ${y - 1} L ${x + 5} ${y - 1} M ${x - 4} ${y + 4} L ${x + 4} ${y + 4}`, stroke: '$secondary', strokeWidth: 1.5, silhouette: false },
      );
    }
    if ((params.phone ?? 1) >= 1) {
      shapes.push(
        { d: rr(80, 66, 25, 13, 4), fill: '$primary' },
        { d: rr(84, 69, 12, 4, 2), fill: '$accent', silhouette: false },
        { d: circle(101, 72, 2), fill: '$secondary', silhouette: false },
      );
    }
    shapes.push({ d: circle(36, 72, 4.5), fill: '$accent', silhouette: false });
    return shapes;
  },
};

const couch: PropTemplate = {
  id: 'couch',
  label: 'Couch',
  projection: 'plan',
  params: [
    { key: 'width', label: 'Width', min: 62, max: 98, step: 4, default: 82 },
    { key: 'cushions', label: 'Cushions', min: 2, max: 3, step: 1, default: 3 },
  ],
  build(params) {
    const w = params.width ?? 82;
    const x = CX - w / 2;
    const top = 42;
    const cushions = params.cushions ?? 3;
    const shapes: ShapeSpec[] = [
      { d: rr(x - 8, top - 6, w + 16, 52, 10), fill: '$secondary' },
      { d: rr(x, top, w, 42, 8), fill: '$primary' },
      { d: rr(x - 12, top + 4, 14, 34, 6), fill: '$secondary' },
      { d: rr(x + w - 2, top + 4, 14, 34, 6), fill: '$secondary' },
      { d: rr(x + 5, top + 31, w - 10, 7, 3), fill: '#00000016', silhouette: false },
    ];
    for (let i = 1; i < cushions; i++) {
      const sx = x + (w * i) / cushions;
      shapes.push({ d: `M ${sx} ${top + 7} L ${sx} ${top + 36}`, stroke: '$secondary', strokeWidth: 2, opacity: 0.65, silhouette: false });
    }
    return shapes;
  },
};

const rug: PropTemplate = {
  id: 'rug',
  label: 'Rug',
  projection: 'plan',
  params: [
    { key: 'width', label: 'Width', min: 72, max: 112, step: 4, default: 96 },
    { key: 'pattern', label: 'Pattern', min: 0, max: 2, step: 1, default: 1 },
  ],
  build(params) {
    const w = params.width ?? 96;
    const x = CX - w / 2;
    const y = 42;
    const h = 48;
    const shapes: ShapeSpec[] = [
      { d: rr(x, y, w, h, 12), fill: '$primary' },
      { d: rr(x + 8, y + 8, w - 16, h - 16, 8), fill: '$secondary', silhouette: false },
    ];
    const pattern = params.pattern ?? 1;
    if (pattern >= 1) shapes.push({ d: rr(x + 20, y + 18, w - 40, h - 36, 6), fill: '$accent', opacity: 0.55, silhouette: false });
    if (pattern >= 2) {
      shapes.push(
        { d: `M ${x + 12} ${y + 12} L ${x + w - 12} ${y + h - 12}`, stroke: '#FFFFFF42', strokeWidth: 4, silhouette: false },
        { d: `M ${x + w - 12} ${y + 12} L ${x + 12} ${y + h - 12}`, stroke: '#FFFFFF42', strokeWidth: 4, silhouette: false },
      );
    }
    return shapes;
  },
};

const vendingMachine: PropTemplate = {
  id: 'vending-machine',
  label: 'Vending machine',
  projection: 'elevation',
  params: [
    { key: 'height', label: 'Height', min: 70, max: 94, step: 2, default: 84 },
    { key: 'stocked', label: 'Stocked rows', min: 1, max: 3, step: 1, default: 3 },
  ],
  build(params) {
    const h = params.height ?? 84;
    const top = GROUND - h;
    const stocked = params.stocked ?? 3;
    const shapes: ShapeSpec[] = [
      { d: rr(CX - 23, top, 46, h, 5), fill: '$primary' },
      { d: rr(CX - 17, top + 8, 24, h - 20, 3), fill: '$secondary', opacity: 0.92 },
      { d: rr(CX + 10, top + 11, 8, h - 24, 2), fill: '#00000038', silhouette: false },
      { d: circle(CX + 14, top + 23, 2.5), fill: '$accent', silhouette: false },
      { d: rr(CX + 11, GROUND - 22, 7, 9, 1.5), fill: '$accent', silhouette: false },
      { d: rr(CX - 13, GROUND - 10, 25, 5, 2), fill: '#00000040', silhouette: false },
    ];
    const colors = ['#D85A30', '#97C459', '#185FA5', '#EF9F27', '#F7F4EC', '#A32D2D'];
    for (let row = 0; row < stocked; row++) {
      for (let col = 0; col < 3; col++) {
        shapes.push({ d: rr(CX - 14 + col * 8, top + 14 + row * 14, 5, 8, 1), fill: colors[(row * 3 + col) % colors.length], silhouette: false });
      }
    }
    return shapes;
  },
};

const officeChair: PropTemplate = {
  id: 'office-chair',
  label: 'Office chair',
  projection: 'plan',
  params: [{ key: 'size', label: 'Seat size', min: 10, max: 16, step: 1, default: 13 }],
  build(params) {
    const r = params.size ?? 13;
    const cy = 64;
    return [
      // backrest: thick arc on the south edge (rotate in-engine to face the desk)
      {
        d: `M ${CX - r - 2.5} ${cy + r * 0.4} A ${r + 3.5} ${r + 3.5} 0 0 0 ${CX + r + 2.5} ${cy + r * 0.4}`,
        stroke: '$accent',
        strokeWidth: 5,
      },
      // armrests
      { d: rr(CX - r - 5, cy - 7, 4.5, 14, 2), fill: '$secondary' },
      { d: rr(CX + r + 0.5, cy - 7, 4.5, 14, 2), fill: '$secondary' },
      // seat
      { d: circle(CX, cy, r), fill: '$primary' },
      // cushion inset
      { d: circle(CX, cy, r - 5), fill: '#00000014', silhouette: false },
    ];
  },
};

const cubicleWorkstation: PropTemplate = {
  id: 'cubicle-workstation',
  label: 'Cubicle workstation',
  projection: 'plan',
  params: [
    { key: 'openness', label: 'Opening side', min: 0, max: 3, step: 1, default: 0 },
    { key: 'clutter', label: 'Desk clutter', min: 0, max: 2, step: 1, default: 1 },
  ],
  build(params) {
    const panel = '$secondary';
    const fabric = '$primary';
    const accent = '$accent';
    const openSide = params.openness ?? 0;
    const shapes: ShapeSpec[] = [
      // soft footprint shadow so pods read as furniture, not architecture
      { d: rr(20, 20, 88, 88, 8), fill: '#00000010', silhouette: false },
      // privacy-post caps
      { d: rr(16, 16, 14, 14, 4), fill: accent },
      { d: rr(98, 16, 14, 14, 4), fill: accent },
      { d: rr(16, 98, 14, 14, 4), fill: accent },
      { d: rr(98, 98, 14, 14, 4), fill: accent },
      // work surface and equipment
      { d: rr(32, 34, 64, 38, 5), fill: '$primary' },
      { d: rr(42, 39, 28, 7, 2), fill: '#2C2C2A', silhouette: false },
      { d: rr(54, 46, 5, 5, 1.5), fill: '#2C2C2A', silhouette: false },
      { d: rr(39, 54, 34, 10, 2), fill: '#F7F4EC', silhouette: false },
      { d: ellipse(82, 58, 4, 5), fill: '#F7F4EC', silhouette: false },
      // chair tucked into the open side
      { d: circle(64, 88, 12), fill: '$accent' },
      {
        d: 'M 52 91 A 14 14 0 0 0 76 91',
        stroke: '$accent',
        strokeWidth: 5,
      },
    ];

    // Low fabric partitions around a one-person workstation.
    if (openSide !== 2) {
      shapes.push(
        { d: rr(18, 18, 92, 10, 3), fill: panel },
        { d: rr(24, 23, 80, 4, 1.5), fill: fabric, silhouette: false },
      );
    }
    if (openSide !== 3) {
      shapes.push(
        { d: rr(18, 18, 10, 92, 3), fill: panel },
        { d: rr(23, 24, 4, 80, 1.5), fill: fabric, silhouette: false },
      );
    }
    if (openSide !== 1) {
      shapes.push(
        { d: rr(100, 18, 10, 92, 3), fill: panel },
        { d: rr(101, 24, 4, 80, 1.5), fill: fabric, silhouette: false },
      );
    }

    if ((params.clutter ?? 1) >= 1) {
      shapes.push(
        { d: rr(82, 38, 8, 11, 1.5), fill: '#F7F4EC', silhouette: false },
        { d: circle(89, 65, 4.5), fill: accent, silhouette: false },
      );
    }
    if ((params.clutter ?? 1) >= 2) {
      shapes.push(
        { d: rr(35, 65, 14, 4, 1.5), fill: '#D85A30', silhouette: false },
        { d: rr(50, 65, 10, 4, 1.5), fill: '#97C459', silhouette: false },
      );
    }

    return shapes;
  },
};

const whiteboard: PropTemplate = {
  id: 'whiteboard',
  label: 'Whiteboard',
  projection: 'elevation',
  params: [
    { key: 'width', label: 'Width', min: 52, max: 76, step: 4, default: 64 },
    { key: 'scribbles', label: 'Scribbles', min: 0, max: 3, step: 1, default: 2 },
  ],
  build(params) {
    const w = params.width;
    const x = CX - w / 2;
    const boardY = 50;
    const boardH = 42;
    const shapes: ShapeSpec[] = [
      // frame + board
      { d: rr(x - 3, boardY - 3, w + 6, boardH + 6, 3), fill: '$primary' },
      { d: rr(x, boardY, w, boardH, 1.5), fill: '$secondary', silhouette: false },
      // marker tray
      { d: rr(x + 4, boardY + boardH + 3, w - 8, 4, 2), fill: '$primary' },
      // legs + feet
      { d: `M ${x + 6} ${boardY + boardH + 7} L ${x + 2} ${GROUND} M ${x + w - 6} ${boardY + boardH + 7} L ${x + w - 2} ${GROUND}`, stroke: '$primary', strokeWidth: 4 },
    ];
    const inks = ['$accent', '#185FA5', '#3B6D11'];
    for (let i = 0; i < params.scribbles; i++) {
      const y = boardY + 9 + i * 10;
      shapes.push({
        d: `M ${x + 7} ${y} Q ${x + 16} ${y - 4} ${x + 24} ${y} T ${x + 7 + (w - 14) * (0.55 + i * 0.15)} ${y}`,
        stroke: inks[i % inks.length],
        strokeWidth: 2,
        silhouette: false,
      });
    }
    return shapes;
  },
};

const filingCabinet: PropTemplate = {
  id: 'filing-cabinet',
  label: 'Filing cabinet',
  projection: 'elevation',
  params: [{ key: 'drawers', label: 'Drawers', min: 2, max: 4, step: 1, default: 3 }],
  build(params) {
    const drawers = params.drawers;
    const drawerH = 22;
    const h = drawers * drawerH + 6;
    const top = GROUND - h;
    const shapes: ShapeSpec[] = [{ d: rr(CX - 17, top, 34, h, 3), fill: '$primary' }];
    for (let i = 0; i < drawers; i++) {
      const dy = top + 4 + i * drawerH;
      shapes.push(
        { d: rr(CX - 13, dy, 26, drawerH - 4, 2), fill: '$secondary', silhouette: false },
        { d: rr(CX - 6, dy + 4, 12, 3, 1.5), fill: '$accent', silhouette: false },
        { d: rr(CX - 4, dy + 10, 8, 5, 1), fill: '#F7F4EC', silhouette: false },
      );
    }
    return shapes;
  },
};

const supplyCabinet: PropTemplate = {
  id: 'supply-cabinet',
  label: 'Supply cabinet',
  projection: 'elevation',
  params: [{ key: 'height', label: 'Height', min: 60, max: 84, step: 2, default: 72 }],
  build(params) {
    const h = params.height;
    const top = GROUND - h;
    const w = 40;
    const x = CX - w / 2;
    const shelfY = top + Math.round(h * 0.42);
    const doorW = (w - 13) / 2;
    const doorTop = shelfY + 4;
    const doorH = GROUND - doorTop - 4;
    return [
      // carcass
      { d: rr(x, top, w, h, 4), fill: '$primary' },
      // open upper shelf recess
      { d: rr(x + 4, top + 4, w - 8, shelfY - top - 6, 2), fill: '$secondary', silhouette: false },
      // stacked supplies on the shelf: paper reams + a box + a bottle
      { d: rr(x + 7, top + 7, 10, 8, 1), fill: '#F7F4EC', silhouette: false },
      { d: rr(x + 18, top + 8, 8, 7, 1), fill: '$accent', silhouette: false },
      { d: rr(x + 27, top + 6, 6, 9, 1), fill: '#97C459', silhouette: false },
      // lower double doors
      { d: rr(x + 5, doorTop, doorW, doorH, 2), fill: '$secondary', silhouette: false },
      { d: rr(CX + 2, doorTop, doorW, doorH, 2), fill: '$secondary', silhouette: false },
      // door handles meeting at the centre seam
      { d: rr(CX - 3.5, doorTop + doorH / 2 - 4, 2, 8, 1), fill: '$accent', silhouette: false },
      { d: rr(CX + 1.5, doorTop + doorH / 2 - 4, 2, 8, 1), fill: '$accent', silhouette: false },
    ];
  },
};

const mailStation: PropTemplate = {
  id: 'mail-station',
  label: 'Mail station',
  projection: 'elevation',
  params: [
    { key: 'height', label: 'Height', min: 48, max: 72, step: 2, default: 60 },
    { key: 'columns', label: 'Slot columns', min: 3, max: 5, step: 1, default: 4 },
  ],
  build(params) {
    const h = params.height;
    const cols = params.columns ?? 4;
    const top = GROUND - h;
    const w = 46;
    const x = CX - w / 2;
    const sorterH = Math.round(h * 0.62);
    const shapes: ShapeSpec[] = [
      // carcass
      { d: rr(x, top, w, h, 3), fill: '$primary' },
      // pigeonhole face
      { d: rr(x + 4, top + 4, w - 8, sorterH - 6, 2), fill: '$secondary', silhouette: false },
    ];
    // grid of mail cubbies
    const rows = 3;
    const gx = x + 6;
    const gy = top + 6;
    const gw = w - 12;
    const gh = sorterH - 10;
    const cw = gw / cols;
    const ch = gh / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        shapes.push({ d: rr(gx + c * cw + 1, gy + r * ch + 1, cw - 2, ch - 2, 1), fill: '#00000026', silhouette: false });
      }
    }
    // a couple of envelopes poking out of slots
    shapes.push(
      { d: rr(gx + 1.5, gy + 1.5, cw - 3, ch * 0.5, 0.5), fill: '#F7F4EC', silhouette: false },
      { d: rr(gx + cw * (cols - 1) + 1.5, gy + ch + 1.5, cw - 3, ch * 0.5, 0.5), fill: '#F7F4EC', silhouette: false },
      // lower parcel shelf + an accent label strip
      { d: rr(x + 4, top + sorterH + 2, w - 8, GROUND - (top + sorterH) - 5, 2), fill: '$secondary', silhouette: false },
      { d: rr(x + 6, top + sorterH + 5, 16, 4, 1), fill: '$accent', silhouette: false },
    );
    return shapes;
  },
};

export const PROP_TEMPLATES: PropTemplate[] = [
  waterCooler,
  printer,
  desk,
  coffeeMachine,
  officePlant,
  fridge,
  conferenceTable,
  receptionDesk,
  badgeReader,
  door,
  window,
  nameplate,
  hvacVent,
  deskClutter,
  couch,
  rug,
  vendingMachine,
  officeChair,
  cubicleWorkstation,
  whiteboard,
  filingCabinet,
  supplyCabinet,
  mailStation,
];
