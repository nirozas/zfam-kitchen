import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url } = await req.json()
        if (!url) throw new Error('URL is required')

        console.log(`Starting import for: ${url}`)

        // 1. Fetch HTML
        let html = ''
        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            })
            if (resp.ok) html = await resp.text()
        } catch (e) {
            console.warn('HTML fetch failed:', e)
        }

        // 2. Extract basic info from meta/regex
        const titleMatch = html.match(/<title>(.*?)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : 'Imported Recipe'

        // Meta description (often contains social caption)
        const metaDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
            html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
        const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : ''

        // LD+JSON fallback (regex based)
        let ldRecipe: any = null
        const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
        for (const m of ldMatches) {
            try {
                const json = JSON.parse(m[1])
                const items = Array.isArray(json) ? json : (json['@graph'] || [json])
                const recipe = items.find((it: any) => it['@type'] === 'Recipe' || (Array.isArray(it['@type']) && it['@type'].includes('Recipe')))
                if (recipe) {
                    ldRecipe = recipe
                    break
                }
            } catch (_) { }
        }

        // 3. AI Extraction
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) {
            throw new Error('Server configuration error: Missing AI Key')
        }

        // Combine title, meta description, and page text
        const cleanBody = `
        TITLE: ${title}
        METADATA: ${metaDesc}
        PAGE_TEXT: ${html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').substring(0, 6000)}
    `

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
                        content: `Extract recipe details into JSON.
            If the input contains no clear recipe ingredients or steps, DO NOT invent them. 
            Return an empty list for ingredients and steps if not found.
            
            JSON Schema:
            {
                "title": "string",
                "description": "string",
                "time_minutes": number,
                "image_url": "string",
                "video_url": "string",
                "steps": [{"text": "string", "image_url": "string"}],
                "ingredients": [{"name": "string", "amount": "string", "unit": "string", "note": "string"}]
            }
            Splitting rules:
            "1.5 cups chopped onions" -> name: "onions", amount: "1.5", unit: "cup", note: "chopped"`
                    },
                    {
                        role: 'user',
                        content: `URL: ${url}\n\nContent:\n${cleanBody}`
                    }
                ],
                response_format: { type: "json_object" }
            })
        })

        if (!aiResponse.ok) {
            throw new Error('AI extraction service is currently unavailable')
        }

        const aiData = await aiResponse.json()
        const result = JSON.parse(aiData.choices[0].message.content)

        // Final Normalize
        const normalized = {
            title: result.title || title,
            description: result.description || metaDesc || '',
            time_minutes: result.time_minutes || 30,
            image_url: result.image_url || '',
            video_url: result.video_url || (/tiktok|instagram|facebook|youtube/.test(url) ? url : ''),
            original_url: url,
            steps: (result.steps || []).map((s: any) => ({
                id: crypto.randomUUID(),
                text: typeof s === 'string' ? s : s.text,
                image_url: s.image_url || '',
                alignment: 'full',
                group_name: 'Main Steps'
            })),
            ingredients: (result.ingredients || []).map((i: any) => ({
                name: i.name || '',
                amount: String(i.amount || ''),
                unit: i.unit || '',
                note: i.note || '',
                group_name: 'Main'
            }))
        }

        // Check if we actually got anything
        if (normalized.steps.length === 0 && normalized.ingredients.length === 0) {
            throw new Error('Could not find recipe details on this page. Some websites block automated access.')
        }

        return new Response(JSON.stringify(normalized), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Import Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Return 200 with error field so frontend Toast shows it
        })
    }
})
