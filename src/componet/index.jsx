
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
  const showeff = useEffect(() => {
    fetch("http://localhost:6001")
      .then((response) => response.json())
      .then((data) => setMessage(data))
  }, []);
  return {
    message,
    showeff
  }
}
function responseImgDate(data) {
  fetch('http://localhost:6001', {
    method: 'POST', // 请求方法
    headers: {
      'Content-Type': 'application/json' // 请求头，表明请求体是 JSON
    },
    body: JSON.stringify(data) // 将数据对象转换为 JSON 字符串
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json(); // 解析响应体为 JSON
    })
    .then(result => {
      console.log('Success:', result); // 处理成功的响应
    })
}

function App() {
  const [searchValue, setSerchValue] = useState('');
  const { message, showeff } = responseMessage();
  const [parms] = useSearchParams();
  const parm = useParams();
  const dataArray = Array.isArray(message.animeDB) ? message.animeDB : [];//要使用這方法來確認是否是陣列
  const marDBarray = Array.isArray(message.marDB) ? message.marDB : [];//要使用這方法來確認是否是陣列
  const marDBcolumnsArray = Array.isArray(message.marDBColumns) ? message.marDBColumns : [];//要使用這方法來確認是否是陣列
  console.log(marDBcolumnsArray);
  const { asd, plus } = plusState();

  return (
    <>
      <div>
        <table>
        <thead>
          <tr>
            {
              marDBcolumnsArray.map((element, index) => (
                <td key={index}>{element}:</td>
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
        輸入要查的字:<input type="text" onChange={(e) => { setSerchValue(e.target.value) }} value={searchValue} />
        <button onClick={() => { responseImgDate(searchValue) }}>查詢</button>
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