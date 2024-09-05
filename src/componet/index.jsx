
import React, { Component, useRef, useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import "../App.css";

function plusState() {
  const [asd, setAsd] = useState(0);
  const plus = () => setAsd(asd + 1);
  return {
    asd,
    plus
  }
}

function responseMessage() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState(true);
  useEffect(() => {
    fetch("http://localhost:6001")
      .then((response) => response.json())
      .then((data) => setMessage(data))
  }, [state]);
  return { message, setState };
}

function responseImgDate() {
  const [searchValue, setSerchValue] = useState('*');
  const inputRef = useRef(null);
  const [vv, setVv] = useState('沒有');
  // 处理点击事件，聚焦到输入框
  const handleClick = async () => {
    if (inputRef.current) {
      fetch("http://localhost:6001/submit", {
        method: 'POST', // 请求方法
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: searchValue }) // 将数据对象转换为 JSON 字符串
      })
        .then((response) => response.json())
        .then(data => {
          setVv(data);
          // console.log('Success:', data.DB); // 处理成功的响应
        })
    }
  };
  return { inputRef, handleClick, searchValue, setSerchValue, vv }
}

function App() {

  const { message, showeff, setState } = responseMessage();
  const [parms] = useSearchParams();
  const parm = useParams();
  const dataArray = Array.isArray(message.animeDB) ? message.animeDB : [];//要使用這方法來確認是否是陣列
  const marDBarray = Array.isArray(message.marDB) ? message.marDB : [];//要使用這方法來確認是否是陣列
  const marDBcolumnsArray = Array.isArray(message.marDBColumns) ? message.marDBColumns : [];//要使用這方法來確認是否是陣列
  const { inputRef, handleClick, searchValue, setSerchValue, vv } = responseImgDate();
  const { asd, plus } = plusState();
  console.log(marDBcolumnsArray);

  const marChin = [
    '停車序號', '折扣設備', '車牌號碼', '入車時間', '計時時間?', '出車時間', '從何時愈期?', '付款人?', '付款時間',
    '實際停車', '本地編號', '存取控制列表編號?', '預約編號?', '交易編號', '輸入記錄編號', '狀態', '類別', '原始費用', '實際費用',
    '折扣時數', '使用折扣時數', '發票號碼', '額外資訊', '創建時間', '更新時間', '票務uid'
  ];
  return (
    <>
      <div>
        輸入要查的字:
        <input 
        type="text" 
        ref={inputRef} 
        onChange={(e) => { setSerchValue(e.target.value) }} 
        value={searchValue} />

        <button onClick={() => { handleClick(); setState(prev => !prev); }}>查詢</button>
        <table>
          <thead>
            <tr>
              {
                marDBcolumnsArray.map((element, index) => (
                  <td key={index}>{element}　　　　　　　　　　　　:</td>
                ))
              }
            </tr>
            <tr>
              {
                marChin.map((e, i) => (
                  <td key={i}>{e}</td>
                ))
              }
            </tr>
          </thead>
          <tbody>
            {
              marDBarray.map((e, i) => (
                <tr key={i}>{
                  marDBcolumnsArray.map((element, index) => (
                    <td key={index}>{e[element]}</td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
        <p> message :{message.message}</p>

        <table>
          <thead>
            <tr>
              <td>id :</td>
              <td>團體 :</td>
              <td>人物 :</td>
            </tr>
          </thead>
          <tbody>
            {
              dataArray.map((e, i) => (
                <tr key={i}>
                  <td >{e.id}</td><td >{e.maintag}</td><td >{e.secondarytag}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
        <p> httpValue: {message.http}</p>
        <p>傳進來的參數: {parms.get('msg')}</p>
        <p>傳進來的參數: {parm.msg}</p>

      </div>
      <button onClick={plus}>{asd}</button>
    </>
  );
}

export default App;