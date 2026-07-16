import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
    image: string; // base64 encoded image
    mimeType: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { image, mimeType } = await req.json() as RequestBody;
        if (!image) throw new Error('Image data is required');
        
        // Remove data URL prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const mime = mimeType || "image/jpeg";

        console.log(`🚀 Starting Receipt Scan...`);

        const geminiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiKey || geminiKey.length < 10) {
            throw new Error('No valid GEMINI_API_KEY found in Supabase Secrets.');
        }

        const systemPrompt = `You are a highly accurate receipt data extraction AI. 
        Analyze the provided receipt image and extract the requested information into a strict JSON format.
        
        ### EXTRACTION RULES:
        1. **Date**: Extract the date of the receipt in YYYY-MM-DD format if possible.
        2. **Store**: Extract the name of the store or restaurant.
        3. **Total**: Extract the final total amount as a number (do not include currency symbols).
        4. **Items**: List each purchased item with its name and price. Do not include taxes or subtotals in the items list.
        
        ### OUTPUT JSON SCHEMA:
        {
            "date": "string",
            "store": "string",
            "total": number,
            "items": [
                {
                    "name": "string",
                    "price": number
                }
            ]
        }`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
        
        const aiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        {
                            inlineData: {
                                mimeType: mime,
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: { 
                    response_mime_type: "application/json", 
                    temperature: 0.1 
                }
            })
        });

        if (!aiResponse.ok) {
            const err = await aiResponse.json().catch(() => ({}));
            throw new Error(`Gemini Error (${aiResponse.status}): ${err.error?.message || 'Unknown'}`);
        }

        const data = await aiResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('AI returned an empty response.');
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error('AI returned invalid JSON.');
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Scan Receipt Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
