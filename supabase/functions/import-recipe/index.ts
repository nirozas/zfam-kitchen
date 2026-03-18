import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
    url: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url } = await req.json() as RequestBody;
        if (!url) throw new Error('URL is required')

        console.log(`🚀 Starting Universal Extraction for: ${url}`)

        const isSocial = /instagram\.com|tiktok\.com|youtube\.com|facebook\.com/.test(url);
        
        // 1. Fetch HTML with browser-like headers
        let html = ''
        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': isSocial 
                        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
                        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                }
            })
            if (resp.ok) {
                html = await resp.text()
            } else {
                console.warn(`Fetch returned status: ${resp.status}`)
            }
        } catch (e) {
            console.error('HTML fetch failed:', e)
        }

        // 2. Extract Data from HTML
        const titleMatch = html.match(/<title>(.*?)<\/title>/i)
        const pageTitle = titleMatch ? titleMatch[1].trim() : ''

        // Meta description (often contains social captions)
        const metaDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
            html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ||
            html.match(/<meta\s+property=["']twitter:description["']\s+content=["'](.*?)["']/i)
        const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : ''

        // OG Image and other images
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)
        const ogImage = ogImageMatch ? ogImageMatch[1] : ''

        // Find all likely images for selection
        const allImages: string[] = []
        if (ogImage) allImages.push(ogImage)
        
        const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp|avif)[^"']*)["']/gi
        let m;
        while ((m = imgRegex.exec(html)) !== null) {
            if (allImages.length < 15 && !allImages.includes(m[1])) {
                // Filter out small icons or tracking pixels if possible
                if (!m[1].includes('icon') && !m[1].includes('pixel') && !m[1].includes('logo')) {
                    allImages.push(m[1])
                }
            }
        }

        // LD+JSON priority (for blogs)
        let ldRecipe: any = null
        const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
        for (const match of ldMatches) {
            try {
                const json = JSON.parse(match[1])
                const items = Array.isArray(json) ? json : (json['@graph'] || [json])
                const recipe = items.find((it: any) => 
                    it['@type'] === 'Recipe' || 
                    (Array.isArray(it['@type']) && it['@type'].includes('Recipe'))
                )
                if (recipe) {
                    ldRecipe = recipe
                    // Extract image from LD+JSON
                    if (recipe.image) {
                        const ldImages = Array.isArray(recipe.image) ? recipe.image : [recipe.image]
                        ldImages.forEach((img: any) => {
                            const url = typeof img === 'string' ? img : (img.url || img['@id'])
                            if (url && !allImages.includes(url)) allImages.unshift(url) // Prioritize recipe images
                        })
                    }
                    break
                }
            } catch (_) { /* ignore parse errors */ }
        }

        // 3. AI Refinement (The Fallback & Extraction Engine)
        const geminiKey = Deno.env.get('GEMINI_API_KEY')
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        const groqKey = Deno.env.get('GROQ_API_KEY')
        
        const isGeminiValid = geminiKey && geminiKey.length > 10 && geminiKey !== "YOUR_GEMINI_API_KEY_HERE";
        const isOpenAIValid = openaiKey && openaiKey.length > 10 && openaiKey !== "YOUR_OPENAI_API_KEY_HERE";
        const isGroqValid = groqKey && groqKey.length > 10 && groqKey !== "YOUR_GROQ_API_KEY_HERE";

        if (!isGeminiValid && !isOpenAIValid && !isGroqValid) {
            throw new Error('No valid AI API Keys found. Please set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in Supabase Secrets.')
        }

        // Clean text for AI to avoid token waste
        const cleanText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .substring(0, 10000)

        const systemPrompt = `You are an expert Culinary Data Engineer and Professional Chef. Your task is to extract recipe data from messy text and convert it into a highly structured, standardized JSON format.

        ### CORE EXTRACTION RULES:
        1. **Ingredient Splitting & Normalization**:
           - Split strings like "1 cup of flour" into amount: "1", unit: "cup", name: "flour".
           - Convert all units to this standard list: g, ml, cup, tsp, tbsp, lbs, oz, pcs.
           - If a specific unit isn't in the list, keep the original but prioritize the standard list.
        2. **Step Cleaning**:
           - Remove all social media fluff, calls to action, or marketing text (e.g., "Link in bio", "Follow for more", "Check out my ebook").
           - Each step should be a clear, concise cooking instruction.
        3. **Time Extraction**:
           - Convert all natural language time expressions to an integer representing total minutes.
           - Example: "An hour and a half" -> 90.
        4. **Culinary Tone**:
           - Rewrite the description to be professional, appetizing, and descriptive of the final dish's flavor and texture.
        5. **Detection & Estimation**:
           - If the input is a TikTok/Instagram caption, look for ingredient lists even if they lack measurements.
           - If nutrition data is missing, ESTIMATE calories and protein based on the ingredients list.
           - Set "raw_time" to true only if the text explicitly states the time in numbers.
           - Set "raw_nutrition" to true only if the text explicitly states the nutrition.

        ### OUTPUT JSON SCHEMA:
        {
            "title": "string",
            "description": "Culinary, appetizing description",
            "time_minutes": number,
            "servings": number,
            "raw_time": boolean,
            "raw_nutrition": boolean,
            "ingredients": [{"name": "string", "name_ar": "Arabic", "name_he": "Hebrew", "name_es": "Spanish", "amount": "string", "unit": "string", "note": "string", "group_name": "string"}],
            "steps": [{"text": "string", "image_url": "string", "group_name": "string"}],
            "nutrition": {"calories": number, "protein": number, "fat": number, "carbs": number},
            "image_url": "string"
        }`

        let result: any = null;
        let lastError: string = "";

        // The AI needs the summary data + the raw text
        const aiInput = `URL: ${url}\nTITLE: ${pageTitle}\nCAPTION/DESC: ${metaDesc}\n\nSOURCE CONTENT:\n${cleanText}`;

        // Attempt 1: Groq (Current best free tier)
        if (!result && isGroqValid) {
            console.log("AI Attempt 1: Calling Groq...")
            const key = groqKey!.trim();
            try {
                const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: aiInput }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    })
                })

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json()
                    result = JSON.parse(aiData.choices[0].message.content)
                    console.log("✅ Groq Success!")
                } else {
                    const err = await aiResponse.json().catch(() => ({}));
                    lastError = `Groq Error (${aiResponse.status}): ${err.error?.message || 'Unknown'}`;
                    console.warn(lastError)
                }
            } catch (e: any) {
                lastError = `Groq Exception: ${e.message}`;
            }
        }

        // Attempt 2: Gemini
        if (!result && isGeminiValid) {
            console.log("AI Attempt 2: Calling Gemini...")
            const key = geminiKey!.trim();
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
            try {
                const aiResponse = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n${aiInput}` }] }],
                        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
                    })
                })

                if (aiResponse.ok) {
                    const data = await aiResponse.json()
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                    if (text) {
                        result = JSON.parse(text)
                        console.log("✅ Gemini Success!")
                    }
                } else {
                    const err = await aiResponse.json().catch(() => ({}));
                    lastError = `Gemini Error (${aiResponse.status}): ${err.error?.message || 'Unknown'}`;
                    console.warn(lastError)
                }
            } catch (e: any) {
                lastError = `Gemini Exception: ${e.message}`;
            }
        }

        // Attempt 3: OpenAI (Final Fallback)
        if (!result && isOpenAIValid) {
            console.log("AI Attempt 3: Calling OpenAI...")
            const key = openaiKey!.trim();
            try {
                const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: aiInput }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    })
                })

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json()
                    result = JSON.parse(aiData.choices[0].message.content)
                    console.log("✅ OpenAI Success!")
                } else {
                    const err = await aiResponse.json().catch(() => ({}));
                    lastError = `OpenAI Error (${aiResponse.status}): ${err.error?.message || 'Quota Exceeded'}`;
                    console.warn(lastError)
                }
            } catch (e: any) {
                lastError = `OpenAI Exception: ${e.message}`;
            }
        }

        if (!result) {
            throw new Error(`Magic Import Failed. The AI was unable to parse this link. Last error: ${lastError}`);
        }

        // 4. Final Normalization
        const normalized = {
            title: result.title || ldRecipe?.name || pageTitle || 'Imported Recipe',
            description: result.description || ldRecipe?.description || metaDesc || '',
            time_minutes: result.time_minutes || (ldRecipe ? (parseInt(ldRecipe.totalTime) || parseInt(ldRecipe.cookTime) || 30) : 30),
            servings: result.servings || (ldRecipe ? parseInt(ldRecipe.recipeYield) || 4 : 4),
            image_url: result.image_url || ldRecipe?.image?.[0] || ldRecipe?.image || ogImage || allImages[0] || '',
            all_images: [...new Set(allImages)].filter(img => img.startsWith('http')),
            video_url: (/tiktok|instagram|youtube|facebook/.test(url) ? url : (result.video_url || '')),
            original_url: url,
            nutrition: result.nutrition || {
                calories: 0,
                protein: 0,
                fat: 0,
                carbs: 0
            },
            steps: (result.steps || []).map((s: any) => ({
                id: crypto.randomUUID(),
                text: typeof s === 'string' ? s : s.text,
                image_url: s.image_url || '',
                alignment: 'full',
                group_name: s.group_name || 'Main Steps'
            })),
            ingredients: (result.ingredients || []).map((i: any) => ({
                name: i.name || '',
                name_ar: i.name_ar || '',
                name_he: i.name_he || '',
                name_es: i.name_es || '',
                amount: String(i.amount || ''),
                unit: i.unit || '',
                note: i.note || '',
                group_name: i.group_name || 'Main'
            }))
        }

        // Fallback for steps and ingredients if AI failed but LD exists
        if (normalized.ingredients.length === 0 && ldRecipe?.recipeIngredient) {
            normalized.ingredients = ldRecipe.recipeIngredient.map((ing: string) => ({
                name: ing,
                amount: '',
                unit: '',
                note: '',
                group_name: 'Main'
            }))
        }

        if (normalized.steps.length === 0 && ldRecipe?.recipeInstructions) {
            const instructions = Array.isArray(ldRecipe.recipeInstructions) 
                ? ldRecipe.recipeInstructions 
                : [ldRecipe.recipeInstructions]
            
            normalized.steps = instructions.map((inst: any) => ({
                id: crypto.randomUUID(),
                text: typeof inst === 'string' ? inst : (inst.text || inst.name || ''),
                image_url: inst.image || '',
                alignment: 'full',
                group_name: 'Main Steps'
            }))
        }

        // Final check
        if (normalized.steps.length === 0 && normalized.ingredients.length === 0) {
            throw new Error('Could not find recipe details. The content might be protected or not formatted as a recipe.')
        }

        return new Response(JSON.stringify(normalized), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Import Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})

