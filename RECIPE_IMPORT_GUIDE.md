# Recipe Importer Feature

I've implemented the **Magic Import** feature which allows you to extract recipes from a URL (TikTok, Instagram, Blogs, etc.) directly into your create recipe form.

## 🚀 How to Enable the Backend

Because the browser cannot scrape other websites directly (due to CORS), this feature relies on a **Supabase Edge Function**. I have already created the function code for you in:
`supabase/functions/import-recipe/index.ts`

### Deployment Steps:

1. **Install Supabase CLI** (if you haven't):
   ```bash
   npm install supabase --save-dev
   ```

2. **Login and Link your project**:
   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-id
   ```

3. **Set your OpenAI Key**:
   This function uses OpenAI (GPT-4o-mini) as a fallback for messy social media captions. Run this command to set your secret:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=your_openai_key_here
   ```

4. **Deploy the function**:
   ```bash
   npx supabase functions deploy import-recipe --no-verify-jwt
   ```
   *Note: `--no-verify-jwt` allows any authenticated user from your frontend to call the function.*

## 🛠️ Extraction Strategy (AI Optimization)

As requested, I've modified the logic to **prioritize non-AI extraction**:

1. **LD+JSON (Schema.org)**: The function first looks for standard structured recipe data. If found, it parses it directly using code (Deno DOM).
2. **AI Fallback**: If structured data is missing (common on social media) OR if the result is incomplete, it passes the HTML/Caption text to OpenAI to "clean" and structure the ingredients and steps.
3. **Unit Normalization**: The prompt explicitly tells the AI to normalize units to your database standards (`g`, `ml`, `pcs`, `cup`, etc.).
4. **Multiple Images**: If multiple images are detected, the UI will present a choice grid for you to pick the best one.

## 📱 Frontend Access
- **Home Page**: A new "Magic Import" button is next to "New Recipe".
- **Create Recipe Page**: A "Magic Import" button is now in the "Fundamentals" section header.
- **Smart Fill**: Once imported, the form fields (Title, Description, Time, Ingredients, Steps) will automatically populate for you to review before saving.
