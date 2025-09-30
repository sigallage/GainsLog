import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import "./recipeGenerator.css";

const AUTH0_AUDIENCE = "gains-log-api";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AIRecipeGenerator = () => {
  const { 
    isAuthenticated, 
    getAccessTokenSilently,
    loginWithRedirect,
    logout 
  } = useAuth0();

  const [dietType, setDietType] = useState("bulking");
  const [country, setCountry] = useState("");
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-detect user's country
  useEffect(() => {
    const fetchUserCountry = async () => {
      try {
        const response = await axios.get("https://ipapi.co/json/");
        setCountry(response.data.country_name);
      } catch (error) {
        console.error("Error fetching country:", error);
        setCountry("International");
      }
    };
    fetchUserCountry();
  }, []);

  const generateRecipe = async () => {
    if (!isAuthenticated) {
      await loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        authorizationParams: {
          prompt: "login",
          scope: "openid profile email write:recipes offline_access",
          audience: AUTH0_AUDIENCE
        }
      });
      return;
    }

    setLoading(true);
    setRecipe("");
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: AUTH0_AUDIENCE,
          scope: "openid profile email write:recipes offline_access"
        },
        timeout: 5000,
        detailedResponse: true
      }).catch(async (error) => {
        console.error("Token error:", error);
        if (error.error === "login_required" || error.error === "missing_refresh_token") {
          await loginWithRedirect({
            appState: { returnTo: window.location.pathname },
            authorizationParams: {
              prompt: "login",
              scope: "openid profile email write:recipes offline_access",
              audience: AUTH0_AUDIENCE
            }
          });
        }
        throw error;
      });

      const prompt = `Generate a ${dietType} recipe with ${country} influences`;
      
      const response = await axios.post(`${API_URL}/api/airecipes/generate`, {
        dietType,
        country,
        prompt,
        modelUsed: "gpt-3.5-turbo"
      }, {
        headers: {
          Authorization: `Bearer ${typeof token === 'object' ? token.access_token : token}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });

      setRecipe(response.data.recipe);
    } catch (error) {
      console.error("Error generating recipe:", error);
      if (error.error === "invalid_grant" || error.error_description?.includes("Refresh token expired")) {
        setError("Session expired. Please login again.");
        logout({ returnTo: window.location.origin });
      } else {
        setError(
          error.response?.data?.message ||
          error.message ||
          "Failed to generate recipe. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-recipe-generator">
      <h2>🍽️ AI-Powered Recipe Generator</h2>

      <label>Diet Type:</label>
      <select value={dietType} onChange={(e) => setDietType(e.target.value)}>
        <option value="bulking">Bulking</option>
        <option value="cutting">Cutting</option>
        <option value="maintenance">Maintenance</option>
        <option value="vegetarian">Vegetarian</option>
        <option value="vegan">Vegan</option>
      </select>

      <label>Country/Cuisine:</label>
      <input 
        type="text" 
        value={country} 
        onChange={(e) => setCountry(e.target.value)}
        placeholder="Enter cuisine type or leave for auto-detected"
      />

      <button onClick={generateRecipe} disabled={loading}>
        {loading ? "Generating..." : "Get AI Recipe"}
      </button>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
          {error.includes("Session expired") && (
            <button onClick={() => logout({ returnTo: window.location.origin })}>
              Login Again
            </button>
          )}
        </div>
      )}

      {recipe && (
        <div className="recipe-output">
          <h3>🧑‍🍳 Your Custom Recipe:</h3>
          <pre>{recipe}</pre>
        </div>
      )}
    </div>
  );
};

export default AIRecipeGenerator;