const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

const Resource = mongoose.model('Resource', new mongoose.Schema({
  uploadedBy: mongoose.Schema.Types.ObjectId,
  uploaderRole: String,
  type: String,
  fileName: String,
  filePath: String,
  title: String,
  description: String,
  approved: Boolean,
  createdAt: Date
}));

async function fixPaths() {
  const resources = await Resource.find({});
  
  for (const resource of resources) {
    const correctFolder = resource.type === 'audio' ? 'audio' :
                         resource.type === 'video' ? 'video' :
                         resource.type === 'article' ? 'pdfarticle' : null;
    
    if (!correctFolder) continue;
    
    const fileName = path.basename(resource.filePath);
    const oldPath = path.join(__dirname, resource.filePath);
    const newPath = path.join(__dirname, `backend/uploads/${correctFolder}/${fileName}`);
    
    if (fs.existsSync(oldPath) && !resource.filePath.includes(`/${correctFolder}/`)) {
      try {
        fs.renameSync(oldPath, newPath);
        resource.filePath = `backend/uploads/${correctFolder}/${fileName}`;
        await resource.save();
        console.log(`✅ Fixed: ${fileName}`);
      } catch (err) {
        console.log(`❌ Error: ${fileName} - ${err.message}`);
      }
    }
  }
  
  console.log('Done!');
  mongoose.connection.close();
}

fixPaths();