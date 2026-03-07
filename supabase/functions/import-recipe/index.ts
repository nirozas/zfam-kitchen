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

        // 3. Fallback to AI refinement if no structured data OR if it's a social media platform
        const isSocial = /instagram\.com|tiktok\.com|youtube\.com|facebook\.com/.test(url)
        const needsRefinement = !recipeData || isSocial || !recipeData.ingredients?.length || recipeData.ingredients.some((i: any) => i.amount === null);

        // We ALWAYS use AI for social media or if we didn't get perfectly structured data
        if (needsRefinement) {
            const openaiKey = Deno.env.get('OPENAI_API_KEY')

            if (openaiKey) {
                // Clean HTML to reduce tokens - focus on meta tags and potential recipe blocks
                const bodyText = doc?.body?.innerText?.replace(/\s+/g, ' ').substring(0, 8000) || html.substring(0, 8000)

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
                                content: `You are a professional chef and data extraction expert. 
                            Extract recipe details from the provided text into a CLEAN JSON format.
                            
                            JSON Schema to return:
                            {
                                "title": "string",
                                "description": "string (max 200 chars)",
                                "time_minutes": number,
                                "image_url": "string",
                                "video_url": "string (optional)",
                                "all_images": ["string"],
                                "steps": [
                                    {"text": "string", "image_url": "string (optional)"}
                                ],
                                "ingredients": [
                                    {"name": "string", "amount": "string|number", "unit": "string", "note": "string (optional)"}
                                ],
                                "nutrition": {"calories": number, "protein": number, "fat": number, "carbs": number}
                            }

                            NORMALIZATION RULES:
                            - Normalize units to exactly: 'cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'pcs', 'pinch', 'clove', 'oz', 'lb', 'pack', 'as liked'.
                            - If unit is not one of these, use 'pcs' or null.
                            - 'amount' should be the quantity (e.g. "1.5", "1/2").
                            - 'note' should contain extra details (e.g. "chopped", "melted", "at room temperature").
                            - If the URL is from TikTok, Instagram, or Facebook and is a video post, set 'video_url' to the original URL or the extracted video URL.
                            - If multiple images found, return the most representative one as image_url.
                            - For 'steps', if you find relevant images in the content for specific steps, include them in 'image_url'.`
                            },
                            {
                                role: 'user',
                                content: `URL: ${url}\n\nContent:\n${bodyText}`
                            }
                        ],
                        response_format: { type: "json_object" }
                    })
                })

                const aiResult = await aiResponse.json()
                if (aiResult.choices?.[0]?.message?.content) {
                    const refinedRecipe = JSON.parse(aiResult.choices[0].message.content)

                    // Normalize steps to our internal format {text, image_url}
                    const normalizedSteps = (refinedRecipe.steps || []).map((s: any) => {
                        if (typeof s === 'string') return { id: crypto.randomUUID(), text: s, image_url: '', alignment: 'full', group_name: 'Main Steps' };
                        return {
                            id: crypto.randomUUID(),
                            text: s.text || '',
                            image_url: s.image_url || '',
                            alignment: 'full',
                            group_name: 'Main Steps'
                        };
                    });

                    // Merge/Overlay
                    recipeData = {
                        title: refinedRecipe.title || recipeData?.title || 'Imported Recipe',
                        description: refinedRecipe.description || recipeData?.description || '',
                        time_minutes: refinedRecipe.time_minutes || recipeData?.time_minutes || 30,
                        image_url: refinedRecipe.image_url || recipeData?.image_url,
                        video_url: refinedRecipe.video_url || refinedRecipe.original_url || url, // Social media fallback
                        all_images: refinedRecipe.all_images || [],
                        original_url: url,
                        steps: normalizedSteps.length ? normalizedSteps : (recipeData?.steps || []),
                        ingredients: refinedRecipe.ingredients || recipeData?.ingredients || [],
                        nutrition: refinedRecipe.nutrition || recipeData?.nutrition
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
    // Schema usually gives an array of strings like ["2 cups flour", "1 tsp salt"]
    if (Array.isArray(ingredients)) {
        return ingredients.map(ing => ({
            name: String(ing),
            amount: null,
            unit: null
        }))
    }
    return []
}
