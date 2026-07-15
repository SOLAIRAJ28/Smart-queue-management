import { MongoClient } from 'mongodb';

const LOCAL_URI = 'mongodb://127.0.0.1:27017/smart_queue';
const ATLAS_URI = 'mongodb+srv://solairaj495:8056453211@cluster0.tr9nu5q.mongodb.net/smart_queue';

const migrate = async () => {
  let localClient, atlasClient;
  
  try {
    console.log('🔗 Connecting to local MongoDB...');
    localClient = new MongoClient(LOCAL_URI);
    await localClient.connect();
    const localDb = localClient.db('smart_queue');
    
    console.log('🔗 Connecting to Atlas...');
    atlasClient = new MongoClient(ATLAS_URI);
    await atlasClient.connect();
    const atlasDb = atlasClient.db('smart_queue');
    
    // Get all collections from local
    const collections = await localDb.listCollections().toArray();
    console.log(`\n📦 Found ${collections.length} collections to migrate:\n`);
    
    for (const col of collections) {
      const name = col.name;
      const localCollection = localDb.collection(name);
      const atlasCollection = atlasDb.collection(name);
      
      const docs = await localCollection.find({}).toArray();
      
      if (docs.length === 0) {
        console.log(`  ⏭️  ${name}: 0 documents (skipped)`);
        continue;
      }
      
      // Clear existing data in Atlas for this collection
      await atlasCollection.deleteMany({});
      
      // Insert all documents
      await atlasCollection.insertMany(docs);
      console.log(`  ✅ ${name}: ${docs.length} documents migrated`);
    }
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('All data from local MongoDB has been transferred to Atlas.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    if (localClient) await localClient.close();
    if (atlasClient) await atlasClient.close();
    process.exit(0);
  }
};

migrate();
