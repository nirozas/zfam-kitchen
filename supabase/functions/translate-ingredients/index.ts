import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

  try {
    // Fetch all ingredients that are missing at least one translation
    const { data: ingredients, error } = await supabase
      .from('ingredients')
      .select('id, name, name_ar, name_he, name_es')
      .or('name_ar.is.null,name_he.is.null,name_es.is.null');

    if (error) throw error;
    if (!ingredients || ingredients.length === 0) {
      return new Response(JSON.stringify({ message: 'All ingredients already have translations!', count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Translating ${ingredients.length} ingredients...`);

    // Process in batches of 30
    const BATCH_SIZE = 30;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
      const batch = ingredients.slice(i, i + BATCH_SIZE);
      const names = batch.map(ing => ing.name);

      const prompt = `You are a culinary dictionary. Translate each of the following English ingredient names into Arabic, Hebrew, and Spanish.

Return ONLY a JSON array, no markdown, no explanations. The array must have exactly ${names.length} objects in the same order as the input, each with this structure:
{ "name": "original english name", "name_ar": "arabic translation", "name_he": "hebrew translation", "name_es": "spanish translation" }

Ingredients to translate:
${names.map((n, idx) => `${idx + 1}. ${n}`).join('\n')}`;

      let responseText = '';

      // Try Gemini first
      if (GEMINI_API_KEY) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
              })
            }
          );
          const data = await res.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (e) {
          console.error('Gemini failed:', e);
        }
      }

      // Fallback to Groq
      if (!responseText && GROQ_API_KEY) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3-70b-8192',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              max_tokens: 4096,
            })
          });
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content || '';
        } catch (e) {
          console.error('Groq failed:', e);
        }
      }

      // Parse JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('No JSON found in response for batch', i);
        failed += batch.length;
        continue;
      }

      let translations: any[];
      try {
        translations = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse JSON for batch', i);
        failed += batch.length;
        continue;
      }

      // Update each ingredient
      for (let j = 0; j < batch.length; j++) {
        const ing = batch[j];
        const trans = translations[j];
        if (!trans) continue;

        const { error: updateError } = await supabase
          .from('ingredients')
          .update({
            name_ar: ing.name_ar || trans.name_ar || null,
            name_he: ing.name_he || trans.name_he || null,
            name_es: ing.name_es || trans.name_es || null,
          })
          .eq('id', ing.id);

        if (updateError) {
          console.error(`Failed to update ${ing.name}:`, updateError);
          failed++;
        } else {
          updated++;
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < ingredients.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Translation complete!',
        total: ingredients.length,
        updated,
        failed 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
