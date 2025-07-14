import React, { useRef } from 'react';

function FocusInput() {
  // 创建一个 useRef 对象，初始值为 null
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 处理点击事件，聚焦到输入框
  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.focus(); // 使输入框获得焦点
      console.log('Input is focused'); // 输出日志
    }
  };

  return (
    <div>
      <input ref={inputRef} type="text" placeholder="Click the button to focus me" />
      <button onClick={handleClick}>Focus the input</button>
    </div>
  );
}

export default FocusInput;
