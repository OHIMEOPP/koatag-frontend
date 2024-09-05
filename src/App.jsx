import "./App.css";
import Index from "./componet/index.jsx";
import Blank from "./componet/blankpage.jsx";
import Te from "./componet/te.jsx";
import MarkingTable from "./componet/markingDBtable.jsx";
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
    element: <MarkingTable></MarkingTable>
  },
  {
    path: 'te',
    element: <Te></Te>
  }
  
])

export default router;
