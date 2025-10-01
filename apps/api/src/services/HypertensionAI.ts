import ollama from "ollama";
import mongoose from "mongoose";
import HypertensionLifestyle, { ILifestyle } from "../models/hypertensionLifestyle";
import HypertensionVital from "../models/hypertensionVitals";

// Function to generate daily alerts from recent vitals
async function getDailyAlerts(userId: string): Promise<string[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const vitals = await HypertensionVital.find({
    userId: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: today, $lt: tomorrow }
  })
    .sort({ createdAt: -1 })
    .limit(5);

  const alerts: string[] = [];
  vitals.forEach(vital => {
    if (vital.systolic >= 140) {
      alerts.push(`High systolic BP: ${vital.systolic} mmHg`);
    }
    if (vital.diastolic >= 90) {
      alerts.push(`High diastolic BP: ${vital.diastolic} mmHg`);
    }
    if (vital.heartRate > 100) {
      alerts.push(`Elevated heart rate: ${vital.heartRate} bpm`);
    }
  });

  if (alerts.length === 0) {
    alerts.push("No alerts today - vitals stable");
  }

  return alerts;
}

// Function to get current lifestyle
async function getCurrentLifestyle(userId: string) {
  const lifestyle = await HypertensionLifestyle.findOne({
    userId: new mongoose.Types.ObjectId(userId)
  })
    .sort({ createdAt: -1 })
    .exec();

  return lifestyle
    ? {
        smoking: lifestyle.smoking,
        alcohol: lifestyle.alcohol,
        exercise: lifestyle.exercise,
        sleep: lifestyle.sleep
      }
    : {
        smoking: "None",
        alcohol: "None",
        exercise: "None",
        sleep: "Irregular"
      };
}

// Main function to generate AI lifestyle recommendations
export async function generateLifestyleRecommendations(
  userId: string,
  weather?: string
): Promise<{ advice: string; alerts: string[]; warnings: string[] }> {
  try {
    const alerts = await getDailyAlerts(userId);
    const lifestyle = await getCurrentLifestyle(userId);

    // Enhanced prompt for better structured output
    const prompt = `You are a hypertension management AI assistant. Provide personalized lifestyle recommendations based on the following patient data:

📊 DAILY VITALS ALERTS:
${alerts.join("\n")}

🏃 CURRENT LIFESTYLE:
- Smoking: ${lifestyle.smoking}
- Alcohol: ${lifestyle.alcohol}
- Exercise: ${lifestyle.exercise}
- Sleep: ${lifestyle.sleep}

🌤️ WEATHER: ${weather || "Not provided"}

Please provide recommendations in the following structured format:

GENERAL ADVICE:
Provide 2-3 sentences of encouraging, personalized advice addressing their current situation. Be empathetic and motivating.

IMMEDIATE ACTIONS:
List specific actions they should take today based on their vitals.

LIFESTYLE IMPROVEMENTS:
Suggest concrete changes to smoking, alcohol, exercise, or sleep habits if any are risky for hypertension.

WEATHER CONSIDERATIONS:
If weather data is available, provide weather-specific tips (e.g., indoor exercise on hot days, hydration reminders).

Keep the response concise, actionable, and encouraging. Focus on what they CAN do rather than just restrictions.`;

    // Call Ollama
    const response = await ollama.generate({
      model: "llama3.2:3b",
      prompt: prompt,
      stream: false
    });

    const rawAdvice = response.response;

    // Parse and structure the advice
    const structuredAdvice = parseAndStructureAdvice(rawAdvice, lifestyle, alerts);

    // Extract warnings based on lifestyle and vitals
    const warnings = extractWarnings(lifestyle, alerts);

    // Update lifestyle with aiAdvice and warnings
    const updatedLifestyle = await HypertensionLifestyle.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { aiAdvice: structuredAdvice, warnings },
      { new: true, upsert: true }
    ).exec();

    if (updatedLifestyle) {
      console.log("✅ Lifestyle updated with AI advice");
    }

    return { advice: structuredAdvice, alerts, warnings };
  } catch (error) {
    console.error("❌ Error generating recommendations:", error);
    return {
      advice: getFallbackAdvice(),
      alerts: await getDailyAlerts(userId),
      warnings: []
    };
  }
}

// Helper function to parse and structure the AI advice
function parseAndStructureAdvice(rawAdvice: string, lifestyle: any, alerts: string[]): string {
  // Clean up the advice and add emoji/formatting
  let structured = rawAdvice;

  // Add section headers with emojis if not present
  if (!structured.includes("GENERAL ADVICE")) {
    structured = `💡 PERSONALIZED INSIGHTS:\n\n${structured}`;
  }

  // Format sections with better visual hierarchy
  structured = structured
    .replace(/GENERAL ADVICE:/gi, "💡 KEY INSIGHTS:")
    .replace(/IMMEDIATE ACTIONS:/gi, "\n🎯 TODAY'S ACTION PLAN:")
    .replace(/LIFESTYLE IMPROVEMENTS:/gi, "\n🌟 LIFESTYLE GOALS:")
    .replace(/WEATHER CONSIDERATIONS:/gi, "\n🌤️ WEATHER TIPS:");

  return structured;
}

// Helper function to extract warnings based on lifestyle and vitals
function extractWarnings(lifestyle: any, alerts: string[]): string[] {
  const warnings: string[] = [];

  // Check for risky lifestyle combinations
  if (lifestyle.smoking === "Heavy" && alerts.some(a => a.includes("High"))) {
    warnings.push("Smoking combined with elevated BP significantly increases cardiovascular risk");
  }

  if (lifestyle.alcohol === "Frequently" && alerts.some(a => a.includes("High"))) {
    warnings.push("Frequent alcohol consumption may be contributing to high blood pressure");
  }

  if (lifestyle.exercise === "None" || lifestyle.exercise === "Rarely") {
    warnings.push("Lack of physical activity increases hypertension risk - start with 10-minute walks");
  }

  if (lifestyle.sleep === "<5 hrs" || lifestyle.sleep === "Irregular") {
    warnings.push("Poor sleep quality can elevate blood pressure - aim for 7-8 hours nightly");
  }

  // Check for multiple high readings
  const highBPAlerts = alerts.filter(a => a.includes("High systolic") || a.includes("High diastolic"));
  if (highBPAlerts.length >= 2) {
    warnings.push("Multiple elevated readings detected - consider consulting your healthcare provider");
  }

  return warnings;
}

// Fallback advice if AI generation fails
function getFallbackAdvice(): string {
  return `💡 KEY INSIGHTS:

We're here to support your heart health journey. While we couldn't generate personalized AI recommendations right now, here are some foundational tips to keep you on track.

🎯 TODAY'S ACTION PLAN:
• Monitor your blood pressure at consistent times each day
• Stay hydrated with 6-8 glasses of water
• Take any prescribed medications as directed
• Practice 5-10 minutes of deep breathing or meditation

🌟 LIFESTYLE GOALS:
• Reduce sodium intake to less than 2,300mg daily
• Aim for 30 minutes of moderate exercise most days
• Prioritize 7-8 hours of quality sleep
• Limit alcohol and avoid smoking

Remember: Small, consistent changes lead to significant improvements. You've got this! 💪`;
}

// Function to update patient's lifestyle based on choices
export async function updateLifestyle(
  userId: string,
  updates: {
    alcohol?: string;
    smoking?: string;
    exercise?: string;
    sleep?: string;
  }
): Promise<ILifestyle | null> {
  try {
    // Validate enums
    const validAlcohol = ["None", "Occasionally", "Frequently"];
    const validSmoking = ["None", "Light", "Heavy"];
    const validExercise = ["Daily", "Few times/week", "Rarely", "None"];
    const validSleep = ["<5 hrs", "6-7 hrs", "7-8 hrs", ">8 hrs", "Irregular"];

    if (updates.alcohol && !validAlcohol.includes(updates.alcohol)) {
      throw new Error("Invalid alcohol value");
    }
    if (updates.smoking && !validSmoking.includes(updates.smoking)) {
      throw new Error("Invalid smoking value");
    }
    if (updates.exercise && !validExercise.includes(updates.exercise)) {
      throw new Error("Invalid exercise value");
    }
    if (updates.sleep && !validSleep.includes(updates.sleep)) {
      throw new Error("Invalid sleep value");
    }

    const updated = await HypertensionLifestyle.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { ...updates, updatedAt: new Date() },
      { new: true, upsert: true }
    ).exec();

    // Regenerate advice after update
    if (updated) {
      console.log("🔄 Regenerating AI advice after lifestyle update...");
      await generateLifestyleRecommendations(userId, undefined);
    }

    return updated;
  } catch (error) {
    console.error("❌ Error updating lifestyle:", error);
    return null;
  }
}