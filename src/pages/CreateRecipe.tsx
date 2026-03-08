import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X, Upload, Loader2, Star, Trash2, ImageIcon, Maximize2, Sparkles, GripVertical } from 'lucide-react';
import { AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useCategories } from '@/lib/hooks';
import ImageCropper from '@/components/ImageCropper';
import LinkImporterModal from '@/components/LinkImporterModal';
import { generateSlug, getOptimizedImageUrl, fixImageUrl } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RecipeStep {
  id: string;
  text: string;
  image_url?: string;
  alignment: 'left' | 'center' | 'right' | 'full';
  group_name?: string;
}

interface GalleryItem {
  url: string;
  caption?: string;
}



const UNIT_MAPPING: Record<string, string> = {
  // Arabic
  'كوب': 'cup', 'أكواب': 'cup', 'كاس': 'cup', 'كؤوس': 'cup',
  'ملعقة كبيرة': 'tbsp', 'ملاعق كبيرة': 'tbsp', 'ملعقة صغيرة': 'tsp', 'ملاعق صغيرة': 'tsp',
  'ملعقه كبيره': 'tbsp', 'ملعقه صغيره': 'tsp',
  'غرام': 'g', 'جرام': 'g', 'غم': 'g',
  'ملليلتر': 'ml', 'ملل': 'ml', 'مل': 'ml',
  'لتر': 'l',
  'حبة': 'pcs', 'حبات': 'pcs', 'قطعة': 'pcs', 'قطع': 'pcs',
  'رشة': 'pinch', 'قرصة': 'pinch',
  'فص': 'clove', 'فصوص': 'clove',
  'ملعقة': 'tbsp',
  'عبوة': 'pack', 'باكيت': 'pack',
  'حسب الرغبة': 'as liked', 'حسب الذوق': 'as liked',
  // Hebrew
  'כוס': 'cup', 'כוסות': 'cup',
  'כף': 'tbsp', 'כפות': 'tbsp',
  'כפית': 'tsp', 'כפיות': 'tsp',
  'גרם': 'g', 'ק"ג': 'kg', 'קג': 'kg',
  'מ"ל': 'ml', 'מל': 'ml',
  'ליטר': 'l',
  'יחידה': 'pcs', 'יחידות': 'pcs',
  'קורט': 'pinch',
  'שן': 'clove', 'שיניים': 'clove',
  'אריזה': 'pack', 'חבילה': 'pack',
  'לפי הטעם': 'as liked',
  // English
  'cup': 'cup', 'cups': 'cup',
  'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
  'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
  'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
  'l': 'l', 'liter': 'l', 'liters': 'l',
  'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs',
  'pinch': 'pinch', 'pinches': 'pinch',
  'clove': 'clove', 'cloves': 'clove',
  'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
  'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
  'pack': 'pack', 'pkg': 'pack', 'package': 'pack',
  'as liked': 'as liked', 'to taste': 'as liked'
};

const COMMON_UNITS = ['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'pcs', 'pinch', 'clove', 'oz', 'lb', 'pack', 'as liked'];

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

const parseAmount = (val: string): number => {
  if (!val) return 0;
  // Handle space-separated fractions like "1 1/2"
  if (val.includes(' ')) {
    const parts = val.split(/\s+/);
    return parts.reduce((acc, part) => acc + parseAmount(part), 0);
  }
  // Handle fractions like "1/2"
  if (val.includes('/')) {
    const [num, den] = val.split('/').map(n => parseFloat(n));
    if (den) return num / den;
  }
  return parseFloat(val) || 0;
};

const cleanIngData = (ing: any) => {
  const line = (ing.name || '').trim();
  // If name already looks parsed (short and no numbers), return as is
  if (line.length < 20 && !/\d/.test(line)) return ing;

  // Basic regex fallback for "2 1/2 cups flour"
  const units = ['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'pcs', 'pinch', 'clove', 'oz', 'lb', 'pack', 'can', 'bottle', 'bag'];
  const unitRegex = new RegExp(`^([\\d\\s\\/\\.\\u00BC-\\u00BE]+)\\s*(${units.join('|')})s?\\b\\s*(.*)`, 'i');
  const match = line.match(unitRegex);

  if (match) {
    return {
      ...ing,
      amount: match[1].trim(),
      unit: match[2].toLowerCase(),
      name: match[3].trim()
    };
  }

  // Number only fallback "3 garlic cloves"
  const numMatch = line.match(/^([\d\s\/\.\u00BC-\u00BE]+)\s+(.*)/i);
  if (numMatch) {
    return {
      ...ing,
      amount: numMatch[1].trim(),
      name: numMatch[2].trim()
    };
  }

  return ing;
};

export default function CreateRecipe() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditing = !!id;
  const { categories } = useCategories();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    notes: '',
    image_url: '',
    video_url: '',
    source_url: '',
    alternative_titles: '',
    category_id: 0,
    secondary_category_ids: [] as number[],
    country_origin: '',
    steps: [{ id: Math.random().toString(), text: '', image_url: '', alignment: 'full', group_name: 'Main Steps' }] as RecipeStep[],
    gallery_urls: [] as GalleryItem[],
    rating: 3,
    tags: '',
    prep_time: '15',
    cook_time: '30',
    servings: '4',
    nutrition: { calories: '0', protein: '0', fat: '0', carbs: '0' }
  });

  const [uploading, setUploading] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showBulkSteps, setShowBulkSteps] = useState(false);
  const [bulkIngredientsText, setBulkIngredientsText] = useState('');
  const [bulkStepsText, setBulkStepsText] = useState('');
  const [ingredients, setIngredients] = useState([{ id: Math.random().toString(), name: '', amount: '', unit: '', note: '', group_name: 'Ingredients' }]);
  const [activeSection, setActiveSection] = useState('fundamentals');
  const [completeness, setCompleteness] = useState(0);
  const [lastFocusedIngredientIndex, setLastFocusedIngredientIndex] = useState<number | null>(null);
  const [lastFocusedStepIndex, setLastFocusedStepIndex] = useState<number | null>(null);
  const [actualRecipeId, setActualRecipeId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl && !isEditing) {
      setFormData(prev => ({ ...prev, category_id: parseInt(categoryFromUrl) }));
    }

    const importFlag = searchParams.get('import');
    if (importFlag === '1' && !isEditing) {
      setShowImporter(true);
    }
  }, [location.search, isEditing]);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ type: 'main' | 'step', index?: number } | null>(null);

  useEffect(() => {
    let score = 0;
    if (formData.title) score += 20;
    if (formData.image_url) score += 20;
    if (ingredients.some(i => i.name)) score += 20;
    if (formData.steps.some(s => s.text)) score += 20;
    if (formData.category_id) score += 20;
    setCompleteness(score);
  }, [formData, ingredients]);

  const sections = [
    { id: 'fundamentals', label: 'Story & Title', icon: '📝' },
    { id: 'details', label: 'Recipe Details', icon: '⚙️' },
    { id: 'media', label: 'Media Assets', icon: '🖼️' },
    { id: 'ingredients', label: 'Ingredients', icon: '🥗' },
    { id: 'instructions', label: 'Cooking Steps', icon: '👩‍🍳' },
    { id: 'notes', label: 'Notes', icon: '📌' },
    { id: 'nutrition', label: 'Nutrition', icon: '📊' },
  ];

  const readFile = (file: File) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.readAsDataURL(file);
  });

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'step', index?: number) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageToCrop(imageDataUrl);
      setCropTarget({ type, index });
      setCropModalOpen(true);
      e.target.value = '';
    }
  };

  const onEditImage = (url: string, type: 'main' | 'step', index?: number) => {
    setImageToCrop(url);
    setCropTarget({ type, index });
    setCropModalOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setUploading(true);
      const fileName = `${Math.random()}.jpeg`;
      const file = new File([croppedBlob], fileName, { type: 'image/jpeg' });
      await supabase.storage.from('recipes').upload(fileName, file);
      const { data } = supabase.storage.from('recipes').getPublicUrl(fileName);
      const url = data.publicUrl;
      if (cropTarget?.type === 'main') setFormData(prev => ({ ...prev, image_url: url }));
      else if (cropTarget?.type === 'step' && typeof cropTarget.index === 'number') updateStep(cropTarget.index, { image_url: url });
      setCropModalOpen(false);
    } catch (error) { alert('Upload failed: ' + (error as Error).message); }
    finally { setUploading(false); }
  };

  useEffect(() => {
    async function loadRecipe() {
      if (isEditing && id) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          let query = supabase
            .from('recipes')
            .select(`
              *,
              recipe_ingredients(
                amount_in_grams, 
                unit, 
                group_name, 
                order_index, 
                ingredients(*)
              ),
              recipe_tags(tags(id, name)),
              recipe_categories(category_id)
            `);

          if (isUuid) {
            query = query.eq('id', id);
          } else {
            query = query.eq('slug', id);
          }

          const { data: recipe, error } = await query.single();
          if (error) {
            console.error('Fetch error:', error);
            throw error;
          }
          
          if (recipe) {
            setActualRecipeId(recipe.id);
            setFormData({
              title: recipe.title || '',
              description: recipe.description || '',
              notes: recipe.notes || '',
              image_url: recipe.image_url || '',
              video_url: recipe.video_url || '',
              source_url: recipe.source_url || '',
              alternative_titles: recipe.alternative_titles || '',
              category_id: recipe.category_id || 0,
              secondary_category_ids: recipe.recipe_categories?.map((rc: any) => rc.category_id).filter(Boolean) || [],
              country_origin: recipe.country_origin || '',
              steps: (recipe.steps || []).map((s: any) => typeof s === 'string' ?
                { id: Math.random().toString(), text: s, image_url: '', alignment: 'full', group_name: 'Main Steps' } :
                { ...s, id: s.id || Math.random().toString(), text: s.text || '', group_name: s.group_name || s.section || 'Main Steps' }),
              gallery_urls: recipe.gallery_urls || [],
              rating: recipe.rating || 3,
              tags: recipe.recipe_tags?.map((rt: any) => rt.tags?.name ? `#${rt.tags.name}` : '').filter(Boolean).join(' ') || '',
              prep_time: (recipe.prep_time_minutes || 0).toString(),
              cook_time: (recipe.cook_time_minutes || 0).toString(),
              servings: (recipe.servings || 1).toString(),
              nutrition: {
                calories: (recipe.nutrition?.calories || 0).toString(),
                protein: (recipe.nutrition?.protein || 0).toString(),
                fat: (recipe.nutrition?.fat || 0).toString(),
                carbs: (recipe.nutrition?.carbs || 0).toString()
              }
            });

            const loadedIngredients = (recipe.recipe_ingredients || [])
              .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
              .map((i: any) => ({
                id: Math.random().toString(),
                name: i.ingredients?.name || '',
                amount: (i.amount_in_grams || 0).toString(),
                unit: i.unit || '',
                note: i.note || '',
                group_name: i.group_name || 'Ingredients'
              }));

            setIngredients(loadedIngredients.length > 0 ? loadedIngredients : [{ id: Math.random().toString(), name: '', amount: '', unit: '', note: '', group_name: 'Ingredients' }]);
          }
        } catch (error) { 
          console.error('Load recipe error:', error); 
          alert('Failed to load recipe. Please check console for details.'); 
        }
      }
    }
    loadRecipe();
    const params = new URLSearchParams(location.search);
    const urlTitle = params.get('title');
    if (urlTitle && !isEditing && !formData.title) {
      setFormData(prev => ({ ...prev, title: urlTitle }));
    }
  }, [id, isEditing, location.search]);

  const handleFileUpload = async (file: File) => {
    const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
    await supabase.storage.from('recipes').upload(fileName, file);
    const { data } = supabase.storage.from('recipes').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleGalleryAdd = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files) return;
      const urls: GalleryItem[] = [];
      for (const file of Array.from(event.target.files)) {
        const url = await handleFileUpload(file);
        urls.push({ url });
      }
      setFormData(prev => ({ ...prev, gallery_urls: [...prev.gallery_urls, ...urls] }));
    } catch (error) { alert((error as Error).message); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }
      const prep = parseInt(formData.prep_time) || 0;
      const cook = parseInt(formData.cook_time) || 0;
      const recipeData = {
        title: formData.title,
        description: formData.description,
        notes: formData.notes,
        image_url: formData.image_url || null,
        video_url: formData.video_url || null,
        source_url: formData.source_url || null,
        alternative_titles: formData.alternative_titles || null,
        gallery_urls: formData.gallery_urls,
        category_id: formData.category_id || null,
        steps: formData.steps.filter((s: RecipeStep) => s.text.trim() !== ''),
        author_id: session.user.id,
        time_minutes: prep + cook,
        prep_time_minutes: prep,
        cook_time_minutes: cook,
        servings: parseInt(formData.servings) || 1,
        nutrition: {
          calories: parseInt(formData.nutrition.calories) || 0,
          protein: parseInt(formData.nutrition.protein) || 0,
          fat: parseInt(formData.nutrition.fat) || 0,
          carbs: parseInt(formData.nutrition.carbs) || 0
        },
        rating: formData.rating,
        slug: generateSlug(formData.title),
        country_origin: formData.country_origin || null,
      };
      let recipeIdForIngredients: string;
      if (isEditing) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!);
        let query = supabase.from('recipes').update(recipeData);
        if (isUuid) {
          query = query.eq('id', id);
        } else {
          query = query.eq('slug', id);
        }
        const { error } = await query;
        if (error) throw error;
        recipeIdForIngredients = actualRecipeId || id!;
      } else {
        const { data, error } = await supabase.from('recipes').insert([recipeData]).select().single();
        if (error) throw error;
        recipeIdForIngredients = data.id;
      }

      // Handle secondary categories
      if (isEditing) await supabase.from('recipe_categories').delete().eq('recipe_id', recipeIdForIngredients);
      const categoryLinks = Array.from(new Set([formData.category_id, ...formData.secondary_category_ids]))
        .filter(cid => cid > 0)
        .map(cid => ({ recipe_id: recipeIdForIngredients, category_id: cid }));

      if (categoryLinks.length > 0) {
        await supabase.from('recipe_categories').upsert(categoryLinks);
      }

      const currentIngredients = ingredients.filter(ing => ing.name.trim() !== '');
      if (isEditing) await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeIdForIngredients);
      for (const ing of currentIngredients) {
        let { data: existingIng } = await supabase.from('ingredients').select('id').eq('name', ing.name).single();
        let ingredientId: number;
        if (!existingIng) {
          const { data: newIng } = await supabase.from('ingredients').insert([{ name: ing.name }]).select().single();
          ingredientId = newIng.id;
        } else ingredientId = existingIng.id;

        await supabase.from('recipe_ingredients').insert([{
          recipe_id: recipeIdForIngredients,
          ingredient_id: ingredientId,
          amount_in_grams: parseAmount(ing.amount),
          unit: ing.unit || null,
          group_name: ing.group_name || 'Ingredients',
          order_index: ingredients.indexOf(ing)
        }]);
      }

      // Handle tags
      if (isEditing) await supabase.from('recipe_tags').delete().eq('recipe_id', recipeIdForIngredients);
      const tagList = formData.tags.split(/[ ,#]+/).filter(t => t.trim() !== '');
      for (const tagName of tagList) {
        let { data: tag } = await supabase.from('tags').select('id').eq('name', tagName.replace('#', '')).single();
        if (!tag) {
          const { data: newTag, error: tagError } = await supabase.from('tags').insert({ name: tagName.replace('#', '') }).select().single();
          if (tagError) {
             // Tag might have been inserted by someone else just now
             const { data: retryTag } = await supabase.from('tags').select('id').eq('name', tagName.replace('#', '')).single();
             tag = retryTag;
          } else {
             tag = newTag;
          }
        }
        if (tag) {
          await supabase.from('recipe_tags').upsert({ recipe_id: recipeIdForIngredients, tag_id: tag.id });
        }
      }

      alert(isEditing ? 'Recipe updated!' : 'Recipe published!');
      navigate(isEditing ? `/recipe/${recipeData.slug}` : `/recipe/${recipeData.slug}`);
    } catch (error) { 
      console.error('Save error:', error);
      alert('Failed to save recipe: ' + (error as Error).message); 
    }
    finally { setUploading(false); }
  };


  const addStep = (index?: number) => {
    const targetIdx = index !== undefined ? index : (lastFocusedStepIndex !== null ? lastFocusedStepIndex : formData.steps.length - 1);
    const lastSection = formData.steps.length > 0 ? (formData.steps[targetIdx >= 0 ? targetIdx : 0]?.group_name || 'Main Steps') : 'Main Steps';
    const newSteps = [...formData.steps];
    newSteps.splice(targetIdx + 1, 0, { id: Math.random().toString(), text: '', image_url: '', alignment: 'full', group_name: lastSection });
    setFormData(prev => ({ ...prev, steps: newSteps }));
    setLastFocusedStepIndex(targetIdx + 1);
  };
  const updateStep = (idx: number, updates: Partial<RecipeStep>) => {
    const newSteps = [...formData.steps];
    newSteps[idx] = { ...newSteps[idx], ...updates };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };
  const removeStep = (idx: number) => setFormData(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }));

  const addIngredient = (index?: number) => {
    const targetIdx = index !== undefined ? index : (lastFocusedIngredientIndex !== null ? lastFocusedIngredientIndex : ingredients.length - 1);
    const lastGroup = ingredients.length > 0 ? (ingredients[targetIdx >= 0 ? targetIdx : 0]?.group_name || 'Ingredients') : 'Ingredients';
    const next = [...ingredients];
    next.splice(targetIdx + 1, 0, { id: Math.random().toString(), name: '', amount: '', unit: '', note: '', group_name: lastGroup });
    setIngredients(next);
    setLastFocusedIngredientIndex(targetIdx + 1);
  };
  const removeIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
    setLastFocusedIngredientIndex(null);
  };
  const updateIngredient = (idx: number, field: string, val: string) => {
    const next = [...ingredients];
    let finalVal = val;
    if (field === 'unit' && UNIT_MAPPING[val.trim().toLowerCase()]) finalVal = UNIT_MAPPING[val.trim().toLowerCase()];
    if (field === 'amount') finalVal = val.replace(/[٠-٩]/g, m => ARABIC_DIGITS_MAP[m] || m).replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75');
    // @ts-ignore
    next[idx][field] = finalVal;
    setIngredients(next);
  };

  const parseBulkIngredients = () => {
    const lines = bulkIngredientsText.split('\n').filter(l => l.trim() !== '');
    let currentGroup = 'Ingredients';
    const newIngs: any[] = [];
    const unitKeys = Object.keys(UNIT_MAPPING).sort((a, b) => b.length - a.length);

    lines.forEach(line => {
      let trimmed = line.trim().replace(/[٠-٩]/g, m => ARABIC_DIGITS_MAP[m] || m).replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75');

      // SECTION DETECTION: Only if it ends with ":" (not in the middle)
      if (trimmed.endsWith(':')) {
        currentGroup = trimmed.replace(/[:]$/g, '').trim();
        return;
      }

      if (trimmed.startsWith('#')) {
        currentGroup = trimmed.replace(/^#\s*/, '').trim();
        return;
      }

      let amount = '';
      let unit = '';
      let name = '';

      // Safer extraction: [Amount] [Unit] [Name]
      const amountMatch = trimmed.match(/^([\d\/\.\s-]+)/);
      if (amountMatch) {
        const rawAmount = amountMatch[1].trim();
        if (rawAmount.match(/[\d]/)) {
          amount = rawAmount;
          let remainder = trimmed.substring(amountMatch[0].length).trim();

          let unitFound = false;
          for (const key of unitKeys) {
            // Search for unit as a FULL WORD boundary-safe
            const unitRegex = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$|(?=\\d))', 'i');
            if (unitRegex.test(remainder)) {
              unit = UNIT_MAPPING[key];
              name = remainder.replace(unitRegex, '').trim();
              unitFound = true;
              break;
            }
          }

          if (!unitFound) {
            name = remainder;
          }
        } else {
          name = trimmed;
        }
      } else {
        name = trimmed;
      }

      if (name) {
        newIngs.push({ id: Math.random().toString(), amount, unit, name, note: '', group_name: currentGroup });
      }
    });

    setIngredients([...ingredients.filter(i => i.name), ...newIngs]);
    setShowBulkAdd(false);
  };

  const parseBulkSteps = () => {
    const lines = bulkStepsText.split('\n').filter(l => l.trim() !== '');
    let currentGroup = 'Main Steps';
    const newSteps: any[] = [];

    lines.forEach(line => {
      let text = line.trim();

      // SECTION DETECTION: Only if it ends with ":"
      if (text.endsWith(':')) {
        currentGroup = text.replace(/[:]$/g, '').trim();
        return;
      }

      if (text.startsWith('#')) {
        currentGroup = text.replace(/^#\s*/, '').trim();
        return;
      }

      const cleanedText = text.replace(/^\s*(\d+[\.\)\-]\s*|step\s*\d+[:\.\s\-]+|[\-\*]\s+)/i, '').trim();

      if (cleanedText) {
        newSteps.push({
          text: cleanedText,
          image_url: '',
          alignment: 'full' as const,
          group_name: currentGroup
        });
      }
    });

    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps.filter(s => s.text), ...newSteps]
    }));
    setShowBulkSteps(false);
  };

  return (
    <div className="min-h-screen bg-gray-50/30 font-sans">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-xl font-black gradient-text tracking-tighter leading-none">{isEditing ? 'Edit Recipe' : 'New Recipe'}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary-500 mt-1">{formData.title || 'Untitled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase text-gray-400">Completeness</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-primary-500 transition-all" style={{ width: `${completeness}%` }}></div></div>
                <span className="text-xs font-bold">{completeness}%</span>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={uploading} className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-primary-600 transition-all flex items-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />} Save
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-8 flex flex-col lg:flex-row gap-6">
        <aside className="hidden lg:block w-48 sticky top-24 h-fit space-y-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => { document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveSection(s.id); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all ${activeSection === s.id ? 'bg-white shadow-md text-gray-900 border border-gray-100' : 'text-gray-400 hover:bg-white/50'}`}>
              <span className="text-base">{s.icon}</span><span className="text-xs font-bold">{s.label}</span>
            </button>
          ))}
        </aside>

        <main className="flex-1 w-full pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

            {/* COLUMN 1 */}
            <div className="space-y-4">
              <section id="fundamentals" className="section-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-lg shadow-inner">📝</div>
                    <h2 className="text-xl font-black tracking-tighter">Fundamentals</h2>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => setShowImporter(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg active:scale-95"
                    >
                      <Sparkles size={12} />
                      Magic Import
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Title</label>
                    <input required type="text" placeholder="Recipe Name" className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 focus:bg-white focus:border-primary-500 border-none text-2xl font-black transition-all tracking-tighter shadow-sm" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Alternative Titles (comma separated)</label>
                    <input type="text" placeholder="e.g. My Favorite Pasta, Grandma's Special" className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 focus:bg-white text-sm" value={formData.alternative_titles} onChange={e => setFormData({ ...formData, alternative_titles: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Description</label>
                    <textarea required rows={3} className="w-full px-6 py-4 rounded-[1.5rem] bg-gray-50 focus:bg-white text-base" placeholder="The story behind this dish..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
              </section>

              <section id="details" className="section-card space-y-4">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg shadow-inner">⚙️</div><h2 className="text-xl font-black tracking-tighter">Recipe Details</h2></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Category</label>
                    <select
                      className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm"
                      value={(() => {
                        const cat = categories.find(c => c.id === formData.category_id);
                        return cat?.parent_id ? cat.parent_id : formData.category_id;
                      })()}
                      onChange={e => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                    >
                      <option value={0}>General</option>
                      {categories.filter(c => !c.parent_id).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Sub-Category</label>
                    <select
                      className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm"
                      value={(() => {
                        const cat = categories.find(c => c.id === formData.category_id);
                        return cat?.parent_id ? formData.category_id : 0;
                      })()}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val === 0) {
                          // REVERT to parent category
                          const cat = categories.find(c => c.id === formData.category_id);
                          const parentId = cat?.parent_id ? cat.parent_id : formData.category_id;
                          setFormData({ ...formData, category_id: parentId });
                        } else {
                          setFormData({ ...formData, category_id: val });
                        }
                      }}
                      disabled={(() => {
                        const cat = categories.find(c => c.id === formData.category_id);
                        const parentId = cat?.parent_id ? cat.parent_id : formData.category_id;
                        return !parentId || categories.filter(c => c.parent_id === parentId).length === 0;
                      })()}
                    >
                      <option value={0}>None</option>
                      {categories.filter(c => {
                        const cat = categories.find(x => x.id === formData.category_id);
                        const parentId = cat?.parent_id ? cat.parent_id : formData.category_id;
                        return c.parent_id === parentId;
                      }).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-gray-400">Additional Categories</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.secondary_category_ids.filter(id => id !== formData.category_id).map(id => {
                        const cat = categories.find(c => c.id === id);
                        return (
                          <div key={id} className="flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-bold border border-primary-100">
                            {cat?.name}
                            <button type="button" onClick={() => setFormData(f => ({ ...f, secondary_category_ids: f.secondary_category_ids.filter(x => x !== id) }))} className="hover:text-red-500"><X size={12} /></button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 py-1.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-[10px] font-bold uppercase tracking-widest"
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (val > 0 && !formData.secondary_category_ids.includes(val)) {
                            setFormData(f => ({ ...f, secondary_category_ids: [...f.secondary_category_ids, val] }));
                          }
                          e.target.value = "0";
                        }}
                      >
                        <option value="0">+ Add Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.parent_id ? `${categories.find(p => p.id === c.parent_id)?.name} > ` : ''}{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black uppercase text-gray-400">Country of Origin</label>
                    <input type="text" placeholder="e.g. Italy, Lebanon, Mexico" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm font-bold" value={formData.country_origin} onChange={e => setFormData({ ...formData, country_origin: e.target.value })} />
                  </div>
                  <div className="space-y-1 col-span-2"><label className="text-[10px] font-black uppercase text-gray-400">Rating</label><div className="flex items-center gap-2 h-10 px-4 bg-gray-50/50 rounded-lg">{[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setFormData({ ...formData, rating: s })}><Star size={16} className={s <= formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} /></button>)}</div></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Servings</label><input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.servings} onChange={e => setFormData({ ...formData, servings: e.target.value })} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Prep (Min)</label><input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.prep_time} onChange={e => setFormData({ ...formData, prep_time: e.target.value })} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Cook (Min)</label><input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.cook_time} onChange={e => setFormData({ ...formData, cook_time: e.target.value })} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-400">Tags</label><input type="text" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" placeholder="#healthy" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} /></div>
                </div>
              </section>

              <section id="media" className="section-card space-y-4">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg shadow-inner">🖼️</div><h2 className="text-xl font-black tracking-tighter">Media Assets</h2></div>
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="h-32 rounded-[1.5rem] bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden relative group transition-all hover:bg-gray-100/50">
                      {formData.image_url ? (
                        <>
                          <img src={getOptimizedImageUrl(formData.image_url)} className="w-full h-full object-cover" />
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button type="button" onClick={() => onEditImage(formData.image_url, 'main')} className="p-3 bg-black/50 text-white rounded-2xl hover:bg-primary-500 transition-all"><Maximize2 size={20} /></button>
                            <button type="button" onClick={() => setFormData({ ...formData, image_url: '' })} className="p-3 bg-black/50 text-white rounded-2xl hover:bg-red-500 transition-all"><X size={20} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center cursor-pointer">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-3"><Upload className="text-primary-500 w-5 h-5" /></div>
                          <p className="font-black text-xs">Cover Image</p><input type="file" accept="image/*" onChange={e => onSelectFile(e, 'main')} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                      )}
                    </div>
                    {/* Image URL Input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 px-1">Or Paste Image URL</label>
                      <input type="text" placeholder="https://..." className="w-full px-4 py-2.5 rounded-lg bg-gray-50 focus:bg-white text-sm border-none" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: fixImageUrl(e.target.value) || '' })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 px-1">Video URL</label>
                      <input type="text" placeholder="YouTube, TikTok, Drive, Dropbox, Box, or MP4" className="w-full px-4 py-2.5 rounded-lg bg-gray-50 focus:bg-white text-sm border-none" value={formData.video_url} onChange={e => setFormData({ ...formData, video_url: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 px-1">Source URL</label>
                      <input type="text" placeholder="Original recipe link" className="w-full px-4 py-2.5 rounded-lg bg-gray-50 focus:bg-white text-sm border-none" value={formData.source_url} onChange={e => setFormData({ ...formData, source_url: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-gray-400">Gallery</label>
                    <div className="grid grid-cols-5 gap-2">
                      {formData.gallery_urls.map((g, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden relative group border border-gray-100">
                          <img src={getOptimizedImageUrl(g.url)} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setFormData(p => ({ ...p, gallery_urls: p.gallery_urls.filter((_, idx) => idx !== i) }))} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><Trash2 size={16} /></button>
                        </div>
                      ))}
                      <div className="aspect-square rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 relative hover:bg-gray-100 cursor-pointer overflow-hidden"><Plus size={16} /><input type="file" multiple accept="image/*" onChange={handleGalleryAdd} className="absolute inset-0 opacity-0 cursor-pointer" /></div>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* COLUMN 2 */}
            <div className="space-y-4">
              <section id="ingredients" className="section-card space-y-4">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg shadow-inner">🥗</div><h2 className="text-xl font-black tracking-tighter">Ingredients</h2></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className="text-[10px] font-black uppercase text-gray-400 hover:text-primary-600 flex items-center mr-2">Bulk Import</button>
                    <button type="button" onClick={() => setIngredients([...ingredients, { id: Math.random().toString(), name: '', amount: '', unit: '', note: '', group_name: 'New Section' }])} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg font-black text-[10px] uppercase shadow-sm hover:bg-gray-100 transition-all">+ Section</button>
                    <button type="button" onClick={() => addIngredient()} className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg font-black text-[10px] uppercase shadow-sm hover:bg-primary-100 transition-all">+ Item</button>
                  </div>
                </div>
                {showBulkAdd && (
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-3 shadow-inner">
                    <textarea rows={4} className="w-full p-4 rounded-xl text-sm bg-white" placeholder="2 cups Milk&#10;1kg Flour..." value={bulkIngredientsText} onChange={e => setBulkIngredientsText(e.target.value)} />
                    <button type="button" onClick={parseBulkIngredients} className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-black text-xs uppercase shadow-lg">Import Items</button>
                  </div>
                )}
                <Reorder.Group axis="y" values={ingredients} onReorder={setIngredients} className="space-y-4">
                  {ingredients.map((ing, i) => {
                    const prevIng = ingredients[i - 1];
                    const showHeader = !prevIng || prevIng.group_name !== ing.group_name;

                    return (
                      <Reorder.Item key={ing.id} value={ing} className="space-y-4">
                        {showHeader && (
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 first:mt-0 first:pt-0 first:border-0">
                            <input type="text" className="flex-1 bg-transparent text-sm font-black text-gray-900 border-none px-0 outline-none uppercase tracking-widest placeholder:text-gray-300" placeholder="Group Name (e.g. Marinade)" value={ing.group_name} onChange={e => {
                              const next = [...ingredients];
                              const oldGroup = ing.group_name;
                              for (let j = i; j < next.length; j++) {
                                if (next[j].group_name === oldGroup) next[j].group_name = e.target.value;
                                else break;
                              }
                              setIngredients(next);
                            }} />
                            <button type="button" onClick={() => addIngredient(i)} className="text-[10px] font-black text-primary-600 uppercase">+ Item</button>
                          </div>
                        )}
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 space-y-2">
                          <div className="flex gap-2 group items-center">
                            <div className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500">
                              <GripVertical size={16} />
                            </div>
                            <input type="text" placeholder="Item" className="flex-1 bg-gray-50 focus:bg-white rounded-lg py-2.5 px-3 text-sm font-medium border-none" value={ing.name} onFocus={() => setLastFocusedIngredientIndex(i)} onChange={e => updateIngredient(i, 'name', e.target.value)} />
                            <input type="text" placeholder="Qty" className="w-16 bg-gray-50 focus:bg-white rounded-lg py-2.5 px-2 text-center text-sm font-medium border-none" value={ing.amount} onFocus={() => setLastFocusedIngredientIndex(i)} onChange={e => updateIngredient(i, 'amount', e.target.value)} />
                            <input type="text" placeholder="Unit" list="unit-options" className="w-20 bg-gray-50 focus:bg-white rounded-lg py-2.5 px-2 text-sm font-medium border-none" value={ing.unit} onFocus={() => setLastFocusedIngredientIndex(i)} onChange={e => updateIngredient(i, 'unit', e.target.value)} />
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => addIngredient(i)} className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors" title="Add after this"><Plus size={16} /></button>
                              <button type="button" onClick={() => removeIngredient(i)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Remove"><X size={16} /></button>
                            </div>
                          </div>
                          <div className="pl-9 pr-12 pb-1">
                            <input
                              type="text"
                              placeholder="Add a note for this ingredient (e.g. finely chopped, room temperature...)"
                              className="w-full bg-transparent text-[10px] font-bold text-gray-400 border-none outline-none focus:text-primary-500 placeholder:text-gray-200"
                              value={ing.note || ''}
                              onChange={e => updateIngredient(i, 'note', e.target.value)}
                            />
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </section>

              <section id="instructions" className="section-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg shadow-inner">👨‍🍳</div><h2 className="text-xl font-black tracking-tighter">Cooking Steps</h2></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBulkSteps(!showBulkSteps)} className="text-[10px] font-black uppercase text-gray-400 hover:text-primary-600">Bulk</button>
                    <button type="button" onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        steps: [...prev.steps, { id: Math.random().toString(), text: '', image_url: '', alignment: 'full', group_name: 'New Section' }]
                      }));
                    }} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg font-black text-[10px] uppercase shadow-sm hover:bg-gray-100 transition-all">+ Section</button>
                    <button type="button" onClick={() => addStep()} className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg font-black text-[10px] uppercase shadow-sm hover:bg-primary-100 transition-all">+ Step</button>
                  </div>
                </div>
                {showBulkSteps && (
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-3 shadow-inner">
                    <textarea rows={6} className="w-full p-4 rounded-xl text-sm bg-white" placeholder="Preheat oven...&#10;Mix dry ingredients..." value={bulkStepsText} onChange={e => setBulkStepsText(e.target.value)} />
                    <button type="button" onClick={parseBulkSteps} className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-black text-xs uppercase shadow-lg">Import Steps</button>
                  </div>
                )}
                <Reorder.Group axis="y" values={formData.steps} onReorder={(newSteps) => setFormData(p => ({ ...p, steps: newSteps }))} className="space-y-3">
                  {formData.steps.map((s, i) => {
                    const prevStep = formData.steps[i - 1];
                    const showHeader = !prevStep || prevStep.group_name !== s.group_name;
                    return (
                      <Reorder.Item key={s.id} value={s} className="space-y-3">
                        {showHeader && (
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 first:mt-0 first:pt-0 first:border-0">
                            <input type="text" className="flex-1 bg-transparent text-sm font-black text-gray-900 border-none px-0 outline-none uppercase tracking-widest placeholder:text-gray-300" placeholder="Section Name (e.g. Preparation)" value={s.group_name} onChange={e => {
                              const newSteps = [...formData.steps];
                              const oldSection = s.group_name;
                              for (let j = i; j < newSteps.length; j++) {
                                if (newSteps[j].group_name === oldSection) newSteps[j].group_name = e.target.value;
                                else break;
                              }
                              setFormData(prev => ({ ...prev, steps: newSteps }));
                            }} />
                            <button type="button" onClick={() => addStep(i)} className="text-[10px] font-black text-primary-600 uppercase">+ Step</button>
                          </div>
                        )}
                        <div className="relative group p-3 rounded-2xl bg-white border border-gray-100 transition-all hover:shadow-lg flex gap-3 items-start">
                          <div className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 mt-1">
                            <GripVertical size={16} />
                          </div>
                          <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-1">{i + 1}</div>

                          <div className="flex-1 flex flex-col gap-2">
                            <textarea required className="w-full bg-transparent border-none text-sm font-semibold p-0 placeholder:text-gray-300 min-h-[30px] pt-0.5 resize-none" rows={1} placeholder="Step description..." value={s.text} onFocus={() => setLastFocusedStepIndex(i)} onChange={e => updateStep(i, { text: e.target.value })} onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }} />

                            <div className="flex items-center gap-2">
                              {s.image_url ? (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden relative group/img shrink-0">
                                  <img src={getOptimizedImageUrl(s.image_url)} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-all">
                                    <button type="button" onClick={() => s.image_url && onEditImage(s.image_url, 'step', i)} className="p-0.5 text-white hover:text-primary-400 transition-colors"><Maximize2 size={10} /></button>
                                    <button type="button" onClick={() => updateStep(i, { image_url: '' })} className="p-0.5 text-white hover:text-red-400 transition-colors"><X size={10} /></button>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-white border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group/img shrink-0 hover:bg-gray-50 cursor-pointer">
                                  <ImageIcon size={14} className="text-gray-300" />
                                  <input type="file" accept="image/*" onChange={e => onSelectFile(e, 'step', i)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                              )}
                              <input type="text" placeholder="Image URL..." className="flex-1 px-2 py-1.5 rounded-lg bg-white focus:bg-gray-50 text-[10px] border border-gray-100 focus:border-primary-500 transition-colors" value={s.image_url} onChange={e => updateStep(i, { image_url: fixImageUrl(e.target.value) || '' })} />
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                <button type="button" onClick={() => addStep(i)} className="p-1 text-gray-400 hover:text-primary-500 transition-all" title="Add after this"><Plus size={14} /></button>
                                <button type="button" onClick={() => removeStep(i)} className="p-1 text-gray-300 hover:text-red-500 transition-all" title="Remove"><X size={14} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </section>

              <section id="notes" className="section-card space-y-4">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-lg shadow-inner">📌</div><h2 className="text-xl font-black tracking-tighter">Notes</h2></div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 px-1">Additional Tips or Info</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-xl bg-gray-50 focus:bg-white text-sm" placeholder="Any extra tips..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
              </section>

              <section id="nutrition" className="section-card space-y-4">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-lg shadow-inner">📊</div><h2 className="text-xl font-black tracking-tighter">Nutrition Facts</h2></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Calories (kcal)</label>
                    <input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.nutrition.calories} onChange={e => setFormData({ ...formData, nutrition: { ...formData.nutrition, calories: e.target.value } })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Protein (g)</label>
                    <input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.nutrition.protein} onChange={e => setFormData({ ...formData, nutrition: { ...formData.nutrition, protein: e.target.value } })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Fat (g)</label>
                    <input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.nutrition.fat} onChange={e => setFormData({ ...formData, nutrition: { ...formData.nutrition, fat: e.target.value } })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Carbs (g)</label>
                    <input type="number" className="w-full py-2.5 px-3 rounded-lg bg-gray-50 focus:bg-white text-sm" value={formData.nutrition.carbs} onChange={e => setFormData({ ...formData, nutrition: { ...formData.nutrition, carbs: e.target.value } })} />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {cropModalOpen && imageToCrop && <ImageCropper imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => setCropModalOpen(false)} aspectRatio={cropTarget?.type === 'main' ? 4 / 3 : 1} />}
      </AnimatePresence>

      <datalist id="unit-options">
        {COMMON_UNITS.map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <LinkImporterModal
        isOpen={showImporter}
        onClose={() => setShowImporter(false)}
        onImportSuccess={(data) => {
          setFormData(prev => ({
            ...prev,
            title: data.title || prev.title,
            description: data.description || prev.description,
            image_url: data.image_url || prev.image_url,
            video_url: data.video_url || data.original_url || prev.video_url,
            source_url: data.original_url || prev.source_url,
            prep_time: String(data.time_minutes || 30),
            cook_time: '0',
            servings: String(data.servings || 4),
            nutrition: data.nutrition ? {
              calories: String(data.nutrition.calories || 0),
              protein: String(data.nutrition.protein || 0),
              fat: String(data.nutrition.fat || 0),
              carbs: String(data.nutrition.carbs || 0),
            } : prev.nutrition,
            steps: data.steps ? data.steps.map((s: any) => {
              if (typeof s === 'string') return {
                id: Math.random().toString(),
                text: s,
                image_url: '',
                alignment: 'full',
                group_name: 'Main Steps'
              };
              return {
                id: Math.random().toString(),
                text: s.text || '',
                image_url: s.image_url || '',
                alignment: 'full',
                group_name: 'Main Steps'
              };
            }) : prev.steps
          }));

          if (data.ingredients) {
            setIngredients(data.ingredients.map((ing: any) => {
              const cleaned = cleanIngData(ing);
              return {
                id: Math.random().toString(),
                name: cleaned.name || '',
                amount: String(cleaned.amount || ''),
                unit: cleaned.unit || '',
                note: cleaned.note || '',
                group_name: cleaned.group_name || 'Main'
              };
            }));
          }

          toast.success('Fields populated! Preview and save.');
        }}
      />
    </div>
  );
}
