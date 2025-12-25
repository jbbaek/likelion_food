import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../config";

function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 페이지 로드 및 경로 변경 시 로그인 상태 확인
  const checkLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error("로그인 필요");
      const data = await res.json();
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    checkLogin();
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("logout failed");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("로그아웃 오류:", err);
    }
  };

  return (
    <nav className="bg-yellow-300 p-3 shadow-md">
      <ul className="flex gap-4 items-center justify-between max-w-7xl mx-auto">
        <div className="flex gap-4">
          <li>
            <Link
              to="/"
              className="font-bold text-orange-600 px-3 py-1 rounded hover:bg-orange-400 hover:text-white transition"
            >
              Food
            </Link>
          </li>
          <li>
            <Link
              to="/mypage"
              className="font-bold text-orange-600 px-3 py-1 rounded hover:bg-orange-400 hover:text-white transition"
            >
              마이페이지
            </Link>
          </li>
        </div>

        {user ? (
          <li>
            <button
              onClick={handleLogout}
              className="font-bold text-orange-600 px-3 py-1 rounded hover:bg-orange-400 hover:text-white transition"
            >
              로그아웃
            </button>
          </li>
        ) : (
          <div className="flex gap-4">
            <li>
              <Link
                to="/login"
                className="font-bold text-orange-600 px-3 py-1 rounded hover:bg-orange-400 hover:text-white transition"
              >
                로그인
              </Link>
            </li>
            <li>
              <Link
                to="/signup"
                className="font-bold text-orange-600 px-3 py-1 rounded hover:bg-orange-400 hover:text-white transition"
              >
                회원가입
              </Link>
            </li>
          </div>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;
