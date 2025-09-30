import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import "./workoutGenerator.css";

const AUTH0_AUDIENCE = "gains-log-api";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const WorkoutGenerator = () => {
  const { 
    isAuthenticated, 
    getAccessTokenSilently,
    loginWithRedirect 
  } = useAuth0();

  const [level, setLevel] = useState("beginner");
  const [experience, setExperience] = useState(0);
  const [workoutType, setWorkoutType] = useState("full body");
  const [workout, setWorkout] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateWorkout = async () => {
    if (!isAuthenticated) {
      await loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        authorizationParams: {
          prompt: "login",
          scope: "openid profile email write:workouts offline_access",
          audience: AUTH0_AUDIENCE
        }
      });
      return;
    }

    setLoading(true);
    setWorkout("");
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: AUTH0_AUDIENCE,
          scope: "write:workouts"
        },
        timeout: 5000
      }).catch(async (error) => {
        if (error.error === "login_required") {
          await loginWithRedirect({
            appState: { returnTo: window.location.pathname }
          });
        }
        throw error;
      });

      const prompt = `Generate a ${level} level ${workoutType} workout for someone with ${experience} weeks of gym experience`;
      
      const response = await axios.post(`${API_URL}/api/aiworkouts/generate`, {
        level,
        experience,
        workoutType,
        prompt,
        modelUsed: "gpt-3.5-turbo"
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 30000  // Increased to 30 seconds to allow for multiple AI service attempts
      });

      setWorkout(response.data.workout);
    } catch (error) {
      console.error("Error generating workout:", error);
      setError(
        error.response?.data?.message ||
        error.message ||
        "Failed to generate workout. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workout-generator">
      <h2>💪 AI-Powered Workout Generator</h2>

      <label>Fitness Level:</label>
      <select value={level} onChange={(e) => setLevel(e.target.value)}>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>

      <label>Weeks in Gym:</label>
      <input
        type="number"
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
        min="0"
        max="104"
      />

      <label>Workout Type:</label>
      <select value={workoutType} onChange={(e) => setWorkoutType(e.target.value)}>
        <option value="full body">Full Body</option>
        <option value="leg day">Leg Day</option>
        <option value="chest day">Chest Day</option>
        <option value="back & biceps">Back & Biceps</option>
        <option value="shoulders & triceps">Shoulders & Triceps</option>
      </select>

      <button onClick={generateWorkout} disabled={loading}>
        {loading ? "Generating your perfect workout..." : "Get Workout Plan"}
      </button>

      {loading && (
        <div className="loading-message">
          <p>Our AI is crafting your personalized workout...</p>
          <small>This may take up to 30 seconds for the best results!</small>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <small>Don't worry! Try again or check your internet connection.</small>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {workout && (
        <div className="workout-output">
          <h3>Your Workout Plan:</h3>
          <pre>{workout}</pre>
        </div>
      )}
    </div>
  );
};

export default WorkoutGenerator;