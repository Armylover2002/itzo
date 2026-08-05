import { GlobalSettings } from '../models/settings.model.js';
import { sendResponse } from '../../../utils/response.js';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { uploadImageBufferDetailed, uploadBufferDetailed, uploadFileDetailed } from '../../../services/upload.service.js';
import { updateSettingsCache } from '../utils/settingsCache.js';

export async function getGlobalSettings(req, res, next) {
    try {
        let settings = await GlobalSettings.findOne();
        if (!settings) {
            try {
                settings = await GlobalSettings.create({
                    companyName: 'Appzeto',
                    email: 'admin@appzeto.com'
                });
            } catch (err) {
                // If duplicate key error occurs due to concurrent requests, re-query
                settings = await GlobalSettings.findOne();
            }
        }

        const rawSettings = settings && typeof settings.toObject === 'function' 
            ? settings.toObject() 
            : (settings ? { ...settings } : { companyName: 'Appzeto', email: 'admin@appzeto.com', modules: {} });

        const allowedModules = ['food', 'quickCommerce'];
        const cleanedModules = {};
        
        allowedModules.forEach(mod => {
            cleanedModules[mod] = (rawSettings.modules && rawSettings.modules[mod] !== undefined) 
                ? !!rawSettings.modules[mod] 
                : true;
        });
        rawSettings.modules = cleanedModules;

        return sendResponse(res, 200, 'Global settings fetched successfully', rawSettings);
    } catch (error) {
        next(error);
    }
}

export async function updateGlobalSettings(req, res, next) {
    try {
        let data = {};
        if (req.body.data) {
            try {
                data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch (e) {
                console.error("Error parsing settings data:", e);
                data = req.body;
            }
        } else {
            data = req.body;
        }
        
        const { 
            companyName, email, customerSupportEmail, partnershipEmail, helpAndSupportEmail, phoneCountryCode, phoneNumber, address, state, pincode, region, 
            legalName, gstin, fssai, panNumber, cinNumber,
            adminLogoUrl, adminFaviconUrl, userLogoUrl, userFaviconUrl, deliveryLogoUrl, deliveryFaviconUrl, restaurantLogoUrl, restaurantFaviconUrl, sellerLogoUrl, sellerFaviconUrl,
            themeColor, modules, landingHeroTitle, landingHeroSubtitle, landingVideoUrl, landingPosterUrl, userLoginVideoUrl,
            socialLinkedinUrl, socialInstagramUrl, socialYoutubeUrl, socialFacebookUrl, socialTwitterUrl, playStoreLink, appStoreLink,
            enableFemaleContactProtection, companySupportNumber, companyWhatsappNumber, privacyMessage,
            benefitsSectionEnabled, benefitsImageAlt, benefitsImageLink
        } = data;
        
        console.log("Updating global settings with data:", data);

        // Validation
        if (companyName !== undefined && (!companyName || companyName.trim().length < 2 || companyName.trim().length > 50)) {
            return res.status(400).json({ success: false, message: 'Company name must be between 2 and 50 characters' });
        }
        
        if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        
        if (phoneNumber && !/^\d{7,15}$/.test(phoneNumber.trim())) {
            return res.status(400).json({ success: false, message: 'Invalid phone number (7-15 digits required)' });
        }

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = new GlobalSettings();
        }

        if (companyName) settings.companyName = companyName;
        if (email) settings.email = email;
        if (customerSupportEmail !== undefined) settings.customerSupportEmail = customerSupportEmail;
        if (enableFemaleContactProtection !== undefined) settings.enableFemaleContactProtection = enableFemaleContactProtection;
        if (companySupportNumber !== undefined) settings.companySupportNumber = companySupportNumber;
        if (companyWhatsappNumber !== undefined) settings.companyWhatsappNumber = companyWhatsappNumber;
        if (privacyMessage !== undefined) settings.privacyMessage = privacyMessage;
        if (partnershipEmail !== undefined) settings.partnershipEmail = partnershipEmail;
        if (helpAndSupportEmail !== undefined) settings.helpAndSupportEmail = helpAndSupportEmail;
        if (phoneCountryCode || phoneNumber) {
            settings.phone = {
                countryCode: phoneCountryCode || settings.phone?.countryCode || '+91',
                number: phoneNumber || settings.phone?.number || ''
            };
        }
        if (address !== undefined) settings.address = address;
        if (state !== undefined) settings.state = state;
        if (pincode !== undefined) settings.pincode = pincode;
        if (region) settings.region = region;
        if (legalName !== undefined) settings.legalName = legalName;
        if (gstin !== undefined) settings.gstin = gstin;
        if (fssai !== undefined) settings.fssai = fssai;
        if (panNumber !== undefined) settings.panNumber = panNumber;
        if (cinNumber !== undefined) settings.cinNumber = cinNumber;
        if (landingHeroTitle !== undefined) settings.landingHeroTitle = landingHeroTitle;
        if (landingHeroSubtitle !== undefined) settings.landingHeroSubtitle = landingHeroSubtitle;
        if (socialLinkedinUrl !== undefined) settings.socialLinkedinUrl = socialLinkedinUrl;
        if (socialInstagramUrl !== undefined) settings.socialInstagramUrl = socialInstagramUrl;
        if (socialYoutubeUrl !== undefined) settings.socialYoutubeUrl = socialYoutubeUrl;
        if (socialFacebookUrl !== undefined) settings.socialFacebookUrl = socialFacebookUrl;
        if (socialTwitterUrl !== undefined) settings.socialTwitterUrl = socialTwitterUrl;
        if (playStoreLink !== undefined) settings.playStoreLink = playStoreLink;
        if (appStoreLink !== undefined) settings.appStoreLink = appStoreLink;
        if (benefitsSectionEnabled !== undefined) {
            settings.benefitsSectionEnabled = benefitsSectionEnabled === true || benefitsSectionEnabled === 'true';
        }
        if (benefitsImageAlt !== undefined) {
            settings.benefitsImageAlt = String(benefitsImageAlt || '').trim();
        }
        if (benefitsImageLink !== undefined) {
            settings.benefitsImageLink = String(benefitsImageLink || '').trim();
        }

        // Update URLs if provided
        const mediaFields = [
            'adminLogo', 'adminFavicon', 'userLogo', 'userFavicon', 
            'deliveryLogo', 'deliveryFavicon', 'restaurantLogo', 'restaurantFavicon', 
            'sellerLogo', 'sellerFavicon',
            'userLoginBanner1', 'userLoginBanner2', 'userLoginBanner3', 'userLoginBanner4', 'userLoginBanner5', 'userLoginVideo',
            'landingPoster', 'landingVideo', 'landingPizzaImage', 'landingTomatoImage', 'landingQrCodeImage',
            'landingAppStoreBadge', 'landingPlayStoreBadge', 'landingFooterLogo', 'landingNavbarLogo',
            'benefitsImage'
        ];
        mediaFields.forEach(field => {
            const urlKey = `${field}Url`;
            if (data[urlKey] !== undefined) {
                const newUrl = String(data[urlKey] || '').trim();
                if (newUrl === '' && settings[field]?.publicId) {
                    const isVideo = field === 'landingVideo' || field === 'userLoginVideo';
                    cloudinary.uploader.destroy(
                        settings[field].publicId, 
                        { resource_type: isVideo ? 'video' : 'image' }
                    ).catch(() => {});
                    settings[field] = {
                        url: '',
                        publicId: ''
                    };
                } else {
                    settings[field] = {
                        url: newUrl,
                        publicId: settings[field]?.publicId || ''
                    };
                }
                settings.markModified(field);
            }
        });
        if (themeColor !== undefined) {
            settings.themeColor = themeColor;
        }

        // Strictly define modules and ensure persistence
        const incomingModules = modules || data.modules;
        const currentModules = settings.modules || { food: true, quickCommerce: true };
        
        settings.modules = {
            food: (incomingModules && incomingModules.food !== undefined) ? !!incomingModules.food : !!currentModules.food,
            quickCommerce: (incomingModules && incomingModules.quickCommerce !== undefined) ? !!incomingModules.quickCommerce : !!currentModules.quickCommerce
        };
        
        // Use markModified to ensure the modules object is fully replaced in DB
        settings.markModified('modules');

        // Handle file uploads
        if (req.files) {
            const limits = {
                landingVideo: 100 * 1024 * 1024,
                userLoginVideo: 100 * 1024 * 1024,
                landingPoster: 10 * 1024 * 1024,
                landingPizzaImage: 10 * 1024 * 1024,
                landingTomatoImage: 10 * 1024 * 1024,
                landingQrCodeImage: 10 * 1024 * 1024,
                landingAppStoreBadge: 10 * 1024 * 1024,
                landingPlayStoreBadge: 10 * 1024 * 1024,
                landingFooterLogo: 10 * 1024 * 1024,
                landingNavbarLogo: 10 * 1024 * 1024,
                benefitsImage: 10 * 1024 * 1024
            };

            for (const [fieldName, maxBytes] of Object.entries(limits)) {
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    if (req.files[fieldName][0].size > maxBytes) {
                        const maxMB = maxBytes / (1024 * 1024);
                        return res.status(413).json({ 
                            success: false, 
                            message: (fieldName === 'landingVideo' || fieldName === 'userLoginVideo')
                                ? `Video size exceeds the maximum allowed limit. Please upload a video smaller than ${maxMB} MB.`
                                : `Image size exceeds the maximum allowed limit. Please upload an image smaller than ${maxMB} MB.`
                        });
                    }
                }
            }

            const mediaUploadFields = [
                { name: 'adminLogo', folder: 'business/logos/admin' },
                { name: 'adminFavicon', folder: 'business/favicons/admin' },
                { name: 'userLogo', folder: 'business/logos/user' },
                { name: 'userFavicon', folder: 'business/favicons/user' },
                { name: 'deliveryLogo', folder: 'business/logos/delivery' },
                { name: 'deliveryFavicon', folder: 'business/favicons/delivery' },
                { name: 'restaurantLogo', folder: 'business/logos/restaurant' },
                { name: 'restaurantFavicon', folder: 'business/favicons/restaurant' },
                { name: 'sellerLogo', folder: 'business/logos/seller' },
                { name: 'sellerFavicon', folder: 'business/favicons/seller' },
                { name: 'userLoginBanner1', folder: 'business/banners/user' },
                { name: 'userLoginBanner2', folder: 'business/banners/user' },
                { name: 'userLoginBanner3', folder: 'business/banners/user' },
                { name: 'userLoginBanner4', folder: 'business/banners/user' },
                { name: 'userLoginBanner5', folder: 'business/banners/user' },
                { name: 'userLoginVideo', folder: 'business/banners/user' },
                { name: 'landingPoster', folder: 'business/landing' },
                { name: 'landingVideo', folder: 'business/landing' },
                { name: 'landingPizzaImage', folder: 'business/landing' },
                { name: 'landingTomatoImage', folder: 'business/landing' },
                { name: 'landingQrCodeImage', folder: 'business/landing' },
                { name: 'landingAppStoreBadge', folder: 'business/landing' },
                { name: 'landingPlayStoreBadge', folder: 'business/landing' },
                { name: 'landingFooterLogo', folder: 'business/landing' },
                { name: 'landingNavbarLogo', folder: 'business/landing' },
                { name: 'benefitsImage', folder: 'business/landing' }
            ];

            for (const field of mediaUploadFields) {
                if (req.files[field.name] && req.files[field.name][0]) {
                    let result;
                    const fileObj = req.files[field.name][0];
                    if (fileObj.path) {
                        if (field.name === 'landingVideo' || field.name === 'userLoginVideo') {
                            result = await uploadFileDetailed(fileObj.path, { folder: field.folder, resourceType: 'video' });
                        } else {
                            result = await uploadFileDetailed(fileObj.path, { folder: field.folder, resourceType: 'image' });
                        }
                    } else if (fileObj.buffer) {
                        if (field.name === 'landingVideo' || field.name === 'userLoginVideo') {
                            result = await uploadBufferDetailed(fileObj.buffer, { folder: field.folder, resourceType: 'video' });
                        } else {
                            result = await uploadImageBufferDetailed(fileObj.buffer, field.folder);
                        }
                    }
                    
                    // Cleanup old asset if it exists
                    if (settings[field.name]?.publicId) {
                        const isVideo = field.name === 'landingVideo' || field.name === 'userLoginVideo';
                        cloudinary.uploader.destroy(
                            settings[field.name].publicId,
                            { resource_type: isVideo ? 'video' : 'image' }
                        ).catch(() => {});
                    }

                    settings[field.name] = {
                        url: result.secure_url,
                        publicId: result.public_id
                    };
                    settings.markModified(field.name);
                }
            }
        }

        await settings.save();
        updateSettingsCache(settings);
        return sendResponse(res, 200, 'Global settings updated successfully', settings);
    } catch (error) {
        next(error);
    } finally {
        // Robust cleanup of any temporary files uploaded to disk
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(fileObj => {
                    if (fileObj.path) {
                        try {
                            if (fs.existsSync(fileObj.path)) {
                                fs.unlinkSync(fileObj.path);
                            }
                        } catch (e) {
                            console.error('Failed to cleanup temp file in finally:', fileObj.path, e);
                        }
                    }
                });
            });
        }
    }
}
