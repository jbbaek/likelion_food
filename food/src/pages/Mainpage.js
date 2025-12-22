import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

function Mainpage() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);

  const [recipeCandidates, setRecipeCandidates] = useState([]);
  const [showPickModal, setShowPickModal] = useState(false);

  // ✅ 전송 중 중복 방지
  const [sending, setSending] = useState(false);

  const navigate = useNavigate();
  const suggestionRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ 채팅 자동 스크롤
  const chatBodyRef = useRef(null);

  const initials = [
    "ㄱ",
    "ㄴ",
    "ㄷ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅅ",
    "ㅇ",
    "ㅈ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];

  const safeSetFoods = (data) => {
    if (Array.isArray(data)) setFoods(data);
    else if (data && Array.isArray(data.foods)) setFoods(data.foods);
    else if (data && Array.isArray(data.items)) setFoods(data.items);
    else setFoods([]);
  };

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("http://localhost:5000/api/foods");
      const data = await res.json();
      safeSetFoods(data);
    } catch (err) {
      console.error("리스트 불러오기 실패:", err);
      setFoods([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList();

    const handleDocClick = (e) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setSuggestions([]);
      }
    };

    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [fetchList]);

  const handleSearch = async (e, q) => {
    if (e && e.preventDefault) e.preventDefault();
    const searchTerm = typeof q === "string" ? q : query;

    try {
      setLoadingList(true);
      const res = await fetch(
        `http://localhost:5000/api/foods?search=${encodeURIComponent(
          searchTerm || ""
        )}`
      );
      const data = await res.json();
      safeSetFoods(data);
      setSuggestions([]);
      if (typeof q === "string") setQuery(q);
    } catch (err) {
      console.error("검색 실패:", err);
      setFoods([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setLoadingAuto(true);
    const tid = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/foods/autocomplete?q=${encodeURIComponent(
            query
          )}`
        );
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
        else if (data && Array.isArray(data.suggestions))
          setSuggestions(data.suggestions);
        else setSuggestions([]);
      } catch (err) {
        console.error("자동완성 실패:", err);
        setSuggestions([]);
      } finally {
        setLoadingAuto(false);
      }
    }, 200);

    return () => clearTimeout(tid);
  }, [query]);

  const handleInitialSearch = async (ch) => {
    try {
      setLoadingList(true);
      const res = await fetch(
        `http://localhost:5000/api/foods/by-initial?initial=${encodeURIComponent(
          ch
        )}`
      );
      const data = await res.json();
      safeSetFoods(data);
      setSuggestions([]);
      setQuery("");
    } catch (err) {
      console.error("초성 검색 실패:", err);
      setFoods([]);
    } finally {
      setLoadingList(false);
    }
  };

  const goRecipeByName = async (name) => {
    const safeName = String(name || "").trim();
    if (!safeName) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/recipes/search?name=${encodeURIComponent(
          safeName
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const list = Array.isArray(data.list) ? data.list : [];

      if (list.length === 0) {
        alert(`"${safeName}" 레시피가 식약처 DB에 없습니다.`);
        return;
      }

      if (list.length === 1) {
        navigate(`/recipes/seq/${encodeURIComponent(list[0].RCP_SEQ)}`);
        return;
      }

      setRecipeCandidates(list);
      setShowPickModal(true);
    } catch (e) {
      alert(`레시피 검색 실패: ${e.message}`);
    }
  };

  const handleFoodClick = (food) => {
    const id = food?.id;
    if (!id) return;
    navigate(`/foods/${id}`); // 너 라우터에 FoodDetail 연결돼 있어야 함
  };

  // ✅ 채팅 로그 변경되면 자동 스크롤
  useEffect(() => {
    if (!showChat) return;
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatLog, showChat]);

  // ✅ AI 메뉴 추천
  const handleSendMessage = async () => {
    if (!message.trim()) return;
    if (sending) return;

    const userText = message;
    setMessage("");

    setChatLog((prev) => [
      ...prev,
      { sender: "user", type: "text", text: userText },
    ]);

    setSending(true);
    try {
      const res = await fetch("http://localhost:5000/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {}

      if (!res.ok)
        throw new Error(data?.message || raw || `HTTP ${res.status}`);

      const foodsFromApi =
        (Array.isArray(data?.foods) && data.foods) ||
        (Array.isArray(data?.cards) && data.cards) ||
        [];

      let replyFromApi =
        (typeof data?.reply === "string" && data.reply) ||
        (typeof data?.replyText === "string" && data.replyText) ||
        "";

      // ✅ "요청: ..." 줄 제거 (첫 줄만 잘라냄)
      replyFromApi = String(replyFromApi || "");
      replyFromApi = replyFromApi.replace(/^요청\s*:\s*.*(\r?\n)?/i, "");

      if (foodsFromApi.length > 0) {
        setChatLog((prev) => [
          ...prev,
          { sender: "ai", type: "recommend", foods: foodsFromApi },
        ]);
      }

      if (replyFromApi.trim()) {
        setChatLog((prev) => [
          ...prev,
          { sender: "ai", type: "text", text: replyFromApi },
        ]);
      }

      if (foodsFromApi.length === 0 && !replyFromApi.trim()) {
        setChatLog((prev) => [
          ...prev,
          { sender: "ai", type: "text", text: "추천 결과가 없습니다." },
        ]);
      }
    } catch (err) {
      console.error("추천 요청 실패:", err);
      setChatLog((prev) => [
        ...prev,
        {
          sender: "ai",
          type: "text",
          text: `서버 오류가 발생했습니다.\n(${err.message || "unknown"})`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDownChat = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetChat = () => {
    setChatLog([]);
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-yellow-50 relative p-4">
      <div className="max-w-[1500px] mx-auto p-6 bg-yellow-50 shadow-sm rounded-lg">
        <h2 className="text-center text-orange-500 text-2xl font-bold mb-4">
          음식 검색
        </h2>

        {/* 초성 버튼 */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {initials.map((ch) => (
            <button
              key={ch}
              onClick={() => handleInitialSearch(ch)}
              className="px-2 py-1 border border-yellow-400 rounded-md text-sm hover:bg-yellow-100 transition"
            >
              {ch}
            </button>
          ))}
          <button
            onClick={fetchList}
            className="px-2 py-1 border border-yellow-400 rounded-md text-sm hover:bg-yellow-100 transition"
          >
            전체
          </button>
        </div>

        {/* 검색폼 */}
        <form
          onSubmit={(e) => handleSearch(e)}
          className="flex gap-2 mb-6 justify-center relative max-w-md mx-auto"
        >
          <div className="w-full relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="음식 이름 입력"
              onChange={(e) => setQuery(e.target.value)}
              className="w-[100%] p-2 border border-yellow-400 rounded-md text-sm focus:outline-none focus:border-orange-500"
            />

            <div ref={suggestionRef} className="absolute left-0 right-0 z-20">
              {suggestions.length > 0 && (
                <ul className="bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-auto">
                  {suggestions.map((s, i) => (
                    <li
                      key={`${s}-${i}`}
                      className="px-3 py-2 hover:bg-yellow-100 cursor-pointer text-sm"
                      onClick={() => {
                        setQuery(s);
                        setSuggestions([]);
                        handleSearch(null, s);
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {loadingAuto && (
              <div className="absolute right-2 top-2 text-xs text-gray-500">
                검색 중...
              </div>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-orange-500 text-white font-bold rounded-md hover:bg-orange-400 transition duration-300 whitespace-nowrap"
          >
            검색
          </button>
        </form>

        {/* 음식 리스트 */}
        <div className="max-w-3xl mx-auto">
          <ul className="list-none p-0 m-0 bg-white border border-gray-300 rounded-md">
            {loadingList ? (
              <li className="px-4 py-6 text-center text-gray-500">
                불러오는 중...
              </li>
            ) : foods.length === 0 ? (
              <li className="px-4 py-6 text-center text-gray-500">
                결과가 없습니다.
              </li>
            ) : (
              foods.map((food) => (
                <li
                  key={
                    food.id ??
                    food.food_name ??
                    food.RCP_SEQ ??
                    food.RCP_NM ??
                    Math.random()
                  }
                  onClick={() => handleFoodClick(food)}
                  className="px-4 py-3 border-b border-gray-200 text-gray-800 text-[15px] cursor-pointer hover:bg-yellow-100 transition duration-200 last:border-b-0"
                >
                  {food.food_name ?? food.RCP_NM ?? food.name}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* AI 추천 버튼 */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 bg-orange-500 text-white p-4 rounded-full text-2xl shadow-lg hover:bg-orange-400 transition"
        title="메뉴 추천"
      >
        📃
      </button>

      {/* 채팅창 */}
      {showChat && (
        <div className="fixed bottom-20 right-6 w-80 bg-white border border-gray-300 rounded-2xl shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-orange-500">
              메뉴 추천 AI
            </h3>
            <button
              onClick={resetChat}
              className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50"
              title="대화 초기화"
            >
              초기화
            </button>
          </div>

          <div
            ref={chatBodyRef}
            className="h-64 overflow-y-auto mb-3 border border-gray-200 rounded-lg p-2 bg-yellow-50 text-sm whitespace-pre-wrap"
          >
            {chatLog.length === 0 && (
              <div className="text-gray-500 text-sm">
                원하는 말을 입력해보세요.
                <br />
                예: “얼큰한 국물”, “해장”, “느끼한 거”, “고단백”
              </div>
            )}

            {chatLog.map((msg, idx) => {
              if (msg.type === "recommend") {
                return (
                  <div
                    key={`rec-${idx}`}
                    className="mb-2 text-left text-orange-700"
                  >
                    {msg.foods.map((food, i) => {
                      const name =
                        food?.name ??
                        food?.food_name ??
                        food?.RCP_NM ??
                        food?.title ??
                        "";

                      const seq = food?.RCP_SEQ ?? food?.rcp_seq ?? null;

                      return (
                        <div
                          key={`${seq ?? name}-${i}`}
                          className="mb-2 p-2 border border-orange-200 rounded-lg bg-white"
                        >
                          <div className="font-semibold text-sm mb-1">
                            {i + 1}. {name || "이름 없음"}
                          </div>

                          <div className="flex gap-2">
                            <button
                              className="text-xs px-2 py-1 rounded-md border border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() => {
                                if (seq) {
                                  navigate(
                                    `/recipes/seq/${encodeURIComponent(seq)}`
                                  );
                                  return;
                                }
                                goRecipeByName(name);
                              }}
                            >
                              레시피 보기
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div
                  key={`msg-${idx}`}
                  className={`mb-2 ${
                    msg.sender === "user"
                      ? "text-right"
                      : "text-left text-orange-700"
                  }`}
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-lg ${
                      msg.sender === "user"
                        ? "bg-orange-500 text-white"
                        : "bg-white border border-orange-300"
                    }`}
                  >
                    {msg.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDownChat}
              placeholder="먹고 싶은 음식을 입력하세요"
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
              disabled={sending}
            />
            <button
              onClick={handleSendMessage}
              disabled={sending}
              className={`px-3 py-1 rounded-lg text-sm ${
                sending
                  ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                  : "bg-orange-500 text-white hover:bg-orange-400"
              }`}
            >
              {sending ? "전송중" : "전송"}
            </button>
          </div>
        </div>
      )}

      {/* 레시피 선택 모달 */}
      {showPickModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
          <div className="w-[420px] max-w-[90vw] bg-white rounded-2xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-orange-600">
                레시피 선택
              </h3>
              <button
                className="text-sm px-2 py-1 border rounded-md"
                onClick={() => {
                  setShowPickModal(false);
                  setRecipeCandidates([]);
                }}
              >
                닫기
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto space-y-2">
              {recipeCandidates.map((r) => (
                <button
                  key={r.RCP_SEQ}
                  className="w-full text-left border rounded-xl p-3 hover:bg-orange-50"
                  onClick={() => {
                    setShowPickModal(false);
                    setRecipeCandidates([]);
                    navigate(`/recipes/seq/${encodeURIComponent(r.RCP_SEQ)}`);
                  }}
                >
                  <div className="font-semibold">{r.RCP_NM}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {r.RCP_WAY2 ? `조리방법: ${r.RCP_WAY2}` : ""}
                    {r.RCP_PAT2 ? ` · 종류: ${r.RCP_PAT2}` : ""}
                    {r.INFO_ENG ? ` · ${r.INFO_ENG}kcal` : ""}
                  </div>
                  {r.HASH_TAG && (
                    <div className="text-xs text-gray-500 mt-1">
                      {r.HASH_TAG}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Mainpage;
