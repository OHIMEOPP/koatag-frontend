import React, { useEffect, useState } from 'react';
import Konva from 'konva';
import { Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import { BoardItem } from './types';
import { koatagImageUrl, loadImage, localImageUrl } from 'services/board.service';

type Props = {
  item: BoardItem;
  onSelect: (id: string) => void;
  onChange: (item: BoardItem) => void;
};

type Status = 'loading' | 'ok' | 'missing';

// 遺失時不知道原圖尺寸，佔位框當成這個大小的圖再乘 scale
const MISSING_WIDTH = 1000;
const MISSING_HEIGHT = 750;

// 圖片來源網址
const sourceOf = async (item: BoardItem): Promise<string | null> => {
  if (item.kind === 'url' && item.url) {
    return item.url;
  }
  if (item.kind === 'koatag' && item.image_id) {
    return koatagImageUrl(item.image_id);
  }
  if (item.kind === 'file' && item.path) {
    return localImageUrl(item.path);
  }
  return null;
};

// 佔位框下面顯示原本的來源
const sourceLabel = (item: BoardItem): string => {
  if (item.kind === 'koatag') {
    return '圖庫圖片 #' + item.image_id;
  }
  if (item.kind === 'file') {
    return '本機複本 ' + (item.path || '');
  }
  return item.url || '';
};

// 黑板上的一張圖，以中心點定位，旋轉也繞中心，讀不到就畫遺失佔位框
export const BoardImage: React.FC<Props> = ({ item, onSelect, onChange }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // 來源不變就不重新載入，拖動縮放不會重抓
  // 來源換掉時先留著舊圖，新圖載好才換，存進圖庫後不會閃一下
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const src = await sourceOf(item);
      let img = null;
      if (src) {
        img = await loadImage(src);
      }
      if (cancelled) {
        return;
      }
      if (img) {
        setImage(img);
        setStatus('ok');
      } else {
        setImage(null);
        setStatus('missing');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.kind, item.url, item.image_id, item.path]);

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ ...item, x: e.target.x(), y: e.target.y() });
  };

  // 縮放框改的是 scaleX、scaleY，鎖等比所以取一個就好
  const onTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    onChange({
      ...item,
      x: node.x(),
      y: node.y(),
      scale: node.scaleX(),
      rotation: node.rotation(),
    });
  };

  if (status === 'loading') {
    return null;
  }

  if (status === 'missing' || !image) {
    return (
      <Group
        id={item.id}
        offsetX={MISSING_WIDTH / 2}
        offsetY={MISSING_HEIGHT / 2}
        x={item.x}
        y={item.y}
        scaleX={item.scale}
        scaleY={item.scale}
        rotation={item.rotation}
        draggable
        onMouseDown={() => onSelect(item.id)}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
      >
        <Rect
          width={MISSING_WIDTH}
          height={MISSING_HEIGHT}
          fill="#171b24"
          stroke="#525969"
          strokeWidth={8}
          dash={[40, 24]}
          cornerRadius={24}
        />
        <Text
          text="圖片遺失"
          width={MISSING_WIDTH}
          y={MISSING_HEIGHT / 2 - 110}
          align="center"
          fontSize={96}
          fontStyle="bold"
          fill="#8a91a0"
        />
        <Text
          text={sourceLabel(item)}
          x={60}
          y={MISSING_HEIGHT / 2 + 20}
          width={MISSING_WIDTH - 120}
          height={180}
          align="center"
          fontSize={44}
          fill="#525969"
          wrap="char"
          ellipsis
        />
      </Group>
    );
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  return (
    <KonvaImage
      id={item.id}
      image={image}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      x={item.x}
      y={item.y}
      scaleX={item.scale}
      scaleY={item.scale}
      rotation={item.rotation}
      draggable
      onMouseDown={() => onSelect(item.id)}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
};
