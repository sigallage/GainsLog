import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Clean recipe text by removing unwanted formatting
const cleanRecipeText = (text) => {
  if (!text) return "Recipe generation failed. Please try again.";
  
  return text
    .replace(/<s>|<\/s>/g, '') // Remove model start/end tokens
    .replace(/\[B_INST\]|\[\/B_INST\]/g, '') // Remove instruction tokens
    .replace(/\[INST\]|\[\/INST\]/g, '') // Remove instruction tokens
    .replace(/[#*•]/g, '') // Remove markdown characters
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s+/g, '\n') // Clean up line breaks
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\n{3,}/g, '\n\n'); // Limit multiple line breaks to double
};

// API Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL;

// Country Ingredient Database (fallback)
const COUNTRY_INGREDIENTS = {
  italy: ["tomatoes", "olive oil", "pasta", "basil", "garlic"],
  japan: ["rice", "soy sauce", "fish", "seaweed", "ginger"],
  mexico: ["corn", "beans", "chili peppers", "avocado", "lime"],
  // Add more countries as needed
};

// Fallback recipes database
const FALLBACK_RECIPES = {
  vegetarian: {
    italy: `Classic Italian Caprese Salad

Ingredients:
- 4 large tomatoes, sliced
- 8 oz fresh mozzarella, sliced
- 1/4 cup fresh basil leaves
- 3 tbsp extra virgin olive oil
- 2 tbsp balsamic vinegar
- Salt and pepper to taste

Instructions:
1. Arrange tomato and mozzarella slices alternately on a plate
2. Tuck basil leaves between slices
3. Drizzle with olive oil and balsamic vinegar
4. Season with salt and pepper
5. Let sit for 10 minutes before serving

Nutrition: Approximately 280 calories, 18g protein, 8g carbs, 20g fat`,
    japan: `Japanese Vegetable Tempura

Ingredients:
- 1 cup all-purpose flour
- 1 cup ice-cold water
- 1 egg yolk
- 2 cups mixed vegetables (zucchini, sweet potato, bell pepper)
- Oil for frying
- Tempura dipping sauce

Instructions:
1. Mix flour, cold water, and egg yolk lightly (don't overmix)
2. Heat oil to 340°F
3. Dip vegetables in batter and fry until golden
4. Drain on paper towels
5. Serve immediately with dipping sauce

Nutrition: Approximately 320 calories, 8g protein, 45g carbs, 12g fat`,
    default: `Healthy Vegetable Stir Fry

Ingredients:
- 2 cups mixed vegetables (broccoli, carrots, bell peppers)
- 2 cloves garlic, minced
- 1 tbsp ginger, minced
- 2 tbsp soy sauce
- 1 tbsp sesame oil
- 1 tbsp vegetable oil
- 1 tsp cornstarch
- Cooked rice for serving

Instructions:
1. Heat vegetable oil in a wok or large pan
2. Add garlic and ginger, stir-fry for 30 seconds
3. Add vegetables and stir-fry for 3-4 minutes
4. Mix soy sauce, sesame oil, and cornstarch
5. Add sauce to vegetables and cook for 1 minute
6. Serve over rice

Nutrition: Approximately 250 calories, 6g protein, 35g carbs, 10g fat`
  },
  vegan: {
    mexico: `Mexican Black Bean Tacos

Ingredients:
- 8 corn tortillas
- 2 cups black beans, cooked
- 1 avocado, sliced
- 1 cup diced tomatoes
- 1/2 cup red onion, diced
- 1/4 cup cilantro, chopped
- 2 limes, juiced
- 1 tsp cumin
- Salt and pepper to taste

Instructions:
1. Warm tortillas in a dry pan
2. Season black beans with cumin, salt, and pepper
3. Fill tortillas with beans
4. Top with tomatoes, onion, avocado, and cilantro
5. Squeeze lime juice over tacos
6. Serve immediately

Nutrition: Approximately 290 calories, 12g protein, 52g carbs, 8g fat`,
    default: `Protein-Rich Chickpea Curry

Ingredients:
- 2 cups cooked chickpeas
- 1 can coconut milk
- 1 onion, diced
- 3 cloves garlic, minced
- 1 tbsp ginger, minced
- 2 tsp curry powder
- 1 tsp turmeric
- 1 can diced tomatoes
- 2 tbsp vegetable oil
- Salt to taste
- Cooked rice for serving

Instructions:
1. Heat oil in a large pot
2. Sauté onion until soft, add garlic and ginger
3. Add curry powder and turmeric, cook for 1 minute
4. Add tomatoes and chickpeas
5. Pour in coconut milk and simmer for 15 minutes
6. Season with salt and serve over rice

Nutrition: Approximately 380 calories, 15g protein, 48g carbs, 16g fat`
  },
  bulking: {
    default: `High-Protein Chicken and Rice Bowl

Ingredients:
- 8 oz chicken breast, diced
- 1 cup brown rice, cooked
- 1/2 cup quinoa, cooked
- 2 tbsp olive oil
- 1 cup mixed vegetables
- 2 eggs, scrambled
- 1/4 cup nuts or seeds

Instructions:
1. Cook chicken in olive oil until done
2. Scramble eggs in the same pan
3. Mix cooked rice and quinoa
4. Steam vegetables
5. Combine all ingredients in a bowl
6. Top with nuts or seeds

Nutrition: Approximately 750 calories, 45g protein, 65g carbs, 25g fat`
  },
  cutting: {
    default: `Low-Calorie Grilled Fish with Vegetables

Ingredients:
- 6 oz white fish fillet
- 2 cups mixed vegetables (zucchini, broccoli, bell peppers)
- 1 tbsp olive oil
- 2 cloves garlic, minced
- 1 lemon, juiced
- Herbs (thyme, rosemary)
- Salt and pepper to taste

Instructions:
1. Season fish with herbs, salt, and pepper
2. Grill fish for 4-5 minutes each side
3. Steam vegetables until tender
4. Sauté garlic in olive oil
5. Toss vegetables with garlic oil and lemon juice
6. Serve fish with vegetables

Nutrition: Approximately 280 calories, 35g protein, 12g carbs, 8g fat`
  },
  maintenance: {
    default: `Balanced Salmon and Sweet Potato Meal

Ingredients:
- 5 oz salmon fillet
- 1 medium sweet potato, cubed
- 2 cups spinach
- 1 tbsp olive oil
- 1 tsp herbs (dill, parsley)
- Salt and pepper to taste

Instructions:
1. Roast sweet potato cubes with half the olive oil
2. Season salmon with herbs, salt, and pepper
3. Pan-sear salmon for 4 minutes each side
4. Wilt spinach with remaining oil
5. Serve salmon with sweet potato and spinach

Nutrition: Approximately 450 calories, 32g protein, 28g carbs, 20g fat`
  }
};

// Get country ingredients (improved)
const getCountryIngredients = (country) => {
  const normalizedCountry = country.toLowerCase();
  return COUNTRY_INGREDIENTS[normalizedCountry] || ["local vegetables", "spices", "staple grains"];
};

// Generate using OpenRouter
const generateWithOpenRouter = async (prompt) => {
  if (!OPENROUTER_API_KEY) {
    console.log("OpenRouter API key not configured");
    return null;
  }

  try {
    console.log("Making OpenRouter API request...");
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 25000
      }
    );
    
    const content = response.data?.choices?.[0]?.message?.content;
    console.log("OpenRouter response received:", content ? "Success" : "Empty");
    return cleanRecipeText(content);
  } catch (error) {
    console.error("OpenRouter error:", error.response?.data || error.message);
    return null;
  }
};

// Recipe Generator Route
router.post("/generate", async (req, res) => {
  try {
    const { dietType = "vegetarian", country = "italy" } = req.body;
    console.log(`Generating ${dietType} recipe for ${country}`);

    const ingredients = getCountryIngredients(country).join(", ");

    const prompt = `Create a detailed ${dietType} recipe from ${country} using mainly: ${ingredients}.
    
    Format the response as:
    Dish Name: [name]
    
    Ingredients:
    - [ingredient 1 with measurement]
    - [ingredient 2 with measurement]
    
    Instructions:
    1. [step 1]
    2. [step 2]
    
    Nutrition: [calories, protein, carbs, fat]`;

    // Try OpenRouter first
    try {
      console.log("Trying OpenRouter API...");
      const aiRecipe = await generateWithOpenRouter(prompt);
      if (aiRecipe && aiRecipe.trim()) {
        console.log("OpenRouter API successful");
        return res.json({
          source: "openrouter",
          recipe: cleanRecipeText(aiRecipe)
        });
      }
      console.log("OpenRouter returned empty response");
    } catch (error) {
      console.log("OpenRouter failed:", error.message);
    }

    // Fallback to local LLM if configured
    if (LOCAL_LLM_URL) {
      try {
        console.log("Trying Local LLM...");
        const response = await axios.post(
          LOCAL_LLM_URL,
          { prompt },
          { timeout: 20000 }
        );
        if (response.data?.result && response.data.result.trim()) {
          console.log("Local LLM successful");
          return res.json({
            source: "local_llm",
            recipe: cleanRecipeText(response.data.result)
          });
        }
        console.log("Local LLM returned empty response");
      } catch (error) {
        console.log("Local LLM failed:", error.message);
      }
    }

    // Ultimate fallback to hardcoded recipes
    console.log("Using fallback recipe");
    const fallbackRecipe = 
      FALLBACK_RECIPES[dietType]?.[country.toLowerCase()] || 
      FALLBACK_RECIPES[dietType]?.default || 
      FALLBACK_RECIPES.vegetarian.default;

    res.json({
      source: "fallback",
      recipe: cleanRecipeText(fallbackRecipe)
    });

  } catch (error) {
    console.error("Recipe generation error:", error);
    res.status(500).json({
      error: "Failed to generate recipe",
      message: error.message
    });
  }
});

export default router;