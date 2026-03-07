import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url } = await req.json()
        if (!url) throw new Error('URL is required')

        // 1. Fetch HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const html = await response.text()

        // 2. Try Structured Data (LD+JSON) extraction first (No AI)
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const jsonLdScripts = doc?.querySelectorAll('script[type="application/ld+json"]')
        let recipeData: any = null

        if (jsonLdScripts) {
            for (const script of jsonLdScripts) {
                try {
                    const content = JSON.parse(script.textContent)
                    // Handle both direct Recipe objects and @graph arrays
                    const items = Array.isArray(content) ? content : (content['@graph'] || [content])
                    const recipe = items.find((item: any) =>
                        item['@type'] === 'Recipe' ||
                        (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
                    )

                    if (recipe) {
                        recipeData = {
                            title: recipe.name,
                            description: typeof recipe.description === 'string' ? recipe.description.substring(0, 200) : '',
                            time_minutes: parseISO8601Duration(recipe.totalTime || recipe.cookTime),
                            image_url: Array.isArray(recipe.image) ? recipe.image[0] : (recipe.image?.url || recipe.image),
                            original_url: url,
                            steps: parseSteps(recipe.recipeInstructions),
                            ingredients: parseIngredientsFromSchema(recipe.recipeIngredient),
                            nutrition: recipe.nutrition ? {
                                calories: parseInt(recipe.nutrition.calories) || 0,
                                protein: parseInt(recipe.nutrition.proteinContent) || 0,
                                fat: parseInt(recipe.nutrition.fatContent) || 0,
                                carbs: parseInt(recipe.nutrition.carbohydrateContent) || 0
                            } : null
                        }
                        break
                    }
                } catch (e) {
                    console.error('Failed to parse LD+JSON', e)
                }
            }
        }

        // 3. Fallback to AI refinement
        const isSocial = /instagram\.com|tiktok\.com|youtube\.com|facebook\.com/.test(url)
        // Refine if unparsed ingredients exist (name has numbers/units)
        const unparsed = recipeData?.ingredients?.some((i: any) =>
            i.name && /\d|cup|tbsp|tsp|gram|clove|lb|oz/i.test(i.name)
        );
        const needsRefinement = !recipeData || isSocial || !recipeData.ingredients?.length || unparsed;

        // We ALWAYS use AI for social media or if we didn't get perfectly structured data
        if (needsRefinement) {
            const openaiKey = Deno.env.get('OPENAI_API_KEY')

            if (openaiKey) {
                // Focus on potential recipe content
                const cleanBody = doc?.body?.innerText || ''
                const recipeMatch = cleanBody.match(/(Ingredients|Steps|Instructions|Directions):?.*?(Directions|Instructions|Notes|Yields|$)/si)
                const bodyText = recipeMatch ? recipeMatch[0] : cleanBody.substring(0, 8000)

                const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: `You are a Senior Full-Stack Engineer and Data Extraction Specialist. 
                            Your task is to take raw recipe text and return a perfectly structured JSON.
                            
                            JSON Schema:
                            {
                                "title": "string",
                                "description": "string",
                                "time_minutes": number,
                                "image_url": "string",
                                "video_url": "string",
                                "steps": [{"text": "string", "image_url": "string"}],
                                "ingredients": [
                                    {"name": "string", "amount": "string", "unit": "string", "note": "string"}
                                ]
                            }

                            SMART PARSING RULES:
                            - NEVER leave quantity or units in the 'name' field. 
                            - "1 1/2 cups flour" -> name: "flour", amount: "1.5", unit: "cup"
                            - "Finely chopped onions (2 cups)" -> name: "onions", amount: "2", unit: "cup", note: "finely chopped"
                            - "3 cloves garlic, minced" -> name: "garlic", amount: "3", unit: "clove", note: "minced"
                            - Normalize units to: 'cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'pcs', 'pinch', 'clove', 'oz', 'lb', 'pack', 'as liked'.
                            - Use 'amount' for the number only. Convert fractions to decimals if easy, or keep as "1 1/2".`
                            },
                            {
                                role: 'user',
                                content: `Source URL: ${url}\n\nRecipe Content:\n${bodyText}`
                            }
                        ],
                        response_format: { type: "json_object" }
                    })
                })

                if (!aiResponse.ok) {
                    const errorText = await aiResponse.text();
                    console.error('OpenAI API Error:', errorText);
                    // Do not throw, allow function to return existing recipeData if AI fails
                } else {
                    const aiResult = await aiResponse.json()
                    if (aiResult.choices?.[0]?.message?.content) {
                        try {
                            const refinedRecipe = JSON.parse(aiResult.choices[0].message.content)

                            // Normalize steps to our internal format {id, text, image_url, alignment, group_name}
                            const normalizedSteps = (refinedRecipe.steps || []).map((s: any) => {
                                const base = typeof s === 'string' ? { text: s, image_url: '' } : s;
                                return {
                                    id: crypto.randomUUID(),
                                    text: base.text || '',
                                    image_url: base.image_url || '',
                                    alignment: 'full',
                                    group_name: 'Main Steps'
                                };
                            });

                            // Merge
                            recipeData = {
                                title: refinedRecipe.title || recipeData?.title || 'Imported Recipe',
                                description: refinedRecipe.description || recipeData?.description || '',
                                time_minutes: refinedRecipe.time_minutes || recipeData?.time_minutes || 30,
                                image_url: refinedRecipe.image_url || recipeData?.image_url,
                                video_url: refinedRecipe.video_url || url,
                                steps: normalizedSteps.length ? normalizedSteps : (recipeData?.steps || []),
                                ingredients: (refinedRecipe.ingredients || []).map((ing: any) => ({
                                    name: ing.name || '',
                                    amount: String(ing.amount || ''),
                                    unit: ing.unit === 'null' ? '' : (ing.unit || ''),
                                    note: ing.note || '',
                                    group_name: 'Main'
                                })) || recipeData?.ingredients || [],
                                nutrition: refinedRecipe.nutrition || recipeData?.nutrition,
                                original_url: url
                            }
                        } catch (e) {
                            console.error('Failed to parse AI JSON:', e);
                            // don't throw, maybe LD+JSON was enough
                        }
                    }
                }
            }
        }

        if (!recipeData) {
            throw new Error('Could not find recipe details on this page.')
        }

        return new Response(JSON.stringify(recipeData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

// Helper functions
function parseISO8601Duration(duration: string) {
    if (!duration) return null
    // Handles formats like PT1H30M
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return null
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    return (hours * 60) + minutes
}

function parseSteps(instructions: any) {
    if (!instructions) return []
    if (typeof instructions === 'string') return instructions.split('\n').filter(s => s.trim())
    if (Array.isArray(instructions)) {
        return instructions.map((step: any) => {
            if (typeof step === 'string') return step
            return step.text || step.name || ''
        }).filter(s => s.trim())
    }
    return []
}

function parseIngredientsFromSchema(ingredients: any) {
    if (!ingredients) return []
    const rawList = Array.isArray(ingredients) ? ingredients : [ingredients]

    return rawList.map(ing => {
        const line = String(ing).trim()
        // Try to capture: "2 1/2 cups flour", "1 tsp salt", "3 cloves garlic"
        // Also handles "Salt to taste"
        const match = line.match(/^([\d\s\/\.¼½¾]+)\s*(cup|tbsp|tsp|g|kg|ml|l|pcs|pinch|clove|oz|lb|pack|can|bottle|bag)s?\b\s*(.*)/i)

        if (match) {
            return {
                amount: match[1].trim(),
                unit: match[2].toLowerCase(),
                name: match[3].trim(),
                note: null
            }
        }

        // Try just number + name
        const numOnlyMatch = line.match(/^([\d\s\/\.¼½¾]+)\s+(.*)/i)
        if (numOnlyMatch) {
            return {
                amount: numOnlyMatch[1].trim(),
                unit: null,
                name: numOnlyMatch[2].trim(),
                note: null
            }
        }

        return {
            name: line,
            amount: null,
            unit: null,
            note: null
        }
    })
}
