
import React, { Component, useRef, useState, useEffect } from "react";


function plusState() {
    const [asd, setAsd] = useState(0);
    const plus = () => setAsd(asd + 1);
    return {
      asd,
      plus
    }
  }
  
  function connectEnd() {
    const [message, setMessage] = useState("");
    const showeff = useEffect(() => {
      fetch("http://localhost:5000")
        .then((response) => response.json())
        .then((data) => setMessage(data))
    }, []);
    return {
      message,
      showeff
    }
  }
  

function App() {
    const [httpValue, setHttpValue] = useState("");
    const { message, showeff } = connectEnd();
  
    const dataArray = Array.isArray(message.data) ? message.data : [];//要使用這方法來確認是否是陣列
    const { asd, plus } = plusState();
    return (
      <>
        <div>
          <p> message :{message.message}</p>
          <p> year :{
            dataArray.map((e, i) => (
              <li key={i}>{e.year}</li>
            ))
          }</p>
          <p> brand :{
            dataArray.map((e, i) => (
              <li key={i}>{e.brand}</li>
            ))
          }</p>
          <p> model :{
            dataArray.map((e, i) => (
              <li key={i}>{e.model}</li>
            ))
          }</p>
          <p> httpValue: {message.http}</p>
        </div>
        <button onClick={plus}>{asd}</button>
      </>
    );
  }

  export default App;