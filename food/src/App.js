import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Mainpage from "./pages/Mainpage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import FoodDetail from "./pages/FoodDetail";
import Mypage from "./pages/Mypage";
import MyFoodChart from "./pages/MyFoodchart";
import RecipeDetail from "./pages/RecipeDetail";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Mainpage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/foods/:id" element={<FoodDetail />} />
        <Route path="/mypage" element={<Mypage />} />
        <Route path="/myfoodchart" element={<MyFoodChart />} />
        <Route path="/recipes/seq/:seq" element={<RecipeDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
