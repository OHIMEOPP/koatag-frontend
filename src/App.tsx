import "./App.css";
import Index from "./componet/index";
import Blank from "./componet/blankpage";
import Te from "./componet/te";
import MarkingTable from "./componet/markingDBtable";
import React, { Component, useRef, useState, useEffect } from "react";
import { createBrowserRouter, Link, RouterProvider, useNavigate } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: '/main/:msg',
    element: <Index></Index>
  },
  {
    path: '/',
    element: <Blank></Blank>
  },
  {
    path: '/markingTable',
    element: <MarkingTable marDBcolumnsArray='黑藝起來'></MarkingTable>
  },
  {
    path: 'te',
    element: <Te></Te>
  }
  
])

export default router;
