import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import axios from "axios";

function Signup() {
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/api/signup`, form, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      const data = res.data;
      setMessage(data.message);

      // axios는 res.ok 없음 → status로 판단
      if (res.status === 200 || res.status === 201) {
        setTimeout(() => navigate("/login"), 1000);
      }
    } catch (err) {
      console.error(err);
      setMessage(err?.response?.data?.message || "서버 오류 발생");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 border-2 border-yellow-400 rounded-xl bg-yellow-50 shadow-md">
      <h2 className="text-center text-orange-500 text-2xl font-bold mb-6">
        회원가입
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          name="username"
          placeholder="아이디"
          value={form.username}
          onChange={handleChange}
          required
          className="p-2 border border-yellow-400 rounded-md text-sm focus:outline-none focus:border-orange-500"
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          value={form.password}
          onChange={handleChange}
          required
          className="p-2 border border-yellow-400 rounded-md text-sm focus:outline-none focus:border-orange-500"
        />
        <input
          type="text"
          name="name"
          placeholder="이름"
          value={form.name}
          onChange={handleChange}
          required
          className="p-2 border border-yellow-400 rounded-md text-sm focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          className="p-2 bg-orange-500 text-white font-bold rounded-md hover:bg-orange-400 transition duration-300"
        >
          회원가입
        </button>
      </form>

      <p className="text-center mt-3 font-semibold text-gray-700">{message}</p>
    </div>
  );
}

export default Signup;
