const Firm = require('../models/Firm');
const User = require('../models/User');
const CloudinaryService = require('../services/cloudinaryService');
const { FOLDER_STRUCTURE } = require('../config/fileUpload');
const { logger } = require('../middleware/logger');
const {
  asyncHandler,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

// @desc    Complete CA Admin post-signup profile
// @route   POST /api/firms/complete-profile
// @access  Private (CA-Admin only)
const completeProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  // Verify user is CA-Admin
  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can complete firm profile');
  }

  // Check if firm already exists for this admin
  const existingFirm = await Firm.findByAdmin(userId);
  if (existingFirm) {
    throw new ConflictError('Firm profile already exists. Use update endpoint instead.');
  }

  const {
    // Section 1: Firm Information
    firmName,
    registrationNumber,
    gstin,
    pan,
    officialEmail,
    contactNumber,
    alternateContactNumber,
    address,
    websiteUrl,
    
    // Bank Details (now nested)
    bankDetails,
    
    // Section 2: Admin Profile
    professionalTitle,
    phoneNumber,
    
    // Section 3: Firm Setup Preferences
    primaryServices,
    customServices,
    whatsappNotification,
    emailNotification,
    smsNotification
  } = req.body;

  // Validate required fields
  if (!firmName || !officialEmail || !contactNumber) {
    throw new ValidationError('Firm name, official email, and contact number are required');
  }

  // Handle file uploads
  let firmLogoUrl = null;
  let profilePhotoUrl = null;

  if (req.files) {
    // Upload firm logo if provided
    if (req.files.firmLogo && req.files.firmLogo[0]) {
      const firmLogoResult = await CloudinaryService.uploadFile(
        req.files.firmLogo[0].buffer,
        {
          folder: `${FOLDER_STRUCTURE.FIRMS.LOGOS}/${userId}`,
          resourceType: 'image',
          transformation: {
            width: 800,
            height: 400,
            crop: 'fit',
            quality: 'auto'
          },
          tags: ['firm-logo', `firm-${userId}`]
        }
      );
      firmLogoUrl = firmLogoResult.url;
    }

    // Upload profile photo if provided
    if (req.files.profilePhoto && req.files.profilePhoto[0]) {
      const profilePhotoResult = await CloudinaryService.uploadFile(
        req.files.profilePhoto[0].buffer,
        {
          folder: `${FOLDER_STRUCTURE.USERS.AVATARS}/${userId}`,
          resourceType: 'image',
          transformation: {
            width: 500,
            height: 500,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto'
          },
          tags: ['profile-photo', `user-${userId}`]
        }
      );
      profilePhotoUrl = profilePhotoResult.url;
    }
  }

  // Create firm
  const firm = await Firm.create({
    firmName,
    registrationNumber,
    gstin,
    pan,
    officialEmail,
    contactNumber,
    alternateContactNumber,
    firmLogo: firmLogoUrl,
    address: address || {},
    websiteUrl,
    bankDetails: {
      bankName: bankDetails?.bankName,
      accountHolderName: bankDetails?.accountHolderName,
      accountNumber: bankDetails?.accountNumber,
      ifscCode: bankDetails?.ifscCode,
      accountType: bankDetails?.accountType || 'Current',
      branchName: bankDetails?.branchName
    },
    primaryServices: primaryServices || [],
    customServices: customServices || [],
    whatsappNotification: normalizeBoolean(whatsappNotification, false),
    emailNotification: normalizeBoolean(emailNotification, true),
    smsNotification: normalizeBoolean(smsNotification, false),
    adminId: userId,
    createdBy: userId,  // Add audit trail
    setupCompleted: true
  });

  // Update user profile
  user.firmId = firm._id;
  user.professionalTitle = professionalTitle;
  user.phoneNumber = phoneNumber;
  if (profilePhotoUrl) {
    user.photoURL = profilePhotoUrl;
  }
  user.profileCompleted = true;
  await user.save();

  // Update existing Free subscription with firm ID
  try {
    const Payment = require('../models/Payment');
    await Payment.updateMany(
      { 
        createdBy: userId,
        paymentType: 'subscription',
        planId: { $exists: true },
        firmId: userId // Old placeholder value
      },
      { 
        $set: { 
          firmId: firm._id,
          clientId: firm._id // Update to firm ID for firm-level subscription
        } 
      }
    );
    
    logger.info('Updated Free subscription with firm ID', { userId, firmId: firm._id });
  } catch (error) {
    logger.error('Failed to update subscription with firm ID', { 
      error: error.message, 
      userId, 
      firmId: firm._id 
    });
    // Continue even if update fails
  }

  res.status(201).json({
    success: true,
    message: 'Firm profile completed successfully',
    data: {
      firm,
      user
    }
  });
});

// @desc    Update firm profile
// @route   PUT /api/firms/:id
// @access  Private (CA-Admin only)
const updateFirm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const firm = await Firm.findOne({ _id: id, isDeleted: false });

  if (!firm) {
    throw new NotFoundError('Firm not found');
  }

  // Verify ownership
  if (firm.adminId.toString() !== userId.toString()) {
    throw new AuthorizationError('Not authorized to update this firm');
  }

  const {
    firmName,
    registrationNumber,
    gstin,
    pan,
    officialEmail,
    contactNumber,
    alternateContactNumber,
    address,
    websiteUrl,
    bankDetails,  // Now nested
    primaryServices,
    customServices,
    whatsappNotification,
    emailNotification,
    smsNotification
  } = req.body;

  // Handle firm logo upload if provided
  if (req.file) {
    // Delete old logo if exists
    if (firm.firmLogo) {
      const oldPublicId = CloudinaryService.extractPublicId(firm.firmLogo);
      if (oldPublicId) {
        await CloudinaryService.deleteFile(oldPublicId, 'image').catch(err => {
          // Log error but don't fail the update
          logger.error('Failed to delete old firm logo', { error: err.message, firmId: firm._id });
        });
      }
    }

    // Upload new logo
    const firmLogoResult = await CloudinaryService.uploadFile(
      req.file.buffer,
      {
        folder: `${FOLDER_STRUCTURE.FIRMS.LOGOS}/${userId}`,
        resourceType: 'image',
        transformation: {
          width: 800,
          height: 400,
          crop: 'fit',
          quality: 'auto'
        },
        tags: ['firm-logo', `firm-${userId}`]
      }
    );
    firm.firmLogo = firmLogoResult.url;
  }

  // Update fields
  if (firmName) firm.firmName = firmName;
  if (registrationNumber !== undefined) firm.registrationNumber = registrationNumber;
  if (gstin !== undefined) firm.gstin = gstin;
  if (pan !== undefined) firm.pan = pan;
  if (officialEmail) firm.officialEmail = officialEmail;
  if (contactNumber) firm.contactNumber = contactNumber;
  if (alternateContactNumber !== undefined) firm.alternateContactNumber = alternateContactNumber;
  if (address) firm.address = { ...firm.address, ...address };
  if (websiteUrl !== undefined) firm.websiteUrl = websiteUrl;
  
  // Update bank details (nested structure)
  if (bankDetails) {
    firm.bankDetails = {
      ...firm.bankDetails,
      ...bankDetails
    };
  }
  
  if (primaryServices) firm.primaryServices = primaryServices;
  if (customServices) firm.customServices = customServices;
  if (whatsappNotification !== undefined) {
    firm.whatsappNotification = normalizeBoolean(whatsappNotification, firm.whatsappNotification);
  }
  if (emailNotification !== undefined) {
    firm.emailNotification = normalizeBoolean(emailNotification, firm.emailNotification);
  }
  if (smsNotification !== undefined) {
    firm.smsNotification = normalizeBoolean(smsNotification, firm.smsNotification);
  }
  
  firm.updatedBy = userId;  // Add audit trail

  await firm.save();

  res.status(200).json({
    success: true,
    message: 'Firm updated successfully',
    data: {
      firm
    }
  });
});

// @desc    Get firm by ID
// @route   GET /api/firms/:id
// @access  Private
const getFirm = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const firm = await Firm.findOne({ _id: id, isDeleted: false })
    .populate('adminId', 'name email professionalTitle phoneNumber photoURL');

  if (!firm) {
    throw new NotFoundError('Firm not found');
  }

  // Check authorization - only firm members can view
  const userId = req.user._id.toString();
  const userRole = req.user.role;
  
  if (userRole === 'CA-Admin' && firm.adminId._id.toString() !== userId) {
    throw new AuthorizationError('Not authorized to view this firm');
  }

  res.status(200).json({
    success: true,
    data: {
      firm
    }
  });
});

// @desc    Get current user's firm
// @route   GET /api/firms/my-firm
// @access  Private (CA-Admin, CA-Employee)
const getMyFirm = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user.firmId) {
    throw new NotFoundError('No firm associated with this account');
  }

  const firm = await Firm.findOne({ _id: user.firmId, isDeleted: false })
    .populate('adminId', 'name email professionalTitle phoneNumber photoURL');

  if (!firm) {
    throw new NotFoundError('Firm not found');
  }

  res.status(200).json({
    success: true,
    data: {
      firm
    }
  });
});

// @desc    Update admin profile
// @route   PUT /api/firms/update-profile
// @access  Private (CA-Admin only)
const updateAdminProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can update admin profile');
  }

  const { name, professionalTitle, phoneNumber } = req.body;

  // Handle profile photo upload if provided
  if (req.file) {
    // Delete old photo if exists
    if (user.photoURL) {
      const oldPublicId = CloudinaryService.extractPublicId(user.photoURL);
      if (oldPublicId) {
        await CloudinaryService.deleteFile(oldPublicId, 'image').catch(err => {
          // Log error but don't fail the update
          logger.error('Failed to delete old profile photo', { error: err.message, userId });
        });
      }
    }

    // Upload new photo
    const profilePhotoResult = await CloudinaryService.uploadFile(
      req.file.buffer,
      {
        folder: `${FOLDER_STRUCTURE.USERS.AVATARS}/${userId}`,
        resourceType: 'image',
        transformation: {
          width: 500,
          height: 500,
          crop: 'fill',
          gravity: 'face',
          quality: 'auto'
        },
        tags: ['profile-photo', `user-${userId}`]
      }
    );
    user.photoURL = profilePhotoResult.url;
  }

  if (name) user.name = name;
  if (professionalTitle) user.professionalTitle = professionalTitle;
  if (phoneNumber) user.phoneNumber = phoneNumber;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Admin profile updated successfully',
    data: {
      user
    }
  });
});

// @desc    Delete firm (soft delete)
// @route   DELETE /api/firms/:id
// @access  Private (CA-Admin only)
const deleteFirm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const firm = await Firm.findOne({ _id: id, isDeleted: false });

  if (!firm) {
    throw new NotFoundError('Firm not found');
  }

  // Verify ownership
  if (firm.adminId.toString() !== userId.toString()) {
    throw new AuthorizationError('Not authorized to delete this firm');
  }

  // Soft delete using new method
  await firm.softDelete(userId);

  res.status(200).json({
    success: true,
    message: 'Firm deleted successfully'
  });
});

module.exports = {
  completeProfile,
  updateFirm,
  getFirm,
  getMyFirm,
  updateAdminProfile,
  deleteFirm
};
