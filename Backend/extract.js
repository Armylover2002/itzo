const fs = require('fs');
const file = 'e:/itzo folder/itzo/Backend/src/modules/quick-commerce/seller/controllers/seller.controller.js';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '    if (req.body?.name !== undefined)';
const endMarker = '    await seller.save();';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const extractedLogic = content.substring(startIndex, endIndex);
  
  const functionWrapper = \export const updateSellerProfileData = async (seller, req) => {\\n    const files = req.files && typeof req.files === 'object' ? req.files : {};\\n\ + extractedLogic + \};\\n\\n\;
  
  const newControllerBody = \    await updateSellerProfileData(seller, req);\\n\\n\;
  
  content = content.substring(0, startIndex) + newControllerBody + content.substring(endIndex);
  
  const controllerDef = 'export const updateSellerProfileController = async (req, res) => {';
  content = content.replace(controllerDef, functionWrapper + controllerDef);
  
  fs.writeFileSync(file, content);
  console.log('Successfully extracted logic');
} else {
  console.log('Markers not found');
}

