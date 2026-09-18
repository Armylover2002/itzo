import { Job } from '../../admin/models/job.model.js';
import { NotFoundError } from '../../../../core/auth/errors.js';

export const getPublicJobsService = async (query = {}) => {
    const { department, search, featured, page = 1, limit = 20 } = query;
    const filter = { 
        status: 'Active',
        $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gte: new Date() } }
        ]
    };

    if (department) filter.department = department;
    if (featured === 'true') filter.featuredJob = true;

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { role: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Public queries typically only need subset of fields for listing
    const jobs = await Job.find(filter)
        .select('title role department location employmentType experienceRequired salaryRange shortDescription posterImage featuredJob publishDate expiryDate')
        .sort({ displayOrder: -1, publishDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Job.countDocuments(filter);

    return { jobs, total, page: parseInt(page), limit: parseInt(limit) };
};

export const getPublicJobByIdService = async (jobId) => {
    const job = await Job.findOne({
        _id: jobId,
        status: 'Active',
        $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gte: new Date() } }
        ]
    });
    if (!job) throw new NotFoundError('Job not found or no longer active');
    return job;
};
