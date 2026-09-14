import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const addonPayloadSchema = z.object({
    name: z.string().min(1, 'Add-on name is required').max(200),
    description: z.string().max(2000).optional().default(''),
    price: z.coerce.number().min(0, 'Price must be >= 0'),
    image: z.string().max(2000).optional().default(''),
    images: z.array(z.string().max(2000)).max(10).optional().default([]),
    foodType: z.enum(['Veg', 'Non-Veg']).default('Veg')
});

const listSchema = z.object({
    includeDeleted: z.coerce.boolean().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(80).optional()
});

const updateSchema = z.object({
    draft: addonPayloadSchema.partial().optional(),
    isAvailable: z.boolean().optional()
});

export const validateAddonListQuery = (query) => {
    const result = listSchema.safeParse(query);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid query');
    }
    return result.data;
};

export const validateAddonCreateDto = (body) => {
    const result = addonPayloadSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid add-on data');
    }
    const d = result.data;
    const images = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
    const image = d.image || images[0] || '';
    return { ...d, images, image };
};

export const validateAddonUpdateDto = (body) => {
    const result = updateSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid add-on data');
    }
    const d = result.data;
    let draft = d.draft;
    if (draft) {
        const images = Array.isArray(draft.images) ? draft.images.filter(Boolean) : undefined;
        const image = draft.image !== undefined ? draft.image : (images && images[0]) ? images[0] : undefined;
        draft = { ...draft, ...(images !== undefined ? { images } : {}), ...(image !== undefined ? { image } : {}) };
    }
    return { ...d, ...(draft ? { draft } : {}) };
};

