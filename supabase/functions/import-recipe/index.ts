// @ts-nocheck
// Supabase Edge Function: import-recipe
// Stable implementation using only built-in Deno APIs (no deno_dom dependency)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const url: string = body?.url
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required')
        }

        // ── 1. Fetch the page HTML ──────────────────────────────────────────────
        let html = ''
        let fetchOk = false
        try {
            const pageRes = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                redirect: 'follow',
            })
            if (pageRes.ok) {
                html = await pageRes.text()
                fetchOk = true
            } else {
                console.warn(`Page fetch status: ${pageRes.status}`)
            }
        } catch (fetchErr) {
            console.warn('Page fetch failed:', fetchErr)
        }

        // ── 2. Extract LD+JSON structured data (no DOM library needed) ──────────
        let recipeData: any = null

        if (fetchOk && html) {
            const ldScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
            for (const match of ldScripts) {
                try {
                    const json = JSON.parse(match[1])
                    const items = Array.isArray(json) ? json : (json['@graph'] ? json['@graph'] : [json])
                    const recipe = items.find((item: any) => {
                        const type = item?.['@type']
                        return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
                    })

                    if (recipe) {
                        const rawImage = recipe.image
                        const imageUrl = Array.isArray(rawImage)
                            ? (rawImage[0]?.url || rawImage[0])
                            : (rawImage?.url || rawImage)

                        recipeData = {
                            title: recipe.name || '',
                            description: (typeof recipe.description === 'string' ? recipe.description : '').substring(0, 300),
                            time_minutes: parseISO8601Duration(recipe.totalTime || recipe.cookTime) || 30,
                            image_url: typeof imageUrl === 'string' ? imageUrl : '',
                            original_url: url,
                            steps: parseSteps(recipe.recipeInstructions),
                            ingredients: parseIngredients(recipe.recipeIngredient),
                            nutrition: parseNutrition(recipe.nutrition),
                        }
                        break
                    }
                } catch (_) {
                    // continue to next script
                }
            }
        }

        // ── 3. Extract plain text for AI ────────────────────────────────────────
        // Strip tags, collapse whitespace, trim to 6000 chars
        const bodyText = html
            ? html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 6000)
            : `Recipe from: ${url}`

        // ── 4. Use AI to refine / fill gaps ────────────────────────────────────
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        const isSocial = /instagram\.com|tiktok\.com|youtube\.com|facebook\.com/i.test(url)
        const hasUnparsedIngredients = recipeData?.ingredients?.some((i: any) =>
            i.name && /^\d|cup|tbsp|tsp|gram|clove|lb|oz/i.test(i.name)
        )
        const needsAI = !recipeData || isSocial || !recipeData.ingredients?.length || hasUnparsedIngredients

        if (needsAI && openaiKey) {
            try {
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        temperature: 0,
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: `You extract recipe data from webpage text and return ONLY valid JSON in this schema:
{
  "title": "string",
  "description": "string (max 250 chars)",
  "time_minutes": number,
  "image_url": "string or null",
  "video_url": "string or null",
  "steps": [{"text": "string", "image_url": "string or null"}],
  "ingredients": [{"name": "string", "amount": "string", "unit": "string or null", "note": "string or null"}]
}

INGREDIENT RULES (critical):
- "name" must ONLY be the ingredient name (e.g. "flour", "garlic"). Never include quantity or units.
- "1 1/2 cups chopped onions" → {name:"onions", amount:"1.5", unit:"cup", note:"chopped"}
- "3 cloves garlic, minced" → {name:"garlic", amount:"3", unit:"clove", note:"minced"}
- "salt to taste" → {name:"salt", amount:"", unit:null, note:"to taste"}
- units must be one of: cup, tbsp, tsp, g, kg, ml, l, pcs, pinch, clove, oz, lb, pack, as liked, or null`,
                            },
                            {
                                role: 'user',
                                content: `URL: ${url}\n\nText:\n${bodyText}`,
                            },
                        ],
                    }),
                })

                if (aiRes.ok) {
                    const aiJson = await aiRes.json()
                    const content = aiJson?.choices?.[0]?.message?.content
                    if (content) {
                        const refined = JSON.parse(content)
                        const normalizedSteps = (refined.steps || []).map((s: any) => ({
                            id: crypto.randomUUID(),
                            text: typeof s === 'string' ? s : (s.text || ''),
                            image_url: typeof s === 'object' ? (s.image_url || '') : '',
                            alignment: 'full',
                            group_name: 'Main Steps',
                        }))

                        recipeData = {
                            title: refined.title || recipeData?.title || 'Imported Recipe',
                            description: refined.description || recipeData?.description || '',
                            time_minutes: refined.time_minutes || recipeData?.time_minutes || 30,
                            image_url: refined.image_url || recipeData?.image_url || '',
                            video_url: refined.video_url || (isSocial ? url : ''),
                            steps: normalizedSteps.length ? normalizedSteps : (recipeData?.steps || []),
                            ingredients: (refined.ingredients || []).map((ing: any) => ({
                                name: (ing.name || '').trim(),
                                amount: String(ing.amount || '').trim(),
                                unit: ing.unit && ing.unit !== 'null' ? ing.unit : '',
                                note: ing.note && ing.note !== 'null' ? ing.note : '',
                                group_name: 'Main',
                            })),
                            nutrition: refined.nutrition || recipeData?.nutrition || null,
                            original_url: url,
                        }
                    }
                } else {
                    const errText = await aiRes.text()
                    console.error('OpenAI error:', aiRes.status, errText)
                }
            } catch (aiErr) {
                console.error('AI step failed:', aiErr)
                // AI failed — continue with whatever LD+JSON extraction gave us
            }
        }

        // ── 5. Return whatever we have ──────────────────────────────────────────
        if (!recipeData) {
            // Return a blank skeleton rather than a 400 — let the user fill it in
            recipeData = {
                title: '',
                description: '',
                time_minutes: 30,
                image_url: '',
                video_url: isSocial ? url : '',
                steps: [],
                ingredients: [],
                nutrition: null,
                original_url: url,
                _warning: 'Could not extract recipe details. Please fill in manually.',
            }
        }

        return new Response(JSON.stringify(recipeData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (err: any) {
        console.error('Fatal error in import-recipe:', err)
        return new Response(
            JSON.stringify({ error: String(err?.message || err) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseISO8601Duration(duration: string): number | null {
    if (!duration || typeof duration !== 'string') return null
    const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!m) return null
    return (parseInt(m[1] || '0') * 60) + parseInt(m[2] || '0')
}

function parseSteps(instructions: any): any[] {
    if (!instructions) return []
    if (typeof instructions === 'string') {
        return instructions.split('\n').filter(Boolean).map(text => ({
            id: crypto.randomUUID(), text: text.trim(), image_url: '', alignment: 'full', group_name: 'Main Steps'
        }))
    }
    if (Array.isArray(instructions)) {
        return instructions.flatMap((step: any) => {
            if (typeof step === 'string') {
                return [{ id: crypto.randomUUID(), text: step.trim(), image_url: '', alignment: 'full', group_name: 'Main Steps' }]
            }
            if (step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
                return step.itemListElement.map((sub: any) => ({
                    id: crypto.randomUUID(), text: sub.text || sub.name || '', image_url: '', alignment: 'full', group_name: step.name || 'Main Steps'
                }))
            }
            return [{ id: crypto.randomUUID(), text: step.text || step.name || '', image_url: '', alignment: 'full', group_name: 'Main Steps' }]
        }).filter((s: any) => s.text)
    }
    return []
}

function parseIngredients(ingredients: any): any[] {
    if (!ingredients) return []
    const list = Array.isArray(ingredients) ? ingredients : [ingredients]
    const unitRx = /^([\d\s\/\.\u00BC-\u00BE]+)\s*(cup|tbsp|tsp|g|kg|ml|l|pcs|pinch|clove|oz|lb|pack|can|bottle|bag)s?\b\s*(.*)/i
    const numRx = /^([\d\s\/\.\u00BC-\u00BE]+)\s+(.*)/i

    return list.map((ing: any) => {
        const line = String(ing).trim()
        const um = line.match(unitRx)
        if (um) return { amount: um[1].trim(), unit: um[2].toLowerCase(), name: um[3].trim(), note: '' }
        const nm = line.match(numRx)
        if (nm) return { amount: nm[1].trim(), unit: '', name: nm[2].trim(), note: '' }
        return { amount: '', unit: '', name: line, note: '' }
    })
}

function parseNutrition(nutrition: any): any {
    if (!nutrition) return null
    return {
        calories: parseInt(nutrition.calories) || 0,
        protein: parseInt(nutrition.proteinContent) || 0,
        fat: parseInt(nutrition.fatContent) || 0,
        carbs: parseInt(nutrition.carbohydrateContent) || 0,
    }
}
