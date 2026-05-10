const Client = require('../models/Client');
const User = require('../models/User');
const Firm = require('../models/Firm');
const emailService = require('../services/emailService');
const { WORKSPACE_DOCUMENT_SOURCE } = require('../services/documentWorkspaceService');
const {
  asyncHandler,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');

// @desc    Add new client company
// @route   POST /api/clients
// @access  Private (CA-Admin only)
const addClient = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  // Verify user is CA-Admin
  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can add clients');
  }

  // Verify user has a firm
  if (!user.firmId) {
    throw new ValidationError('You must complete your firm profile before adding clients');
  }

  const { 
    companyName, 
    email, 
    phoneNumber, 
    companyType, 
    gstin, 
    pan, 
    tan,
    cin,
    alternatePhoneNumber,
    address,
    contactPerson
  } = req.body;

  // Check if client with this email already exists
  const existingClient = await Client.findByEmail(email);
  if (existingClient) {
    throw new ConflictError('A client with this email already exists');
  }

  // Generate unique user ID and password
  const generatedUserId = await Client.generateUserId(user.firmId);
  const generatedPassword = Client.generatePassword();

  // Prepare client data
  const clientData = {
    companyName,
    email,
    phoneNumber,
    companyType,
    userId: generatedUserId,
    firmId: user.firmId,
    createdBy: userId
  };

  // Add optional fields if provided
  if (gstin) clientData.gstin = gstin;
  if (pan) clientData.pan = pan;
  if (tan) clientData.tan = tan;
  if (cin) clientData.cin = cin;
  if (alternatePhoneNumber) clientData.alternatePhoneNumber = alternatePhoneNumber;
  if (address) clientData.address = address;
  if (contactPerson) clientData.contactPerson = contactPerson;

  // Create client
  const client = await Client.create(clientData);

  // Automatically create user account for the client
  const clientUser = await User.create({
    email: client.email,
    name: client.companyName,
    password: generatedPassword,
    role: 'Client',
    firmId: client.firmId,
    clientProfileId: client._id,  // Link to client profile
    isEmailVerified: false,
    createdBy: userId  // Add audit trail
  });

  // Update client with user account reference
  client.userAccountId = clientUser._id;
  client.accountCreated = true;
  await client.save();

  // Get firm details for email
  const firm = await Firm.findByAdmin(user._id);
  const firmName = firm ? firm.firmName : user.name;

  // Send welcome email with credentials
  try {
    await emailService.sendClientWelcomeEmail({
      email: client.email,
      companyName: client.companyName,
      userId: generatedUserId,
      password: generatedPassword,
      firmName: firmName
    });
    
    await client.recordInvitation();  // Use new method
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // Don't fail the request if email fails
  }

  // Return client with credentials (only on creation)
  const clientResponse = client.toObject();
  clientResponse.credentials = {
    userId: generatedUserId,
    password: generatedPassword
  };

  res.status(201).json({
    success: true,
    message: 'Client added successfully. User account created and credentials sent to client email.',
    data: {
      client: clientResponse
    }
  });
});

// @desc    Get all clients for the firm
// @route   GET /api/clients
// @access  Private (CA-Admin, CA-Employee)
const getClients = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user.firmId) {
    throw new ValidationError('No firm associated with this account');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Filters (add isDeleted filter)
  const filters = { firmId: user.firmId, isDeleted: false };
  
  if (req.query.companyType) {
    filters.companyType = req.query.companyType;
  }

  if (req.query.search) {
    filters.$or = [
      { companyName: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
      { userId: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const clients = await Client.find(filters)
    .populate('userAccountId', 'name email lastLogin photoURL')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // Use lean for better performance

  // Get document counts for all clients
  const Document = require('../models/Document');
  const clientIds = clients.map(c => c._id);
  
  const documentCounts = await Document.aggregate([
    {
      $match: {
        clientId: { $in: clientIds },
        isDeleted: false,
        documentSource: WORKSPACE_DOCUMENT_SOURCE,
      }
    },
    {
      $group: {
        _id: '$clientId',
        count: { $sum: 1 }
      }
    }
  ]);

  // Create a map of clientId -> document count
  const countMap = {};
  documentCounts.forEach(item => {
    countMap[item._id.toString()] = item.count;
  });

  // Add document count to each client
  const clientsWithCounts = clients.map(client => ({
    ...client,
    totalDocuments: countMap[client._id.toString()] || 0
  }));

  const total = await Client.countDocuments(filters);

  res.status(200).json({
    success: true,
    data: {
      clients: clientsWithCounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get single client by ID
// @route   GET /api/clients/:id
// @access  Private (CA-Admin, CA-Employee)
const getClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id);

  const client = await Client.findOne({ _id: id, isDeleted: false })
    .populate('userAccountId', 'name email lastLogin photoURL')
    .populate('firmId', 'firmName officialEmail contactNumber');

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Verify client belongs to user's firm
  if (client.firmId._id.toString() !== user.firmId.toString()) {
    throw new AuthorizationError('Not authorized to view this client');
  }

  res.status(200).json({
    success: true,
    data: {
      client
    }
  });
});

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private (CA-Admin only)
const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can update clients');
  }

  const client = await Client.findOne({ _id: id, isDeleted: false });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Verify client belongs to user's firm
  if (client.firmId.toString() !== user.firmId.toString()) {
    throw new AuthorizationError('Not authorized to update this client');
  }

  const { 
    companyName, 
    email, 
    phoneNumber, 
    companyType, 
    gstin, 
    pan, 
    tan,
    cin,
    alternatePhoneNumber,
    address,
    contactPerson
  } = req.body;

  // If email is being changed, check for conflicts
  if (email && email !== client.email) {
    const existingClient = await Client.findOne({ email, _id: { $ne: id }, isDeleted: false });
    if (existingClient) {
      throw new ConflictError('A client with this email already exists');
    }
  }

  // Update fields
  if (companyName) client.companyName = companyName;
  if (email) client.email = email;
  if (phoneNumber) client.phoneNumber = phoneNumber;
  if (companyType) client.companyType = companyType;
  if (gstin !== undefined) client.gstin = gstin;
  if (pan !== undefined) client.pan = pan;
  if (tan !== undefined) client.tan = tan;
  if (cin !== undefined) client.cin = cin;
  if (alternatePhoneNumber !== undefined) client.alternatePhoneNumber = alternatePhoneNumber;
  if (address) client.address = { ...client.address, ...address };
  if (contactPerson) client.contactPerson = { ...client.contactPerson, ...contactPerson };
  
  client.updatedBy = userId;  // Add audit trail

  await client.save();

  res.status(200).json({
    success: true,
    message: 'Client updated successfully',
    data: {
      client
    }
  });
});

// @desc    Delete client (soft delete)
// @route   DELETE /api/clients/:id
// @access  Private (CA-Admin only)
const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can delete clients');
  }

  const client = await Client.findOne({ _id: id, isDeleted: false });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Verify client belongs to user's firm
  if (client.firmId.toString() !== user.firmId.toString()) {
    throw new AuthorizationError('Not authorized to delete this client');
  }

  // Soft delete using new method
  await client.softDelete(userId);

  res.status(200).json({
    success: true,
    message: 'Client deleted successfully'
  });
});

// @desc    Resend client credentials
// @route   POST /api/clients/:id/resend-credentials
// @access  Private (CA-Admin only)
const resendCredentials = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA Admins can resend credentials');
  }

  const client = await Client.findOne({ _id: id, isDeleted: false });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Verify client belongs to user's firm
  if (client.firmId.toString() !== user.firmId.toString()) {
    throw new AuthorizationError('Not authorized to access this client');
  }

  // Get password from User model
  const clientUser = await User.findById(client.userAccountId).select('+password');
  if (!clientUser) {
    throw new NotFoundError('Client user account not found');
  }

  // Generate new password
  const newPassword = Client.generatePassword();
  clientUser.password = newPassword;
  await clientUser.save();

  const firm = await Firm.findByAdmin(user._id);

  // Resend welcome email with new credentials
  try {
    await emailService.sendClientWelcomeEmail({
      email: client.email,
      companyName: client.companyName,
      userId: client.userId,
      password: newPassword,
      firmName: firm.firmName
    });
    
    await client.recordInvitation();  // Use new method

    res.status(200).json({
      success: true,
      message: 'New credentials sent successfully to client email'
    });
  } catch (emailError) {
    console.error('Failed to send credentials email:', emailError);
    throw new ValidationError('Failed to send email. Please try again later.');
  }
});

module.exports = {
  addClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
  resendCredentials
};
