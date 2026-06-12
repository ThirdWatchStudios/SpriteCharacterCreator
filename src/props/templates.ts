import type { PropTemplate, ShapeSpec } from '../core/types';
import { rr, circle } from '../core/geometry';

/**
 * Parametric prop templates. Conventions:
 * - Canvas coords (128 design units), props rest on the ground line y = 116.
 * - Fills use '$primary' / '$secondary' / '$accent' tokens from the prop's palette.
 * - The global outline pass applies automatically, same as characters.
 */

const GROUND = 116;
const CX = 64;

const waterCooler: PropTemplate = {
  id: 'water-cooler',
  label: 'Water cooler',
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
      { d: rr(CX - 10, bodyTop - 28, 6, 18, 3), fill: '#FFFFFF55', silhouette: false },
    ];
    return shapes;
  },
};

const printer: PropTemplate = {
  id: 'printer',
  label: 'Printer',
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
  params: [
    { key: 'width', label: 'Width', min: 72, max: 120, step: 4, default: 100 },
    { key: 'monitor', label: 'Monitor', min: 0, max: 1, step: 1, default: 1 },
  ],
  build(params) {
    const w = params.width;
    const x = CX - w / 2;
    const topY = 78;
    const shapes: ShapeSpec[] = [];
    if (params.monitor >= 1) {
      shapes.push(
        { d: rr(CX - 19, topY - 40, 38, 27, 3), fill: '#2C2C2A' },
        { d: rr(CX - 15, topY - 36, 30, 19, 1.5), fill: '$secondary', silhouette: false },
        { d: rr(CX - 2.5, topY - 13, 5, 7, 1), fill: '#2C2C2A' },
        { d: rr(CX - 9, topY - 6, 18, 3, 1.5), fill: '#2C2C2A' },
        // keyboard
        { d: rr(CX - 16, topY - 4, 32, 4, 1.5), fill: '$accent', silhouette: false },
      );
    }
    shapes.push(
      // slab
      { d: rr(x, topY, w, 8, 3), fill: '$primary' },
      // legs
      { d: rr(x + 4, topY + 8, 7, GROUND - topY - 8, 2), fill: '$primary' },
      { d: rr(x + w - 11, topY + 8, 7, GROUND - topY - 8, 2), fill: '$primary' },
      // modesty panel
      { d: rr(x + 14, topY + 8, w - 28, 20, 2), fill: '$primary', opacity: 0.55, silhouette: false },
    );
    return shapes;
  },
};

const coffeeMachine: PropTemplate = {
  id: 'coffee-machine',
  label: 'Coffee machine',
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
  params: [
    { key: 'width', label: 'Width', min: 84, max: 120, step: 4, default: 110 },
    { key: 'chairs', label: 'Chairs', min: 0, max: 4, step: 1, default: 2 },
  ],
  build(params) {
    const w = params.width;
    const x = CX - w / 2;
    const topY = 82;
    const shapes: ShapeSpec[] = [];
    // chair backs peeking over the far side
    const chairs = params.chairs;
    for (let i = 0; i < chairs; i++) {
      const cx = x + ((i + 1) * w) / (chairs + 1);
      shapes.push({ d: rr(cx - 9, topY - 22, 18, 24, 6), fill: '$accent' });
    }
    shapes.push(
      // slab
      { d: rr(x, topY, w, 9, 4), fill: '$primary' },
      // end panels
      { d: rr(x + 6, topY + 9, 8, GROUND - topY - 9, 2), fill: '$secondary' },
      { d: rr(x + w - 14, topY + 9, 8, GROUND - topY - 9, 2), fill: '$secondary' },
    );
    return shapes;
  },
};

const receptionDesk: PropTemplate = {
  id: 'reception-desk',
  label: 'Reception desk',
  params: [{ key: 'width', label: 'Width', min: 72, max: 104, step: 4, default: 88 }],
  build(params) {
    const w = params.width;
    const x = CX - w / 2;
    const counterY = 64;
    return [
      // service bell
      { d: `M ${CX + w / 2 - 18} ${counterY} A 4 4 0 0 1 ${CX + w / 2 - 10} ${counterY} Z`, fill: '$accent' },
      // counter top, proud of the front panel
      { d: rr(x - 5, counterY, w + 10, 8, 3), fill: '$secondary' },
      // front panel
      { d: rr(x, counterY + 8, w, GROUND - counterY - 8, 4), fill: '$primary' },
      // shadow under the counter overhang
      { d: `M ${x + 2} ${counterY + 10} L ${x + w - 2} ${counterY + 10}`, stroke: '#00000026', strokeWidth: 2.5, silhouette: false },
      // company plaque
      { d: rr(CX - 16, counterY + 22, 32, 12, 2), fill: '$secondary', silhouette: false },
      // kick line
      { d: `M ${x + 4} ${GROUND - 6} L ${x + w - 4} ${GROUND - 6}`, stroke: '#00000022', strokeWidth: 2, silhouette: false },
    ];
  },
};

const badgeReader: PropTemplate = {
  id: 'badge-reader',
  label: 'Badge reader',
  params: [{ key: 'granted', label: 'Access granted', min: 0, max: 1, step: 1, default: 1 }],
  build(params) {
    const light = params.granted >= 1 ? '#97C459' : '#E24B4A';
    const top = 46;
    return [
      // wall slice it mounts on
      { d: rr(CX - 15, top, 30, GROUND - top, 2), fill: '$secondary' },
      // reader unit
      { d: rr(CX - 9, 64, 18, 28, 3), fill: '$primary' },
      // status light
      { d: circle(CX, 70, 2.6), fill: light, silhouette: false },
      // keypad
      { d: circle(CX - 4, 78, 1.5), fill: '#00000055', silhouette: false },
      { d: circle(CX + 4, 78, 1.5), fill: '#00000055', silhouette: false },
      { d: circle(CX - 4, 84, 1.5), fill: '#00000055', silhouette: false },
      { d: circle(CX + 4, 84, 1.5), fill: '#00000055', silhouette: false },
      // swipe slot
      { d: `M ${CX - 6} 89 L ${CX + 6} 89`, stroke: '#00000055', strokeWidth: 2, silhouette: false },
    ];
  },
};

const officeChair: PropTemplate = {
  id: 'office-chair',
  label: 'Office chair',
  params: [{ key: 'backHeight', label: 'Back height', min: 24, max: 40, step: 2, default: 30 }],
  build(params) {
    const bh = params.backHeight;
    const seatY = 88;
    return [
      // backrest
      { d: rr(CX - 14, seatY - bh - 4, 28, bh, 8), fill: '$primary' },
      // seat
      { d: rr(CX - 18, seatY, 36, 10, 4), fill: '$primary' },
      // armrests
      { d: rr(CX - 24, seatY - 10, 5, 12, 2), fill: '$secondary' },
      { d: rr(CX + 19, seatY - 10, 5, 12, 2), fill: '$secondary' },
      // gas lift
      { d: rr(CX - 2.5, seatY + 10, 5, 10, 1), fill: '$secondary' },
      // star base + casters
      { d: `M ${CX} ${seatY + 20} L ${CX - 18} ${GROUND - 4} M ${CX} ${seatY + 20} L ${CX + 18} ${GROUND - 4} M ${CX} ${seatY + 20} L ${CX} ${GROUND - 3}`, stroke: '$secondary', strokeWidth: 4 },
      { d: circle(CX - 18, GROUND - 3, 3), fill: '$accent' },
      { d: circle(CX, GROUND - 2, 3), fill: '$accent' },
      { d: circle(CX + 18, GROUND - 3, 3), fill: '$accent' },
    ];
  },
};

const whiteboard: PropTemplate = {
  id: 'whiteboard',
  label: 'Whiteboard',
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
  officeChair,
  whiteboard,
  filingCabinet,
];
