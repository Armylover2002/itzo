import { FoodPageContent } from '../models/pageContent.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const normalizeKey = (key) => String(key || '').trim().toLowerCase();

const decodeHtmlEntities = (value) => {
    if (value === null || value === undefined) return value;
    let s = String(value);
    if (!s.includes('&')) return s;
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
};

const normalizeFaqs = (faqs = []) => {
    if (!Array.isArray(faqs)) return [];
    return faqs
        .map((item, idx) => ({
            question: decodeHtmlEntities(String(item?.question || '')).trim(),
            answer: decodeHtmlEntities(String(item?.answer || '')).trim(),
            order: Number.isFinite(Number(item?.order)) ? Number(item.order) : idx,
        }))
        .filter((item) => item.question || item.answer)
        .sort((a, b) => a.order - b.order);
};

const normalizeLegalForResponse = (legal) => {
    if (!legal || typeof legal !== 'object') return legal;
    const title = legal.title ?? '';
    const content = decodeHtmlEntities(legal.content ?? '');
    return {
        ...legal,
        title,
        content,
        contactNumber: String(legal.contactNumber ?? '').trim(),
        email: String(legal.email ?? '').trim(),
        faqs: normalizeFaqs(legal.faqs),
    };
};

const normalizeAboutForResponse = (about) => {
    if (!about || typeof about !== 'object') return about;
    return {
        ...about,
        appName: decodeHtmlEntities(about.appName ?? ''),
        version: decodeHtmlEntities(about.version ?? ''),
        description: decodeHtmlEntities(about.description ?? ''),
        logo: decodeHtmlEntities(about.logo ?? '')
    };
};

export const getPublicPageByKey = async (key, role = 'user') => {
    const k = normalizeKey(key);
    const r = String(role || 'user').toLowerCase();
    
    const doc = await FoodPageContent.findOne({ key: k, role: r }).lean();
    if (!doc) return { key: k, role: r, data: null };
    if (k === 'about') return { key: k, role: r, data: normalizeAboutForResponse(doc.about || null) };
    return { key: k, role: r, data: normalizeLegalForResponse(doc.legal || null) };
};

export const getAdminPageByKey = async (key, role = 'user') => getPublicPageByKey(key, role);

export const upsertLegalPage = async (key, payload, updatedBy, role = 'user') => {
    const k = normalizeKey(key);
    const r = String(role || 'user').toLowerCase();
    
    if (!['terms', 'privacy', 'support', 'refund', 'shipping', 'cancellation'].includes(k)) {
        throw new ValidationError('Invalid page key');
    }
    const title = String(payload?.title || '').trim();
    const content = decodeHtmlEntities(String(payload?.content || '')).trim();
    const legal = { title, content };

    if (k === 'support') {
        const contactNumber = String(payload?.contactNumber || '').replace(/\D/g, '').trim();
        if (contactNumber && !/^\d{10}$/.test(contactNumber)) {
            throw new ValidationError('Contact number must be exactly 10 digits');
        }
        legal.contactNumber = contactNumber;
        legal.email = String(payload?.email || '').trim().toLowerCase();
        legal.faqs = normalizeFaqs(payload?.faqs);
    }

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: k, role: r },
        {
            $set: {
                key: k,
                role: r,
                legal,
                about: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: k, role: r, data: normalizeLegalForResponse(doc?.legal || null) };
};

export const upsertAboutPage = async (payload, updatedBy) => {
    const appName = decodeHtmlEntities(String(payload?.appName || '')).trim() || 'Appzeto Food';
    const version = decodeHtmlEntities(String(payload?.version || '')).trim() || '1.0.0';
    const description = decodeHtmlEntities(String(payload?.description || '')).trim();
    const logo = decodeHtmlEntities(String(payload?.logo || '')).trim();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const stats = Array.isArray(payload?.stats) ? payload.stats : [];

    const normalizedFeatures = features.map((f, idx) => ({
        icon: String(f?.icon || 'Heart'),
        title: String(f?.title || ''),
        description: String(f?.description || ''),
        color: String(f?.color || ''),
        bgColor: String(f?.bgColor || ''),
        order: Number.isFinite(Number(f?.order)) ? Number(f.order) : idx
    }));

    const doc = await FoodPageContent.findOneAndUpdate(
        { key: 'about', role: 'all' },
        {
            $set: {
                key: 'about',
                role: 'all',
                about: { appName, version, description, logo, features: normalizedFeatures, stats },
                legal: undefined,
                updatedBy: updatedBy || null,
                updatedByRole: 'ADMIN'
            }
        },
        { upsert: true, new: true }
    ).lean();

    return { key: 'about', role: 'all', data: normalizeAboutForResponse(doc?.about || null) };
};

