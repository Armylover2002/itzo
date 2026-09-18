import { Job } from '../models/job.model.js';
import { NotFoundError, ValidationError } from '../../../../core/auth/errors.js';

export const createJobService = async (jobData, adminId) => {
    const job = new Job({ ...jobData, createdBy: adminId });
    await job.save();
    return job;
};

export const updateJobService = async (jobId, jobData) => {
    const job = await Job.findByIdAndUpdate(jobId, jobData, { new: true });
    if (!job) throw new NotFoundError('Job not found');
    return job;
};

export const deleteJobService = async (jobId) => {
    const job = await Job.findByIdAndDelete(jobId);
    if (!job) throw new NotFoundError('Job not found');
    return true;
};

export const getAdminJobsService = async (query = {}) => {
    const { status, featuredJob, department, search, page = 1, limit = 10 } = query;
    const filter = {};

    if (status) filter.status = status;
    if (featuredJob !== undefined) filter.featuredJob = featuredJob === 'true';
    if (department) filter.department = department;

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { role: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const jobs = await Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Job.countDocuments(filter);

    return { jobs, total, page: parseInt(page), limit: parseInt(limit) };
};

export const getAdminJobByIdService = async (jobId) => {
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('Job not found');
    return job;
};

export const toggleFeaturedJobService = async (jobId) => {
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('Job not found');
    job.featuredJob = !job.featuredJob;
    await job.save();
    return job;
};

export const updateJobStatusService = async (jobId, status) => {
    if (!['Active', 'Inactive', 'Draft', 'Closed'].includes(status)) {
        throw new ValidationError('Invalid status');
    }
    const job = await Job.findByIdAndUpdate(jobId, { status }, { new: true });
    if (!job) throw new NotFoundError('Job not found');
    return job;
};
