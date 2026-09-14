import { FaqCategory } from '../models/faqCategory.model.js';
import { Faq } from '../models/faq.model.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findFaqCategoryByName = (name) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return null;

  return FaqCategory.findOne({
    name: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i')
  });
};

// --- Categories ---

export const getFaqCategories = async (req, res) => {
  try {
    const categories = await FaqCategory.find().sort({ createdAt: -1 });
    res.json({ success: true, result: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFaqCategory = async (req, res) => {
  try {
    const { name, color } = req.body;
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return res.status(400).json({ success: false, message: 'Name is required' });
    
    const category = await FaqCategory.create({ name: normalizedName, color });
    res.status(201).json({ success: true, result: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFaqCategory = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if category has faqs
    const faqCount = await Faq.countDocuments({ categoryId: id });
    if (faqCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete category with existing FAQs. Delete FAQs first.' });
    }
    await FaqCategory.findByIdAndDelete(id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Admin FAQs ---

export const getAdminFaqs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      Faq.find().populate('categoryId', 'name color').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Faq.countDocuments()
    ]);

    // Format for existing UI: it expects category to be a string name in the frontend
    const formattedItems = items.map(item => ({
      ...item,
      category: item.categoryId?.name || 'Uncategorized',
      id: item._id
    }));

    res.json({ success: true, result: { items: formattedItems, total, page: parseInt(page) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFaq = async (req, res) => {
  try {
    const { category, audience, question, answer, status } = req.body;
    
    // Find category by name (since frontend sends category name)
    const categoryDoc = await findFaqCategoryByName(category);
    if (!categoryDoc) {
      return res.status(400).json({ success: false, message: 'Category not found' });
    }

    const faq = await Faq.create({
      categoryId: categoryDoc._id,
      audience,
      question,
      answer,
      status: status || 'published'
    });

    res.status(201).json({ success: true, result: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, audience, question, answer, status } = req.body;
    
    const updateData = { audience, question, answer, status };

    if (category) {
      const categoryDoc = await findFaqCategoryByName(category);
      if (categoryDoc) updateData.categoryId = categoryDoc._id;
    }

    const faq = await Faq.findByIdAndUpdate(id, updateData, { new: true });
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });

    res.json({ success: true, result: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFaq = async (req, res) => {
  try {
    await Faq.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Public FAQs ---

export const getPublicFaqs = async (req, res) => {
  try {
    const { audience } = req.query;
    if (!audience) {
      return res.status(400).json({ success: false, message: 'Audience is required' });
    }

    const items = await Faq.find({ audience, status: 'published' })
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Increment views async (don't block response)
    const faqIds = items.map(i => i._id);
    if (faqIds.length > 0) {
      Faq.updateMany({ _id: { $in: faqIds } }, { $inc: { views: 1 } }).catch(console.error);
    }

    const formattedItems = items.map(item => ({
      _id: item._id,
      question: item.question,
      answer: item.answer,
      category: item.categoryId?.name || 'Uncategorized'
    }));

    res.json({ success: true, result: { items: formattedItems } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
