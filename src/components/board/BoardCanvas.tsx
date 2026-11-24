import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Transformer } from 'react-konva';
import { BoardImage } from './BoardImage';
import { BoardItem, BoardView } from './types';

type Props = {
  view: BoardView;
  items: BoardItem[];
  selectedId: string | null;
  onViewChange: (view: BoardView) => void;
  onSelect: (id: string | null) => void;
  onItemChange: (item: BoardItem) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.1;
const GRID = 40;

// 黑板畫布，拖空白處平移，滾輪以游標為中心縮放
export const BoardCanvas: React.FC<Props> = ({ view, items, selectedId, onViewChange, onSelect, onItemChange, onSizeChange }) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // 畫布跟著外框大小走
  useEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const next = { width: area.clientWidth, height: area.clientHeight };
      setSize(next);
      onSizeChange(next);
    });
    observer.observe(area);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選取框套到選中的圖
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) {
      return;
    }
    let node = null;
    if (selectedId) {
      node = stage.findOne('#' + selectedId);
    }
    if (node) {
      transformer.nodes([node]);
    } else {
      transformer.nodes([]);
    }
  }, [selectedId, items]);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    // 游標底下那一點在黑板上的座標，縮放後要留在游標底下
    const pointX = (pointer.x - view.x) / view.zoom;
    const pointY = (pointer.y - view.y) / view.zoom;

    let zoom = view.zoom / ZOOM_STEP;
    if (e.evt.deltaY < 0) {
      zoom = view.zoom * ZOOM_STEP;
    }
    if (zoom < MIN_ZOOM) {
      zoom = MIN_ZOOM;
    }
    if (zoom > MAX_ZOOM) {
      zoom = MAX_ZOOM;
    }

    onViewChange({
      x: pointer.x - pointX * zoom,
      y: pointer.y - pointY * zoom,
      zoom: zoom,
    });
  };

  // 只處理拖整塊黑板，拖圖片的事件不算
  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target.getStage();
    if (e.target !== stage || !stage) {
      return;
    }
    onViewChange({ x: stage.x(), y: stage.y(), zoom: view.zoom });
  };

  // 點空白處取消選取
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  };

  // 疊放順序照 z 由小到大畫
  const sorted = [...items].sort((a, b) => a.z - b.z);

  // 背景點點跟著平移縮放
  const gridSize = GRID * view.zoom;
  const areaStyle: React.CSSProperties = {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${view.x}px ${view.y}px`,
  };

  return (
    <div className="board-area" ref={areaRef} style={areaStyle}>
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.zoom}
          scaleY={view.zoom}
          draggable
          onWheel={onWheel}
          onDragMove={onDragMove}
          onMouseDown={onMouseDown}
        >
          <Layer>
            {sorted.map((item) => (
              <BoardImage key={item.id} item={item} onSelect={onSelect} onChange={onItemChange} />
            ))}
            <Transformer
              ref={transformerRef}
              keepRatio
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotationSnaps={[0, 90, 180, 270]}
              borderStroke="#e8b96a"
              anchorStroke="#e8b96a"
              anchorFill="#11141b"
              anchorSize={10}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => {
                // 縮太小就不給縮
                if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
};
