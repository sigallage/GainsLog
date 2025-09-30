import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Function to clean workout text from markdown formatting and add proper spacing
function cleanWorkoutText(text) {
  return text
    .replace(/#{1,6}\s*/g, '') 
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') 
    .replace(/^\s*[\*\-•]\s+/gm, '') 
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu, '') 
    .replace(/🏋️|🔥|💪|🧘|🦵|🔙|😊/g, '') // Remove specific emojis as fallback
    .replace(/^\s+/gm, '') 
    .replace(/(Day \d+:)/g, '\n\n$1') // Add spacing before each day
    .replace(/(Warm-up|Cool-down|Rest):/gi, '\n$1:') // Add spacing before major sections
    .replace(/(\d+ sets? of \d+)/g, '\n  $1') // Indent exercise details
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .trim();
}

// Alternative free AI providers
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL; // Optional: For self-hosted models

router.post('/generate', async (req, res) => {
  const { level = 'beginner', experience = '4', workoutType = 'strength' } = req.body;

  // 1. First try Hugging Face with reduced timeout for faster fallback
  try {
    const hfResponse = await axios.post(
      'https://api-inference.huggingface.co/pipeline/text-generation/mistralai/Mistral-7B-Instruct-v0.1',
      {
        inputs: `[INST] Create a ${level} ${workoutType} workout for ${experience} weeks experience [/INST]`,
        parameters: { max_new_tokens: 500 }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000  // Reduced timeout for faster fallback
      }
    );
    
    if (hfResponse.data?.generated_text) {
      return res.json({
        source: 'huggingface',
        workout: cleanWorkoutText(hfResponse.data.generated_text)
      });
    }
  } catch (hfError) {
    console.log('Hugging Face failed:', hfError.message);
  }

  // 2. Fallback to OpenRouter.ai
  try {
    const orResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          {
            role: 'user',
            content: `Generate a ${level} ${workoutType} workout for ${experience} weeks experience`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000  // Reduced timeout for faster fallback
      }
    );

    if (orResponse.data?.choices?.[0]?.message?.content) {
      return res.json({
        source: 'openrouter',
        workout: cleanWorkoutText(orResponse.data.choices[0].message.content)
      });
    }
  } catch (orError) {
    console.log('OpenRouter failed:', orError.message);
  }

  // 3. Final fallback - Local LLM or hardcoded response
  try {
    if (LOCAL_LLM_URL) {
      const localResponse = await axios.post(
        LOCAL_LLM_URL,
        {
          prompt: `WORKOUT PROMPT: ${level} ${workoutType} ${experience} weeks`
        },
        { timeout: 5000 }
      );
      return res.json({
        source: 'local_llm',
        workout: cleanWorkoutText(localResponse.data?.result || 'Local model response empty')
      });
    }
  } catch (localError) {
    console.log('Local LLM failed:', localError.message);
  }

  // Ultimate fallback - Comprehensive hardcoded workouts
  const fallbackWorkouts = {
    beginner: {
      'full body': `🏋️ BEGINNER FULL BODY WORKOUT

🔥 Warm-up (5 mins):
• Light cardio - 2 mins
• Arm circles - 30 sec each direction
• Body weight squats - 10 reps
• Jumping jacks - 1 min

� Main Workout:
1. Push-ups (modified if needed) - 3 sets x 8-12 reps
2. Bodyweight squats - 3 sets x 12-15 reps
3. Lunges (each leg) - 3 sets x 8-10 reps
4. Plank hold - 3 sets x 20-30 seconds
5. Dumbbell rows (or resistance band) - 3 sets x 10-12 reps

🧘 Cool down (5 mins):
• Hamstring stretch - 30 sec each leg
• Chest stretch - 30 sec
• Shoulder stretch - 30 sec each arm
• Deep breathing - 2 mins`,
      
      'leg day': `🦵 BEGINNER LEG DAY

🔥 Warm-up:
• Light walking - 3 mins
• Leg swings - 10 each direction
• Bodyweight squats - 10 reps

💪 Main Workout:
1. Goblet squats - 3 sets x 12-15 reps
2. Romanian deadlifts (light weight) - 3 sets x 10-12 reps
3. Walking lunges - 3 sets x 10 each leg
4. Calf raises - 3 sets x 15-20 reps
5. Wall sit - 3 sets x 20-30 seconds`,
      
      'chest day': `💪 BEGINNER CHEST DAY

🔥 Warm-up:
• Arm circles - 1 min
• Light shoulder rolls - 30 sec
• Push-up prep stretches - 2 mins

💪 Main Workout:
1. Push-ups (modified if needed) - 3 sets x 8-12 reps
2. Incline push-ups (on bench/step) - 3 sets x 10-15 reps
3. Chest press with dumbbells - 3 sets x 10-12 reps
4. Chest flyes (light weight) - 3 sets x 10-12 reps`,
      
      'back & biceps': `🔙 BEGINNER BACK & BICEPS

💪 Main Workout:
1. Bent-over dumbbell rows - 3 sets x 10-12 reps
2. Lat pulldowns (or assisted pull-ups) - 3 sets x 8-10 reps
3. Bicep curls - 3 sets x 12-15 reps
4. Hammer curls - 3 sets x 10-12 reps
5. Reverse flyes - 3 sets x 12-15 reps`,
      
      'shoulders & triceps': `� BEGINNER SHOULDERS & TRICEPS

💪 Main Workout:
1. Overhead press (light weight) - 3 sets x 10-12 reps
2. Lateral raises - 3 sets x 12-15 reps
3. Front raises - 3 sets x 10-12 reps
4. Tricep dips (assisted) - 3 sets x 8-10 reps
5. Tricep extensions - 3 sets x 10-12 reps`
    },
    
    intermediate: {
      'full body': `🏋️ INTERMEDIATE FULL BODY WORKOUT

💪 Main Workout:
1. Barbell squats - 4 sets x 8-10 reps
2. Bench press - 4 sets x 8-10 reps
3. Bent-over rows - 4 sets x 8-10 reps
4. Overhead press - 3 sets x 10-12 reps
5. Romanian deadlifts - 3 sets x 10-12 reps
6. Pull-ups/chin-ups - 3 sets x 6-10 reps
7. Plank - 3 sets x 45-60 seconds`,
      
      'leg day': `🦵 INTERMEDIATE LEG DAY

💪 Main Workout:
1. Back squats - 4 sets x 8-10 reps
2. Romanian deadlifts - 4 sets x 8-10 reps
3. Bulgarian split squats - 3 sets x 10 each leg
4. Hip thrusts - 3 sets x 12-15 reps
5. Walking lunges - 3 sets x 12 each leg
6. Calf raises - 4 sets x 15-20 reps`
    },
    
    advanced: {
      'full body': `🏋️ ADVANCED FULL BODY WORKOUT

💪 Main Workout:
1. Deadlifts - 5 sets x 5 reps
2. Bench press - 4 sets x 6-8 reps
3. Pull-ups (weighted if possible) - 4 sets x 8-12 reps
4. Overhead press - 4 sets x 6-8 reps
5. Barbell rows - 4 sets x 8-10 reps
6. Front squats - 4 sets x 8-10 reps
7. Dips - 3 sets x 10-15 reps`
    }
  };

  // Get workout based on level and type, with intelligent fallbacks
  let selectedWorkout = fallbackWorkouts[level]?.[workoutType] || 
                       fallbackWorkouts[level]?.[Object.keys(fallbackWorkouts[level])[0]] ||
                       fallbackWorkouts.beginner['full body'];

  res.json({
    source: 'fallback',
    workout: cleanWorkoutText(selectedWorkout),
    message: 'AI services unavailable, using curated workout plan'
  });
});

export default router;