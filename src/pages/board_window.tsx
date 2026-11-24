import React from 'react';
import { Board } from './board';
import '../style/v3/index.scss';
import '../style/message/message.scss';

// 獨立黑板視窗，不套側欄與頂端列
const BoardWindow: React.FC = () => {
  return <Board standalone />;
};

export { BoardWindow };
