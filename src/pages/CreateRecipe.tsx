import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus, X, Upload, Loader2, Trash2,
  AlignLeft, AlignCenter, AlignRight, Maximize,
  Play, ExternalLink, Star, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useCategories } from '@/lib/hooks';
import ImageCropper from '@/components/ImageCropper';

interface RecipeStep {
  text: string;
  image_url?: string;
  alignment: 'left' | 'center' | 'right' | 'full';
}

interface GalleryItem {
  url: string;
  caption?: string;
}

export default function CreateRecipe() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const { categories } = useCategories();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    video_url: '',
    source_url: '',
    category_id: 0,
    steps: [{ text: '', image_url: '', alignment: 'full' }] as RecipeStep[],
    gallery_urls: [] as GalleryItem[],
    rating: 3,
    tags: '',
    prep_time: '15',
    cook_time: '30',
    servings: '4',
    nutrition: {
      calories: '0',
      protein: '0',
      fat: '0',
      carbs: '0'
    }
  });

  const [uploading, setUploading] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showBulkSteps, setShowBulkSteps] = useState(false);
  const [bulkIngredientsText, setBulkIngredientsText] = useState('');
  const [bulkStepsText, setBulkStepsText] = useState('');
  const [showBulkNutrition, setShowBulkNutrition] = useState(false);
  const [bulkNutritionText, setBulkNutritionText] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', amount: '', unit: 'g' }]);

  const ingredientRefs = useRef<Array<HTMLInputElement | null>>([]);
  const stepRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  // Crop State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ type: 'main' | 'step', index?: number } | null>(null);

  const readFile = (file: File) => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string));
      reader.readAsDataURL(file);
    });
  };

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'step', index?: number) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageToCrop(imageDataUrl);
      setCropTarget({ type, index });
      setCropModalOpen(true);
      e.target.value = ''; // Reset so same file can be selected again
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setUploading(true);
      const fileExt = 'jpeg';
      const fileName = `${Math.random()}.${fileExt}`;
      const file = new File([croppedBlob], fileName, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('recipes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('recipes').getPublicUrl(fileName);
      const url = data.publicUrl;

      if (cropTarget?.type === 'main') {
        setFormData(prev => ({ ...prev, image_url: url }));
      } else if (cropTarget?.type === 'step' && typeof cropTarget.index === 'number') {
        updateStep(cropTarget.index, { image_url: url });
      }

      setCropModalOpen(false);
      setImageToCrop(null);
      setCropTarget(null);
    } catch (error) {
      alert('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    async function loadRecipe() {
      if (isEditing && id) {
        try {
          const { data: recipe, error } = await supabase
            .from('recipes')
            .select(`
              *,
              recipe_ingredients(
                amount_in_grams,
                unit,
                ingredient:ingredients(name)
              ),
              recipe_tags(
                tags(name)
              )
            `)
            .eq('id', id)
            .single();

          if (error) throw error;

          if (recipe) {
            // Migrating old steps format to new objects if necessary
            const rawSteps = recipe.steps || [''];
            const migratedSteps: RecipeStep[] = rawSteps.map((s: any) =>
              typeof s === 'string' ? { text: s, image_url: '', alignment: 'full' } : s
            );

            setFormData({
              title: recipe.title,
              description: recipe.description || '',
              image_url: recipe.image_url || '',
              video_url: recipe.video_url || '',
              source_url: recipe.source_url || '',
              category_id: recipe.category_id || 0,
              steps: migratedSteps,
              gallery_urls: recipe.gallery_urls || [],
              rating: recipe.rating || 3,
              tags: recipe.recipe_tags?.map((rt: any) => `#${rt.tags?.name}`).join(' ') || '',
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

            setIngredients(recipe.recipe_ingredients?.map((i: any) => ({
              name: i.ingredient?.name || '',
              amount: i.amount_in_grams.toString(),
              unit: i.unit || 'g'
            })) || [{ name: '', amount: '', unit: 'g' }]);
          }
        } catch (error) {
          console.error('Error loading recipe:', error);
          alert('Failed to load recipe');
        }
      }
    }

    loadRecipe();
  }, [id, isEditing]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
    });
  }, [navigate]);

  // Pre-fill category from URL parameter
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam && !isEditing) {
      const categoryId = parseInt(categoryParam, 10);
      if (!isNaN(categoryId)) {
        setFormData(prev => ({ ...prev, category_id: categoryId }));
      }
    }
  }, [searchParams, isEditing]);

  const handleFileUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('recipes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('recipes').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleGalleryAdd = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files) return;
      const newFiles = Array.from(event.target.files);
      const newUrls: GalleryItem[] = [];

      for (const file of newFiles) {
        const url = await handleFileUpload(file);
        newUrls.push({ url });
      }

      setFormData({ ...formData, gallery_urls: [...formData.gallery_urls, ...newUrls] });
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in');
        navigate('/auth');
        return;
      }

      const prep = parseInt(formData.prep_time) || 0;
      const cook = parseInt(formData.cook_time) || 0;

      const recipeData = {
        title: formData.title,
        description: formData.description,
        image_url: formData.image_url || null,
        video_url: formData.video_url || null,
        source_url: formData.source_url || null,
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
      };

      let recipeId: string;

      if (isEditing) {
        const { error } = await supabase.from('recipes').update(recipeData).eq('id', id);
        if (error) throw error;
        recipeId = id!;
      } else {
        const { data, error } = await supabase.from('recipes').insert([recipeData]).select().single();
        if (error) throw error;
        recipeId = data.id;
      }

      // Sync Ingredients
      const currentIngredients = ingredients.filter(ing => ing.name.trim() !== '');
      if (isEditing) {
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      }

      for (const ing of currentIngredients) {
        let { data: existingIng } = await supabase.from('ingredients').select('id').eq('name', ing.name).single();
        let ingredientId: number;
        if (!existingIng) {
          const { data: newIng, error } = await supabase.from('ingredients').insert([{ name: ing.name }]).select().single();
          if (error) throw error;
          ingredientId = newIng.id;
        } else {
          ingredientId = existingIng.id;
        }
        await supabase.from('recipe_ingredients').insert([{
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          amount_in_grams: parseFloat(ing.amount) || 0,
          unit: ing.unit || 'g'
        }]);
      }

      // Sync Tags
      const tagsList = formData.tags.split(/\s+/).filter(t => t.startsWith('#')).map(t => t.toLowerCase());
      if (isEditing) await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId);
      for (const tagName of tagsList) {
        const cleanTagName = tagName.substring(1);
        if (!cleanTagName) continue;
        let { data: tag } = await supabase.from('tags').select('id').eq('name', cleanTagName).single();
        if (!tag) {
          const { data: newTag, error: tagErr } = await supabase.from('tags').insert([{ name: cleanTagName }]).select().single();
          if (tagErr) throw tagErr;
          tag = newTag;
        }
        if (tag) await supabase.from('recipe_tags').insert([{ recipe_id: recipeId, tag_id: tag.id }]);
      }

      alert(isEditing ? 'Recipe updated!' : 'Recipe published!');
      navigate(isEditing ? `/recipe/${id}` : '/');

    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Failed to save recipe: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this recipe?')) return;
    try {
      setUploading(true);
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
      navigate('/');
    } catch (error) {
      alert('Delete failed');
    } finally {
      setUploading(false);
    }
  };

  const addStep = () => {
    setFormData((prev: any) => ({ ...prev, steps: [...prev.steps, { text: '', image_url: '', alignment: 'full' }] }));
    setTimeout(() => {
      const lastIndex = formData.steps.length;
      stepRefs.current[lastIndex]?.focus();
    }, 0);
  };
  const updateStep = (idx: number, updates: Partial<RecipeStep>) => {
    const newSteps = [...formData.steps];
    newSteps[idx] = { ...newSteps[idx], ...updates };
    setFormData({ ...formData, steps: newSteps });
  };
  const removeStep = (idx: number) => setFormData({ ...formData, steps: formData.steps.filter((_, i) => i !== idx) });

  const addIngredient = () => {
    setIngredients((prev: any) => [...prev, { name: '', amount: '', unit: 'g' }]);
    setTimeout(() => {
      const lastIndex = ingredients.length;
      ingredientRefs.current[lastIndex]?.focus();
    }, 0);
  };
  const updateIngredient = (idx: number, field: string, val: string) => {
    const newIngredients = [...ingredients];
    // @ts-ignore
    newIngredients[idx][field] = val;
    setIngredients(newIngredients);
  };
  const removeIngredient = (idx: number) => setIngredients(ingredients.filter((_, i) => i !== idx));

  const parseBulkSteps = () => {
    const lines = bulkStepsText.split('\n').filter((line: string) => line.trim() !== '');
    const newSteps = lines.map((line: string) => ({ text: line.trim(), image_url: '', alignment: 'full' as any }));
    setFormData((prev: any) => ({ ...prev, steps: [...prev.steps.filter((s: RecipeStep) => s.text !== ''), ...newSteps] }));
    setBulkStepsText('');
    setShowBulkSteps(false);
  };

  const parseBulkIngredients = () => {
    const lines = bulkIngredientsText.split('\n').filter(line => line.trim() !== '');
    const newIngredients = lines.map(line => {
      const match = line.match(/^([\d\/\.]+)?\s*(g|ml|pcs|cup|lb|oz|tbsp|tsp)?\s*(.*)$/i);
      if (match) {
        return {
          amount: match[1] || '1',
          unit: (match[2]?.toLowerCase() as any) || 'pcs',
          name: match[3]?.trim() || line.trim()
        };
      }
      return { name: line.trim(), amount: '1', unit: 'pcs' };
    });

    setIngredients([...ingredients.filter(i => i.name !== ''), ...newIngredients]);
    setBulkIngredientsText('');
    setShowBulkAdd(false);
  };

  const parseBulkNutrition = () => {
    const lines = bulkNutritionText.split('\n');
    const newNutrition = { ...formData.nutrition };

    lines.forEach(line => {
      const lower = line.toLowerCase();
      const match = line.match(/(\d+)/);
      if (!match) return;
      const val = match[1];

      if (lower.includes('cal')) newNutrition.calories = val;
      else if (lower.includes('prot')) newNutrition.protein = val;
      else if (lower.includes('fat')) newNutrition.fat = val;
      else if (lower.includes('carb')) newNutrition.carbs = val;
    });

    setFormData(prev => ({ ...prev, nutrition: newNutrition }));
    setBulkNutritionText('');
    setShowBulkNutrition(false);
  };

  const createNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { data, error } = await supabase.from('categories').insert([{
        name: newCategoryName,
        slug: newCategoryName.toLowerCase().replace(/\s+/g, '-'),
        image_url: null
      }]).select().single();
      if (error) throw error;
      setFormData({ ...formData, category_id: data.id });
      setNewCategoryName('');
      setShowNewCategoryModal(false);
      window.location.reload();
    } catch (error) {
      alert('Failed: ' + (error as Error).message);
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto py-8 px-4 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 tracking-tighter leading-none">{isEditing ? 'Edit Recipe' : 'New Recipe'}</h1>
        <div className="h-1 w-12 bg-primary-600 mx-auto rounded-full"></div>
      </div>

      <form onSubmit={handleSubmit} className="pb-20">
        <div className="grid lg:grid-cols-2 gap-8 items-start">

          {/* LEFT COLUMN */}
          <div className="space-y-8">
            {/* Section 1: Basic Info */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shadow-inner">
                  <span className="text-xl font-black">1</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Fundamentals</h2>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Recipe Identity</label>
                  <input
                    required
                    type="text"
                    placeholder="The name of your masterpiece..."
                    className="w-full px-6 py-4 rounded-3xl border-gray-100 bg-gray-50 focus:bg-white focus:border-primary-500 focus:ring-primary-500 text-2xl font-bold transition-all placeholder:text-gray-300"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Story & Context</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-6 py-4 rounded-3xl border-gray-100 bg-gray-50 focus:bg-white focus:border-primary-500 focus:ring-primary-500 font-medium transition-all"
                    placeholder="What inspired this dish? (e.g., 'Passed down from my grandmother...')"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* Section 2: Media Assets */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner">
                  <span className="text-xl font-black">2</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Media Assets</h2>
              </div>

              <div className="space-y-12">
                {/* Main Image */}
                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Primary Cover Photo</label>
                  <div className="relative aspect-[4/3] max-h-64 rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden group transition-all hover:border-primary-200">
                    {formData.image_url ? (
                      <>
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                          className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors shadow-lg"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3">
                          <Upload size={24} className="opacity-30" />
                        </div>
                        <p className="font-bold text-sm">Drop image or click</p>
                        <p className="text-[9px] uppercase font-black tracking-widest mt-1 opacity-50">Landscape preferred</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={(e) => onSelectFile(e, 'main')} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                  </div>
                  <input
                    type="text"
                    placeholder="Or paste image URL..."
                    className="w-full px-4 py-2 rounded-xl border-gray-100 bg-gray-50 text-xs font-bold focus:bg-white focus:border-primary-500 focus:ring-primary-500"
                    value={formData.image_url}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  />
                </div>

                {/* Gallery Section */}
                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Photo Gallery (Extended views)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {formData.gallery_urls.map((item, idx) => (
                      <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden border border-gray-100 group shadow-sm">
                        <img src={item.url} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, gallery_urls: formData.gallery_urls.filter((_, i) => i !== idx) })}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="relative aspect-square rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer overflow-hidden">
                      <Plus size={24} />
                      <span className="text-[10px] font-black uppercase mt-1">Add More</span>
                      <input type="file" multiple accept="image/*" onChange={handleGalleryAdd} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                    </div>
                  </div>
                </div>

                {/* Video & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-50">
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Video link (YT/TT/IG)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500"><Play size={20} /></div>
                      <input
                        type="text"
                        placeholder="URL for tutorial..."
                        className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-gray-100 font-bold focus:bg-white focus:border-primary-500 transition-all"
                        value={formData.video_url}
                        onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 px-1">Source</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><ExternalLink size={20} /></div>
                      <input
                        type="text"
                        placeholder="Credit author..."
                        className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-gray-100 font-bold focus:bg-white focus:border-primary-500 transition-all"
                        value={formData.source_url}
                        onChange={e => setFormData({ ...formData, source_url: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Configuration */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
              <div className="flex items-center gap-4 border-b border-gray-50 pb-6">
                <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-xl">⚙️</div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Configuration</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Category</label>
                  <select
                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-gray-100 font-bold focus:bg-white focus:border-primary-500"
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                  >
                    <option value="">Choose Path</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewCategoryModal(true)} className="text-[10px] font-black uppercase text-primary-600 tracking-widest ml-1 hover:underline">+ New Group</button>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Cook's Rating</label>
                  <div className="flex gap-2 items-center bg-gray-50 h-[58px] px-6 rounded-2xl border border-gray-100">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setFormData({ ...formData, rating: star })} className="transform hover:scale-125 transition-transform">
                        <Star size={24} className={`${star <= formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Tags (Search terms)</label>
                  <input
                    type="text"
                    placeholder="#vegan #dinner..."
                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-gray-100 font-bold focus:bg-white"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Prep Time</label>
                  <div className="relative">
                    <input type="number" className="w-full px-6 py-4 pr-16 rounded-2xl bg-gray-50 border-gray-100 font-bold" value={formData.prep_time} onChange={e => setFormData({ ...formData, prep_time: e.target.value })} />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">min</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Cook Time</label>
                  <div className="relative">
                    <input type="number" className="w-full px-6 py-4 pr-16 rounded-2xl bg-gray-50 border-gray-100 font-bold" value={formData.cook_time} onChange={e => setFormData({ ...formData, cook_time: e.target.value })} />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">min</span>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Servings</label>
                  <div className="relative">
                    <input type="number" className="w-full px-6 py-4 pr-16 rounded-2xl bg-gray-50 border-gray-100 font-bold" value={formData.servings} onChange={e => setFormData({ ...formData, servings: e.target.value })} />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm">👥</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            {/* Section 5: Ingredients */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-xl shadow-inner">🍏</div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Ingredients</h3>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className="text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-primary-600">Bulk</button>
                  <button type="button" onClick={addIngredient} className="text-primary-600 font-black text-[10px] uppercase tracking-widest">+ Add</button>
                </div>
              </div>

              <AnimatePresence>
                {showBulkAdd && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4 overflow-hidden"
                  >
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Multiple Items (One per line)</label>
                    <textarea
                      rows={5}
                      className="w-full px-5 py-4 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-mono"
                      placeholder="2 cups Milk&#10;300g Flour&#10;2 Eggs"
                      value={bulkIngredientsText}
                      onChange={e => setBulkIngredientsText(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowBulkAdd(false)} className="px-4 py-2 text-xs font-bold text-gray-400">Cancel</button>
                      <button type="button" onClick={parseBulkIngredients} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Import</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <input
                      ref={el => ingredientRefs.current[idx] = el}
                      type="text"
                      placeholder="Item"
                      className="flex-1 bg-gray-50 border-none rounded-xl text-xs font-bold px-3 py-1.5"
                      value={ing.name}
                      onChange={e => updateIngredient(idx, 'name', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    />
                    <input type="text" placeholder="Q" className="w-12 bg-gray-50 border-none rounded-xl text-xs font-bold text-center" value={ing.amount} onChange={e => updateIngredient(idx, 'amount', e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIngredient())} />
                    <select className="w-14 bg-gray-50 border-none rounded-xl text-[8px] font-black" value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)}>
                      {['g', 'ml', 'tsp', 'tbsp', 'cup', 'lb', 'pcs'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button type="button" onClick={() => removeIngredient(idx)} className="p-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </section>
            {/* Section 4: Advanced Instructions */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-inner">
                    <span className="text-xl font-black">4</span>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Instructions</h2>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowBulkSteps(!showBulkSteps)} className="text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-primary-600">Bulk</button>
                  <button type="button" onClick={addStep} className="px-4 py-2 bg-primary-50 text-primary-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-100 transition-all">+ Add Step</button>
                </div>
              </div>

              <AnimatePresence>
                {showBulkSteps && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4 overflow-hidden"
                  >
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Describe steps (One per line)</label>
                    <textarea
                      rows={5}
                      className="w-full px-5 py-4 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                      placeholder="First, boil the water...&#10;Then add salt..."
                      value={bulkStepsText}
                      onChange={e => setBulkStepsText(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowBulkSteps(false)} className="px-4 py-2 text-xs font-bold text-gray-400">Cancel</button>
                      <button type="button" onClick={parseBulkSteps} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Import</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-12">
                {formData.steps.map((step, idx) => (
                  <div key={idx} className="relative p-6 rounded-[2rem] bg-gray-50 border border-gray-100 group transition-all hover:bg-white hover:shadow-lg">
                    <div className="absolute -left-4 top-6 w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-lg shadow-xl">{idx + 1}</div>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="flex-1 w-full space-y-6">
                        <textarea
                          ref={el => stepRefs.current[idx] = el}
                          required
                          className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold p-0 min-h-[100px] placeholder:text-gray-200"
                          placeholder={`Explain step ${idx + 1} in detail...`}
                          value={step.text}
                          onChange={e => updateStep(idx, { text: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addStep())}
                        />

                        <div className="flex items-center gap-4 pt-4 border-t border-gray-200/50">
                          <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-100">
                            {[
                              { val: 'left', icon: <AlignLeft size={16} /> },
                              { val: 'center', icon: <AlignCenter size={16} /> },
                              { val: 'right', icon: <AlignRight size={16} /> },
                              { val: 'full', icon: <Maximize size={16} /> }
                            ].map(align => (
                              <button
                                key={align.val}
                                type="button"
                                onClick={() => updateStep(idx, { alignment: align.val as any })}
                                className={`p-2 rounded-lg transition-all ${step.alignment === align.val ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
                              >
                                {align.icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="relative w-32 aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex-shrink-0 cursor-pointer overflow-hidden group/img hover:border-primary-200 transition-colors">
                        {step.image_url ? (
                          <>
                            <img src={step.image_url} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => updateStep(idx, { image_url: '' })} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center font-black text-[10px] uppercase">Remove</button>
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="text-gray-300" />
                            <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">Step Photo</span>
                            <input type="file" accept="image/*" onChange={(e) => onSelectFile(e, 'step', idx)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="absolute -right-3 -top-3 w-10 h-10 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-lg flex items-center justify-center transition-all border border-gray-50 z-10"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 6: Nutrition Facts */}
            <section className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Nutrition Facts</h3>
                </div>
                <div className="flex gap-4 items-center">
                  <button type="button" onClick={() => setShowBulkNutrition(!showBulkNutrition)} className="text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-primary-600">Bulk</button>
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">per serving</span>
                </div>
              </div>

              <AnimatePresence>
                {showBulkNutrition && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4 overflow-hidden"
                  >
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nutrition Details (One per line)</label>
                    <textarea
                      rows={4}
                      className="w-full px-5 py-4 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-mono"
                      placeholder="Calories: 350&#10;Protein: 20g&#10;Fat: 12g&#10;Carbs: 45g"
                      value={bulkNutritionText}
                      onChange={e => setBulkNutritionText(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowBulkNutrition(false)} className="px-4 py-2 text-xs font-bold text-gray-400">Cancel</button>
                      <button type="button" onClick={parseBulkNutrition} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Import</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(formData.nutrition).map((key) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{key}</label>
                    <input
                      type="number"
                      className="w-full bg-gray-50 border-none rounded-xl text-sm font-bold px-4 py-3"
                      value={formData.nutrition[key as keyof typeof formData.nutrition]}
                      onChange={e => setFormData({ ...formData, nutrition: { ...formData.nutrition, [key]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </form>

      {/* Action Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-50 pointer-events-none px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between pointer-events-auto">
          <button type="button" onClick={() => navigate(-1)} className="p-5 bg-white rounded-full shadow-2xl border border-gray-100 text-gray-400 hover:text-gray-900 transition-all">
            <ArrowLeft size={24} />
          </button>

          <div className="flex gap-3">
            {isEditing && (
              <button type="button" onClick={handleDelete} className="p-5 bg-white text-red-200 hover:text-red-500 rounded-full shadow-2xl border border-red-50 transition-all">
                <Trash2 size={24} />
              </button>
            )}
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
              disabled={uploading}
              className="px-8 py-4 bg-gray-900 text-white rounded-full font-black text-lg shadow-2xl shadow-gray-300 hover:bg-primary-600 hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-50 disabled:transform-none"
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
              {isEditing ? 'Update Masterpiece' : 'Publish to Kitchen'}
            </button>
          </div>
        </div>
      </div>

      {/* Modern Category Modal */}
      <AnimatePresence>
        {showNewCategoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-gray-100 relative">
              <button onClick={() => setShowNewCategoryModal(false)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-900"><X size={24} /></button>
              <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-8 leading-none">New Creation Path</h3>
              <input
                autoFocus
                type="text"
                placeholder="e.g., Healthy Morning"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xl font-bold mb-8 placeholder:text-gray-200"
                onKeyPress={(e) => e.key === 'Enter' && createNewCategory()}
              />
              <button type="button" onClick={createNewCategory} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-100 hover:bg-primary-700 transition-all">Create Path</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cropModalOpen && imageToCrop && (
          <ImageCropper
            imageSrc={imageToCrop}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setCropModalOpen(false);
              setImageToCrop(null);
              setCropTarget(null);
            }}
            aspectRatio={cropTarget?.type === 'main' ? 4 / 3 : 1}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
