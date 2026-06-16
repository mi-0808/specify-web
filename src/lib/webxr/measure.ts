export interface Point3D {
  x: number
  y: number
  z: number
}

// 2点間のユークリッド距離（メートル）
function dist(a: Point3D, b: Point3D): number {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) +
    Math.pow(b.y - a.y, 2) +
    Math.pow(b.z - a.z, 2)
  )
}

export interface SpaceDimensions {
  width_cm: number
  depth_cm: number
  // 高さは別途壁タップで計測するため今は0
  height_cm: number
}

/**
 * 4隅の3D座標から矩形の幅・奥行きを計算する。
 * 順序: 左前 → 右前 → 右奥 → 左奥（時計回り or 逆時計回り）
 */
export function calcDimensions(corners: [Point3D, Point3D, Point3D, Point3D]): SpaceDimensions {
  const [p0, p1, p2] = corners

  // 辺0-1と辺1-2の長さを取る（対角でなく隣辺）
  const side01 = dist(p0, p1)
  const side12 = dist(p1, p2)

  // 長い方を幅、短い方を奥行きとする
  const a = Math.round(side01 * 100)
  const b = Math.round(side12 * 100)

  return {
    width_cm: Math.max(a, b),
    depth_cm: Math.min(a, b),
    height_cm: 0,
  }
}
