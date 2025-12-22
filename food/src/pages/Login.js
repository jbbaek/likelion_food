import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json();
      setMessage(data.message);

      if (res.ok) {
        const user = data.user;
        navigate("/mypage", { state: { user } });
      }
    } catch (err) {
      console.error(err);
      setMessage("서버 오류 발생");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 border-2 border-yellow-400 rounded-xl bg-yellow-50 shadow-md">
      <h2 className="text-center text-orange-500 text-2xl font-bold mb-6">
        로그인
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
        <button
          type="submit"
          className="p-2 bg-orange-500 text-white font-bold rounded-md hover:bg-orange-400 transition duration-300"
        >
          로그인
        </button>
      </form>

      <p className="text-center mt-3 font-semibold text-gray-700">{message}</p>
    </div>
  );
}

export default Login;
