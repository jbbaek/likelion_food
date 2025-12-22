import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config"; 

function FoodDetail() {
  const { id } = useParams();
  const [food, setFood] = useState(null);

  useEffect(() => {
    const fetchFoodDetail = async () => {
      const res = await axios.get(`${API_BASE}/api/foods/${id}`, {
        withCredentials: true, // 세션 기반이면 안전
      });
      setFood(res.data);
    };
    fetchFoodDetail();
  }, [id]);

  if (!food)
    return <p className="text-center mt-10 text-gray-600">불러오는 중...</p>;

  return (
    <div className="bg-white p-8 rounded-2xl max-w-5xl mx-auto my-8 font-sans">
      <div className="flex justify-center items-center bg-orange-600 text-white text-lg font-bold py-5 rounded-lg mb-8">
        <h2 className="mr-4 text-2xl">{food.food_name}</h2>
        <span className="text-3xl">{food.energy_kcal} kcal</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          탄수화물: {food.carbohydrate_g} g
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          단백질: {food.protein_g} g
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          지방: {food.fat_g} g
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          당류: {food.sugar_g} g
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          나트륨: {food.sodium_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          칼슘: {food.calcium_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          철분: {food.iron_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          칼륨: {food.potassium_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          비타민 A: {food.vitamin_a_ug} µg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          비타민 C: {food.vitamin_c_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          비타민 D: {food.vitamin_d_ug} µg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          콜레스테롤: {food.cholesterol_mg} mg
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          포화지방: {food.saturated_fat_g} g
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 text-center text-lg font-semibold text-gray-800 shadow-sm">
          트랜스지방: {food.trans_fat_g} g
        </div>
      </div>
    </div>
  );
}

export default FoodDetail;
