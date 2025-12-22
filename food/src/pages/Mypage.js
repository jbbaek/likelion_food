import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function MyPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [foods, setFoods] = useState([]);
  const [search, setSearch] = useState("");
  const [newRecord, setNewRecord] = useState({
    meal_type: "아침",
    food_id: "",
    food_name: "",
    calories: "",
  });

  // 로그인 확인
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/me", { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => {
        alert("로그인이 필요합니다.");
        navigate("/login");
      });
  }, [navigate]);

  const loadFoods = async (query = "") => {
    try {
      const res = await axios.get("http://localhost:5000/api/foods", {
        params: { search: query },
      });
      setFoods(res.data || []);
    } catch (err) {
      console.error("음식 불러오기 오류:", err);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    loadFoods(value);
  };

  const handleFoodChange = async (e) => {
    const foodId = e.target.value;
    if (!foodId) {
      setNewRecord({ ...newRecord, food_id: "", food_name: "", calories: "" });
      return;
    }

    try {
      const res = await axios.get(`http://localhost:5000/api/foods/${foodId}`);
      const { food_name, energy_kcal } = res.data;

      setNewRecord({
        ...newRecord,
        food_id: foodId,
        food_name,
        calories: energy_kcal,
      });
    } catch (err) {
      console.error("음식 상세 조회 오류:", err);
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [recRes, sumRes] = await Promise.all([
        axios.get("http://localhost:5000/api/records/list", {
          params: { user_id: user.id, record_date: selectedDate },
        }),
        axios.get("http://localhost:5000/api/records/summary", {
          params: { user_id: user.id, record_date: selectedDate },
        }),
      ]);
      setRecords(Array.isArray(recRes.data) ? recRes.data : []);
      setSummary(sumRes.data || {});
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
      setRecords([]);
      setSummary({});
    }
  }, [user?.id, selectedDate]);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, selectedDate, loadData]);

  const addRecord = async () => {
    if (!user?.id) return alert("로그인이 필요합니다.");
    if (!newRecord.food_id) return alert("음식을 선택하세요.");

    try {
      await axios.post(
        "http://localhost:5000/api/records/add",
        {
          user_id: user.id,
          food_id: newRecord.food_id,
          record_date: selectedDate,
          meal_type: newRecord.meal_type,
          quantity: 1,
        },
        { withCredentials: true }
      );

      setNewRecord({
        meal_type: "아침",
        food_id: "",
        food_name: "",
        calories: "",
      });
      loadData();
    } catch (err) {
      console.error("추가 오류:", err);
    }
  };

  const deleteRecord = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/records/delete/${id}`, {
        withCredentials: true,
      });
      loadData();
    } catch (err) {
      console.error("삭제 오류:", err);
    }
  };

  const groupedMeals = {
    아침: records.filter((r) => r.meal_type === "아침"),
    점심: records.filter((r) => r.meal_type === "점심"),
    저녁: records.filter((r) => r.meal_type === "저녁"),
    간식: records.filter((r) => r.meal_type === "간식"),
  };

  // 숫자를 소수점 2자리로 표시하는 헬퍼 함수
  const fmt = (v, unit = "") =>
    v !== undefined && !isNaN(v)
      ? `${Number(v).toFixed(2)}${unit}`
      : `0${unit}`;

  //  표시할 영양소 리스트 (백엔드 필드명 기반)
  const nutrientList = [
    { key: "total_kcal", label: "총 섭취 칼로리", unit: " kcal" },
    { key: "total_carbs", label: "탄수화물", unit: " g" },
    { key: "total_protein", label: "단백질", unit: " g" },
    { key: "total_fat", label: "지방", unit: " g" },
  ];

  if (!user)
    return (
      <div className="text-center mt-10">로그인 정보를 확인 중입니다...</div>
    );

  return (
    <div className="p-8 max-w-5xl mx-auto text-gray-800 font-sans">
      {/* Header */}
      <div className="mypage-header flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-orange-600">
          {user.name || "사용자"}의 식단 기록
        </h1>

        <div className="flex items-center gap-3">
          {/* 날짜 선택 */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1"
          />

          {/* Food Chart 링크 */}
          <Link
            to="/myfoodchart"
            className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition"
          >
            Food Chart 보기
          </Link>
        </div>
      </div>

      {/* Summary (모든 영양소 + 소수점 2자리 표시) */}
      <div className="bg-white/80 shadow-md rounded-xl p-5 border border-gray-100 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          오늘의 영양 요약
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {nutrientList.map((nutrient, i) => (
            <div
              key={i}
              className="bg-white border border-gray-100 shadow-sm rounded-lg p-4 text-center hover:shadow-md transition"
            >
              <p className="font-semibold text-lg text-orange-600">
                {fmt(summary[nutrient.key], nutrient.unit)}
              </p>
              <small className="text-gray-500">{nutrient.label}</small>
            </div>
          ))}
        </div>
      </div>

      {/* Add food */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select
          value={newRecord.meal_type}
          onChange={(e) =>
            setNewRecord({ ...newRecord, meal_type: e.target.value })
          }
          className="p-2 border border-gray-200 rounded-lg"
        >
          <option>아침</option>
          <option>점심</option>
          <option>저녁</option>
          <option>간식</option>
        </select>

        <input
          type="text"
          placeholder="음식 검색..."
          value={search}
          onChange={handleSearchChange}
          className="p-2 border border-gray-200 rounded-lg flex-1 min-w-[150px]"
        />

        <select
          value={newRecord.food_id}
          onChange={handleFoodChange}
          className="p-2 border border-gray-200 rounded-lg"
        >
          <option value="">음식을 선택</option>
          {foods.map((f) => (
            <option key={f.id} value={f.id}>
              {f.food_name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="칼로리"
          value={newRecord.calories}
          readOnly
          className="p-2 border border-gray-200 rounded-lg w-24"
        />
        <button
          onClick={addRecord}
          className="bg-gradient-to-r from-orange-500 to-orange-400 text-white px-4 py-2 rounded-lg shadow hover:-translate-y-0.5 transition"
        >
          추가
        </button>
      </div>

      {/* Meals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {Object.entries(groupedMeals).map(([meal, items]) => (
          <div
            key={meal}
            className={`bg-white/80 shadow-md border border-gray-100 rounded-xl p-4 ${
              meal === "아침"
                ? "border-l-8 border-orange-400"
                : meal === "점심"
                ? "border-l-8 border-yellow-400"
                : meal === "저녁"
                ? "border-l-8 border-orange-700"
                : "border-l-8 border-yellow-200"
            }`}
          >
            <h4 className="text-lg font-semibold mb-2">{meal}</h4>
            <div>
              {items.length > 0 ? (
                <ul className="space-y-2">
                  {items.map((r) => (
                    <li
                      key={r.id}
                      className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm"
                    >
                      <span>
                        {r.food_name}{" "}
                        <span className="text-gray-500 text-sm">
                          ({r.energy_kcal} kcal)
                        </span>
                      </span>
                      <button
                        onClick={() => deleteRecord(r.id)}
                        className="text-orange-600 font-semibold hover:opacity-80"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500 text-sm py-2">
                  등록된 식단이 없습니다.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MyPage;
