import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
  Scatter,
} from "recharts";
import { useNavigate } from "react-router-dom";

export default function MyFoodchart() {
  const [user, setUser] = useState(null);
  const [weeklyData, setWeeklyData] = useState({});
  const [selectedWeek, setSelectedWeek] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/me", { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => {
        alert("로그인이 필요합니다.");
        navigate("/login");
      });
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;
    axios
      .get("http://localhost:5000/api/weekly-summary", {
        params: { user_id: user.id },
      })
      .then((res) => {
        const data = res.data.map((item) => ({
          date: new Date(item.date),
          calories: Math.round(item.total_kcal || 0),
        }));

        const grouped = {};
        data.forEach((item) => {
          const d = new Date(item.date);
          const day = d.getDay();
          const start = new Date(d);
          start.setDate(d.getDate() - day);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);

          const key = `${start.getMonth() + 1}/${start.getDate()} ~ ${
            end.getMonth() + 1
          }/${end.getDate()}`;

          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({
            day: ["일", "월", "화", "수", "목", "금", "토"][day],
            calories: item.calories,
          });
        });

        setWeeklyData(grouped);

        const weeks = Object.keys(grouped).sort(
          (a, b) => new Date(a.split("~")[0]) - new Date(b.split("~")[0])
        );
        setSelectedWeek(weeks[weeks.length - 1]);
      })
      .catch((err) => console.error("주간 데이터 불러오기 오류:", err));
  }, [user?.id]);

  const recommended = 2000;
  const displayData = weeklyData[selectedWeek] || [];

  const avgCalories =
    displayData.length > 0
      ? displayData.reduce((sum, d) => sum + d.calories, 0) / displayData.length
      : 0;

  if (!user)
    return (
      <div className="text-center mt-10 text-gray-600">로그인 확인 중...</div>
    );

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="p-8 max-w-5xl bg-white rounded-3xl shadow-lg w-full">
        {/* 제목 + 버튼 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[#EA580C]">
            {user.name || "사용자"}님의 주간 섭취량
          </h2>
          <button
            onClick={() => navigate("/mypage")}
            className="bg-[#F97316] text-white px-3 py-1.5 rounded-lg hover:bg-[#EA580C] transition"
          >
            ← 마이페이지로
          </button>
        </div>

        {/* 주 선택 드롭다운 */}
        <div className="mb-4 flex justify-end">
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {Object.keys(weeklyData)
              .sort(
                (a, b) => new Date(a.split("~")[0]) - new Date(b.split("~")[0])
              )
              .map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
          </select>
        </div>

        {displayData.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            선택한 주간 데이터가 없습니다.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={370}>
              <BarChart
                data={displayData}
                margin={{ top: 30, right: 40, left: 0, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#fcd34d50" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 13, fill: "#78350F" }}
                  tickMargin={10}
                />
                <YAxis
                  domain={[0, 2500]}
                  tick={{ fontSize: 13, fill: "#78350F" }}
                  label={{
                    value: "칼로리 (kcal)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#78350F",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fffef5",
                    borderRadius: "10px",
                    border: "1px solid #FDBA74",
                    color: "#78350F",
                  }}
                />

                {/* 권장 섭취량 기준선 */}
                <ReferenceLine
                  y={recommended}
                  stroke="#FCD34D"
                  strokeWidth={3}
                  strokeDasharray="6 4"
                  label={{
                    value: "권장 2,000 kcal",
                    position: "right",
                    fill: "#F59E0B",
                    fontSize: 12,
                  }}
                />

                {/* 평균 섭취량 기준선 */}
                <ReferenceLine
                  y={avgCalories}
                  stroke="#FB923C"
                  strokeDasharray="4 3"
                  label={{
                    value: `평균 ${Math.round(avgCalories)} kcal`,
                    position: "right",
                    fill: "#EA580C",
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="calories"
                  fill="url(#colorOrange)"
                  barSize={45}
                  radius={[10, 10, 0, 0]}
                >
                  <LabelList
                    dataKey="calories"
                    position="top"
                    fill="#78350F"
                    fontSize={12}
                  />
                </Bar>

                <Scatter
                  data={displayData.filter((d) => d.calories > recommended)}
                  fill="#DC2626"
                  shape="circle"
                  r={5}
                />

                <defs>
                  <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.95} />
                    <stop offset="95%" stopColor="#FDBA74" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>

            <div className="text-right text-sm text-[#78350F] mt-3 mr-3">
              <span className="font-semibold text-[#EA580C]">
                ● 권장 2,000 kcal
              </span>
              <span className="ml-3 text-[#FB923C]">
                — 평균 {Math.round(avgCalories)} kcal
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
