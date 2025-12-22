import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      setMessage(data.message);

      if (res.ok) {
        setTimeout(() => navigate("/login"), 1000);
      }
    } catch (err) {
      console.error(err);
      setMessage("서버 오류 발생");
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
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          value={form.password}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="name"
          placeholder="이름"
          value={form.name}
          onChange={handleChange}
          required
        />
        <button type="submit">회원가입</button>
      </form>

      <p>{message}</p>
    </div>
  );
}

export default Signup;
