export type BoardView = { x: number; y: number; zoom: number };

// x、y 是圖片中心點在黑板上的座標，scale 相對原圖尺寸
export type BoardItem = {
  id: string;
  kind: 'koatag' | 'file' | 'url';
  image_id?: number;
  path?: string;
  url?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};
