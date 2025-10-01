"use client";

import React, { Dispatch, SetStateAction } from "react";
import { Wine, Cigarette, Coffee, TriangleAlert, CheckCircle } from "lucide-react";
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type LifestyleData = {
  alcohol: boolean;
  smoking: boolean;
  caffeine: number;
  exercise: "" | "none" | "low" | "moderate" | "high";
};

interface TodayVitals {
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
}

interface AiRecommendations {
  advice: string;
  alerts: string[];
  warnings: string[];
}

interface LifestyleAssessmentProps {
  lifestyle: LifestyleData;
  onLifestyleChange: Dispatch<SetStateAction<LifestyleData>>;
  bpLevel?: string;
  alertStatus?: "alert" | "stable" | null;
  todayVitals: TodayVitals;
  aiRecommendations: AiRecommendations;
  loadingAI: boolean;
}

function LifestyleAssessment({ lifestyle, onLifestyleChange, bpLevel, alertStatus, todayVitals, aiRecommendations, loadingAI }: LifestyleAssessmentProps) {
  function getRecommendations(level?: string, status?: "alert" | "stable" | null): string[] {
    const baseRecs = (() => {
      switch (level) {
        case 'Normal':
          return [
            'Maintain a balanced diet rich in fruits and vegetables.',
            'Continue regular physical activity.',
            'Keep stress levels in check.',
          ];
        case 'Elevated':
          return [
            'Reduce salt intake in your meals.',
            'Engage in at least 30 minutes of exercise daily.',
            'Limit alcohol and caffeine consumption.',
          ];
        case 'Stage 1 Hypertension':
          return [
            'Lower sodium intake significantly.',
            'Exercise 30–60 minutes, 5 days a week.',
            'Maintain a healthy body weight.',
            'Manage stress through relaxation or meditation.',
          ];
        case 'Stage 2 Hypertension':
          return [
            'Consult a doctor for medical evaluation.',
            'Take medication as prescribed.',
            'Adopt a DASH diet (fruits, vegetables, whole grains).',
            'Quit smoking and avoid alcohol.',
          ];
        case 'Hypertensive Crisis':
          return [
            'Seek immediate medical attention!',
            'Follow emergency medical guidance.',
            'Strictly adhere to doctor’s advice afterward.',
          ];
        case 'Low Blood Pressure':
          return [
            'Stay hydrated and drink more fluids.',
            'Eat small, frequent meals.',
            'Stand up slowly to avoid dizziness.',
          ];
        default:
          return ['No specific recommendations available.'];
      }
    })();

    const personalized: string[] = [];
    if (status === 'alert') {
      if (lifestyle.smoking) personalized.push('🚨 Alert: Quit smoking immediately to reduce hypertension risk.');
      if (lifestyle.alcohol) personalized.push('🚨 Alert: Avoid alcohol today to stabilize blood pressure.');
      if (lifestyle.caffeine > 3) personalized.push('🚨 Alert: Reduce caffeine intake below 3 cups to avoid elevating heart rate.');
      if (lifestyle.exercise === 'none' || lifestyle.exercise === '') personalized.push('🚨 Alert: Start light exercise today, like walking, to improve circulation.');
    } else if (status === 'stable') {
      if (lifestyle.smoking) personalized.push('✅ Good day: Consider reducing smoking for long-term heart health.');
      if (lifestyle.alcohol) personalized.push('✅ Stable: Limit alcohol to moderate levels.');
      if (lifestyle.caffeine > 2) personalized.push('✅ Stable: Keep caffeine to 2 cups or less for optimal BP.');
      if (lifestyle.exercise === 'low') personalized.push('✅ Stable: Aim to increase exercise to moderate frequency.');
    }

    return [...baseRecs, ...personalized];
  }

  const getAlertDisplay = () => {
    if (!alertStatus || todayVitals.systolic === null) {
      return null;
    }

    const isAlert = alertStatus === 'alert';
    const Icon = isAlert ? TriangleAlert : CheckCircle;
    const color = isAlert ? 'text-red-600' : 'text-green-600';
    const bgColor = isAlert ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';
    const title = isAlert ? 'Daily Alert Status' : 'Daily Stable Status';

    return (
      <div className={`border-l-4 ${bgColor} p-4 rounded-lg mb-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={color} size={20} />
          <h4 className={`font-semibold ${color}`}>{title}</h4>
        </div>
        <div className="text-sm text-gray-700 mb-2">
          <p><strong>Systolic:</strong> {todayVitals.systolic} mmHg</p>
          <p><strong>Diastolic:</strong> {todayVitals.diastolic} mmHg</p>
          <p><strong>Heart Rate:</strong> {todayVitals.heartRate} bpm</p>
        </div>
        <p className={`text-sm ${color}`}>
          {isAlert ? 'Monitor closely and adjust lifestyle factors.' : 'Vitals are stable today. Maintain good habits.'}
        </p>
      </div>
    );
  };

  const recommendations = getRecommendations(bpLevel, alertStatus);

  const handleUpdateLifestyle = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const payload = {
        smoking: lifestyle.smoking ? "Heavy" : "None",
        alcohol: lifestyle.alcohol ? "Frequently" : "None",
        exercise: lifestyle.exercise === "high" ? "Daily" : lifestyle.exercise === "moderate" ? "Few times/week" : lifestyle.exercise === "low" ? "Rarely" : "None",
        sleep: "7-8 hrs" // Default
      };
      const response = await axios.post(`${API_URL}/api/hypertension/lifestyle/update`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      });
      
      if (response.data) {
        // Refresh AI by calling parent function or direct fetch
        const res = await axios.get(`${API_URL}/api/hypertension/lifestyle`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        // Assume parent updates via prop, or add callback prop
        console.log('Lifestyle updated, AI refreshed');
      }
    } catch (error: any) {
      console.error("Failed to update lifestyle:", error);
    }
  };

  return (
    <div className="shadow-lg bg-white w-full max-w-4xl rounded-lg px-6 py-6 mb-6">
      {getAlertDisplay()}
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Lifestyle Assessment
        </h3>
      </div>

      {/* Lifestyle inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Substance Use */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Substance Use
          </h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={lifestyle.alcohol}
                onChange={(e) => onLifestyleChange(prev => ({ ...prev, alcohol: e.target.checked }))}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <Wine className="text-purple-600" size={16} />
              <span className="text-sm text-gray-700">
                Regular alcohol consumption
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={lifestyle.smoking}
                onChange={(e) => onLifestyleChange(prev => ({ ...prev, smoking: e.target.checked }))}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <Cigarette className="text-purple-600" size={16} />
              <span className="text-sm text-gray-700">Smoking/tobacco use</span>
            </label>
          </div>
          <button 
            onClick={handleUpdateLifestyle}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Update Habits
          </button>
        </div>

        {/* Daily Habits */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Daily Habits
          </h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Coffee className="text-purple-600" size={16} />
              <label className="text-sm text-gray-700">
                Caffeine intake (cups/day):
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={lifestyle.caffeine}
                onChange={(e) =>
                  onLifestyleChange(prev => ({ ...prev, caffeine: parseInt(e.target.value) || 0 }))
                }
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700 mb-2 block">
                Exercise frequency:
              </label>
              <select
                value={lifestyle.exercise}
                onChange={(e) =>
                  onLifestyleChange(prev => ({ ...prev, exercise: e.target.value as LifestyleData["exercise"] }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
              >
                <option value="">Select frequency</option>
                <option value="none">No exercise</option>
                <option value="low">1-2 times per week</option>
                <option value="moderate">3-4 times per week</option>
                <option value="high">5+ times per week</option>
              </select>
            </div>
          </div>
          <button 
            onClick={handleUpdateLifestyle}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Update Habits
          </button>
        </div>
      </div>

      
      {/* AI Recommendations */}
     {/* AI Recommendations */}
      {loadingAI ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-700 font-medium">Loading AI recommendations...</p>
          </div>
        </div>
      ) : aiRecommendations.advice ? (
        <div className="space-y-4 mb-6">
          {/* Main Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-bold text-xl text-gray-900">AI Lifestyle Insights</h3>
          </div>

          {(() => {
            const parseAIAdvice = (advice: string) => {
              const sections = {
                keyInsights: '',
                actionPlan: '',
                lifestyleGoals: '',
                weatherTips: ''
              };

              // Parse sections based on emojis and headers
              const keyInsightsMatch = advice.match(/💡[^🎯🌟🌤️]*/s);
              const actionPlanMatch = advice.match(/🎯[^💡🌟🌤️]*/s);
              const lifestyleGoalsMatch = advice.match(/🌟[^💡🎯🌤️]*/s);
              const weatherTipsMatch = advice.match(/🌤️[^💡🎯🌟]*/s);

              if (keyInsightsMatch) sections.keyInsights = keyInsightsMatch[0].replace(/💡\s*(KEY INSIGHTS:|PERSONALIZED INSIGHTS:)?/i, '').trim();
              if (actionPlanMatch) sections.actionPlan = actionPlanMatch[0].replace(/🎯\s*(TODAY'S ACTION PLAN:|ACTION PLAN:)?/i, '').trim();
              if (lifestyleGoalsMatch) sections.lifestyleGoals = lifestyleGoalsMatch[0].replace(/🌟\s*(LIFESTYLE GOALS:|IMPROVEMENTS:)?/i, '').trim();
              if (weatherTipsMatch) sections.weatherTips = weatherTipsMatch[0].replace(/🌤️\s*(WEATHER TIPS:|WEATHER CONSIDERATIONS:)?/i, '').trim();

              return sections;
            };

            const sections = parseAIAdvice(aiRecommendations.advice);

            return (
              <>
                {/* Key Insights Section */}
                {sections.keyInsights && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-l-4 border-blue-500 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">💡</span>
                      <h4 className="font-bold text-blue-900 text-lg">Key Insights</h4>
                    </div>
                    <p className="text-gray-800 leading-relaxed text-sm">{sections.keyInsights}</p>
                  </div>
                )}

                {/* Today's Action Plan */}
                {sections.actionPlan && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border-l-4 border-green-500 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🎯</span>
                      <h4 className="font-bold text-green-900 text-lg">Today's Action Plan</h4>
                    </div>
                    <div className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">{sections.actionPlan}</div>
                  </div>
                )}

                {/* Lifestyle Goals */}
                {sections.lifestyleGoals && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border-l-4 border-purple-500 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🌟</span>
                      <h4 className="font-bold text-purple-900 text-lg">Lifestyle Goals</h4>
                    </div>
                    <div className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">{sections.lifestyleGoals}</div>
                  </div>
                )}

                {/* Weather Tips */}
                {sections.weatherTips && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border-l-4 border-amber-500 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🌤️</span>
                      <h4 className="font-bold text-amber-900 text-lg">Weather Tips</h4>
                    </div>
                    <p className="text-gray-800 leading-relaxed text-sm">{sections.weatherTips}</p>
                  </div>
                )}
              </>
            );
          })()}

          {/* Warnings Section */}
          {aiRecommendations.warnings.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-5 rounded-xl border-l-4 border-yellow-400 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TriangleAlert className="text-yellow-600" size={20} />
                <h4 className="font-bold text-yellow-900 text-lg">Important Warnings</h4>
              </div>
              <div className="space-y-2">
                {aiRecommendations.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-3 bg-white/70 p-3 rounded-lg">
                    <span className="text-yellow-600 font-bold text-lg mt-0.5">⚠️</span>
                    <p className="text-sm text-yellow-900 flex-1 leading-relaxed">{warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Alerts Section */}
          {aiRecommendations.alerts.length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 p-5 rounded-xl border-l-4 border-red-500 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TriangleAlert className="text-red-600" size={20} />
                <h4 className="font-bold text-red-900 text-lg">Critical Alerts</h4>
              </div>
              <div className="space-y-2">
                {aiRecommendations.alerts.map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 bg-white/70 p-3 rounded-lg">
                    <span className="text-red-600 font-bold text-lg mt-0.5">🚨</span>
                    <p className="text-sm text-red-900 flex-1 leading-relaxed">{alert}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Dynamic recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Personalized Recommendations:</h3>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {recommendations.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LifestyleAssessment;
