import "./App.css";
import Index from "./componet/index.jsx";
import React, { Component, useRef, useState, useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: '/main',
    element: <Index></Index>
  }
])

export default router;
