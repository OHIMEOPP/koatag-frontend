import React, { Component, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function Blank() {
    const navigate = useNavigate();
    return <>
            <a href='/main'>跳轉道主頁面:標籤a版</a><br></br>
            <Link to='/main/100'>跳轉道主頁面:link版</Link><br></br>
            <Link onClick={() => navigate('./main?msg=jack')}>轉跳主頁面:link useSearchParams傳參數版</Link><br></br>
            <Link onClick={() => navigate('./main/jack')}>轉跳主頁面:link useParams傳參數版</Link><br></br>
            <Link onClick={() => navigate('./markingTable')}>轉跳主頁面:link MarkingTable版</Link><br></br>
    </>
}

export default Blank;