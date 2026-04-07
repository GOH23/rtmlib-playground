export function getBboxValue(det: any, key: 'x1' | 'y1' | 'x2' | 'y2'): number {
  if (!det.bbox) return 0;
  if (det.bbox[key] !== undefined) return Math.round(det.bbox[key]);
  if (key === 'x1') return det.bbox.originX !== undefined ? Math.round(det.bbox.originX) : 0;
  if (key === 'y1') return det.bbox.originY !== undefined ? Math.round(det.bbox.originY) : 0;
  if (key === 'x2') {
    if (det.bbox.originX !== undefined && det.bbox.width !== undefined) return Math.round(det.bbox.originX + det.bbox.width);
    return 0;
  }
  if (key === 'y2') {
    if (det.bbox.originY !== undefined && det.bbox.height !== undefined) return Math.round(det.bbox.originY + det.bbox.height);
    return 0;
  }
  return 0;
}
